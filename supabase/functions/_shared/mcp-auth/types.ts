/**
 * Shared auth types for all MCP servers.
 */

/** Authenticated identity returned by the auth middleware. */
export interface AuthIdentity {
  /** Unique identifier (Supabase user ID or API key name). */
  id: string;
  /** Email address (from JWT claims or API key metadata). */
  email: string;
  /** Role: "user", "admin", "service", etc. */
  role: string;
  /** How the identity was authenticated. */
  method: "api_key" | "supabase_jwt" | "skip_auth";
}

/** Result of an authentication attempt. */
export type AuthResult =
  | { success: true; identity: AuthIdentity }
  | { success: false; error: string; status: number };
