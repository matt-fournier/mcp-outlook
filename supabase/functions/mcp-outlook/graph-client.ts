/**
 * Microsoft Graph API client using client credentials (app-only) flow.
 *
 * Required environment variables:
 *   MICROSOFT_TENANT_ID   – Azure AD tenant ID
 *   MICROSOFT_CLIENT_ID   – Application (client) ID
 *   MICROSOFT_CLIENT_SECRET – Client secret value
 *
 * Required Azure AD Application API permissions (Application type):
 *   Mail.ReadWrite   – Read and write mail in all mailboxes
 *   Calendars.ReadWrite – Read and write calendars in all mailboxes
 */

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * Obtain an access token via the OAuth 2.0 client credentials flow.
 * Tokens are cached in memory until 5 minutes before expiry.
 */
async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  const tenantId = Deno.env.get("MICROSOFT_TENANT_ID")!;
  const clientId = Deno.env.get("MICROSOFT_CLIENT_ID")!;
  const clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET")!;

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to obtain Microsoft Graph token: ${res.status} ${text}`);
  }

  const data = await res.json();
  cachedToken = {
    value: data.access_token,
    // Expire 5 minutes early to avoid edge-case failures
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };

  return cachedToken.value;
}

/**
 * Make an authenticated request to the Microsoft Graph API.
 */
export async function graphRequest(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    params?: Record<string, string>;
  } = {},
): Promise<unknown> {
  const token = await getAccessToken();
  const { method = "GET", body, params } = options;

  const url = new URL(`${GRAPH_BASE}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph API error ${res.status}: ${text}`);
  }

  // 204 No Content
  if (res.status === 204) return null;

  return await res.json();
}
