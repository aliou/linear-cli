import { graphql } from "../api.ts";
import {
  getNumber,
  getPositional,
  getString,
  parseArgs,
  wantsHelp,
} from "../args.ts";
import { printTable, requireToken, useJson } from "./shared.ts";

const MILESTONE_OPTIONS = {
  project: { type: "string" as const },
  name: { type: "string" as const },
  description: { type: "string" as const },
  targetDate: { type: "string" as const },
  limit: { type: "string" as const },
  json: { type: "boolean" as const },
};

export async function listMilestones(args: string[]): Promise<void> {
  const parsed = parseArgs(args, MILESTONE_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear milestone list [options]

List project milestones.

Options:
  --project <id>   Filter by project ID
  --limit <n>      Max results (default: 50)
  --json           Output as JSON
  -h, --help       Show this help
`);
    return;
  }

  const token = await requireToken();
  const projectId = getString(parsed, "project");
  const limit = getNumber(parsed, "limit") ?? 50;
  const json = await useJson(parsed);

  const filter: Record<string, unknown> = {};
  if (projectId) {
    filter.project = { id: { eq: projectId } };
  }

  const query = `
    query ProjectMilestones($first: Int, $filter: ProjectMilestoneFilter) {
      projectMilestones(first: $first, filter: $filter) {
        nodes {
          id
          name
          description
          targetDate
          sortOrder
          project { id name }
          createdAt
        }
      }
    }
  `;

  const data = await graphql<{
    projectMilestones: {
      nodes: Array<{
        id: string;
        name: string;
        description: string | null;
        targetDate: string | null;
        sortOrder: number;
        project: { id: string; name: string };
        createdAt: string;
      }>;
    };
  }>(token, query, {
    first: limit,
    filter: Object.keys(filter).length > 0 ? filter : undefined,
  });

  const milestones = data.projectMilestones.nodes;

  if (json) {
    console.log(JSON.stringify(milestones, null, 2));
    return;
  }

  if (milestones.length === 0) {
    console.log("No milestones found.");
    return;
  }

  const headers = ["NAME", "PROJECT", "TARGET DATE", "CREATED"];
  const rows = milestones.map((m) => [
    m.name,
    m.project.name,
    m.targetDate ?? "",
    m.createdAt.slice(0, 10),
  ]);

  printTable(headers, rows);
}

export async function getMilestone(args: string[]): Promise<void> {
  const parsed = parseArgs(args, MILESTONE_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear milestone get <id>

Get milestone details by UUID.

Options:
  --json       Output as JSON
  -h, --help   Show this help
`);
    return;
  }

  const milestoneId = getPositional(parsed, 0);
  if (!milestoneId) {
    console.error("Error: Milestone ID is required.");
    process.exit(1);
  }

  const token = await requireToken();
  const json = await useJson(parsed);

  const query = `
    query ProjectMilestone($id: String!) {
      projectMilestone(id: $id) {
        id
        name
        description
        targetDate
        sortOrder
        project { id name }
        issues {
          nodes {
            identifier
            title
            state { name }
          }
        }
        createdAt
        updatedAt
      }
    }
  `;

  const data = await graphql<{
    projectMilestone: {
      id: string;
      name: string;
      description: string | null;
      targetDate: string | null;
      sortOrder: number;
      project: { id: string; name: string };
      issues: {
        nodes: Array<{
          identifier: string;
          title: string;
          state: { name: string };
        }>;
      };
      createdAt: string;
      updatedAt: string;
    };
  }>(token, query, { id: milestoneId });

  const milestone = data.projectMilestone;

  if (json) {
    console.log(JSON.stringify(milestone, null, 2));
    return;
  }

  console.log(`Name:        ${milestone.name}`);
  console.log(`ID:          ${milestone.id}`);
  console.log(`Project:     ${milestone.project.name}`);
  console.log(`Description: ${milestone.description ?? "-"}`);
  console.log(`Target Date: ${milestone.targetDate ?? "Not set"}`);
  console.log(`Sort Order:  ${milestone.sortOrder}`);
  console.log(`Created:     ${milestone.createdAt}`);
  console.log(`Updated:     ${milestone.updatedAt}`);

  const issues = milestone.issues.nodes;
  if (issues.length > 0) {
    console.log(`\nIssues (${issues.length}):`);
    for (const issue of issues) {
      console.log(
        `  ${issue.identifier}  ${issue.title}  [${issue.state.name}]`,
      );
    }
  } else {
    console.log("\nNo issues in this milestone.");
  }
}

