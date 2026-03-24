import { graphql } from "../api.ts";
import { printTable, requireToken, useJson } from "./shared.ts";

export interface ListLabelsOptions {
  team?: string;
  limit?: number;
  json?: boolean;
}

export async function listLabels(options: ListLabelsOptions): Promise<void> {
  const token = await requireToken();
  const json = await useJson(options.json);
  const limit = options.limit ?? 50;

  const filter: Record<string, unknown> = {};
  if (options.team) filter.team = { key: { eq: options.team } };

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

export interface CreateLabelOptions {
  name: string;
  color: string;
  team?: string;
  description?: string;
  json?: boolean;
}

export async function createLabel(options: CreateLabelOptions): Promise<void> {
  const token = await requireToken();
  const json = await useJson(options.json);

  const input: Record<string, unknown> = {
    name: options.name,
    color: options.color,
  };
  if (options.description) input.description = options.description;

  if (options.team) {
    const teamQuery = `
      query Teams($filter: TeamFilter!) {
        teams(filter: $filter, first: 1) {
          nodes { id }
        }
      }
    `;

    const teamData = await graphql<{
      teams: { nodes: Array<{ id: string }> };
    }>(token, teamQuery, { filter: { key: { eq: options.team } } });

    if (teamData.teams.nodes.length === 0) {
      console.error(`Error: Team "${options.team}" not found.`);
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

export interface UpdateLabelOptions {
  id: string;
  name?: string;
  color?: string;
  description?: string;
  json?: boolean;
}

export async function updateLabel(options: UpdateLabelOptions): Promise<void> {
  const token = await requireToken();
  const json = await useJson(options.json);

  const input: Record<string, unknown> = {};

  if (options.name) input.name = options.name;
  if (options.color) input.color = options.color;
  if (options.description) input.description = options.description;

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
  }>(token, mutation, { id: options.id, input });

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

export interface DeleteLabelOptions {
  id: string;
  json?: boolean;
}

export async function deleteLabel(options: DeleteLabelOptions): Promise<void> {
  const token = await requireToken();
  const json = await useJson(options.json);

  const mutation = `
    mutation IssueLabelArchive($id: String!) {
      issueLabelArchive(id: $id) {
        success
      }
    }
  `;

  const data = await graphql<{
    issueLabelArchive: { success: boolean };
  }>(token, mutation, { id: options.id });

  if (!data.issueLabelArchive.success) {
    console.error("Error: Failed to delete label.");
    process.exit(1);
  }

  if (json) {
    console.log(JSON.stringify({ id: options.id, deleted: true }, null, 2));
    return;
  }

  console.log(`Deleted label ${options.id}`);
}
