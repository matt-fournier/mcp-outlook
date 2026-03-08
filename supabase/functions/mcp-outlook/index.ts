import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors } from "./cors.ts";
import { authenticate } from "./auth.ts";
import { createMcpServer } from "./server.ts";

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Authenticate every request via shared mcp-auth module
    const result = await authenticate(req);
    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: result.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Route to MCP handler
    const server = createMcpServer(result.identity);
    return await server.handle(req);
  } catch (error) {
    console.error("[MCP] Unhandled error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
