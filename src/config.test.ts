import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getApiToken,
  getConfigPath,
  getConfigSchemaUrl,
  loadConfig,
  loadMergedConfig,
  migrateConfigOnStartup,
  resolveAuth,
  saveConfig,
  saveWorkspaceProfile,
  setDefaultWorkspace,
  validateConfig,
  validateLocalConfig,
} from "./config";

describe("validateConfig", () => {
  test("parses new workspace-keyed shape", () => {
    const result = validateConfig({
      defaultWorkspace: "acme",
      workspaces: {
        acme: {
          apiToken: "api-acme",
          defaultTeamKey: "ENG",
          outputFormat: "json",
          orgName: "Acme Inc",
        },
      },
    });

    expect(result.defaultWorkspace).toBe("acme");
    expect(result.workspaces?.acme?.apiToken).toBe("api-acme");
    expect(result.workspaces?.acme?.defaultTeamKey).toBe("ENG");
    expect(result.workspaces?.acme?.outputFormat).toBe("json");
    expect(result.workspaces?.acme?.orgName).toBe("Acme Inc");
  });

  test("legacy flat config is exposed as implicit default workspace", () => {
    const result = validateConfig({
      apiToken: "legacy-api",
      oauth: {
        access: "legacy-oauth",
        refresh: "legacy-refresh",
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
    });

    expect(result.workspaces?.default?.apiToken).toBe("legacy-api");
    expect(result.workspaces?.default?.accessToken).toBe("legacy-oauth");
    expect(result.workspaces?.default?.refreshToken).toBe("legacy-refresh");
    expect(result.defaultWorkspace).toBe("default");
  });

  test("strips unknown fields", () => {
    const result = validateConfig({ unknownField: "value" });
    expect((result as Record<string, unknown>).unknownField).toBeUndefined();
  });
});

describe("saveConfig migration + schema", () => {
  let tempDir: string;
  const originalXdgConfigHome = process.env.XDG_CONFIG_HOME;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "linear-cli-test-"));
    process.env.XDG_CONFIG_HOME = tempDir;
  });

  afterEach(async () => {
    if (originalXdgConfigHome === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = originalXdgConfigHome;
    }

    await rm(tempDir, { recursive: true, force: true });
  });

  test("saveConfig writes new workspace-keyed format and schema", async () => {
    await saveConfig({
      apiToken: "legacy-api",
      outputFormat: "table",
    });

    const content = await Bun.file(getConfigPath()).text();
    const parsed = JSON.parse(content) as {
      $schema?: string;
      apiToken?: string;
      defaultWorkspace?: string;
      workspaces?: Record<string, { apiToken?: string }>;
    };

    expect(parsed.$schema).toBe(getConfigSchemaUrl());
    expect(parsed.apiToken).toBeUndefined();
    expect(parsed.defaultWorkspace).toBe("default");
    expect(parsed.workspaces?.default?.apiToken).toBe("legacy-api");
  });

  test("round-trips workspace profiles", async () => {
    await saveConfig({
      defaultWorkspace: "acme",
      workspaces: {
        acme: {
          accessToken: "oauth",
          refreshToken: "refresh",
          accessTokenExpiresAt: "2099-01-01T00:00:00.000Z",
          oauthClientId: "cid",
          oauthClientSecret: "secret",
          orgName: "Acme Inc",
          outputFormat: "json",
        },
      },
      outputFormat: "table",
    });

    const loaded = await loadConfig();
    expect(loaded.defaultWorkspace).toBe("acme");
    expect(loaded.workspaces?.acme?.accessToken).toBe("oauth");
    expect(loaded.workspaces?.acme?.refreshToken).toBe("refresh");
    expect(loaded.workspaces?.acme?.oauthClientId).toBe("cid");
    expect(loaded.workspaces?.acme?.oauthClientSecret).toBe("secret");
    expect(loaded.workspaces?.acme?.orgName).toBe("Acme Inc");
  });

  test("migrates legacy config on startup and creates versioned backup", async () => {
    const configPath = getConfigPath();

    await Bun.write(
      configPath,
      JSON.stringify(
        {
          apiToken: "legacy-api",
          outputFormat: "table",
        },
        null,
        2,
      ),
    );

    await migrateConfigOnStartup();

    const migratedContent = JSON.parse(
      await Bun.file(configPath).text(),
    ) as Record<string, unknown>;

    expect(migratedContent.apiToken).toBeUndefined();
    expect(
      (migratedContent.workspaces as Record<string, { apiToken?: string }>)
        ?.default?.apiToken,
    ).toBe("legacy-api");

    const configDir = join(tempDir, "linear-cli");
    const entries = await readdir(configDir);
    const backup = entries.find(
      (entry) => entry.startsWith("config.") && entry !== "config.json",
    );

    expect(backup).toBeDefined();
    const backupContent = JSON.parse(
      await Bun.file(join(configDir, backup as string)).text(),
    ) as { apiToken?: string };
    expect(backupContent.apiToken).toBe("legacy-api");
  });
});

