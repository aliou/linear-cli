/**
 * Configuration management for linear-cli.
 * Handles loading, saving, and validating config from ~/.config/linear-cli/config.json
 */

import { chmod, mkdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { CONFIG_FILE, VERSION } from "./constants.ts";

export interface Config {
  // Personal API token from Linear settings
  apiToken?: string;

  // OAuth token from a Linear app
  accessToken?: string;

  // OAuth refresh token (config-stored OAuth only)
  refreshToken?: string;

  // ISO timestamp at which the access token expires
  accessTokenExpiresAt?: string;

  // OAuth client credentials for token refresh
  oauthClientId?: string;
  oauthClientSecret?: string;

  // Default team key (e.g. "ENG")
  defaultTeamKey?: string;

  // Output preferences
  outputFormat?: "json" | "table";

  // Additional paths to search for local config files
  localConfigPaths?: string[];
}

export interface ConfigFileShape {
  $schema?: string;
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

  if (typeof oauth?.clientId === "string") {
    config.oauthClientId = oauth.clientId;
  }

  if (typeof oauth?.clientSecret === "string") {
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

  if (config.apiToken) {
    fileShape.apiToken = config.apiToken;
  }

  if (
    config.accessToken ||
    config.refreshToken ||
    config.accessTokenExpiresAt ||
    config.oauthClientId ||
    config.oauthClientSecret
  ) {
    fileShape.oauth = {};
    if (config.accessToken) {
      fileShape.oauth.access = config.accessToken;
    }
    if (config.refreshToken) {
      fileShape.oauth.refresh = config.refreshToken;
    }
    if (config.accessTokenExpiresAt) {
      fileShape.oauth.expiresAt = config.accessTokenExpiresAt;
    }
    if (config.oauthClientId) {
      fileShape.oauth.clientId = config.oauthClientId;
    }
    if (config.oauthClientSecret) {
      fileShape.oauth.clientSecret = config.oauthClientSecret;
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

/**
 * Resolve auth credentials, checking env vars first then config.
 * Precedence:
 *   1. LINEAR_OAUTH_TOKEN (env, oauth)
 *   2. LINEAR_API_TOKEN   (env, api)
 *   3. config.accessToken (config, oauth)
 *   4. config.apiToken    (config, api)
 */
export async function resolveAuth(): Promise<ResolvedAuth | undefined> {
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
export async function resolveOAuthClientCredentials(): Promise<
  { clientId: string; clientSecret: string } | undefined
> {
  const clientId = process.env.LINEAR_CLIENT_ID;
  const clientSecret = process.env.LINEAR_CLIENT_SECRET;

  if (clientId && clientSecret) {
    return { clientId, clientSecret };
  }

  const config = await loadConfig();
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
 * Load global config and local config, merging local overrides.
 * Local config values override global config values (except apiToken).
 */
export async function loadMergedConfig(): Promise<{
  config: Config;
  local: LocalConfig | undefined;
}> {
  const config = await loadConfig();
  const local = await loadLocalConfig(config.localConfigPaths);

  if (local) {
    if (local.defaultTeamKey !== undefined) {
      config.defaultTeamKey = local.defaultTeamKey;
    }
    if (local.outputFormat !== undefined) {
      config.outputFormat = local.outputFormat;
    }
  }

  return { config, local };
}
