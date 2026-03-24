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
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
  orgName?: string;
  defaultTeamKey?: string;
  outputFormat?: "json" | "table";
}

interface WorkspaceFileProfile {
  apiToken?: string;
  oauth?: {
    access?: string;
    refresh?: string;
    expiresAt?: string;
    clientId?: string;
    clientSecret?: string;
  };
  orgName?: string;
  defaultTeamKey?: string;
  outputFormat?: "json" | "table";
}

export interface Config {
  // Workspace profiles
  workspaces?: Record<string, WorkspaceProfile>;
  defaultWorkspace?: string;

  // Active workspace credentials (resolved from workspace or legacy)
  apiToken?: string;
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;

  // Defaults
  defaultTeamKey?: string;
  outputFormat?: "json" | "table";
  localConfigPaths?: string[];
}

export interface ConfigFileShape {
  $schema?: string;

  // New workspace-keyed config
  workspaces?: Record<string, WorkspaceFileProfile>;
  defaultWorkspace?: string;

  // Legacy top-level fields (kept for backward compatibility)
  apiToken?: string;
  oauth?: {
    access?: string;
    refresh?: string;
    expiresAt?: string;
    clientId?: string;
    clientSecret?: string;
  };
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
  /** Whether this is an oauth or api token */
  kind: "oauth" | "api";
  /** Workspace profile used (config tokens only) */
  workspace?: string;
  /** Refresh token (config oauth only) */
  refreshToken?: string;
  /** ISO expiry timestamp (config oauth only) */
  accessTokenExpiresAt?: string;
}

const DEFAULT_CONFIG: Config = {
  outputFormat: "table",
};

const DEFAULT_LOCAL_CONFIG_PATHS = [
  ".agents/linear.json",
  ".linear.json",
  ".linear/config.json",
];

export interface ConfigMigration {
  name: string;
  shouldRun: (data: Record<string, unknown>) => boolean;
  run: (data: Record<string, unknown>) => Record<string, unknown>;
}

function parseWorkspaceFileProfile(data: unknown): WorkspaceProfile {
  if (!data || typeof data !== "object") {
    return {};
  }

  const obj = data as Record<string, unknown>;
  const oauth =
    obj.oauth && typeof obj.oauth === "object"
      ? (obj.oauth as Record<string, unknown>)
      : undefined;

  const profile: WorkspaceProfile = {};

  if (typeof obj.apiToken === "string") {
    profile.apiToken = obj.apiToken;
  }

  if (typeof oauth?.access === "string") {
    profile.accessToken = oauth.access;
  }

  if (typeof oauth?.refresh === "string") {
    profile.refreshToken = oauth.refresh;
  }

  if (typeof oauth?.expiresAt === "string") {
    profile.accessTokenExpiresAt = oauth.expiresAt;
  }

  if (typeof oauth?.clientId === "string") {
    profile.oauthClientId = oauth.clientId;
  }

  if (typeof oauth?.clientSecret === "string") {
    profile.oauthClientSecret = oauth.clientSecret;
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

function workspaceProfileToFile(
  profile: WorkspaceProfile,
): WorkspaceFileProfile {
  const fileProfile: WorkspaceFileProfile = {};

  if (profile.apiToken) {
    fileProfile.apiToken = profile.apiToken;
  }

  if (
    profile.accessToken ||
    profile.refreshToken ||
    profile.accessTokenExpiresAt ||
    profile.oauthClientId ||
    profile.oauthClientSecret
  ) {
    fileProfile.oauth = {};
    if (profile.accessToken) {
      fileProfile.oauth.access = profile.accessToken;
    }
    if (profile.refreshToken) {
      fileProfile.oauth.refresh = profile.refreshToken;
    }
    if (profile.accessTokenExpiresAt) {
      fileProfile.oauth.expiresAt = profile.accessTokenExpiresAt;
    }
    if (profile.oauthClientId) {
      fileProfile.oauth.clientId = profile.oauthClientId;
    }
    if (profile.oauthClientSecret) {
      fileProfile.oauth.clientSecret = profile.oauthClientSecret;
    }
  }

  if (profile.orgName) {
    fileProfile.orgName = profile.orgName;
  }

  if (profile.defaultTeamKey) {
    fileProfile.defaultTeamKey = profile.defaultTeamKey;
  }

  if (profile.outputFormat) {
    fileProfile.outputFormat = profile.outputFormat;
  }

  return fileProfile;
}

function hasCredentials(profile: WorkspaceProfile): boolean {
  return Boolean(profile.accessToken || profile.apiToken);
}

function parseSemverParts(
  version: string,
): [number, number, number] | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) return undefined;

  const major = Number.parseInt(match[1] ?? "0", 10);
  const minor = Number.parseInt(match[2] ?? "0", 10);
  const patch = Number.parseInt(match[3] ?? "0", 10);

  if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch)) {
    return undefined;
  }

  return [major, minor, patch];
}

