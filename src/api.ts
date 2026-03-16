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

function truncateDetail(value: string, maxLength = 200): string {
  return value.length > maxLength
    ? `${value.slice(0, maxLength - 3)}...`
    : value;
}

/**
 * Execute a GraphQL request against the Linear API and return the raw GraphQL response.
 *
 * When passed a ResolvedAuth from config with a refreshToken, a 401 response
 * will trigger a single token-refresh attempt followed by a retry.
 * Tokens from environment variables are never refreshed automatically.
 */
export async function graphqlRequest<T = unknown>(
  auth: string | ResolvedAuth,
  query: string,
  variables?: Record<string, unknown>,
): Promise<GraphQLResponse<T>> {
  let currentHeader = authHeader(auth);
  let response = await doGraphQL(currentHeader, query, variables);

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
    const detail = truncateDetail(body.trim());
    const message = detail
      ? `Linear API request failed with ${response.status} ${response.statusText}: ${detail}`
      : `Linear API request failed with ${response.status} ${response.statusText}`;

    throw new CliError(message);
  }

  return (await response.json()) as GraphQLResponse<T>;
}

/**
 * Execute a GraphQL query against the Linear API.
 */
export async function graphql<T = unknown>(
  auth: string | ResolvedAuth,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const result = await graphqlRequest<T>(auth, query, variables);

  if (result.errors?.length) {
    const firstMessage =
      result.errors[0]?.message ?? "Unknown Linear API error";
    const entityNotFoundMatch = /^Entity not found: (.+)$/.exec(firstMessage);

    if (entityNotFoundMatch) {
      const entityName = entityNotFoundMatch[1] ?? "Entity";
      const identifier =
        typeof variables?.id === "string" ? variables.id.trim() : "";

      if (identifier) {
        throw new CliError(`${entityName} not found: ${identifier}`, {
          suggestion: `Use a valid ${entityName.toLowerCase()} identifier or UUID.`,
        });
      }
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
