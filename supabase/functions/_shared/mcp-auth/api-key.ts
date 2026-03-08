/**
 * API Key authentication strategy.
 *
 * Validates tokens with the `mcp_sk_` prefix against the MCP_API_KEYS secret.
 *
 * Secret format (comma-separated, each entry is name:key):
 *   MCP_API_KEYS="claude-desktop:mcp_sk_abc123,backend-app:mcp_sk_xyz789"
 *
 * This allows identifying which client is calling and revoking individual keys.
 */

import type { AuthIdentity, AuthResult } from "./types.ts";

const API_KEY_PREFIX = "mcp_sk_";

/** Check if a token looks like an MCP API key. */
export function isApiKey(token: string): boolean {
  return token.startsWith(API_KEY_PREFIX);
}

/** Validate an API key against the MCP_API_KEYS secret. */
export function validateApiKey(token: string): AuthResult {
  const raw = Deno.env.get("MCP_API_KEYS");
  if (!raw) {
    console.error("[AUTH:API_KEY] MCP_API_KEYS secret is not configured");
    return {
      success: false,
      error: "API key authentication is not configured",
      status: 500,
    };
  }

  // Parse entries: "name:key,name:key"
  const entries = raw
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const colonIdx = entry.indexOf(":");
    if (colonIdx === -1) continue;

    const name = entry.slice(0, colonIdx).trim();
    const key = entry.slice(colonIdx + 1).trim();

    if (key === token) {
      const identity: AuthIdentity = {
        id: `apikey:${name}`,
        email: `${name}@mcp.local`,
        role: "service",
        method: "api_key",
      };
      console.log(`[AUTH:API_KEY] Authenticated client "${name}"`);
      return { success: true, identity };
    }
  }

  return {
    success: false,
    error: "Invalid API key",
    status: 401,
  };
}