function getPreviousCliVersion(version: string): string {
  const parts = parseSemverParts(version);
  if (!parts) return version;

  let [major, minor, patch] = parts;

  if (patch > 0) {
    patch -= 1;
  } else if (minor > 0) {
    minor -= 1;
    patch = 0;
  } else if (major > 0) {
    major -= 1;
    minor = 0;
    patch = 0;
  }

  return `${major}.${minor}.${patch}`;
}

function hasLegacyAuthFields(data: Record<string, unknown>): boolean {
  const oauth =
    data.oauth && typeof data.oauth === "object"
      ? (data.oauth as Record<string, unknown>)
      : undefined;

  return (
    typeof data.apiToken === "string" ||
    typeof data.accessToken === "string" ||
    typeof data.refreshToken === "string" ||
    typeof data.accessTokenExpiresAt === "string" ||
    typeof data.oauthClientId === "string" ||
    typeof data.oauthClientSecret === "string" ||
    typeof oauth?.access === "string" ||
    typeof oauth?.refresh === "string" ||
    typeof oauth?.expiresAt === "string" ||
    typeof oauth?.clientId === "string" ||
    typeof oauth?.clientSecret === "string"
  );
}

const CONFIG_MIGRATIONS: ConfigMigration[] = [
  {
    name: "legacy-flat-auth-to-workspaces",
    shouldRun: (data) => {
      const hasWorkspaces =
        data.workspaces !== undefined &&
        data.workspaces !== null &&
        typeof data.workspaces === "object";
      return !hasWorkspaces && hasLegacyAuthFields(data);
    },
    run: (data) => {
      const next: Record<string, unknown> = { ...data };

      const oauth =
        next.oauth && typeof next.oauth === "object"
          ? ({ ...(next.oauth as Record<string, unknown>) } as Record<
              string,
              unknown
            >)
          : undefined;

      const workspaceProfile: Record<string, unknown> = {};

      if (typeof next.apiToken === "string") {
        workspaceProfile.apiToken = next.apiToken;
      }

      const access =
        typeof next.accessToken === "string"
          ? next.accessToken
          : typeof oauth?.access === "string"
            ? oauth.access
            : undefined;

      const refresh =
        typeof next.refreshToken === "string"
          ? next.refreshToken
          : typeof oauth?.refresh === "string"
            ? oauth.refresh
            : undefined;

      const expiresAt =
        typeof next.accessTokenExpiresAt === "string"
          ? next.accessTokenExpiresAt
          : typeof oauth?.expiresAt === "string"
            ? oauth.expiresAt
            : undefined;

      const clientId =
        typeof next.oauthClientId === "string"
          ? next.oauthClientId
          : typeof oauth?.clientId === "string"
            ? oauth.clientId
            : undefined;

      const clientSecret =
        typeof next.oauthClientSecret === "string"
          ? next.oauthClientSecret
          : typeof oauth?.clientSecret === "string"
            ? oauth.clientSecret
            : undefined;

      if (
        access !== undefined ||
        refresh !== undefined ||
        expiresAt !== undefined ||
        clientId !== undefined ||
        clientSecret !== undefined
      ) {
        const oauthProfile: Record<string, unknown> = {};
        if (access !== undefined) oauthProfile.access = access;
        if (refresh !== undefined) oauthProfile.refresh = refresh;
        if (expiresAt !== undefined) oauthProfile.expiresAt = expiresAt;
        if (clientId !== undefined) oauthProfile.clientId = clientId;
        if (clientSecret !== undefined)
          oauthProfile.clientSecret = clientSecret;
        workspaceProfile.oauth = oauthProfile;
      }

      next.workspaces = { default: workspaceProfile };
      next.defaultWorkspace =
        typeof next.defaultWorkspace === "string"
          ? next.defaultWorkspace
          : "default";

      delete next.apiToken;
      delete next.accessToken;
      delete next.refreshToken;
      delete next.accessTokenExpiresAt;
      delete next.oauthClientId;
      delete next.oauthClientSecret;
      delete next.oauth;

      return next;
    },
  },
];

function getWorkspaceNames(config: Config): string[] {
  return Object.keys(config.workspaces ?? {});
}

