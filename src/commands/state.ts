import { graphql } from "../api.ts";
import { printTable, requireToken, useJson } from "./shared.ts";

export interface ListStatesOptions {
  team?: string;
  limit?: number;
  json?: boolean;
}

export async function listStates(options: ListStatesOptions): Promise<void> {
  const token = await requireToken();
  const limit = options.limit ?? 50;
  const json = await useJson(options.json);

  const query = `
    query WorkflowStates($first: Int, $filter: WorkflowStateFilter) {
      workflowStates(first: $first, filter: $filter) {
        nodes {
          id
          name
          type
          color
          position
          team { key name }
        }
      }
    }
  `;

  const filter: Record<string, unknown> = {};
  if (options.team) {
    filter.team = { key: { eq: options.team } };
  }

  const data = await graphql<{
    workflowStates: {
      nodes: Array<{
        id: string;
        name: string;
        type: string;
        color: string;
        position: number;
        team: { key: string; name: string };
      }>;
    };
  }>(token, query, {
    first: limit,
    filter: Object.keys(filter).length > 0 ? filter : undefined,
  });

  const states = data.workflowStates.nodes;

  if (json) {
    console.log(JSON.stringify(states, null, 2));
    return;
  }

  if (states.length === 0) {
    console.log("No workflow states found.");
    return;
  }

  const headers = ["NAME", "TYPE", "COLOR", "TEAM"];
  const rows = states.map((s) => [s.name, s.type, s.color, s.team.key]);
  printTable(headers, rows);
}
