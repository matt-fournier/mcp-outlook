import { createClient } from "npm:@supabase/supabase-js";
import type { AuthUser } from "./types.ts";

export async function authenticate(req: Request): Promise<AuthUser | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.split(" ")[1];

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) return null;

  return {
    id: user.id,
    email: user.email!,
    role: user.role ?? "user",
  };
}
