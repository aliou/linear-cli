import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getApiToken,
  getConfigPath,
  getConfigSchemaUrl,
  loadConfig,
  loadMergedConfig,
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

  test("ignores top-level legacy auth fields entirely", () => {
    const result = validateConfig({
      apiToken: "should-be-ignored",
      oauth: {
        access: "ignored-oauth",
        refresh: "ignored-refresh",
      },
      accessToken: "also-ignored",
      outputFormat: "table",
    });

    // No workspace is synthesised from legacy fields
    expect(result.workspaces).toBeUndefined();
    expect(result.defaultWorkspace).toBeUndefined();
    // Non-auth defaults still parsed
    expect(result.outputFormat).toBe("table");
  });

  test("strips unknown fields", () => {
    const result = validateConfig({ unknownField: "value" });
    expect((result as Record<string, unknown>).unknownField).toBeUndefined();
  });

  test("workspace oauth sub-object is ignored (not parsed into profile)", () => {
    const result = validateConfig({
      defaultWorkspace: "acme",
      workspaces: {
        acme: {
          apiToken: "api-acme",
          oauth: {
            access: "should-be-stripped",
            refresh: "also-stripped",
          },
        },
      },
    });

    const profile = result.workspaces?.acme;
    expect(profile?.apiToken).toBe("api-acme");
    // oauth fields must not bleed into the profile type
    expect((profile as Record<string, unknown>)?.oauth).toBeUndefined();
    expect((profile as Record<string, unknown>)?.accessToken).toBeUndefined();
  });
});

describe("saveConfig + schema", () => {
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

  test("saveConfig writes workspace-keyed format with $schema", async () => {
    await saveConfig({
      defaultWorkspace: "acme",
      workspaces: { acme: { apiToken: "api-acme", orgName: "Acme Inc" } },
      outputFormat: "table",
    });

    const content = await Bun.file(getConfigPath()).text();
    const parsed = JSON.parse(content) as Record<string, unknown>;

    expect(parsed.$schema).toBe(getConfigSchemaUrl());
    expect(parsed.defaultWorkspace).toBe("acme");
    expect(
      (parsed.workspaces as Record<string, { apiToken?: string }>)?.acme
        ?.apiToken,
    ).toBe("api-acme");
    // No top-level auth fields should be written
    expect(parsed.apiToken).toBeUndefined();
    expect(parsed.oauth).toBeUndefined();
  });

  test("saveConfig never writes oauth blocks in workspace profiles", async () => {
    await saveConfig({
      defaultWorkspace: "acme",
      workspaces: {
        acme: { apiToken: "api-acme" },
      },
      outputFormat: "table",
    });

    const content = await Bun.file(getConfigPath()).text();
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const workspaces = parsed.workspaces as Record<
      string,
      Record<string, unknown>
    >;

    expect(workspaces?.acme?.oauth).toBeUndefined();
    expect(workspaces?.acme?.accessToken).toBeUndefined();
  });

  test("round-trips workspace profile non-auth fields", async () => {
    await saveConfig({
      defaultWorkspace: "acme",
      workspaces: {
        acme: {
          apiToken: "api-acme",
          orgName: "Acme Inc",
          defaultTeamKey: "ENG",
          outputFormat: "json",
        },
      },
      outputFormat: "table",
    });

    const loaded = await loadConfig();
    expect(loaded.defaultWorkspace).toBe("acme");
    expect(loaded.workspaces?.acme?.apiToken).toBe("api-acme");
    expect(loaded.workspaces?.acme?.orgName).toBe("Acme Inc");
    expect(loaded.workspaces?.acme?.defaultTeamKey).toBe("ENG");
    expect(loaded.workspaces?.acme?.outputFormat).toBe("json");
  });

  test("top-level auth fields in config file are ignored on load", async () => {
    const configPath = getConfigPath();
    const configDir = join(tempDir, "linear-cli");
    await mkdir(configDir, { recursive: true });

    // Write a file with legacy top-level auth fields
    await Bun.write(
      configPath,
      JSON.stringify(
        {
          apiToken: "top-level-ignored",
          oauth: { access: "ignored-access" },
          outputFormat: "json",
        },
        null,
        2,
      ),
    );

    const loaded = await loadConfig();
    // Top-level auth fields must be ignored
    expect(loaded.workspaces).toBeUndefined();
    expect(loaded.defaultWorkspace).toBeUndefined();
    // Non-auth defaults still parsed
    expect(loaded.outputFormat).toBe("json");
  });
});

