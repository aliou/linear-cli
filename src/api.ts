/**
 * Linear GraphQL API client.
 */

import type { ResolvedAuth } from "./config.ts";
import { LINEAR_API_URL } from "./constants.ts";
import { CliError } from "./errors.ts";
import { refreshOAuthToken } from "./oauth.ts";

export type { ResolvedAuth };

export interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
}

/**
 * Resolve an auth value (string or ResolvedAuth) into a header string.
 */
function authHeader(auth: string | ResolvedAuth): string {
  return typeof auth === "string" ? auth : auth.header;
}

/**
 * Execute a GraphQL request and return the raw Response.
 */
async function doGraphQL(
  authValue: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<Response> {
  return fetch(LINEAR_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authValue,
    },
    body: JSON.stringify({ query, variables }),
  });
}

/**
 * Execute a GraphQL query against the Linear API.
 *
 * When passed a ResolvedAuth from config with a refreshToken, a 401 response
 * will trigger a single token-refresh attempt followed by a retry.
 * Tokens from environment variables are never refreshed automatically.
 */
export async function graphql<T = unknown>(
  auth: string | ResolvedAuth,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  let currentHeader = authHeader(auth);
  let response = await doGraphQL(currentHeader, query, variables);

  // Attempt a token refresh on 401 for config-backed OAuth tokens with a refresh token
  if (
    response.status === 401 &&
    typeof auth !== "string" &&
    auth.source === "config" &&
    auth.kind === "oauth" &&
    auth.refreshToken
  ) {
    currentHeader = await refreshOAuthToken(auth.refreshToken);
    response = await doGraphQL(currentHeader, query, variables);
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new CliError("Invalid API token", {
        suggestion: "Run 'linear auth login' to save a valid token.",
      });
    }

    const body = await response.text();
    const detail = body.trim();
    const message = detail
      ? `Linear API request failed with ${response.status} ${response.statusText}: ${detail}`
      : `Linear API request failed with ${response.status} ${response.statusText}`;

    throw new CliError(message);
  }

  const result = (await response.json()) as GraphQLResponse<T>;

  if (result.errors?.length) {
    const firstMessage =
      result.errors[0]?.message ?? "Unknown Linear API error";

    if (
      firstMessage === "Entity not found: Issue" &&
      typeof variables?.id === "string" &&
      variables.id.trim()
    ) {
      throw new CliError(`Issue not found: ${variables.id}`, {
        suggestion:
          "Use a valid issue identifier like ENG-123 or a Linear issue UUID.",
      });
    }

    throw new CliError(result.errors.map((e) => e.message).join(", "));
  }

  if (!result.data) {
    throw new CliError("No data returned from Linear API");
  }

  return result.data;
}

/**
 * Fetch the authenticated user (viewer) to validate token.
 */
export async function fetchViewer(
  auth: string | ResolvedAuth,
): Promise<{ id: string; name: string; email: string }> {
  const data = await graphql<{
    viewer: { id: string; name: string; email: string };
  }>(auth, `query { viewer { id name email } }`);

  return data.viewer;
}
