/**
 * Authentication utilities for linear-cli.
 * Handles token storage, validation, and auth status.
 */

import { fetchOrganization, fetchViewer } from "./api.ts";
import {
  checkConfigPermissions,
  loadConfig,
  type ResolvedAuth,
  resolveAuth,
  saveConfig,
} from "./config.ts";
import { CliError } from "./errors.ts";
import { refreshOAuthToken } from "./oauth.ts";

export { refreshOAuthToken };

export interface AuthStatus {
  authenticated: boolean;
  name?: string;
  email?: string;
  workspace?: string;
  orgName?: string;
  tokenSource?: "env" | "config";
  error?: string;
}

export interface LoginResult {
  success: boolean;
  name?: string;
  email?: string;
  workspace?: string;
  orgName?: string;
  error?: string;
}

export type TokenKind = "api" | "oauth";

function formatTokenForApi(token: string, kind: TokenKind): string {
  return kind === "oauth" ? `Bearer ${token}` : token;
}

/**
 * Perform login: validate token and store in config.
 * For OAuth logins, optionally persist refreshToken and accessTokenExpiresAt.
 */
export async function login(
  token: string,
  kind: TokenKind,
  options?: { refreshToken?: string; expiresAt?: string; workspace?: string },
): Promise<LoginResult> {
  try {
    const trimmedToken = token.trim();
    const authHeader = formatTokenForApi(trimmedToken, kind);

    const viewer = await fetchViewer(authHeader);

    const explicitWorkspace = options?.workspace?.trim();
    if (options?.workspace !== undefined && !explicitWorkspace) {
      return {
        success: false,
        error: "Workspace name cannot be empty.",
      };
    }

    let organization:
      | {
          id: string;
          name: string;
          urlKey: string;
        }
      | undefined;

    try {
      organization = await fetchOrganization(authHeader);
    } catch {
      // Some tokens validate viewer but may not allow organization query.
      // Keep login working and fall back to explicit/default workspace naming.
      organization = undefined;
    }

    const config = await loadConfig();

    let workspace = explicitWorkspace ?? organization?.urlKey;
    if (!workspace) {
      const names = Object.keys(config.workspaces ?? {});
      if (names.length === 1) {
        workspace = names[0];
      }
    }

    if (!workspace) {
      return {
        success: false,
        error:
          "Could not auto-detect workspace. Re-run with --workspace <name>.",
      };
    }

    const workspaces = { ...(config.workspaces ?? {}) };
    const currentProfile = workspaces[workspace] ?? {};
    const hadWorkspaces = Object.keys(workspaces).length > 0;
    const isImplicitLegacyDefault =
      config.defaultWorkspace === "default" &&
      workspace !== "default" &&
      Object.keys(config.workspaces ?? {}).length === 1 &&
      (config.apiToken !== undefined ||
        config.accessToken !== undefined ||
        config.refreshToken !== undefined);

    if (kind === "oauth") {
      const { apiToken: _unusedApiToken, ...restProfile } = currentProfile;
      workspaces[workspace] = {
        ...restProfile,
        orgName: organization?.name ?? currentProfile.orgName,
        accessToken: trimmedToken,
        ...(options?.refreshToken !== undefined
          ? { refreshToken: options.refreshToken }
          : {}),
        ...(options?.expiresAt !== undefined
          ? { accessTokenExpiresAt: options.expiresAt }
          : {}),
      };
    } else {
      const {
        accessToken: _unusedAccessToken,
        refreshToken: _unusedRefreshToken,
        accessTokenExpiresAt: _unusedExpiresAt,
        ...restProfile
      } = currentProfile;
      workspaces[workspace] = {
        ...restProfile,
        orgName: organization?.name ?? currentProfile.orgName,
        apiToken: trimmedToken,
      };
    }

    if (isImplicitLegacyDefault) {
      delete workspaces.default;
    }

    await saveConfig({
      ...config,
      workspaces,
      defaultWorkspace:
        !hadWorkspaces || isImplicitLegacyDefault
          ? workspace
          : config.defaultWorkspace,
    });

    return {
      success: true,
      name: viewer.name,
      email: viewer.email,
      workspace,
      orgName: organization?.name,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Perform logout: remove token and related OAuth fields from config.
 */
export async function logout(workspace?: string): Promise<void> {
  const config = await loadConfig();

  const workspaceNames = Object.keys(config.workspaces ?? {});

  if (!workspace) {
    if (
      config.defaultWorkspace &&
      workspaceNames.includes(config.defaultWorkspace)
    ) {
      workspace = config.defaultWorkspace;
    } else if (workspaceNames.length === 1) {
      workspace = workspaceNames[0];
    }
  }

  if (!workspace && workspaceNames.length > 1) {
    throw new CliError(
      "Multiple workspaces configured. Specify one with --workspace or set a default with 'linear auth use <name>'.",
      {
        suggestion: `Available workspaces: ${workspaceNames.join(", ")}`,
      },
    );
  }

  if (
    workspace &&
    !config.workspaces?.[workspace] &&
    workspaceNames.length > 0
  ) {
    throw new CliError(`Workspace "${workspace}" not found in config.`, {
      suggestion: `Run 'linear auth list' to see available workspaces: ${workspaceNames.join(", ")}`,
    });
  }

  if (workspace && config.workspaces?.[workspace]) {
    const workspaces = { ...config.workspaces };
    delete workspaces[workspace];

    const nextDefault =
      config.defaultWorkspace === workspace ||
      (config.defaultWorkspace !== undefined &&
        !workspaceNames.includes(config.defaultWorkspace))
        ? undefined
        : config.defaultWorkspace;

    await saveConfig({
      ...config,
      workspaces,
      defaultWorkspace: nextDefault,
    });
    return;
  }

  // Legacy fallback
  delete config.apiToken;
  delete config.accessToken;
  delete config.refreshToken;
  delete config.accessTokenExpiresAt;
  delete config.defaultWorkspace;
  await saveConfig(config);
}

/**
 * Check current authentication status.
 */
export async function getAuthStatus(workspace?: string): Promise<AuthStatus> {
  await checkConfigPermissions();

  let auth: ResolvedAuth | undefined;
  try {
    auth = await resolveAuth({ workspace });
  } catch (error) {
    return {
      authenticated: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  if (!auth) {
    return {
      authenticated: false,
      error: "No API token configured",
    };
  }

  try {
    const viewer = await fetchViewer(auth);
    const config = await loadConfig();
    const orgName = auth.workspace
      ? config.workspaces?.[auth.workspace]?.orgName
      : undefined;

    return {
      authenticated: true,
      name: viewer.name,
      email: viewer.email,
      workspace: auth.workspace,
      orgName,
      tokenSource: auth.source,
    };
  } catch (error) {
    return {
      authenticated: false,
      tokenSource: auth.source,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Read token from stdin (for piping).
 */
export async function readTokenFromStdin(): Promise<string | null> {
  if (process.stdin.isTTY) {
    return null;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const input = Buffer.concat(chunks).toString("utf-8").trim();
    return input || null;
  } catch {
    return null;
  }
}

/**
 * Prompt for token interactively.
 */
export async function promptForToken(): Promise<string> {
  process.stdout.write("Enter token: ");

  return new Promise((resolve) => {
    let input = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => {
      input += chunk;
      if (input.includes("\n")) {
        process.stdin.pause();
        resolve(input.trim());
      }
    });
    process.stdin.resume();
  });
}

export async function promptForTokenKind(): Promise<TokenKind> {
  process.stdout.write("Token type [api/oauth]: ");

  return new Promise((resolve) => {
    let input = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => {
      input += chunk;
      if (!input.includes("\n")) {
        return;
      }

      process.stdin.pause();
      const value = input.trim().toLowerCase();
      resolve(value === "oauth" || value === "o" ? "oauth" : "api");
    });
    process.stdin.resume();
  });
}