describe("resolveAuth + workspace resolution", () => {
  let tempDir: string;
  let projectDir: string;
  const originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
  const originalApiToken = process.env.LINEAR_API_TOKEN;
  const originalOauthToken = process.env.LINEAR_OAUTH_TOKEN;
  const originalWorkspace = process.env.LINEAR_WORKSPACE;
  const originalCwd = process.cwd();

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "linear-cli-test-"));
    projectDir = await mkdtemp(join(tmpdir(), "linear-cli-project-"));
    process.env.XDG_CONFIG_HOME = tempDir;
    delete process.env.LINEAR_API_TOKEN;
    delete process.env.LINEAR_OAUTH_TOKEN;
    delete process.env.LINEAR_WORKSPACE;
  });

  afterEach(async () => {
    process.chdir(originalCwd);

    if (originalXdgConfigHome === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = originalXdgConfigHome;

    if (originalApiToken === undefined) delete process.env.LINEAR_API_TOKEN;
    else process.env.LINEAR_API_TOKEN = originalApiToken;

    if (originalOauthToken === undefined) delete process.env.LINEAR_OAUTH_TOKEN;
    else process.env.LINEAR_OAUTH_TOKEN = originalOauthToken;

    if (originalWorkspace === undefined) delete process.env.LINEAR_WORKSPACE;
    else process.env.LINEAR_WORKSPACE = originalWorkspace;

    await rm(tempDir, { recursive: true, force: true });
    await rm(projectDir, { recursive: true, force: true });
  });

  test("env tokens override workspace selection", async () => {
    await saveConfig({
      defaultWorkspace: "acme",
      workspaces: { acme: { apiToken: "cfg-api" } },
      outputFormat: "table",
    });

    process.env.LINEAR_OAUTH_TOKEN = "env-oauth";

    const auth = await resolveAuth({ workspace: "acme" });
    expect(auth?.source).toBe("env");
    expect(auth?.kind).toBe("oauth");
    expect(auth?.header).toBe("Bearer env-oauth");
  });

  test("selects explicit workspace", async () => {
    await saveConfig({
      defaultWorkspace: "acme",
      workspaces: {
        acme: { apiToken: "api-acme" },
        personal: { accessToken: "oauth-personal", refreshToken: "r1" },
      },
      outputFormat: "table",
    });

    const auth = await resolveAuth({ workspace: "personal" });
    expect(auth?.workspace).toBe("personal");
    expect(auth?.kind).toBe("oauth");
    expect(auth?.refreshToken).toBe("r1");
  });

  test("uses local config workspace before defaultWorkspace", async () => {
    await saveConfig({
      defaultWorkspace: "acme",
      workspaces: {
        acme: { apiToken: "api-acme", outputFormat: "table" },
        personal: { apiToken: "api-personal", outputFormat: "json" },
      },
      outputFormat: "table",
    });

    await mkdir(join(projectDir, ".linear"), { recursive: true });
    await Bun.write(
      join(projectDir, ".linear.json"),
      JSON.stringify({ workspace: "personal" }),
    );

    process.chdir(projectDir);
    const auth = await resolveAuth();
    expect(auth?.workspace).toBe("personal");
    expect(auth?.header).toBe("api-personal");
  });

  test("throws on unknown workspace", async () => {
    await saveConfig({
      defaultWorkspace: "acme",
      workspaces: { acme: { apiToken: "api-acme" } },
      outputFormat: "table",
    });

    await expect(resolveAuth({ workspace: "missing" })).rejects.toThrow(
      'Workspace "missing" not found in config.',
    );
  });

  test("throws when multiple workspaces and no default selected", async () => {
    await saveConfig({
      workspaces: {
        acme: { apiToken: "api-acme" },
        personal: { apiToken: "api-personal" },
      },
      outputFormat: "table",
    });

    const config = await loadConfig();
    await saveConfig({ ...config, defaultWorkspace: undefined });

    await expect(resolveAuth()).rejects.toThrow(
      "Multiple workspaces configured",
    );
  });

  test("single workspace auto-select", async () => {
    await saveConfig({
      workspaces: {
        acme: { apiToken: "api-acme" },
      },
      outputFormat: "table",
    });

    const config = await loadConfig();
    await saveConfig({ ...config, defaultWorkspace: undefined });

    const auth = await resolveAuth();
    expect(auth?.workspace).toBe("acme");
  });

  test("ignores stale defaultWorkspace and falls back when one profile exists", async () => {
    await saveConfig({
      defaultWorkspace: "missing",
      workspaces: {
        acme: { apiToken: "api-acme" },
      },
      outputFormat: "table",
    });

    const auth = await resolveAuth();
    expect(auth?.workspace).toBe("acme");
  });
});

