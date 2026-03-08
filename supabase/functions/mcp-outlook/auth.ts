/**
 * Auth wrapper for mcp-outlook.
 * Delegates to the shared mcp-auth module.
 */

export { authenticate } from "@shared/mcp-auth/mod.ts";
export type { AuthIdentity, AuthResult } from "@shared/mcp-auth/mod.ts";
