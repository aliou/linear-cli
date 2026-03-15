/**
 * Authentication utilities for linear-cli.
 * Handles token storage, validation, and auth status.
 */

import { fetchViewer } from "./api.ts";
import {
  checkConfigPermissions,
  loadConfig,
  saveConfig,
  updateConfig,
} from "./config.ts";

export interface AuthStatus {
  authenticated: boolean;
  name?: string;
  email?: string;
  tokenSource?: "env" | "config";
  error?: string;
}

export interface LoginResult {
  success: boolean;
  name?: string;
  email?: string;
  error?: string;
}

export type TokenKind = "api" | "oauth";

function formatTokenForApi(token: string, kind: TokenKind): string {
  return kind === "oauth" ? `Bearer ${token}` : token;
}

/**
 * Perform login: validate token and store in config.
 */
export async function login(
  token: string,
  kind: TokenKind,
): Promise<LoginResult> {
  try {
    const trimmedToken = token.trim();
    const viewer = await fetchViewer(formatTokenForApi(trimmedToken, kind));

    await updateConfig(
      kind === "oauth"
        ? { accessToken: trimmedToken, apiToken: undefined }
        : { apiToken: trimmedToken, accessToken: undefined },
    );

    return {
      success: true,
      name: viewer.name,
      email: viewer.email,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Perform logout: remove token from config.
 */
export async function logout(): Promise<void> {
  const config = await loadConfig();
  delete config.apiToken;
  delete config.accessToken;
  delete config.defaultTeamKey;
  await saveConfig(config);
}

/**
 * Check current authentication status.
 */
export async function getAuthStatus(): Promise<AuthStatus> {
  await checkConfigPermissions();

  const envOauthToken = process.env.LINEAR_OAUTH_TOKEN;
  const envApiToken = process.env.LINEAR_API_TOKEN;
  const config = await loadConfig();
  const token = envOauthToken
    ? formatTokenForApi(envOauthToken, "oauth")
    : envApiToken
      ? formatTokenForApi(envApiToken, "api")
      : config.accessToken
        ? formatTokenForApi(config.accessToken, "oauth")
        : config.apiToken
          ? formatTokenForApi(config.apiToken, "api")
          : undefined;

  if (!token) {
    return {
      authenticated: false,
      error: "No API token configured",
    };
  }

  const tokenSource = envOauthToken || envApiToken ? "env" : "config";

  try {
    const viewer = await fetchViewer(token);

    return {
      authenticated: true,
      name: viewer.name,
      email: viewer.email,
      tokenSource,
    };
  } catch (error) {
    return {
      authenticated: false,
      tokenSource,
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
