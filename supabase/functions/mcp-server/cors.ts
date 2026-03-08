const ALLOWED_ORIGINS = [
  "https://claude.ai",
  "http://localhost:3000",
  "http://localhost:5173",
];

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE",
};

export function handleCors(req: Request): Response | null {
  const origin = req.headers.get("Origin") ?? "";

  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Origin": allowedOrigin,
      },
    });
  }

  return null;
}
