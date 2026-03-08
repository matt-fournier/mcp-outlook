/**
 * Auth wrapper for mcp-outlook.
 * Delegates to the shared mcp-auth module.
 */

export { authenticate } from "../_shared/mcp-auth/mod.ts";
export type { AuthIdentity, AuthResult } from "../_shared/mcp-auth/mod.ts";