describe("workspace helpers + local config parsing", () => {
  let tempDir: string;
  const originalXdgConfigHome = process.env.XDG_CONFIG_HOME;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "linear-cli-test-"));
    process.env.XDG_CONFIG_HOME = tempDir;
  });

  afterEach(async () => {
    if (originalXdgConfigHome === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = originalXdgConfigHome;
    await rm(tempDir, { recursive: true, force: true });
  });

  test("saveWorkspaceProfile and setDefaultWorkspace", async () => {
    await saveConfig({ outputFormat: "table" });
    await saveWorkspaceProfile("acme", {
      apiToken: "api-acme",
      orgName: "Acme Inc",
    });
    await setDefaultWorkspace("acme");

    const cfg = await loadConfig();
    expect(cfg.workspaces?.acme?.apiToken).toBe("api-acme");
    expect(cfg.defaultWorkspace).toBe("acme");
  });

  test("validateLocalConfig parses workspace", () => {
    const local = validateLocalConfig({
      workspace: "acme",
      outputFormat: "json",
      unknown: true,
    });

    expect(local.workspace).toBe("acme");
    expect(local.outputFormat).toBe("json");
    expect((local as Record<string, unknown>).unknown).toBeUndefined();
  });

  test("loadMergedConfig applies workspace defaults then local overrides", async () => {
    const projectDir = await mkdtemp(join(tmpdir(), "linear-cli-project-"));
    const originalCwd = process.cwd();

    try {
      await saveConfig({
        defaultWorkspace: "acme",
        outputFormat: "table",
        workspaces: {
          acme: {
            apiToken: "api-acme",
            defaultTeamKey: "ENG",
            outputFormat: "json",
          },
        },
      });

      await Bun.write(
        join(projectDir, ".linear.json"),
        JSON.stringify({ outputFormat: "table", defaultTeamKey: "OPS" }),
      );

      process.chdir(projectDir);
      const merged = await loadMergedConfig();

      expect(merged.workspaceName).toBe("acme");
      expect(merged.config.outputFormat).toBe("table");
      expect(merged.config.defaultTeamKey).toBe("OPS");
    } finally {
      process.chdir(originalCwd);
      await rm(projectDir, { recursive: true, force: true });
    }
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
    if (originalXdgConfigHome === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = originalXdgConfigHome;

    if (originalApiToken === undefined) delete process.env.LINEAR_API_TOKEN;
    else process.env.LINEAR_API_TOKEN = originalApiToken;

    if (originalOauthToken === undefined) delete process.env.LINEAR_OAUTH_TOKEN;
    else process.env.LINEAR_OAUTH_TOKEN = originalOauthToken;

    await rm(tempDir, { recursive: true, force: true });
  });

  test("returns oauth env token before api env token", async () => {
    process.env.LINEAR_API_TOKEN = "api-token";
    process.env.LINEAR_OAUTH_TOKEN = "oauth-token";

    await expect(getApiToken()).resolves.toBe("Bearer oauth-token");
  });

  test("returns workspace config token", async () => {
    await saveConfig({
      defaultWorkspace: "acme",
      workspaces: {
        acme: { accessToken: "oauth-token" },
      },
      outputFormat: "table",
    });

    await expect(getApiToken()).resolves.toBe("Bearer oauth-token");
  });
});
