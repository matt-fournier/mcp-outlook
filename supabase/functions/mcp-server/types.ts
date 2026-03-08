import { McpServer } from "npm:@modelcontextprotocol/sdk/server/mcp.js";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

export interface McpTool {
  register(server: McpServer, user: AuthUser): void;
}
