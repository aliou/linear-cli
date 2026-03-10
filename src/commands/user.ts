import { graphql } from "../api.ts";
import { getNumber, getPositional, parseArgs, wantsHelp } from "../args.ts";
import { printTable, requireToken, useJson } from "./shared.ts";

const USER_OPTIONS = {
  limit: { type: "string" as const },
  json: { type: "boolean" as const },
};

interface User {
  id: string;
  name: string;
  email: string;
  displayName: string;
  active: boolean;
  admin: boolean;
  avatarUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export async function listUsers(args: string[]): Promise<void> {
  const parsed = parseArgs(args, USER_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear user list [options]

List users in the workspace.

Options:
  --limit <n>  Maximum number of users to return (default: 50)
  --json       Output as JSON
  -h, --help   Show this help
`);
    return;
  }

  const token = await requireToken();
  const limit = getNumber(parsed, "limit") ?? 50;
  const json = await useJson(parsed);

  const query = `
    query Users($first: Int) {
      users(first: $first) {
        nodes {
          id
          name
          email
          displayName
          active
          admin
          createdAt
        }
      }
    }
  `;

  const data = await graphql<{ users: { nodes: User[] } }>(token, query, {
    first: limit,
  });

  const users = data.users.nodes;

  if (json) {
    console.log(JSON.stringify(users, null, 2));
    return;
  }

  if (users.length === 0) {
    console.log("No users found.");
    return;
  }

  const headers = ["NAME", "EMAIL", "ACTIVE", "ADMIN"];
  const rows = users.map((u) => [
    u.name,
    u.email,
    String(u.active),
    String(u.admin),
  ]);

  printTable(headers, rows);
}

export async function getUser(args: string[]): Promise<void> {
  const parsed = parseArgs(args, USER_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear user get <id>

Get details for a specific user.

Arguments:
  id  User UUID

Options:
  --json       Output as JSON
  -h, --help   Show this help
`);
    return;
  }

  const userId = getPositional(parsed, 0);
  if (!userId) {
    console.error("Error: User ID is required.");
    console.error("Usage: linear user get <id>");
    process.exit(1);
  }

  const token = await requireToken();
  const json = await useJson(parsed);

  const query = `
    query User($id: String!) {
      user(id: $id) {
        id
        name
        email
        displayName
        active
        admin
        avatarUrl
        createdAt
        updatedAt
      }
    }
  `;

  const data = await graphql<{ user: User }>(token, query, { id: userId });
  const user = data.user;

  if (json) {
    console.log(JSON.stringify(user, null, 2));
    return;
  }

  printUserDetail(user);
}

export async function me(args: string[]): Promise<void> {
  const parsed = parseArgs(args, USER_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear user me

Show the currently authenticated user.

Options:
  --json       Output as JSON
  -h, --help   Show this help
`);
    return;
  }

  const token = await requireToken();
  const json = await useJson(parsed);

  const query = `
    query {
      viewer {
        id
        name
        email
        displayName
        active
        admin
        avatarUrl
        createdAt
        updatedAt
      }
    }
  `;

  const data = await graphql<{ viewer: User }>(token, query);
  const user = data.viewer;

  if (json) {
    console.log(JSON.stringify(user, null, 2));
    return;
  }

  printUserDetail(user);
}

function printUserDetail(user: User): void {
  console.log(`Name:         ${user.name}`);
  console.log(`Display name: ${user.displayName}`);
  console.log(`ID:           ${user.id}`);
  console.log(`Email:        ${user.email}`);
  console.log(`Active:       ${user.active}`);
  console.log(`Admin:        ${user.admin}`);
  if (user.avatarUrl) {
    console.log(`Avatar:       ${user.avatarUrl}`);
  }
  console.log(`Created:      ${user.createdAt}`);
  if (user.updatedAt) {
    console.log(`Updated:      ${user.updatedAt}`);
  }
}
