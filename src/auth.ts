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

/**
 * Perform login: validate token and store in config.
 */
export async function login(token: string): Promise<LoginResult> {
  try {
    const viewer = await fetchViewer(token);

    await updateConfig({ apiToken: token });

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
  delete config.defaultTeamKey;
  await saveConfig(config);
}

/**
 * Check current authentication status.
 */
export async function getAuthStatus(): Promise<AuthStatus> {
  await checkConfigPermissions();

  const envToken = process.env.LINEAR_API_TOKEN;
  const config = await loadConfig();
  const token = envToken ?? config.apiToken;

  if (!token) {
    return {
      authenticated: false,
      error: "No API token configured",
    };
  }

  const tokenSource = envToken ? "env" : "config";

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
  process.stdout.write("Enter API token: ");

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
