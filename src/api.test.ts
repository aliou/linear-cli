/**
 * Tests for graphql() and API helpers.
 */

import { afterEach, describe, expect, mock, test } from "bun:test";
import { fetchOrganization, graphql } from "./api.ts";

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const SUCCESS_BODY = {
  data: { viewer: { id: "1", name: "Test", email: "t@t.com" } },
};

afterEach(() => {
  mock.restore();
});

describe("fetchOrganization", () => {
  test("returns organization metadata", async () => {
    const fetchMock = mock(async () =>
      makeJsonResponse({
        data: {
          organization: { id: "org-1", name: "Acme Inc", urlKey: "acme" },
        },
      }),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      const org = await fetchOrganization("api-token");
      expect(org.id).toBe("org-1");
      expect(org.name).toBe("Acme Inc");
      expect(org.urlKey).toBe("acme");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("graphql() with plain string token", () => {
  test("works with a plain string auth header", async () => {
    const fetchMock = mock(async () => makeJsonResponse(SUCCESS_BODY));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      const result = await graphql<(typeof SUCCESS_BODY)["data"]>(
        "api-token",
        "query { viewer { id name email } }",
      );
      expect(result.viewer.name).toBe("Test");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("returns invalid API token on 401", async () => {
    const fetchMock = mock(
      async () => new Response("Unauthorized", { status: 401 }),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      await expect(
        graphql("api-token", "query { viewer { id } }"),
      ).rejects.toThrow("Invalid API token");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("graphql() error handling", () => {
  test("truncates large non-JSON HTTP error bodies", async () => {
    const fetchMock = mock(
      async () =>
        new Response("x".repeat(400), {
          status: 503,
          statusText: "Service Unavailable",
        }),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      await expect(
        graphql("api-token", "query { viewer { id } }"),
      ).rejects.toThrow(
        /Linear API request failed with 503 Service Unavailable: x{50}/,
      );
      await expect(
        graphql("api-token", "query { viewer { id } }"),
      ).rejects.not.toThrow(/x{250}/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("surfaces generic entity-not-found hints using the provided id variable", async () => {
    const fetchMock = mock(async () =>
      makeJsonResponse({
        errors: [{ message: "Entity not found: Project" }],
      }),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      await expect(
        graphql(
          "api-token",
          "query Project($id: String!) { project(id: $id) { id } }",
          {
            id: "project-123",
          },
        ),
      ).rejects.toThrow("Project not found: project-123");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
