import { graphql } from "../api.ts";
import {
  getNumber,
  getPositional,
  getString,
  parseArgs,
  wantsHelp,
} from "../args.ts";
import { printTable, requireToken, useJson } from "./shared.ts";

const LABEL_OPTIONS = {
  team: { type: "string" as const },
  name: { type: "string" as const },
  color: { type: "string" as const },
  description: { type: "string" as const },
  limit: { type: "string" as const },
  json: { type: "boolean" as const },
};

export async function listLabels(args: string[]): Promise<void> {
  const parsed = parseArgs(args, LABEL_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear label list [options]

List issue labels.

Options:
  --team <key>   Filter by team key
  --limit <n>    Maximum number of labels to return (default: 50)
  --json         Output as JSON
  -h, --help     Show this help
`);
    return;
  }

  const token = await requireToken();
  const json = await useJson(parsed);
  const teamKey = getString(parsed, "team");
  const limit = getNumber(parsed, "limit") ?? 50;

  const filter: Record<string, unknown> = {};
  if (teamKey) filter.team = { key: { eq: teamKey } };

  const query = `
    query IssueLabels($first: Int, $filter: IssueLabelFilter) {
      issueLabels(first: $first, filter: $filter) {
        nodes {
          id
          name
          description
          color
          team { key name }
          isGroup
          createdAt
        }
      }
    }
  `;

  const data = await graphql<{
    issueLabels: {
      nodes: Array<{
        id: string;
        name: string;
        description: string | null;
        color: string;
        team: { key: string; name: string } | null;
        isGroup: boolean;
        createdAt: string;
      }>;
    };
  }>(token, query, { first: limit, filter });

  const labels = data.issueLabels.nodes;

  if (json) {
    console.log(JSON.stringify(labels, null, 2));
    return;
  }

  if (labels.length === 0) {
    console.log("No labels found.");
    return;
  }

  const headers = ["NAME", "COLOR", "TEAM", "GROUP"];
  const rows = labels.map((l) => [
    l.name,
    l.color,
    l.team?.key ?? "",
    l.isGroup ? "yes" : "no",
  ]);

  printTable(headers, rows);
}

export async function createLabel(args: string[]): Promise<void> {
  const parsed = parseArgs(args, LABEL_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear label create --name <name> --color <hex> [options]

Create a new issue label.

Options:
  --name <name>          Label name (required)
  --color <hex>          Label color hex (required)
  --team <key>           Team key to scope the label to
  --description <text>   Label description
  --json                 Output as JSON
  -h, --help             Show this help
`);
    return;
  }

  const token = await requireToken();
  const json = await useJson(parsed);

  const name = getString(parsed, "name");
  if (!name) {
    console.error("Error: --name is required.");
    process.exit(1);
  }

  const color = getString(parsed, "color");
  if (!color) {
    console.error("Error: --color is required.");
    process.exit(1);
  }

  const teamKey = getString(parsed, "team");
  const description = getString(parsed, "description");

  const input: Record<string, unknown> = { name, color };
  if (description) input.description = description;

  if (teamKey) {
    const teamQuery = `
      query Teams($filter: TeamFilter!) {
        teams(filter: $filter, first: 1) {
          nodes { id }
        }
      }
    `;

    const teamData = await graphql<{
      teams: { nodes: Array<{ id: string }> };
    }>(token, teamQuery, { filter: { key: { eq: teamKey } } });

    if (teamData.teams.nodes.length === 0) {
      console.error(`Error: Team "${teamKey}" not found.`);
      process.exit(1);
    }

    input.teamId = teamData.teams.nodes[0]?.id;
  }

  const mutation = `
    mutation IssueLabelCreate($input: IssueLabelCreateInput!) {
      issueLabelCreate(input: $input) {
        success
        issueLabel {
          id
          name
          color
          team { key }
        }
      }
    }
  `;

  const data = await graphql<{
    issueLabelCreate: {
      success: boolean;
      issueLabel: {
        id: string;
        name: string;
        color: string;
        team: { key: string } | null;
      };
    };
  }>(token, mutation, { input });

  if (!data.issueLabelCreate.success) {
    console.error("Error: Failed to create label.");
    process.exit(1);
  }

  const label = data.issueLabelCreate.issueLabel;

  if (json) {
    console.log(JSON.stringify(label, null, 2));
    return;
  }

  console.log(`Created label "${label.name}" (${label.color})`);
}

export async function updateLabel(args: string[]): Promise<void> {
  const parsed = parseArgs(args, LABEL_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear label update <id> [options]

Update an existing issue label.

Options:
  --name <name>          New label name
  --color <hex>          New label color hex
  --description <text>   New label description
  --json                 Output as JSON
  -h, --help             Show this help
`);
    return;
  }

  const id = getPositional(parsed, 0);
  if (!id) {
    console.error("Error: Label ID is required.");
    console.error("Usage: linear label update <id>");
    process.exit(1);
  }

  const token = await requireToken();
  const json = await useJson(parsed);

  const input: Record<string, unknown> = {};

  const name = getString(parsed, "name");
  if (name) input.name = name;

  const color = getString(parsed, "color");
  if (color) input.color = color;

  const description = getString(parsed, "description");
  if (description) input.description = description;

  if (Object.keys(input).length === 0) {
    console.error("Error: No update flags provided.");
    process.exit(1);
  }

  const mutation = `
    mutation IssueLabelUpdate($id: String!, $input: IssueLabelUpdateInput!) {
      issueLabelUpdate(id: $id, input: $input) {
        success
        issueLabel {
          id
          name
          color
        }
      }
    }
  `;

  const data = await graphql<{
    issueLabelUpdate: {
      success: boolean;
      issueLabel: {
        id: string;
        name: string;
        color: string;
      };
    };
  }>(token, mutation, { id, input });

  if (!data.issueLabelUpdate.success) {
    console.error("Error: Failed to update label.");
    process.exit(1);
  }

  const label = data.issueLabelUpdate.issueLabel;

  if (json) {
    console.log(JSON.stringify(label, null, 2));
    return;
  }

  console.log(`Updated label "${label.name}" (${label.color})`);
}

export async function deleteLabel(args: string[]): Promise<void> {
  const parsed = parseArgs(args, LABEL_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear label delete <id>

Delete (archive) an issue label.

Options:
  --json         Output as JSON
  -h, --help     Show this help
`);
    return;
  }

  const id = getPositional(parsed, 0);
  if (!id) {
    console.error("Error: Label ID is required.");
    console.error("Usage: linear label delete <id>");
    process.exit(1);
  }

  const token = await requireToken();
  const json = await useJson(parsed);

  const mutation = `
    mutation IssueLabelArchive($id: String!) {
      issueLabelArchive(id: $id) {
        success
      }
    }
  `;

  const data = await graphql<{
    issueLabelArchive: { success: boolean };
  }>(token, mutation, { id });

  if (!data.issueLabelArchive.success) {
    console.error("Error: Failed to delete label.");
    process.exit(1);
  }

  if (json) {
    console.log(JSON.stringify({ id, deleted: true }, null, 2));
    return;
  }

  console.log(`Deleted label ${id}`);
}