function buildWorkspaceMapForSave(config: Config): {
  workspaces: Record<string, WorkspaceProfile>;
  defaultWorkspace?: string;
} {
  const workspaces: Record<string, WorkspaceProfile> = {
    ...(config.workspaces ?? {}),
  };

  // Legacy migration: if no explicit workspace profiles exist, move legacy auth
  // into a default workspace profile on save.
  if (Object.keys(workspaces).length === 0) {
    const legacyProfile: WorkspaceProfile = {};

    if (config.apiToken) {
      legacyProfile.apiToken = config.apiToken;
    }
    if (config.accessToken) {
      legacyProfile.accessToken = config.accessToken;
    }
    if (config.refreshToken) {
      legacyProfile.refreshToken = config.refreshToken;
    }
    if (config.accessTokenExpiresAt) {
      legacyProfile.accessTokenExpiresAt = config.accessTokenExpiresAt;
    }
    if (config.oauthClientId) {
      legacyProfile.oauthClientId = config.oauthClientId;
    }
    if (config.oauthClientSecret) {
      legacyProfile.oauthClientSecret = config.oauthClientSecret;
    }

    if (hasCredentials(legacyProfile) || legacyProfile.refreshToken) {
      const profileName = config.defaultWorkspace ?? "default";
      workspaces[profileName] = legacyProfile;
      return { workspaces, defaultWorkspace: profileName };
    }
  }

  return {
    workspaces,
    defaultWorkspace: config.defaultWorkspace,
  };
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
 */
export function validateConfig(data: unknown): Config {
  if (!data || typeof data !== "object") {
    return { ...DEFAULT_CONFIG };
  }

  const obj = data as Record<string, unknown>;
  const oauth =
    obj.oauth && typeof obj.oauth === "object"
      ? (obj.oauth as Record<string, unknown>)
      : undefined;

  const config: Config = { ...DEFAULT_CONFIG };

  if (typeof obj.defaultWorkspace === "string") {
    config.defaultWorkspace = obj.defaultWorkspace;
  }

  if (obj.workspaces && typeof obj.workspaces === "object") {
    const workspaceObj = obj.workspaces as Record<string, unknown>;
    const parsedWorkspaces: Record<string, WorkspaceProfile> = {};

    for (const [name, value] of Object.entries(workspaceObj)) {
      if (!name) continue;
      parsedWorkspaces[name] = parseWorkspaceFileProfile(value);
    }

    if (Object.keys(parsedWorkspaces).length > 0) {
      config.workspaces = parsedWorkspaces;
    }
  }

  // Parse legacy flat fields for backward compatibility.
  if (typeof obj.apiToken === "string") {
    config.apiToken = obj.apiToken;
  }

  if (typeof obj.accessToken === "string") {
    config.accessToken = obj.accessToken;
  } else if (typeof oauth?.access === "string") {
    config.accessToken = oauth.access;
  }

  if (typeof obj.refreshToken === "string") {
    config.refreshToken = obj.refreshToken;
  } else if (typeof oauth?.refresh === "string") {
    config.refreshToken = oauth.refresh;
  }

  if (typeof obj.accessTokenExpiresAt === "string") {
    config.accessTokenExpiresAt = obj.accessTokenExpiresAt;
  } else if (typeof oauth?.expiresAt === "string") {
    config.accessTokenExpiresAt = oauth.expiresAt;
  }

  if (typeof obj.oauthClientId === "string") {
    config.oauthClientId = obj.oauthClientId;
  } else if (typeof oauth?.clientId === "string") {
    config.oauthClientId = oauth.clientId;
  }

  if (typeof obj.oauthClientSecret === "string") {
    config.oauthClientSecret = obj.oauthClientSecret;
  } else if (typeof oauth?.clientSecret === "string") {
    config.oauthClientSecret = oauth.clientSecret;
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

  // Implicit legacy migration in memory only: expose a default workspace profile
  // so workspace-aware reads still work before the next save.
  if (
    !config.workspaces &&
    (config.apiToken || config.accessToken || config.refreshToken)
  ) {
    config.workspaces = {
      default: {
        apiToken: config.apiToken,
        accessToken: config.accessToken,
        refreshToken: config.refreshToken,
        accessTokenExpiresAt: config.accessTokenExpiresAt,
        oauthClientId: config.oauthClientId,
        oauthClientSecret: config.oauthClientSecret,
      },
    };
    config.defaultWorkspace = config.defaultWorkspace ?? "default";
  }

  return config;
}

async function backupConfigForMigration(configPath: string): Promise<void> {
  const previousVersion = getPreviousCliVersion(VERSION);
  const backupPath = join(
    dirname(configPath),
    `config.${previousVersion}.json`,
  );

  const backupFile = Bun.file(backupPath);
  if (await backupFile.exists()) {
    return;
  }

  const source = Bun.file(configPath);
  const content = await source.text();
  await Bun.write(backupPath, content);
  await chmod(backupPath, 0o600);
}

async function migrateConfigFileIfNeeded(configPath: string): Promise<void> {
  const file = Bun.file(configPath);
  if (!(await file.exists())) {
    return;
  }

  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return;
  }

  if (!data || typeof data !== "object") {
    return;
  }

  let current = data as Record<string, unknown>;
  let changed = false;

  for (const migration of CONFIG_MIGRATIONS) {
    if (!migration.shouldRun(current)) {
      continue;
    }

    if (!changed) {
      await backupConfigForMigration(configPath);
    }

    current = migration.run(current);
    changed = true;
  }

  if (!changed) {
    return;
  }

  await saveConfig(validateConfig(current));
}

export async function migrateConfigOnStartup(): Promise<void> {
  await migrateConfigFileIfNeeded(getConfigPath());
}

/**
 * Load config from disk.
 * Returns default config if file doesn't exist.
 */
export async function loadConfig(): Promise<Config> {
  const configPath = getConfigPath();

  await migrateConfigFileIfNeeded(configPath);

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
 */
export async function saveConfig(config: Config): Promise<void> {
  const configPath = getConfigPath();
  const configDir = dirname(configPath);

  // Create directory with restricted permissions (owner only)
  await mkdir(configDir, { recursive: true, mode: 0o700 });

  const normalized = buildWorkspaceMapForSave(config);

  const fileShape: ConfigFileShape = {
    $schema: getConfigSchemaUrl(),
    outputFormat: config.outputFormat,
  };

  if (normalized.defaultWorkspace) {
    fileShape.defaultWorkspace = normalized.defaultWorkspace;
  }

  if (Object.keys(normalized.workspaces).length > 0) {
    fileShape.workspaces = {};
    for (const [name, profile] of Object.entries(normalized.workspaces)) {
      fileShape.workspaces[name] = workspaceProfileToFile(profile);
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
 *   1. LINEAR_OAUTH_TOKEN (env, oauth)
 *   2. LINEAR_API_TOKEN   (env, api)
 *   3. workspace profile oauth token
 *   4. workspace profile api token
 *   5. legacy config accessToken/apiToken (backward compat)
 */
export async function resolveAuth(context?: {
  workspace?: string;
}): Promise<ResolvedAuth | undefined> {
  const envOauthToken = process.env.LINEAR_OAUTH_TOKEN;
  if (envOauthToken) {
    return {
      header: `Bearer ${envOauthToken}`,
      token: envOauthToken,
      source: "env",
      kind: "oauth",
    };
  }

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

    if (profile?.accessToken) {
      return {
        header: `Bearer ${profile.accessToken}`,
        token: profile.accessToken,
        source: "config",
        kind: "oauth",
        workspace,
        refreshToken: profile.refreshToken,
        accessTokenExpiresAt: profile.accessTokenExpiresAt,
      };
    }

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

  // Legacy fallback for old flat config.
  if (config.accessToken) {
    return {
      header: `Bearer ${config.accessToken}`,
      token: config.accessToken,
      source: "config",
      kind: "oauth",
      refreshToken: config.refreshToken,
      accessTokenExpiresAt: config.accessTokenExpiresAt,
    };
  }

  if (config.apiToken) {
    return {
      header: config.apiToken,
      token: config.apiToken,
      source: "config",
      kind: "api",
    };
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
 * Resolve OAuth client credentials for token refresh.
 * Environment variables take precedence over config file values.
 */
export async function resolveOAuthClientCredentials(context?: {
  workspace?: string;
}): Promise<{ clientId: string; clientSecret: string } | undefined> {
  const clientId = process.env.LINEAR_CLIENT_ID;
  const clientSecret = process.env.LINEAR_CLIENT_SECRET;

  if (clientId && clientSecret) {
    return { clientId, clientSecret };
  }

  const config = await loadConfig();
  const local = await loadLocalConfig(config.localConfigPaths);
  const workspace = resolveWorkspaceName(config, local, context);

  if (workspace) {
    const profile = config.workspaces?.[workspace];
    if (profile?.oauthClientId && profile.oauthClientSecret) {
      return {
        clientId: profile.oauthClientId,
        clientSecret: profile.oauthClientSecret,
      };
    }
  }

  if (config.oauthClientId && config.oauthClientSecret) {
    return {
      clientId: config.oauthClientId,
      clientSecret: config.oauthClientSecret,
    };
  }

  return undefined;
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
      if (profile.apiToken !== undefined) {
        merged.apiToken = profile.apiToken;
      }
      if (profile.accessToken !== undefined) {
        merged.accessToken = profile.accessToken;
      }
      if (profile.refreshToken !== undefined) {
        merged.refreshToken = profile.refreshToken;
      }
      if (profile.accessTokenExpiresAt !== undefined) {
        merged.accessTokenExpiresAt = profile.accessTokenExpiresAt;
      }
      if (profile.oauthClientId !== undefined) {
        merged.oauthClientId = profile.oauthClientId;
      }
      if (profile.oauthClientSecret !== undefined) {
        merged.oauthClientSecret = profile.oauthClientSecret;
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
