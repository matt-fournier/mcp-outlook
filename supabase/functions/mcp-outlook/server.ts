/**
 * Deno-compatible MCP server handler.
 *
 * The official StreamableHTTPServerTransport relies on @hono/node-server
 * which calls `outgoing.writeHead()` — a Node-only API that doesn't exist
 * in the Supabase/Deno edge runtime.
 *
 * This module implements the MCP JSON-RPC protocol manually over plain
 * HTTP POST, which is fully compatible with Deno's Web API Request/Response.
 *
 * NOTE: In the Deno npm: runtime, Zod's `_def.typeName` is always
 * `undefined`. We use `constructor.name` instead for type detection.
 */

import { z, type ZodRawShape } from "npm:zod";
import { corsHeaders } from "./cors.ts";
import { allTools } from "./tools/index.ts";
import type { AuthUser } from "./types.ts";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  // deno-lint-ignore no-explicit-any
  zodSchema: z.ZodObject<any>;
  handler: (args: Record<string, unknown>) => Promise<{
    content: { type: string; text: string }[];
    isError?: boolean;
  }>;
}

interface JsonRpcRequest {
  jsonrpc: string;
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Zod → JSON Schema converter (uses constructor.name, not typeName)  */
/* ------------------------------------------------------------------ */

/**
 * Get the Zod type name reliably across Node and Deno runtimes.
 * In Deno's npm: runtime, `_def.typeName` is undefined,
 * but `constructor.name` works correctly.
 */
// deno-lint-ignore no-explicit-any
function zodTypeName(field: any): string {
  return field?._def?.typeName ?? field?.constructor?.name ?? "";
}

/**
 * Unwrap all Zod wrapper layers (Default, Optional, Nullable, Effects)
 * and return the core field plus metadata collected along the way.
 */
// deno-lint-ignore no-explicit-any
function unwrapZod(field: any): {
  // deno-lint-ignore no-explicit-any
  core: any;
  // deno-lint-ignore no-explicit-any
  defaultValue?: any;
  description?: string;
} {
  // deno-lint-ignore no-explicit-any
  let current: any = field;
  // deno-lint-ignore no-explicit-any
  let defaultValue: any = undefined;
  let description: string | undefined = undefined;

  for (let i = 0; i < 10; i++) {
    const def = current?._def;
    if (!def) break;

    if (def.description && !description) {
      description = def.description;
    }

    const tn = zodTypeName(current);

    if (tn === "ZodDefault") {
      defaultValue = typeof def.defaultValue === "function"
        ? def.defaultValue()
        : def.defaultValue;
      current = def.innerType;
      continue;
    }
    if (tn === "ZodOptional" || tn === "ZodNullable") {
      current = def.innerType;
      continue;
    }
    if (tn === "ZodEffects") {
      current = def.schema;
      continue;
    }

    // Reached a non-wrapper type
    break;
  }

  // Capture description from the innermost layer too
  if (!description && current?._def?.description) {
    description = current._def.description;
  }

  return { core: current, defaultValue, description };
}

// deno-lint-ignore no-explicit-any
function zodFieldToJsonSchema(field: any): Record<string, unknown> {
  const { core, defaultValue, description } = unwrapZod(field);
  const schema: Record<string, unknown> = {};
  const tn = zodTypeName(core);
  const def = core?._def;

  switch (tn) {
    case "ZodString": {
      schema.type = "string";
      for (const check of def?.checks ?? []) {
        if (check.kind === "email") schema.format = "email";
        if (check.kind === "url") schema.format = "uri";
        if (check.kind === "min") schema.minLength = check.value;
        if (check.kind === "max") schema.maxLength = check.value;
      }
      break;
    }
    case "ZodNumber": {
      schema.type = "number";
      for (const check of def?.checks ?? []) {
        if (check.kind === "min") schema.minimum = check.value;
        if (check.kind === "max") schema.maximum = check.value;
        if (check.kind === "int") schema.type = "integer";
      }
      break;
    }
    case "ZodBoolean":
      schema.type = "boolean";
      break;
    case "ZodEnum":
      schema.type = "string";
      schema.enum = def?.values;
      break;
    case "ZodArray":
      schema.type = "array";
      schema.items = zodFieldToJsonSchema(def?.type);
      break;
    case "ZodLiteral":
      schema.const = def?.value;
      break;
    default:
      schema.type = "string";
      break;
  }

  if (defaultValue !== undefined) schema.default = defaultValue;
  if (description) schema.description = description;

  return schema;
}

function zodShapeToJsonSchema(shape: ZodRawShape): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, field] of Object.entries(shape)) {
    properties[key] = zodFieldToJsonSchema(field);

    // Use Zod's .isOptional() — returns true for ZodOptional & ZodDefault
    // deno-lint-ignore no-explicit-any
    const isOpt = typeof (field as any).isOptional === "function"
      // deno-lint-ignore no-explicit-any
      ? (field as any).isOptional()
      : false;
    if (!isOpt) {
      required.push(key);
    }
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

/* ------------------------------------------------------------------ */
/*  McpServer shim (collects tool registrations)                       */
/* ------------------------------------------------------------------ */

function createToolCollector() {
  const tools: ToolDefinition[] = [];

  const shim = {
    tool(
      name: string,
      description: string,
      shape: ZodRawShape,
      handler: (args: Record<string, unknown>) => Promise<{
        content: { type: string; text: string }[];
        isError?: boolean;
      }>,
    ) {
      const inputSchema = zodShapeToJsonSchema(shape);
      const zodSchema = z.object(shape);
      tools.push({ name, description, inputSchema, zodSchema, handler });
    },
  };

  return { shim, tools };
}

/* ------------------------------------------------------------------ */
/*  JSON-RPC helpers                                                   */
/* ------------------------------------------------------------------ */

function jsonRpcResponse(id: string | number | undefined, result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function jsonRpcError(
  id: string | number | undefined,
  code: number,
  message: string,
) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export function createMcpServer(user: AuthUser) {
  const { shim, tools } = createToolCollector();
  allTools.forEach((t) => t.register(shim as never, user));

  return {
    async handle(req: Request): Promise<Response> {
      const origin = req.headers.get("Origin") ?? "https://claude.ai";
      const headers: Record<string, string> = {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": origin,
      };

      try {
        const body: JsonRpcRequest = await req.json();
        const { id, method, params } = body;

        let result: unknown;

        switch (method) {
          case "initialize":
            result = {
              protocolVersion: "2025-03-26",
              serverInfo: { name: "mcp-outlook", version: "1.0.0" },
              capabilities: { tools: {} },
            };
            break;

          case "tools/list":
            result = {
              tools: tools.map((t) => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema,
              })),
            };
            break;

          case "tools/call": {
            const toolName = (params as { name: string })?.name;
            const toolArgs =
              ((params as { arguments?: Record<string, unknown> })
                ?.arguments) ?? {};

            const tool = tools.find((t) => t.name === toolName);
            if (!tool) {
              return new Response(
                JSON.stringify(
                  jsonRpcError(id, -32602, `Unknown tool: ${toolName}`),
                ),
                { status: 200, headers },
              );
            }

            // Parse through Zod to apply defaults and validate
            const parsed = tool.zodSchema.parse(toolArgs);
            result = await tool.handler(parsed);
            break;
          }

          case "ping":
            result = {};
            break;

          default:
            return new Response(
              JSON.stringify(
                jsonRpcError(id, -32601, `Method not found: ${method}`),
              ),
              { status: 200, headers },
            );
        }

        return new Response(JSON.stringify(jsonRpcResponse(id, result)), {
          status: 200,
          headers,
        });
      } catch (err) {
        console.error("[MCP] Handler error:", err);
        return new Response(
          JSON.stringify(
            jsonRpcError(undefined, -32700, "Parse error: invalid JSON"),
          ),
          { status: 200, headers },
        );
      }
    },
  };
}
