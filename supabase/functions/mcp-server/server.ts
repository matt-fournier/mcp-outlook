import { McpServer } from "npm:@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "npm:@modelcontextprotocol/sdk/server/streamableHttp.js";
import { corsHeaders } from "./cors.ts";
import { allTools } from "./tools/index.ts";
import type { AuthUser } from "./types.ts";

export function createMcpServer(user: AuthUser) {
  const server = new McpServer({
    name: "mcp-outlook",
    version: "1.0.0",
  });

  // Register all tools, passing user context
  allTools.forEach((tool) => tool.register(server, user));

  return {
    async handle(req: Request): Promise<Response> {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless — no session needed
      });

      const response = await transport.handleRequest(req, async () => {
        await server.connect(transport);
      });

      // Merge CORS headers into the response
      const newHeaders = new Headers(response.headers);
      const origin = req.headers.get("Origin") ?? "https://claude.ai";
      Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
      newHeaders.set("Access-Control-Allow-Origin", origin);

      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      });
    },
  };
}
