/**
 * Configuration management for linear-cli.
 * Handles loading, saving, and validating config from ~/.config/linear-cli/config.json
 */

import { chmod, mkdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { CONFIG_FILE, VERSION } from "./constants.ts";
import { CliError } from "./errors.ts";

export interface WorkspaceProfile {
  apiToken?: string;
  orgName?: string;
  defaultTeamKey?: string;
  outputFormat?: "json" | "table";
}

export interface Config {
  // Workspace profiles
  workspaces?: Record<string, WorkspaceProfile>;
  defaultWorkspace?: string;

  // Defaults
  defaultTeamKey?: string;
  outputFormat?: "json" | "table";
  localConfigPaths?: string[];
}

interface ConfigFileShape {
  $schema?: string;
  workspaces?: Record<string, WorkspaceProfile>;
  defaultWorkspace?: string;
  defaultTeamKey?: string;
  outputFormat?: "json" | "table";
  localConfigPaths?: string[];
}

export interface LocalConfig {
  workspace?: string;
  defaultTeamKey?: string;
  defaultProject?: string;
  outputFormat?: "json" | "table";
}

/**
 * Rich auth resolution result.
 */
export interface ResolvedAuth {
  /** Formatted Authorization header value */
  header: string;
  /** Raw token value (without "Bearer " prefix) */
  token: string;
  /** Whether token came from env var or config file */
  source: "env" | "config";
  /** Token kind (API keys only) */
  kind: "api";
  /** Workspace profile used (config tokens only) */
  workspace?: string;
}

const DEFAULT_CONFIG: Config = {
  outputFormat: "table",
};

export const DEFAULT_LOCAL_CONFIG_PATHS = [
  ".agents/linear.json",
  ".linear.json",
  ".linear/config.json",
];

function parseWorkspaceProfile(data: unknown): WorkspaceProfile {
  if (!data || typeof data !== "object") {
    return {};
  }

  const obj = data as Record<string, unknown>;
  const profile: WorkspaceProfile = {};

  if (typeof obj.apiToken === "string") {
    profile.apiToken = obj.apiToken;
  }
  if (typeof obj.orgName === "string") {
    profile.orgName = obj.orgName;
  }
  if (typeof obj.defaultTeamKey === "string") {
    profile.defaultTeamKey = obj.defaultTeamKey;
  }
  if (obj.outputFormat === "json" || obj.outputFormat === "table") {
    profile.outputFormat = obj.outputFormat;
  }

  return profile;
}

function getWorkspaceNames(config: Config): string[] {
  return Object.keys(config.workspaces ?? {});
}

function resolveWorkspaceName(
  config: Config,
  local: LocalConfig | undefined,
  context?: { workspace?: string },
): string | undefined {
  const workspaceNames = getWorkspaceNames(config);

  const explicitWorkspace =
    context?.workspace ?? process.env.LINEAR_WORKSPACE ?? local?.workspace;

  if (explicitWorkspace) {
    if (!workspaceNames.includes(explicitWorkspace)) {
      throw new CliError(
        `Workspace "${explicitWorkspace}" not found in config.`,
        {
          suggestion:
            "Run 'linear auth list' to see available workspaces, or 'linear auth login --workspace " +
            explicitWorkspace +
            "' to add one.",
        },
      );
    }
    return explicitWorkspace;
  }

  if (
    config.defaultWorkspace &&
    workspaceNames.includes(config.defaultWorkspace)
  ) {
    return config.defaultWorkspace;
  }

  if (workspaceNames.length === 1) {
    return workspaceNames[0];
  }

  if (
    config.defaultWorkspace &&
    !workspaceNames.includes(config.defaultWorkspace) &&
    workspaceNames.length > 1
  ) {
    throw new CliError(
      "Configured default workspace is missing and multiple workspaces are available.",
      {
        suggestion: `Run 'linear auth use <name>' to pick a default. Available workspaces: ${workspaceNames.join(", ")}`,
      },
    );
  }

  if (workspaceNames.length > 1) {
    throw new CliError(
      "Multiple workspaces configured. Specify one with --workspace or set a default with 'linear auth use <name>'.",
      {
        suggestion: `Available workspaces: ${workspaceNames.join(", ")}`,
      },
    );
  }

  return undefined;
}

/**
 * Get the path to the config directory.
 * Respects XDG_CONFIG_HOME, falls back to ~/.config
 */
export function getConfigDir(): string {
  const configHome = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(configHome, "linear-cli");
}

/**
 * Get the path to the config file.
 */
export function getConfigPath(): string {
  return join(getConfigDir(), CONFIG_FILE);
}

export function getConfigSchemaUrl(): string {
  return `https://raw.githubusercontent.com/aliou/linear-cli/v${VERSION}/schemas/config.schema.json`;
}

/**
 * Validate config object structure.
 * Returns a valid Config object, stripping unknown fields.
 * Top-level auth fields (apiToken, oauth, accessToken, etc.) are ignored entirely.
 */
export function validateConfig(data: unknown): Config {
  if (!data || typeof data !== "object") {
    return { ...DEFAULT_CONFIG };
  }

  const obj = data as Record<string, unknown>;
  const config: Config = { ...DEFAULT_CONFIG };

  if (typeof obj.defaultWorkspace === "string") {
    config.defaultWorkspace = obj.defaultWorkspace;
  }

  if (obj.workspaces && typeof obj.workspaces === "object") {
    const workspaceObj = obj.workspaces as Record<string, unknown>;
    const parsedWorkspaces: Record<string, WorkspaceProfile> = {};

    for (const [name, value] of Object.entries(workspaceObj)) {
      if (!name) continue;
      parsedWorkspaces[name] = parseWorkspaceProfile(value);
    }

    if (Object.keys(parsedWorkspaces).length > 0) {
      config.workspaces = parsedWorkspaces;
    }
  }

  if (typeof obj.defaultTeamKey === "string") {
    config.defaultTeamKey = obj.defaultTeamKey;
  }

  if (obj.outputFormat === "json" || obj.outputFormat === "table") {
    config.outputFormat = obj.outputFormat;
  }

  if (
    Array.isArray(obj.localConfigPaths) &&
    obj.localConfigPaths.every((p: unknown) => typeof p === "string")
  ) {
    config.localConfigPaths = obj.localConfigPaths as string[];
  }

  return config;
}

/**
 * Load config from disk.
 * Returns default config if file doesn't exist.
 */
export async function loadConfig(): Promise<Config> {
  const configPath = getConfigPath();

  try {
    const file = Bun.file(configPath);
    const exists = await file.exists();

    if (!exists) {
      return { ...DEFAULT_CONFIG };
    }

    const content = await file.text();
    const data = JSON.parse(content);
    return validateConfig(data);
  } catch (error) {
    // If JSON parsing fails, return default config
    if (error instanceof SyntaxError) {
      console.error(
        `Warning: Invalid config file at ${configPath}, using defaults`,
      );
      return { ...DEFAULT_CONFIG };
    }
    throw error;
  }
}

/**
 * Save config to disk.
 * Creates directory with 0700 and file with 0600 permissions.
 * Only writes workspace-keyed apiToken shape; no oauth blocks ever.
 */
export async function saveConfig(config: Config): Promise<void> {
  const configPath = getConfigPath();
  const configDir = dirname(configPath);

  // Create directory with restricted permissions (owner only)
  await mkdir(configDir, { recursive: true, mode: 0o700 });

  const fileShape: ConfigFileShape = {
    $schema: getConfigSchemaUrl(),
    outputFormat: config.outputFormat,
  };

  if (config.defaultWorkspace) {
    fileShape.defaultWorkspace = config.defaultWorkspace;
  }

  if (config.workspaces && Object.keys(config.workspaces).length > 0) {
    fileShape.workspaces = {};
    for (const [name, profile] of Object.entries(config.workspaces)) {
      const fileProfile: WorkspaceProfile = {};
      if (profile.apiToken) fileProfile.apiToken = profile.apiToken;
      if (profile.orgName) fileProfile.orgName = profile.orgName;
      if (profile.defaultTeamKey)
        fileProfile.defaultTeamKey = profile.defaultTeamKey;
      if (profile.outputFormat) fileProfile.outputFormat = profile.outputFormat;
      fileShape.workspaces[name] = fileProfile;
    }
  }

  if (config.defaultTeamKey) {
    fileShape.defaultTeamKey = config.defaultTeamKey;
  }

  if (config.localConfigPaths) {
    fileShape.localConfigPaths = config.localConfigPaths;
  }

  // Write config file
  const content = `${JSON.stringify(fileShape, null, 2)}\n`;
  await Bun.write(configPath, content);

  // Set file permissions (owner read/write only)
  await chmod(configPath, 0o600);
}

/**
 * Update specific config fields without overwriting the entire config.
 */
export async function updateConfig(updates: Partial<Config>): Promise<Config> {
  const current = await loadConfig();
  const updated = { ...current, ...updates };
  await saveConfig(updated);
  return updated;
}

export async function saveWorkspaceProfile(
  name: string,
  profile: WorkspaceProfile,
): Promise<void> {
  const config = await loadConfig();
  const workspaces = { ...(config.workspaces ?? {}) };
  workspaces[name] = profile;

  await saveConfig({
    ...config,
    workspaces,
  });
}

export async function setDefaultWorkspace(name: string): Promise<void> {
  const config = await loadConfig();
  const workspaces = config.workspaces ?? {};

  if (!workspaces[name]) {
    throw new CliError(`Workspace "${name}" not found in config.`, {
      suggestion:
        "Run 'linear auth list' to see available workspaces, or 'linear auth login --workspace " +
        name +
        "' to add one.",
    });
  }

  await saveConfig({
    ...config,
    defaultWorkspace: name,
  });
}

/**
 * Resolve auth credentials, checking env vars first then config.
 * Precedence:
 *   1. LINEAR_API_TOKEN (env)
 *   2. selected workspace profile apiToken
 */
export async function resolveAuth(context?: {
  workspace?: string;
}): Promise<ResolvedAuth | undefined> {
  const envApiToken = process.env.LINEAR_API_TOKEN;
  if (envApiToken) {
    return {
      header: envApiToken,
      token: envApiToken,
      source: "env",
      kind: "api",
    };
  }

  const config = await loadConfig();
  const local = await loadLocalConfig(config.localConfigPaths);
  const workspace = resolveWorkspaceName(config, local, context);

  if (workspace) {
    const profile = config.workspaces?.[workspace];

    if (profile?.apiToken) {
      return {
        header: profile.apiToken,
        token: profile.apiToken,
        source: "config",
        kind: "api",
        workspace,
      };
    }

    return undefined;
  }

  return undefined;
}

/**
 * Get the auth token, checking env vars first, then config file.
 * Returns the formatted Authorization header value.
 */
export async function getApiToken(): Promise<string | undefined> {
  const auth = await resolveAuth();
  return auth?.header;
}

/**
 * Check file permissions and warn if too open.
 * Returns true if permissions are safe (owner-only).
 */
export async function checkConfigPermissions(): Promise<boolean> {
  const configPath = getConfigPath();

  try {
    const stats = await stat(configPath);
    const mode = stats.mode & 0o777;

    // Warn if group or others can read
    if (mode & 0o077) {
      console.error(
        `Warning: Config file ${configPath} has unsafe permissions (${mode.toString(8)}).`,
      );
      console.error(`Consider running: chmod 600 ${configPath}`);
      return false;
    }

    return true;
  } catch {
    // File doesn't exist yet, that's fine
    return true;
  }
}

/**
 * Validate local config object structure.
 * Returns a valid LocalConfig object, stripping unknown fields.
 */
export function validateLocalConfig(data: unknown): LocalConfig {
  if (!data || typeof data !== "object") {
    return {};
  }

  const obj = data as Record<string, unknown>;
  const config: LocalConfig = {};

  if (typeof obj.workspace === "string") {
    config.workspace = obj.workspace;
  }

  if (typeof obj.defaultTeamKey === "string") {
    config.defaultTeamKey = obj.defaultTeamKey;
  }

  if (typeof obj.defaultProject === "string") {
    config.defaultProject = obj.defaultProject;
  }

  if (obj.outputFormat === "json" || obj.outputFormat === "table") {
    config.outputFormat = obj.outputFormat;
  }

  return config;
}

/**
 * Load a local config file by walking up directories from cwd.
 * Searches DEFAULT_LOCAL_CONFIG_PATHS (plus any additional paths from global config)
 * at each directory until reaching / or homedir().
 */
export async function loadLocalConfig(
  additionalPaths?: string[],
): Promise<LocalConfig | undefined> {
  const home = homedir();
  const searchPaths = [
    ...DEFAULT_LOCAL_CONFIG_PATHS,
    ...(additionalPaths ?? []),
  ];

  let dir = process.cwd();

  while (true) {
    for (const relPath of searchPaths) {
      const filePath = join(dir, relPath);
      try {
        const file = Bun.file(filePath);
        const exists = await file.exists();
        if (exists) {
          const content = await file.text();
          const data = JSON.parse(content);
          return validateLocalConfig(data);
        }
      } catch {
        // Skip files that can't be read or parsed
      }
    }

    // Stop at filesystem root or home directory
    if (dir === "/" || dir === home) {
      break;
    }

    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  return undefined;
}

/**
 * Load global config and local config, applying workspace and local overrides.
 * Merge order:
 *   global defaults < workspace profile defaults < local overrides
 */
export function resolveWorkspaceFromGlobalConfig(
  config: Config,
  context?: { workspace?: string },
): string | undefined {
  return resolveWorkspaceName(config, undefined, context);
}

export async function loadLocalConfigFromPath(
  filePath: string,
): Promise<LocalConfig | undefined> {
  try {
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return undefined;
    }
    const content = await file.text();
    const data = JSON.parse(content);
    return validateLocalConfig(data);
  } catch {
    return undefined;
  }
}

export async function saveLocalConfigToPath(
  filePath: string,
  local: LocalConfig,
): Promise<void> {
  const content = `${JSON.stringify(local, null, 2)}\n`;
  await Bun.write(filePath, content);
}

export async function loadMergedConfig(context?: {
  workspace?: string;
}): Promise<{
  config: Config;
  local: LocalConfig | undefined;
  workspaceName?: string;
}> {
  const config = await loadConfig();
  const local = await loadLocalConfig(config.localConfigPaths);
  const workspaceName = resolveWorkspaceName(config, local, context);

  const merged: Config = { ...config };

  if (workspaceName) {
    const profile = config.workspaces?.[workspaceName];
    if (profile) {
      if (profile.defaultTeamKey !== undefined) {
        merged.defaultTeamKey = profile.defaultTeamKey;
      }
      if (profile.outputFormat !== undefined) {
        merged.outputFormat = profile.outputFormat;
      }
    }
  }

  if (local) {
    if (local.defaultTeamKey !== undefined) {
      merged.defaultTeamKey = local.defaultTeamKey;
    }
    if (local.outputFormat !== undefined) {
      merged.outputFormat = local.outputFormat;
    }
  }

  return { config: merged, local, workspaceName };
}
