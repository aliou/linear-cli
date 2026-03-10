import { graphql } from "../api.ts";
import {
  getNumber,
  getPositional,
  getString,
  parseArgs,
  wantsHelp,
} from "../args.ts";
import { printTable, requireToken, useJson } from "./shared.ts";

const OPTIONS = {
  team: { type: "string" as const },
  limit: { type: "string" as const },
  json: { type: "boolean" as const },
};

export async function searchIssues(args: string[]): Promise<void> {
  const parsed = parseArgs(args, OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear search issues <term> [flags]

Search issues by term.

Options:
  --team <key>   Filter by team key
  --limit <n>    Max results (default: 25)
  --json         Output as JSON
  -h, --help     Show this help
`);
    return;
  }

  const term = getPositional(parsed, 0);
  if (!term) {
    console.error("Error: Search term is required.");
    process.exit(1);
  }

  const token = await requireToken();
  const json = await useJson(parsed);
  const teamKey = getString(parsed, "team");
  const limit = getNumber(parsed, "limit") ?? 25;

  const filter: Record<string, unknown> | undefined = teamKey
    ? { team: { key: { eq: teamKey } } }
    : undefined;

  const query = `
    query SearchIssues($term: String!, $first: Int, $filter: IssueFilter) {
      searchIssues(term: $term, first: $first, filter: $filter) {
        nodes {
          id
          identifier
          title
          state { name }
          assignee { name }
          team { key }
          priority
          priorityLabel
        }
      }
    }
  `;

  const data = await graphql<{
    searchIssues: {
      nodes: Array<{
        id: string;
        identifier: string;
        title: string;
        state: { name: string };
        assignee: { name: string } | null;
        team: { key: string };
        priority: number;
        priorityLabel: string;
      }>;
    };
  }>(token, query, { term, first: limit, filter });

  const issues = data.searchIssues.nodes;

  if (json) {
    console.log(JSON.stringify(issues, null, 2));
    return;
  }

  if (issues.length === 0) {
    console.log("No issues found.");
    return;
  }

  const headers = ["IDENTIFIER", "TITLE", "STATE", "PRIORITY", "ASSIGNEE"];
  const rows = issues.map((issue) => [
    issue.identifier,
    issue.title,
    issue.state.name,
    issue.priorityLabel,
    issue.assignee?.name ?? "",
  ]);

  printTable(headers, rows);
}

export async function searchDocuments(args: string[]): Promise<void> {
  const parsed = parseArgs(args, OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear search documents <term> [flags]

Search documents by term.

Options:
  --limit <n>    Max results (default: 25)
  --json         Output as JSON
  -h, --help     Show this help
`);
    return;
  }

  const term = getPositional(parsed, 0);
  if (!term) {
    console.error("Error: Search term is required.");
    process.exit(1);
  }

  const token = await requireToken();
  const json = await useJson(parsed);
  const limit = getNumber(parsed, "limit") ?? 25;

  const query = `
    query SearchDocuments($term: String!, $first: Int) {
      searchDocuments(term: $term, first: $first) {
        nodes {
          id
          title
          creator { name }
          project { name }
          createdAt
        }
      }
    }
  `;

  const data = await graphql<{
    searchDocuments: {
      nodes: Array<{
        id: string;
        title: string;
        creator: { name: string } | null;
        project: { name: string } | null;
        createdAt: string;
      }>;
    };
  }>(token, query, { term, first: limit });

  const documents = data.searchDocuments.nodes;

  if (json) {
    console.log(JSON.stringify(documents, null, 2));
    return;
  }

  if (documents.length === 0) {
    console.log("No documents found.");
    return;
  }

  const headers = ["TITLE", "PROJECT", "CREATOR", "CREATED"];
  const rows = documents.map((doc) => [
    doc.title,
    doc.project?.name ?? "",
    doc.creator?.name ?? "",
    doc.createdAt,
  ]);

  printTable(headers, rows);
}

export async function searchProjects(args: string[]): Promise<void> {
  const parsed = parseArgs(args, OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear search projects <term> [flags]

Search projects by term.

Options:
  --limit <n>    Max results (default: 25)
  --json         Output as JSON
  -h, --help     Show this help
`);
    return;
  }

  const term = getPositional(parsed, 0);
  if (!term) {
    console.error("Error: Search term is required.");
    process.exit(1);
  }

  const token = await requireToken();
  const json = await useJson(parsed);
  const limit = getNumber(parsed, "limit") ?? 25;

  const query = `
    query SearchProjects($term: String!, $first: Int) {
      searchProjects(term: $term, first: $first) {
        nodes {
          id
          name
          state
          progress
          lead { name }
          teams { nodes { key } }
        }
      }
    }
  `;

  const data = await graphql<{
    searchProjects: {
      nodes: Array<{
        id: string;
        name: string;
        state: string;
        progress: number;
        lead: { name: string } | null;
        teams: { nodes: Array<{ key: string }> };
      }>;
    };
  }>(token, query, { term, first: limit });

  const projects = data.searchProjects.nodes;

  if (json) {
    console.log(JSON.stringify(projects, null, 2));
    return;
  }

  if (projects.length === 0) {
    console.log("No projects found.");
    return;
  }

  const headers = ["NAME", "STATUS", "PROGRESS", "LEAD", "TEAMS"];
  const rows = projects.map((proj) => [
    proj.name,
    proj.state,
    `${Math.round(proj.progress * 100)}%`,
    proj.lead?.name ?? "",
    proj.teams.nodes.map((t) => t.key).join(", "),
  ]);

  printTable(headers, rows);
}
