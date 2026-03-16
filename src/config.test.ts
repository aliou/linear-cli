import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getApiToken,
  getConfigPath,
  getConfigSchemaUrl,
  resolveAuth,
  saveConfig,
  validateConfig,
} from "./config";

describe("validateConfig", () => {
  test("preserves refreshToken and accessTokenExpiresAt", () => {
    const result = validateConfig({
      accessToken: "tok",
      refreshToken: "ref",
      accessTokenExpiresAt: "2099-01-01T00:00:00.000Z",
    });
    expect(result.refreshToken).toBe("ref");
    expect(result.accessTokenExpiresAt).toBe("2099-01-01T00:00:00.000Z");
  });

  test("parses nested oauth config shape", () => {
    const result = validateConfig({
      apiToken: "api-token",
      oauth: {
        access: "oauth-access",
        refresh: "oauth-refresh",
        expiresAt: "2099-01-01T00:00:00.000Z",
        clientId: "client-id",
        clientSecret: "client-secret",
      },
    });
    expect(result.apiToken).toBe("api-token");
    expect(result.accessToken).toBe("oauth-access");
    expect(result.refreshToken).toBe("oauth-refresh");
    expect(result.accessTokenExpiresAt).toBe("2099-01-01T00:00:00.000Z");
    expect(result.oauthClientId).toBe("client-id");
    expect(result.oauthClientSecret).toBe("client-secret");
  });

  test("strips unknown fields", () => {
    const result = validateConfig({ unknownField: "value" });
    expect((result as Record<string, unknown>).unknownField).toBeUndefined();
  });

  test("backward compatible: parses existing configs without new fields", () => {
    const result = validateConfig({ apiToken: "abc", outputFormat: "table" });
    expect(result.apiToken).toBe("abc");
    expect(result.refreshToken).toBeUndefined();
    expect(result.accessTokenExpiresAt).toBeUndefined();
  });
});

describe("getApiToken", () => {
  let tempDir: string;
  const originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
  const originalApiToken = process.env.LINEAR_API_TOKEN;
  const originalOauthToken = process.env.LINEAR_OAUTH_TOKEN;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "linear-cli-test-"));
    process.env.XDG_CONFIG_HOME = tempDir;
    delete process.env.LINEAR_API_TOKEN;
    delete process.env.LINEAR_OAUTH_TOKEN;
  });

  afterEach(async () => {
    if (originalXdgConfigHome === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = originalXdgConfigHome;
    }

    if (originalApiToken === undefined) {
      delete process.env.LINEAR_API_TOKEN;
    } else {
      process.env.LINEAR_API_TOKEN = originalApiToken;
    }

    if (originalOauthToken === undefined) {
      delete process.env.LINEAR_OAUTH_TOKEN;
    } else {
      process.env.LINEAR_OAUTH_TOKEN = originalOauthToken;
    }

    await rm(tempDir, { recursive: true, force: true });
  });

  test("returns oauth env token before api env token", async () => {
    process.env.LINEAR_API_TOKEN = "api-token";
    process.env.LINEAR_OAUTH_TOKEN = "oauth-token";

    await expect(getApiToken()).resolves.toBe("Bearer oauth-token");
  });

  test("returns api env token when oauth env token is absent", async () => {
    process.env.LINEAR_API_TOKEN = "api-token";

    await expect(getApiToken()).resolves.toBe("api-token");
  });

  test("returns config access token before config api token", async () => {
    await saveConfig({
      accessToken: "oauth-token",
      apiToken: "api-token",
      outputFormat: "table",
    });

    await expect(getApiToken()).resolves.toBe("Bearer oauth-token");
  });

  test("returns config api token when access token is absent", async () => {
    await saveConfig({
      apiToken: "api-token",
      outputFormat: "table",
    });

    await expect(getApiToken()).resolves.toBe("api-token");
  });

  test("reads nested oauth config shape from disk and still supports apiToken", async () => {
    const configPath = join(tempDir, "linear-cli", "config.json");
    await Bun.write(
      configPath,
      JSON.stringify(
        {
          outputFormat: "table",
          oauth: {
            access: "oauth-token",
            refresh: "refresh-token",
          },
          apiToken: "api-token",
        },
        null,
        2,
      ),
    );

    await expect(getApiToken()).resolves.toBe("Bearer oauth-token");
  });

  test("saveConfig writes $schema for the current CLI version", async () => {
    await saveConfig({
      apiToken: "api-token",
      outputFormat: "table",
    });

    const content = await Bun.file(getConfigPath()).text();
    const parsed = JSON.parse(content) as { $schema?: string };
    expect(parsed.$schema).toBe(getConfigSchemaUrl());
  });
});

describe("resolveAuth", () => {
  let tempDir: string;
  const originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
  const originalApiToken = process.env.LINEAR_API_TOKEN;
  const originalOauthToken = process.env.LINEAR_OAUTH_TOKEN;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "linear-cli-test-"));
    process.env.XDG_CONFIG_HOME = tempDir;
    delete process.env.LINEAR_API_TOKEN;
    delete process.env.LINEAR_OAUTH_TOKEN;
  });

  afterEach(async () => {
    if (originalXdgConfigHome === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = originalXdgConfigHome;
    }
    if (originalApiToken === undefined) {
      delete process.env.LINEAR_API_TOKEN;
    } else {
      process.env.LINEAR_API_TOKEN = originalApiToken;
    }
    if (originalOauthToken === undefined) {
      delete process.env.LINEAR_OAUTH_TOKEN;
    } else {
      process.env.LINEAR_OAUTH_TOKEN = originalOauthToken;
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  test("env oauth token: source=env, kind=oauth, no refreshToken", async () => {
    process.env.LINEAR_OAUTH_TOKEN = "env-oauth";
    const auth = await resolveAuth();
    expect(auth).toBeDefined();
    expect(auth?.source).toBe("env");
    expect(auth?.kind).toBe("oauth");
    expect(auth?.header).toBe("Bearer env-oauth");
    expect(auth?.refreshToken).toBeUndefined();
  });

  test("env api token: source=env, kind=api", async () => {
    process.env.LINEAR_API_TOKEN = "env-api";
    const auth = await resolveAuth();
    expect(auth?.source).toBe("env");
    expect(auth?.kind).toBe("api");
    expect(auth?.header).toBe("env-api");
  });

  test("config oauth token includes refreshToken and accessTokenExpiresAt", async () => {
    await saveConfig({
      accessToken: "cfg-oauth",
      refreshToken: "cfg-refresh",
      accessTokenExpiresAt: "2099-01-01T00:00:00.000Z",
      outputFormat: "table",
    });
    const auth = await resolveAuth();
    expect(auth?.source).toBe("config");
    expect(auth?.kind).toBe("oauth");
    expect(auth?.header).toBe("Bearer cfg-oauth");
    expect(auth?.refreshToken).toBe("cfg-refresh");
    expect(auth?.accessTokenExpiresAt).toBe("2099-01-01T00:00:00.000Z");
  });

  test("config api token: source=config, kind=api, no refreshToken", async () => {
    await saveConfig({ apiToken: "cfg-api", outputFormat: "table" });
    const auth = await resolveAuth();
    expect(auth?.source).toBe("config");
    expect(auth?.kind).toBe("api");
    expect(auth?.refreshToken).toBeUndefined();
  });

  test("returns undefined when no token is configured", async () => {
    const auth = await resolveAuth();
    expect(auth).toBeUndefined();
  });
});
