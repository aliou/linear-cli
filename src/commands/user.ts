import { graphql } from "../api.ts";
import { getNumber, getPositional, parseArgs, wantsHelp } from "../args.ts";
import { pad, printTable, requireToken, useJson } from "./shared.ts";

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
  app: boolean;
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
          app
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

  const headers = ["NAME", "EMAIL", "ACTIVE", "ADMIN", "APP"];
  const rows = users.map((u) => [
    u.name,
    u.email,
    String(u.active),
    String(u.admin),
    String(u.app),
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
        app
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
        app
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
  const maxKey = Math.max(
    "Display name".length,
    "Email".length,
    "Created".length,
  );
  console.log(`${pad("Name", maxKey)}         ${user.name}`);
  console.log(`${pad("Display name", maxKey)}  ${user.displayName}`);
  console.log(`${pad("ID", maxKey)}           ${user.id}`);
  console.log(`${pad("Email", maxKey)}        ${user.email}`);
  console.log(`${pad("Active", maxKey)}       ${String(user.active)}`);
  console.log(`${pad("Admin", maxKey)}        ${String(user.admin)}`);
  console.log(`${pad("App/Agent", maxKey)}    ${String(user.app)}`);
  if (user.avatarUrl) {
    console.log(`${pad("Avatar", maxKey)}       ${user.avatarUrl}`);
  }
  console.log(`${pad("Created", maxKey)}      ${user.createdAt}`);
  if (user.updatedAt) {
    console.log(`${pad("Updated", maxKey)}      ${user.updatedAt}`);
  }
}
