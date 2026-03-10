import { graphql } from "../api.ts";
import {
  getNumber,
  getPositional,
  getString,
  parseArgs,
  wantsHelp,
} from "../args.ts";
import { formatDate, printTable, requireToken, useJson } from "./shared.ts";

const CYCLE_OPTIONS = {
  team: { type: "string" as const },
  limit: { type: "string" as const },
  json: { type: "boolean" as const },
};

function formatProgress(progress: number): string {
  return `${Math.round(progress * 100)}%`;
}

export async function listCycles(args: string[]): Promise<void> {
  const parsed = parseArgs(args, CYCLE_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear cycle list [options]

List cycles.

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
    query Cycles($first: Int, $filter: CycleFilter) {
      cycles(first: $first, filter: $filter) {
        nodes {
          id
          number
          name
          startsAt
          endsAt
          completedAt
          progress
          team { key name }
          issues { nodes { id } }
        }
      }
    }
  `;

  const filter: Record<string, unknown> = {};
  if (teamKey) {
    filter.team = { key: { eq: teamKey } };
  }

  const data = await graphql<{
    cycles: {
      nodes: Array<{
        id: string;
        number: number;
        name: string | null;
        startsAt: string;
        endsAt: string;
        completedAt: string | null;
        progress: number;
        team: { key: string; name: string };
        issues: { nodes: Array<{ id: string }> };
      }>;
    };
  }>(token, query, {
    first: limit,
    filter: Object.keys(filter).length > 0 ? filter : undefined,
  });

  const cycles = data.cycles.nodes;

  if (json) {
    console.log(JSON.stringify(cycles, null, 2));
    return;
  }

  if (cycles.length === 0) {
    console.log("No cycles found.");
    return;
  }

  const headers = [
    "NUMBER",
    "NAME",
    "TEAM",
    "START",
    "END",
    "PROGRESS",
    "ISSUES",
  ];
  const rows = cycles.map((c) => [
    String(c.number),
    c.name ?? "-",
    c.team.key,
    formatDate(c.startsAt),
    formatDate(c.endsAt),
    formatProgress(c.progress),
    String(c.issues.nodes.length),
  ]);
  printTable(headers, rows);
}

export async function getCycle(args: string[]): Promise<void> {
  const parsed = parseArgs(args, CYCLE_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear cycle get <cycle-id> [options]

Get cycle details by UUID.

Options:
  --json       Output as JSON
  -h, --help   Show this help
`);
    return;
  }

  const cycleId = getPositional(parsed, 0);
  if (!cycleId) {
    console.error("Error: Cycle ID is required.");
    console.error("Usage: linear cycle get <cycle-id>");
    process.exit(1);
  }

  const token = await requireToken();
  const json = await useJson(parsed);

  const query = `
    query Cycle($id: String!) {
      cycle(id: $id) {
        id
        number
        name
        description
        startsAt
        endsAt
        completedAt
        progress
        team { key name }
        issues {
          nodes {
            identifier
            title
            state { name }
            assignee { name }
            priority
            priorityLabel
          }
        }
        createdAt
        updatedAt
      }
    }
  `;

  const data = await graphql<{
    cycle: {
      id: string;
      number: number;
      name: string | null;
      description: string | null;
      startsAt: string;
      endsAt: string;
      completedAt: string | null;
      progress: number;
      team: { key: string; name: string };
      issues: {
        nodes: Array<{
          identifier: string;
          title: string;
          state: { name: string };
          assignee: { name: string } | null;
          priority: number;
          priorityLabel: string;
        }>;
      };
      createdAt: string;
      updatedAt: string;
    };
  }>(token, query, { id: cycleId });

  const cycle = data.cycle;

  if (json) {
    console.log(JSON.stringify(cycle, null, 2));
    return;
  }

  console.log(`Number:      ${cycle.number}`);
  console.log(`Name:        ${cycle.name ?? "-"}`);
  console.log(`Team:        ${cycle.team.key} (${cycle.team.name})`);
  console.log(`Description: ${cycle.description ?? "-"}`);
  console.log(`Start:       ${formatDate(cycle.startsAt)}`);
  console.log(`End:         ${formatDate(cycle.endsAt)}`);
  console.log(`Completed:   ${formatDate(cycle.completedAt)}`);
  console.log(`Progress:    ${formatProgress(cycle.progress)}`);
  console.log(`Created:     ${formatDate(cycle.createdAt)}`);
  console.log(`Updated:     ${formatDate(cycle.updatedAt)}`);

  const issues = cycle.issues.nodes;
  if (issues.length > 0) {
    console.log(`\nIssues (${issues.length}):`);
    const issueHeaders = [
      "IDENTIFIER",
      "TITLE",
      "STATE",
      "PRIORITY",
      "ASSIGNEE",
    ];
    const issueRows = issues.map((i) => [
      i.identifier,
      i.title,
      i.state.name,
      i.priorityLabel,
      i.assignee?.name ?? "-",
    ]);
    printTable(issueHeaders, issueRows);
  } else {
    console.log("\nNo issues in this cycle.");
  }
}
