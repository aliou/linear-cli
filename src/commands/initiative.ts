import { graphql } from "../api.ts";
import { getNumber, getPositional, parseArgs, wantsHelp } from "../args.ts";
import { printTable, requireToken, useJson } from "./shared.ts";

const INITIATIVE_OPTIONS = {
  limit: { type: "string" as const },
  json: { type: "boolean" as const },
};

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

export async function listInitiatives(args: string[]): Promise<void> {
  const parsed = parseArgs(args, INITIATIVE_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear initiative list [options]

List initiatives.

Options:
  --limit <n>      Number of initiatives to fetch (default: 50)
  --json           Output as JSON
  -h, --help       Show this help
`);
    return;
  }

  const token = await requireToken();
  const limit = getNumber(parsed, "limit") ?? 50;

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

  if (await useJson(parsed)) {
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

export async function getInitiative(args: string[]): Promise<void> {
  const parsed = parseArgs(args, { json: { type: "boolean" as const } });

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear initiative get <id>

Get initiative details by ID.

Options:
  --json       Output as JSON
  -h, --help   Show this help
`);
    return;
  }

  const initiativeId = getPositional(parsed, 0);
  if (!initiativeId) {
    console.error("Error: Initiative ID is required.");
    process.exit(1);
  }

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
    id: initiativeId,
  });

  const initiative = data.initiative;

  if (await useJson(parsed)) {
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
