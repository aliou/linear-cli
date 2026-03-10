import { graphql } from "../api.ts";
import { getNumber, getString, parseArgs, wantsHelp } from "../args.ts";
import { printTable, requireToken, useJson } from "./shared.ts";

const STATE_OPTIONS = {
  team: { type: "string" as const },
  limit: { type: "string" as const },
  json: { type: "boolean" as const },
};

export async function listStates(args: string[]): Promise<void> {
  const parsed = parseArgs(args, STATE_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear state list [options]

List workflow states.

Options:
  --team <key>   Filter by team key
  --limit <n>    Max results (default: 50)
  --json         Output as JSON
  -h, --help     Show this help
`);
    return;
  }

  const token = await requireToken();
  const teamKey = getString(parsed, "team");
  const limit = getNumber(parsed, "limit") ?? 50;
  const json = await useJson(parsed);

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
  if (teamKey) {
    filter.team = { key: { eq: teamKey } };
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
