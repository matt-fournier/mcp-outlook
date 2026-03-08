/**
 * Supabase JWT authentication strategy.
 *
 * Uses getClaims() (new pattern) with the SB_PUBLISHABLE_KEY.
 * Falls back to getUser() with SUPABASE_ANON_KEY for legacy projects.
 *
 * Required secrets:
 *   - SUPABASE_URL (auto-injected by Supabase)
 *   - SB_PUBLISHABLE_KEY (new key) or SUPABASE_ANON_KEY (legacy)
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import type { AuthIdentity, AuthResult } from "./types.ts";

export async function validateSupabaseJwt(token: string): Promise<AuthResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  // Prefer new publishable key, fall back to legacy anon key
  const supabaseKey =
    Deno.env.get("SB_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "[AUTH:JWT] Missing SUPABASE_URL or SB_PUBLISHABLE_KEY/SUPABASE_ANON_KEY",
    );
    return {
      success: false,
      error: "Supabase JWT authentication is not configured",
      status: 500,
    };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Try getClaims() first (new asymmetric JWT pattern)
  if (typeof supabase.auth.getClaims === "function") {
    try {
      const { data, error } = await supabase.auth.getClaims(token);
      if (!error && data?.claims) {
        const claims = data.claims;
        const identity: AuthIdentity = {
          id: (claims.sub as string) ?? "unknown",
          email: (claims.email as string) ?? "unknown",
          role: (claims.role as string) ?? "user",
          method: "supabase_jwt",
        };
        console.log(
          `[AUTH:JWT] Authenticated via getClaims(): ${identity.email}`,
        );
        return { success: true, identity };
      }
      if (error) {
        console.warn(`[AUTH:JWT] getClaims() failed: ${error.message}`);
      }
    } catch (err) {
      console.warn(
        `[AUTH:JWT] getClaims() threw: ${(err as Error).message}, falling back to getUser()`,
      );
    }
  }

  // Fallback: getUser() (works with legacy symmetric JWTs)
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return {
        success: false,
        error: "Invalid or expired JWT",
        status: 401,
      };
    }

    const identity: AuthIdentity = {
      id: user.id,
      email: user.email ?? "unknown",
      role: user.role ?? "user",
      method: "supabase_jwt",
    };
    console.log(`[AUTH:JWT] Authenticated via getUser(): ${identity.email}`);
    return { success: true, identity };
  } catch (err) {
    console.error(`[AUTH:JWT] getUser() threw: ${(err as Error).message}`);
    return {
      success: false,
      error: "JWT validation failed",
      status: 401,
    };
  }
}
