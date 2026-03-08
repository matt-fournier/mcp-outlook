/**
 * Shared MCP authentication middleware.
 *
 * Supports 3 authentication methods (tried in order):
 *
 * 1. SKIP_AUTH (dev only) — env var SKIP_AUTH=true bypasses all auth
 * 2. API Key — Bearer token with `mcp_sk_` prefix, validated against MCP_API_KEYS secret
 * 3. Supabase JWT — Bearer token validated via getClaims() or getUser()
 *
 * Usage in any MCP Edge Function:
 *
 *   import { authenticate } from "../_shared/mcp-auth/mod.ts";
 *
 *   const result = await authenticate(req);
 *   if (!result.success) {
 *     return new Response(JSON.stringify({ error: result.error }), {
 *       status: result.status,
 *     });
 *   }
 *   const identity = result.identity;
 *
 * Required Supabase secrets:
 *   - MCP_API_KEYS: comma-separated "name:mcp_sk_xxx" pairs
 *   - SB_PUBLISHABLE_KEY or SUPABASE_ANON_KEY: for JWT validation
 *   - SUPABASE_URL: auto-injected by Supabase
 *
 * Deploy all MCP functions with verify_jwt = false (or --no-verify-jwt)
 * so the gateway lets requests through and this module handles auth.
 */

import type { AuthIdentity, AuthResult } from "./types.ts";
import { isApiKey, validateApiKey } from "./api-key.ts";
import { validateSupabaseJwt } from "./supabase-jwt.ts";

export type { AuthIdentity, AuthResult };

const DEV_IDENTITY: AuthIdentity = {
  id: "dev-local-user",
  email: "dev@localhost",
  role: "admin",
  method: "skip_auth",
};

/**
 * Authenticate an incoming HTTP request.
 *
 * Extracts the Bearer token from the Authorization header, then
 * routes to the appropriate strategy based on the token format.
 */
export async function authenticate(req: Request): Promise<AuthResult> {
  // 1. Dev mode — skip all auth
  if (Deno.env.get("SKIP_AUTH") === "true") {
    console.warn("[AUTH] SKIP_AUTH is enabled — returning dev identity");
    return { success: true, identity: DEV_IDENTITY };
  }

  // 2. Extract Bearer token
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      success: false,
      error: "Missing or malformed Authorization header",
      status: 401,
    };
  }

  const token = authHeader.slice(7); // "Bearer ".length === 7
  if (!token) {
    return {
      success: false,
      error: "Empty Bearer token",
      status: 401,
    };
  }

  // 3. Route by token type
  if (isApiKey(token)) {
    return validateApiKey(token);
  }

  // 4. Default: treat as Supabase JWT
  return await validateSupabaseJwt(token);
}
