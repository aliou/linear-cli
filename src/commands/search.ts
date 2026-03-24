import { graphql } from "../api.ts";
import { printTable, requireToken, useJson } from "./shared.ts";

export interface SearchIssuesOptions {
  term: string;
  team?: string;
  limit?: number;
  json?: boolean;
}

export async function searchIssues(
  options: SearchIssuesOptions,
): Promise<void> {
  const token = await requireToken();
  const json = await useJson(options.json);
  const limit = options.limit ?? 25;

  const filter: Record<string, unknown> | undefined = options.team
    ? { team: { key: { eq: options.team } } }
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
  }>(token, query, { term: options.term, first: limit, filter });

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

export interface SearchDocumentsOptions {
  term: string;
  limit?: number;
  json?: boolean;
}

export async function searchDocuments(
  options: SearchDocumentsOptions,
): Promise<void> {
  const token = await requireToken();
  const json = await useJson(options.json);
  const limit = options.limit ?? 25;

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
  }>(token, query, { term: options.term, first: limit });

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

export interface SearchProjectsOptions {
  term: string;
  limit?: number;
  json?: boolean;
}

export async function searchProjects(
  options: SearchProjectsOptions,
): Promise<void> {
  const token = await requireToken();
  const json = await useJson(options.json);
  const limit = options.limit ?? 25;

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
  }>(token, query, { term: options.term, first: limit });

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
