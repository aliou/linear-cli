import { graphql } from "../api.ts";
import { printTable, requireToken, useJson } from "./shared.ts";

interface InitiativeNode {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface InitiativeDetail extends InitiativeNode {
  projects: {
    nodes: { id: string; name: string; state: string; progress: number }[];
  };
}

export interface ListInitiativesOptions {
  limit?: number;
  json?: boolean;
}

export async function listInitiatives(
  options: ListInitiativesOptions,
): Promise<void> {
  const token = await requireToken();
  const limit = options.limit ?? 50;

  const query = `
    query Initiatives($first: Int) {
      initiatives(first: $first) {
        nodes {
          id
          name
          description
          status
          createdAt
          updatedAt
        }
      }
    }
  `;

  const data = await graphql<{ initiatives: { nodes: InitiativeNode[] } }>(
    token,
    query,
    { first: limit },
  );

  const initiatives = data.initiatives.nodes;

  if (await useJson(options.json)) {
    console.log(JSON.stringify(initiatives, null, 2));
    return;
  }

  if (initiatives.length === 0) {
    console.log("No initiatives found.");
    return;
  }

  const headers = ["NAME", "STATUS", "CREATED"];
  const rows = initiatives.map((i) => [i.name, i.status, i.createdAt]);
  printTable(headers, rows);
}

export interface GetInitiativeOptions {
  id: string;
  json?: boolean;
}

export async function getInitiative(
  options: GetInitiativeOptions,
): Promise<void> {
  const token = await requireToken();

  const query = `
    query Initiative($id: String!) {
      initiative(id: $id) {
        id
        name
        description
        status
        projects { nodes { id name state progress } }
        createdAt
        updatedAt
      }
    }
  `;

  const data = await graphql<{ initiative: InitiativeDetail }>(token, query, {
    id: options.id,
  });

  const initiative = data.initiative;

  if (await useJson(options.json)) {
    console.log(JSON.stringify(initiative, null, 2));
    return;
  }

  console.log(`Name:        ${initiative.name}`);
  console.log(`ID:          ${initiative.id}`);
  console.log(`Status:      ${initiative.status}`);
  console.log(`Created:     ${initiative.createdAt}`);
  console.log(`Updated:     ${initiative.updatedAt}`);

  if (initiative.description) {
    console.log(`\nDescription:\n  ${initiative.description}`);
  }

  if (initiative.projects.nodes.length > 0) {
    console.log("\nProjects:");
    for (const project of initiative.projects.nodes) {
      console.log(
        `  ${project.name}  [${project.state}]  ${Math.round(project.progress * 100)}%`,
      );
    }
  }
}
