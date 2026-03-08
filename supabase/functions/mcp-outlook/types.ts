import { McpServer } from "npm:@modelcontextprotocol/sdk/server/mcp.js";

// Re-export AuthIdentity from shared module as the canonical auth type
export type { AuthIdentity } from "@shared/mcp-auth/mod.ts";
import type { AuthIdentity } from "@shared/mcp-auth/mod.ts";

/** Legacy alias — kept for backward compatibility during migration. */
export type AuthUser = AuthIdentity;

export interface McpTool {
  register(server: McpServer, user: AuthIdentity): void;
}
