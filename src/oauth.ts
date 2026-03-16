/**
 * OAuth token refresh utilities for linear-cli.
 * Kept in a separate module to avoid circular dependencies between api.ts and auth.ts.
 */

import { resolveOAuthClientCredentials, updateConfig } from "./config.ts";
/**
 * Exchange a refresh token for a new access token using Linear's OAuth endpoint.
 * Uses LINEAR_CLIENT_ID / LINEAR_CLIENT_SECRET from env when present,
 * otherwise falls back to oauth.clientId / oauth.clientSecret from config.
 * Persists the new tokens to config and returns the new Authorization header value.
 */
export async function refreshOAuthToken(
  currentRefreshToken: string,
): Promise<string> {
  const credentials = await resolveOAuthClientCredentials();

  if (!credentials) {
    throw new Error(
      "OAuth token refresh requires LINEAR_CLIENT_ID and LINEAR_CLIENT_SECRET, or oauth.clientId and oauth.clientSecret in config.",
    );
  }

  const { clientId, clientSecret } = credentials;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: currentRefreshToken,
  });

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );

  const response = await fetch("https://api.linear.app/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`OAuth token refresh failed: ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    throw new Error("OAuth token refresh response missing access_token");
  }

  const accessTokenExpiresAt =
    typeof data.expires_in === "number"
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : undefined;

  await updateConfig({
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? currentRefreshToken,
    accessTokenExpiresAt,
  });

  return `Bearer ${data.access_token}`;
}
