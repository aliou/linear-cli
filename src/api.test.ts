/**
 * Tests for graphql() OAuth refresh-on-401 behavior.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchOrganization, graphql } from "./api.ts";
import type { ResolvedAuth } from "./config.ts";
import { loadConfig, saveConfig } from "./config.ts";

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const SUCCESS_BODY = {
  data: { viewer: { id: "1", name: "Test", email: "t@t.com" } },
};

let tempDir: string;
const originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
const originalClientId = process.env.LINEAR_CLIENT_ID;
const originalClientSecret = process.env.LINEAR_CLIENT_SECRET;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "linear-cli-api-test-"));
  process.env.XDG_CONFIG_HOME = tempDir;
  process.env.LINEAR_CLIENT_ID = "test-client-id";
  process.env.LINEAR_CLIENT_SECRET = "test-client-secret";
});

afterEach(async () => {
  if (originalXdgConfigHome === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = originalXdgConfigHome;

  if (originalClientId === undefined) delete process.env.LINEAR_CLIENT_ID;
  else process.env.LINEAR_CLIENT_ID = originalClientId;

  if (originalClientSecret === undefined)
    delete process.env.LINEAR_CLIENT_SECRET;
  else process.env.LINEAR_CLIENT_SECRET = originalClientSecret;

  await rm(tempDir, { recursive: true, force: true });
  mock.restore();
});

describe("graphql() with config OAuth token + refreshToken on 401", () => {
  test("refreshes token, retries, and updates config on 401", async () => {
    await saveConfig({
      defaultWorkspace: "acme",
      workspaces: {
        acme: {
          accessToken: "old-access-token",
          refreshToken: "my-refresh-token",
        },
      },
      outputFormat: "table",
    });

    const auth: ResolvedAuth = {
      header: "Bearer old-access-token",
      token: "old-access-token",
      source: "config",
      kind: "oauth",
      workspace: "acme",
      refreshToken: "my-refresh-token",
    };

    let callCount = 0;
    const fetchMock = mock(async (url: string) => {
      if (typeof url === "string" && url.includes("/oauth/token")) {
        return makeJsonResponse({
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          expires_in: 3600,
        });
      }
      callCount++;
      if (callCount === 1) {
        return new Response("Unauthorized", { status: 401 });
      }
      return makeJsonResponse(SUCCESS_BODY);
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      const result = await graphql<(typeof SUCCESS_BODY)["data"]>(
        auth,
        "query { viewer { id name email } }",
      );
      expect(result.viewer.name).toBe("Test");
      expect(callCount).toBe(2);

      const config = await loadConfig();
      expect(config.workspaces?.acme?.accessToken).toBe("new-access-token");
      expect(config.workspaces?.acme?.refreshToken).toBe("new-refresh-token");
      expect(config.workspaces?.acme?.accessTokenExpiresAt).toBeDefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("refreshes using oauth client credentials from config when env vars are absent", async () => {
    delete process.env.LINEAR_CLIENT_ID;
    delete process.env.LINEAR_CLIENT_SECRET;

    await saveConfig({
      defaultWorkspace: "acme",
      workspaces: {
        acme: {
          accessToken: "old-access-token",
          refreshToken: "my-refresh-token",
          oauthClientId: "config-client-id",
          oauthClientSecret: "config-client-secret",
        },
      },
      outputFormat: "table",
    });

    const auth: ResolvedAuth = {
      header: "Bearer old-access-token",
      token: "old-access-token",
      source: "config",
      kind: "oauth",
      workspace: "acme",
      refreshToken: "my-refresh-token",
    };

    let sawBasicAuth = false;
    let callCount = 0;
    const fetchMock = mock(async (url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.includes("/oauth/token")) {
        sawBasicAuth =
          init?.headers instanceof Headers
            ? init.headers.get("Authorization") ===
              `Basic ${Buffer.from("config-client-id:config-client-secret").toString("base64")}`
            : (init?.headers as Record<string, string> | undefined)
                ?.Authorization ===
              `Basic ${Buffer.from("config-client-id:config-client-secret").toString("base64")}`;
        return makeJsonResponse({
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          expires_in: 3600,
        });
      }
      callCount++;
      if (callCount === 1) {
        return new Response("Unauthorized", { status: 401 });
      }
      return makeJsonResponse(SUCCESS_BODY);
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      const result = await graphql<(typeof SUCCESS_BODY)["data"]>(
        auth,
        "query { viewer { id name email } }",
      );
      expect(result.viewer.name).toBe("Test");
      expect(sawBasicAuth).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("does not refresh if no refreshToken in auth", async () => {
    const auth: ResolvedAuth = {
      header: "Bearer no-refresh-token",
      token: "no-refresh-token",
      source: "config",
      kind: "oauth",
      workspace: "acme",
    };

    let callCount = 0;
    const fetchMock = mock(async () => {
      callCount++;
      return new Response("Unauthorized", { status: 401 });
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      await expect(graphql(auth, "query { viewer { id } }")).rejects.toThrow(
        "Invalid API token",
      );
      expect(callCount).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("does not refresh env OAuth token on 401", async () => {
    const auth: ResolvedAuth = {
      header: "Bearer env-oauth-token",
      token: "env-oauth-token",
      source: "env",
      kind: "oauth",
      refreshToken: "should-not-use",
    };

    let callCount = 0;
    const fetchMock = mock(async () => {
      callCount++;
      return new Response("Unauthorized", { status: 401 });
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      await expect(graphql(auth, "query { viewer { id } }")).rejects.toThrow(
        "Invalid API token",
      );
      expect(callCount).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("does not refresh config api token on 401", async () => {
    const auth: ResolvedAuth = {
      header: "api-key",
      token: "api-key",
      source: "config",
      kind: "api",
    };

    let callCount = 0;
    const fetchMock = mock(async () => {
      callCount++;
      return new Response("Unauthorized", { status: 401 });
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      await expect(graphql(auth, "query { viewer { id } }")).rejects.toThrow(
        "Invalid API token",
      );
      expect(callCount).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("does not loop: only retries once after refresh", async () => {
    await saveConfig({
      defaultWorkspace: "acme",
      workspaces: {
        acme: {
          accessToken: "old-access-token",
          refreshToken: "my-refresh-token",
        },
      },
      outputFormat: "table",
    });

    const auth: ResolvedAuth = {
      header: "Bearer old-access-token",
      token: "old-access-token",
      source: "config",
      kind: "oauth",
      workspace: "acme",
      refreshToken: "my-refresh-token",
    };

    let graphqlCallCount = 0;
    const fetchMock = mock(async (url: string) => {
      if (typeof url === "string" && url.includes("/oauth/token")) {
        return makeJsonResponse({
          access_token: "new-access-token",
          expires_in: 3600,
        });
      }
      graphqlCallCount++;
      return new Response("Unauthorized", { status: 401 });
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      await expect(graphql(auth, "query { viewer { id } }")).rejects.toThrow(
        "Invalid API token",
      );
      expect(graphqlCallCount).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("persists rotated refresh token from response", async () => {
    await saveConfig({
      defaultWorkspace: "acme",
      workspaces: {
        acme: {
          accessToken: "old-token",
          refreshToken: "old-refresh",
        },
      },
      outputFormat: "table",
    });

    const auth: ResolvedAuth = {
      header: "Bearer old-token",
      token: "old-token",
      source: "config",
      kind: "oauth",
      workspace: "acme",
      refreshToken: "old-refresh",
    };

    let gqlCalls = 0;
    const fetchMock2 = mock(async (url: string) => {
      if (typeof url === "string" && url.includes("/oauth/token")) {
        return makeJsonResponse({
          access_token: "rotated-access",
          refresh_token: "rotated-refresh",
          expires_in: 7200,
        });
      }
      gqlCalls++;
      if (gqlCalls === 1) return new Response("Unauthorized", { status: 401 });
      return makeJsonResponse(SUCCESS_BODY);
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock2 as unknown as typeof fetch;

    try {
      await graphql(auth, "query { viewer { id } }");
      const config = await loadConfig();
      expect(config.workspaces?.acme?.accessToken).toBe("rotated-access");
      expect(config.workspaces?.acme?.refreshToken).toBe("rotated-refresh");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
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
      const org = await fetchOrganization("Bearer string-token");
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
        "Bearer string-token",
        "query { viewer { id name email } }",
      );
      expect(result.viewer.name).toBe("Test");
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
        graphql("Bearer test-token", "query { viewer { id } }"),
      ).rejects.toThrow(
        /Linear API request failed with 503 Service Unavailable: x{50}/,
      );
      await expect(
        graphql("Bearer test-token", "query { viewer { id } }"),
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
          "Bearer test-token",
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
