import { graphql } from "../api.ts";
import { pad, printTable, requireToken, useJson } from "./shared.ts";

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

export interface ListUsersOptions {
  limit?: number;
  json?: boolean;
}

export async function listUsers(options: ListUsersOptions): Promise<void> {
  const token = await requireToken();
  const limit = options.limit ?? 50;
  const json = await useJson(options.json);

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

export interface GetUserOptions {
  id: string;
  json?: boolean;
}

export async function getUser(options: GetUserOptions): Promise<void> {
  const token = await requireToken();
  const json = await useJson(options.json);

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

  const data = await graphql<{ user: User }>(token, query, { id: options.id });
  const user = data.user;

  if (json) {
    console.log(JSON.stringify(user, null, 2));
    return;
  }

  printUserDetail(user);
}

export interface MeOptions {
  json?: boolean;
}

export async function me(options: MeOptions): Promise<void> {
  const token = await requireToken();
  const json = await useJson(options.json);

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