export async function createMilestone(args: string[]): Promise<void> {
  const parsed = parseArgs(args, MILESTONE_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear milestone create --project <id> --name <name> [options]

Create a new project milestone.

Options:
  --project <id>        Project ID (required)
  --name <name>         Milestone name (required)
  --description <text>  Description
  --targetDate <date>   Target date (YYYY-MM-DD)
  --json                Output as JSON
  -h, --help            Show this help
`);
    return;
  }

  const token = await requireToken();
  const json = await useJson(parsed);

  const projectId = getString(parsed, "project");
  if (!projectId) {
    console.error("Error: --project is required.");
    process.exit(1);
  }

  const name = getString(parsed, "name");
  if (!name) {
    console.error("Error: --name is required.");
    process.exit(1);
  }

  const input: Record<string, unknown> = { projectId, name };

  const description = getString(parsed, "description");
  if (description) input.description = description;

  const targetDate = getString(parsed, "targetDate");
  if (targetDate) input.targetDate = targetDate;

  const mutation = `
    mutation ProjectMilestoneCreate($input: ProjectMilestoneCreateInput!) {
      projectMilestoneCreate(input: $input) {
        success
        projectMilestone {
          id
          name
          project { name }
          targetDate
        }
      }
    }
  `;

  const data = await graphql<{
    projectMilestoneCreate: {
      success: boolean;
      projectMilestone: {
        id: string;
        name: string;
        project: { name: string };
        targetDate: string | null;
      };
    };
  }>(token, mutation, { input });

  if (!data.projectMilestoneCreate.success) {
    console.error("Error: Failed to create milestone.");
    process.exit(1);
  }

  const milestone = data.projectMilestoneCreate.projectMilestone;

  if (json) {
    console.log(JSON.stringify(milestone, null, 2));
    return;
  }

  console.log(`Created milestone: ${milestone.name}`);
  console.log(`Project: ${milestone.project.name}`);
  console.log(`Target Date: ${milestone.targetDate ?? "Not set"}`);
}

export async function updateMilestone(args: string[]): Promise<void> {
  const parsed = parseArgs(args, MILESTONE_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear milestone update <id> [options]

Update an existing project milestone.

Options:
  --name <name>         New name
  --description <text>  New description
  --targetDate <date>   New target date (YYYY-MM-DD)
  --json                Output as JSON
  -h, --help            Show this help
`);
    return;
  }

  const id = getPositional(parsed, 0);
  if (!id) {
    console.error("Error: Milestone ID is required.");
    process.exit(1);
  }

  const token = await requireToken();
  const json = await useJson(parsed);

  const input: Record<string, unknown> = {};

  const name = getString(parsed, "name");
  if (name) input.name = name;

  const description = getString(parsed, "description");
  if (description) input.description = description;

  const targetDate = getString(parsed, "targetDate");
  if (targetDate) input.targetDate = targetDate;

  if (Object.keys(input).length === 0) {
    console.error("Error: No update flags provided.");
    process.exit(1);
  }

  const mutation = `
    mutation ProjectMilestoneUpdate($id: String!, $input: ProjectMilestoneUpdateInput!) {
      projectMilestoneUpdate(id: $id, input: $input) {
        success
        projectMilestone {
          id
          name
          targetDate
        }
      }
    }
  `;

  const data = await graphql<{
    projectMilestoneUpdate: {
      success: boolean;
      projectMilestone: {
        id: string;
        name: string;
        targetDate: string | null;
      };
    };
  }>(token, mutation, { id, input });

  if (!data.projectMilestoneUpdate.success) {
    console.error("Error: Failed to update milestone.");
    process.exit(1);
  }

  const milestone = data.projectMilestoneUpdate.projectMilestone;

  if (json) {
    console.log(JSON.stringify(milestone, null, 2));
    return;
  }

  console.log(`Updated milestone: ${milestone.name}`);
  console.log(`Target Date: ${milestone.targetDate ?? "Not set"}`);
}

export async function deleteMilestone(args: string[]): Promise<void> {
  const parsed = parseArgs(args, MILESTONE_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear milestone delete <id>

Delete a project milestone.

Options:
  --json       Output as JSON
  -h, --help   Show this help
`);
    return;
  }

  const id = getPositional(parsed, 0);
  if (!id) {
    console.error("Error: Milestone ID is required.");
    process.exit(1);
  }

  const token = await requireToken();
  const json = await useJson(parsed);

  const mutation = `
    mutation ProjectMilestoneDelete($id: String!) {
      projectMilestoneDelete(id: $id) {
        success
      }
    }
  `;

  const data = await graphql<{
    projectMilestoneDelete: {
      success: boolean;
    };
  }>(token, mutation, { id });

  if (!data.projectMilestoneDelete.success) {
    console.error("Error: Failed to delete milestone.");
    process.exit(1);
  }

  if (json) {
    console.log(JSON.stringify({ deleted: true, id }, null, 2));
    return;
  }

  console.log(`Deleted milestone ${id}`);
}
