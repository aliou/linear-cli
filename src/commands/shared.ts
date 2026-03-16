import type { ResolvedAuth } from "../api.ts";
import { graphql } from "../api.ts";
import type { ParsedArgs } from "../args.ts";
import { getBoolean } from "../args.ts";
import { loadConfig, resolveAuth } from "../config.ts";

export type { ResolvedAuth };

export async function requireAuth(): Promise<ResolvedAuth> {
  const auth = await resolveAuth();
  if (!auth) {
    console.error("Error: Not authenticated. Run 'linear auth login' first.");
    process.exit(1);
  }
  return auth;
}

/** @deprecated Use requireAuth() to get the full auth object for refresh support. */
export async function requireToken(): Promise<ResolvedAuth> {
  return requireAuth();
}

/**
 * User/Agent resolution result
 */
export interface ResolvedUser {
  id: string;
  name: string;
  email: string;
  displayName: string;
  app: boolean;
}

/**
 * Resolve a user by identifier (UUID, email, displayName, or name).
 * If requireApp is true, only returns users where app === true (agents).
 * Returns null if not found or throws on ambiguity.
 */
export async function resolveUser(
  auth: string | ResolvedAuth,
  value: string,
  options?: { requireApp?: boolean; allowMe?: boolean },
): Promise<ResolvedUser | null> {
  const { requireApp = false, allowMe = false } = options ?? {};

  // Handle "none" for clearing
  if (value.toLowerCase() === "none") {
    return null;
  }

  // Handle "me" for current user
  if (value.toLowerCase() === "me" && allowMe) {
    const query = `
      query {
        viewer {
          id
          name
          email
          displayName
          app
        }
      }
    `;
    const data = await graphql<{ viewer: ResolvedUser }>(auth, query);
    if (requireApp && !data.viewer.app) {
      throw new Error(
        `"me" resolves to a regular user, but an agent/app user is required.`,
      );
    }
    return data.viewer;
  }

  // Check if it's a UUID (8-4-4-4-12 format)
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    );

  let filter: Record<string, unknown>;

  if (isUuid) {
    // Direct UUID lookup
    const query = `
      query User($id: String!) {
        user(id: $id) {
          id
          name
          email
          displayName
          app
        }
      }
    `;
    const data = await graphql<{ user: ResolvedUser | null }>(auth, query, {
      id: value,
    });
    const user = data.user;
    if (!user) {
      return null;
    }
    if (requireApp && !user.app) {
      throw new Error(
        `User "${user.name}" (${user.email}) is not an agent/app user. Use a user where app=true.`,
      );
    }
    return user;
  } else if (value.includes("@")) {
    // Email lookup
    filter = { email: { eq: value } };
  } else {
    // Name or displayName lookup - try both
    filter = {
      or: [{ name: { eq: value } }, { displayName: { eq: value } }],
    };
  }

  const query = `
    query Users($filter: UserFilter) {
      users(filter: $filter, first: 10) {
        nodes {
          id
          name
          email
          displayName
          app
        }
      }
    }
  `;

  const data = await graphql<{ users: { nodes: ResolvedUser[] } }>(
    auth,
    query,
    { filter },
  );

  const users = data.users.nodes;

  if (users.length === 0) {
    return null;
  }

  // Filter to app users if required
  const matchingUsers = requireApp ? users.filter((u) => u.app) : users;

  if (matchingUsers.length === 0) {
    if (requireApp) {
      const userInfo = users.map((u) => `${u.name} (${u.email})`).join(", ");
      throw new Error(
        `No agent/app user found matching "${value}". Found regular user(s): ${userInfo}`,
      );
    }
    return null;
  }

  if (matchingUsers.length > 1) {
    const userInfo = matchingUsers
      .map((u) => `${u.name} <${u.email}> (${u.id})`)
      .join("\n  ");
    throw new Error(
      `Multiple ${requireApp ? "agents" : "users"} match "${value}":\n  ${userInfo}\nPlease use a more specific identifier (email or UUID).`,
    );
  }

  return matchingUsers[0] ?? null;
}

/**
 * Resolve an assignee (regular user or "me")
 */
export async function resolveAssignee(
  auth: string | ResolvedAuth,
  value: string,
): Promise<string | null> {
  if (value.toLowerCase() === "none") {
    return null;
  }
  const user = await resolveUser(auth, value, { allowMe: true });
  if (!user) {
    throw new Error(`Assignee "${value}" not found.`);
  }
  return user.id;
}

/**
 * Resolve a delegate/agent (must be an app user)
 */
export async function resolveDelegate(
  auth: string | ResolvedAuth,
  value: string,
): Promise<string | null> {
  if (value.toLowerCase() === "none") {
    return null;
  }
  const user = await resolveUser(auth, value, { requireApp: true });
  if (!user) {
    throw new Error(
      `Agent/delegate "${value}" not found or is not an app user.`,
    );
  }
  return user.id;
}

export async function useJson(parsed: ParsedArgs): Promise<boolean> {
  if (getBoolean(parsed, "json")) return true;
  const config = await loadConfig();
  return config.outputFormat === "json";
}

export function pad(str: string, len: number): string {
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return dateStr.slice(0, 10);
}

export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return `${str.slice(0, len - 3)}...`;
}

export function printTable(headers: string[], rows: string[][]): void {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
  );

  console.log(headers.map((h, i) => pad(h, widths[i] ?? 0)).join("  "));
  for (const row of rows) {
    console.log(row.map((cell, i) => pad(cell, widths[i] ?? 0)).join("  "));
  }
}
