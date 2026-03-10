import { graphql } from "../api.ts";
import {
  getNumber,
  getPositional,
  getString,
  parseArgs,
  wantsHelp,
} from "../args.ts";
import { printTable, requireToken, useJson } from "./shared.ts";

const PROJECT_OPTIONS = {
  limit: { type: "string" as const },
  status: { type: "string" as const },
  json: { type: "boolean" as const },
};

interface ProjectNode {
  id: string;
  name: string;
  description: string;
  state: string;
  progress: number;
  lead: { name: string } | null;
  startDate: string | null;
  targetDate: string | null;
  teams: { nodes: { key: string }[] };
  createdAt: string;
  updatedAt: string;
}

interface ProjectDetail extends ProjectNode {
  lead: { name: string; email: string } | null;
  members: { nodes: { name: string }[] };
  teams: { nodes: { key: string; name: string }[] };
  issues: {
    nodes: { identifier: string; title: string; state: { name: string } }[];
  };
  projectMilestones: { nodes: { id: string; name: string }[] };
  url: string;
}

export async function listProjects(args: string[]): Promise<void> {
  const parsed = parseArgs(args, PROJECT_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear project list [options]

List projects.

Options:
  --limit <n>      Number of projects to fetch (default: 50)
  --status <s>     Filter by status (planned, started, paused, completed, canceled)
  --json           Output as JSON
  -h, --help       Show this help
`);
    return;
  }

  const token = await requireToken();
  const limit = getNumber(parsed, "limit") ?? 50;
  const status = getString(parsed, "status");

  const filter: Record<string, unknown> = {};
  if (status) {
    filter.state = { eq: status };
  }

  const query = `
    query Projects($first: Int, $filter: ProjectFilter) {
      projects(first: $first, filter: $filter) {
        nodes {
          id
          name
          description
          state
          progress
          lead { name }
          startDate
          targetDate
          teams { nodes { key } }
          createdAt
          updatedAt
        }
      }
    }
  `;

  const data = await graphql<{ projects: { nodes: ProjectNode[] } }>(
    token,
    query,
    {
      first: limit,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
    },
  );

  const projects = data.projects.nodes;

  if (await useJson(parsed)) {
    console.log(JSON.stringify(projects, null, 2));
    return;
  }

  if (projects.length === 0) {
    console.log("No projects found.");
    return;
  }

  const rows = projects.map((p) => [
    p.name,
    p.state,
    `${Math.round(p.progress * 100)}%`,
    p.lead?.name ?? "",
    p.targetDate ?? "",
    p.teams.nodes.map((t) => t.key).join(", "),
  ]);

  const headers = [
    "NAME",
    "STATUS",
    "PROGRESS",
    "LEAD",
    "TARGET DATE",
    "TEAMS",
  ];
  printTable(headers, rows);
}

export async function getProject(args: string[]): Promise<void> {
  const parsed = parseArgs(args, { json: { type: "boolean" as const } });

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear project get <project-id>

Get project details by UUID or slug.

Options:
  --json       Output as JSON
  -h, --help   Show this help
`);
    return;
  }

  const projectId = getPositional(parsed, 0);
  if (!projectId) {
    console.error("Error: Project ID or slug is required.");
    process.exit(1);
  }

  const token = await requireToken();

  const query = `
    query Project($id: String!) {
      project(id: $id) {
        id
        name
        description
        state
        progress
        lead { name email }
        members { nodes { name } }
        startDate
        targetDate
        teams { nodes { key name } }
        issues { nodes { identifier title state { name } } }
        projectMilestones { nodes { id name } }
        createdAt
        updatedAt
        url
      }
    }
  `;

  const data = await graphql<{ project: ProjectDetail }>(token, query, {
    id: projectId,
  });

  const project = data.project;

  if (await useJson(parsed)) {
    console.log(JSON.stringify(project, null, 2));
    return;
  }

  console.log(`Name:        ${project.name}`);
  console.log(`ID:          ${project.id}`);
  console.log(`Status:      ${project.state}`);
  console.log(`Progress:    ${Math.round(project.progress * 100)}%`);
  console.log(
    `Lead:        ${project.lead ? `${project.lead.name} <${project.lead.email}>` : "None"}`,
  );
  console.log(`Start Date:  ${project.startDate ?? "Not set"}`);
  console.log(`Target Date: ${project.targetDate ?? "Not set"}`);
  console.log(`URL:         ${project.url}`);
  console.log(`Created:     ${project.createdAt}`);
  console.log(`Updated:     ${project.updatedAt}`);

  if (project.description) {
    console.log(`\nDescription:\n  ${project.description}`);
  }

  if (project.teams.nodes.length > 0) {
    console.log("\nTeams:");
    for (const team of project.teams.nodes) {
      console.log(`  ${team.key}  ${team.name}`);
    }
  }

  if (project.members.nodes.length > 0) {
    console.log("\nMembers:");
    for (const member of project.members.nodes) {
      console.log(`  ${member.name}`);
    }
  }

  if (project.projectMilestones.nodes.length > 0) {
    console.log("\nMilestones:");
    for (const milestone of project.projectMilestones.nodes) {
      console.log(`  ${milestone.name}`);
    }
  }

  if (project.issues.nodes.length > 0) {
    console.log("\nIssues:");
    for (const issue of project.issues.nodes) {
      console.log(
        `  ${issue.identifier}  ${issue.title}  [${issue.state.name}]`,
      );
    }
  }
}