describe("resolveAuth + workspace resolution", () => {
  let tempDir: string;
  let projectDir: string;
  const originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
  const originalApiToken = process.env.LINEAR_API_TOKEN;
  const originalWorkspace = process.env.LINEAR_WORKSPACE;
  const originalCwd = process.cwd();

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "linear-cli-test-"));
    projectDir = await mkdtemp(join(tmpdir(), "linear-cli-project-"));
    process.env.XDG_CONFIG_HOME = tempDir;
    delete process.env.LINEAR_API_TOKEN;
    delete process.env.LINEAR_WORKSPACE;
  });

  afterEach(async () => {
    process.chdir(originalCwd);

    if (originalXdgConfigHome === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = originalXdgConfigHome;

    if (originalApiToken === undefined) delete process.env.LINEAR_API_TOKEN;
    else process.env.LINEAR_API_TOKEN = originalApiToken;

    if (originalWorkspace === undefined) delete process.env.LINEAR_WORKSPACE;
    else process.env.LINEAR_WORKSPACE = originalWorkspace;

    await rm(tempDir, { recursive: true, force: true });
    await rm(projectDir, { recursive: true, force: true });
  });

  test("env api token overrides workspace selection", async () => {
    await saveConfig({
      defaultWorkspace: "acme",
      workspaces: { acme: { apiToken: "cfg-api" } },
      outputFormat: "table",
    });

    process.env.LINEAR_API_TOKEN = "env-api";

    const auth = await resolveAuth({ workspace: "acme" });
    expect(auth?.source).toBe("env");
    expect(auth?.kind).toBe("api");
    expect(auth?.header).toBe("env-api");
  });

  test("selects explicit workspace", async () => {
    await saveConfig({
      defaultWorkspace: "acme",
      workspaces: {
        acme: { apiToken: "api-acme" },
        personal: { apiToken: "api-personal" },
      },
      outputFormat: "table",
    });

    const auth = await resolveAuth({ workspace: "personal" });
    expect(auth?.workspace).toBe("personal");
    expect(auth?.kind).toBe("api");
    expect(auth?.header).toBe("api-personal");
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

  test("returns undefined when no workspace has apiToken", async () => {
    await saveConfig({
      defaultWorkspace: "acme",
      workspaces: { acme: { orgName: "Acme Inc" } },
      outputFormat: "table",
    });

    const auth = await resolveAuth();
    expect(auth).toBeUndefined();
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

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "linear-cli-test-"));
    process.env.XDG_CONFIG_HOME = tempDir;
    delete process.env.LINEAR_API_TOKEN;
  });

  afterEach(async () => {
    if (originalXdgConfigHome === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = originalXdgConfigHome;

    if (originalApiToken === undefined) delete process.env.LINEAR_API_TOKEN;
    else process.env.LINEAR_API_TOKEN = originalApiToken;

    await rm(tempDir, { recursive: true, force: true });
  });

  test("returns api env token", async () => {
    process.env.LINEAR_API_TOKEN = "api-token";

    await expect(getApiToken()).resolves.toBe("api-token");
  });

  test("returns workspace config token", async () => {
    await saveConfig({
      defaultWorkspace: "acme",
      workspaces: {
        acme: { apiToken: "api-token" },
      },
      outputFormat: "table",
    });

    await expect(getApiToken()).resolves.toBe("api-token");
  });
});
