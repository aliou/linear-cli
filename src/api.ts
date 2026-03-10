/**
 * Linear GraphQL API client.
 */

import { LINEAR_API_URL } from "./constants.ts";

export interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
}

/**
 * Execute a GraphQL query against the Linear API.
 */
export async function graphql<T = unknown>(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(LINEAR_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Invalid API token");
    }
    throw new Error(`Linear API error: ${response.statusText}`);
  }

  const result = (await response.json()) as GraphQLResponse<T>;

  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join(", "));
  }

  if (!result.data) {
    throw new Error("No data returned from Linear API");
  }

  return result.data;
}

/**
 * Fetch the authenticated user (viewer) to validate token.
 */
export async function fetchViewer(
  token: string,
): Promise<{ id: string; name: string; email: string }> {
  const data = await graphql<{
    viewer: { id: string; name: string; email: string };
  }>(token, `query { viewer { id name email } }`);

  return data.viewer;
}
