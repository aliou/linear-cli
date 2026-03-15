import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getApiToken, saveConfig } from "./config";

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
});
