import { graphql } from "../api.ts";
import { printTable, requireToken, useJson } from "./shared.ts";

export interface ListMilestonesOptions {
  project?: string;
  limit?: number;
  json?: boolean;
}

export async function listMilestones(
  options: ListMilestonesOptions,
): Promise<void> {
  const token = await requireToken();
  const limit = options.limit ?? 50;
  const json = await useJson(options.json);

  const filter: Record<string, unknown> = {};
  if (options.project) {
    filter.project = { id: { eq: options.project } };
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

export interface GetMilestoneOptions {
  id: string;
  json?: boolean;
}

export async function getMilestone(
  options: GetMilestoneOptions,
): Promise<void> {
  const token = await requireToken();
  const json = await useJson(options.json);

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
  }>(token, query, { id: options.id });

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

export interface CreateMilestoneOptions {
  project: string;
  name: string;
  description?: string;
  targetDate?: string;
  json?: boolean;
}

export async function createMilestone(
  options: CreateMilestoneOptions,
): Promise<void> {
  const token = await requireToken();
  const json = await useJson(options.json);

  const input: Record<string, unknown> = {
    projectId: options.project,
    name: options.name,
  };

  if (options.description) input.description = options.description;
  if (options.targetDate) input.targetDate = options.targetDate;

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

export interface UpdateMilestoneOptions {
  id: string;
  name?: string;
  description?: string;
  targetDate?: string;
  json?: boolean;
}

export async function updateMilestone(
  options: UpdateMilestoneOptions,
): Promise<void> {
  const token = await requireToken();
  const json = await useJson(options.json);

  const input: Record<string, unknown> = {};

  if (options.name) input.name = options.name;
  if (options.description) input.description = options.description;
  if (options.targetDate) input.targetDate = options.targetDate;

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
  }>(token, mutation, { id: options.id, input });

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

export interface DeleteMilestoneOptions {
  id: string;
  json?: boolean;
}

export async function deleteMilestone(
  options: DeleteMilestoneOptions,
): Promise<void> {
  const token = await requireToken();
  const json = await useJson(options.json);

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
  }>(token, mutation, { id: options.id });

  if (!data.projectMilestoneDelete.success) {
    console.error("Error: Failed to delete milestone.");
    process.exit(1);
  }

  if (json) {
    console.log(JSON.stringify({ deleted: true, id: options.id }, null, 2));
    return;
  }

  console.log(`Deleted milestone ${options.id}`);
}
