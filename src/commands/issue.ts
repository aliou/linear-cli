import { graphql } from "../api.ts";
import {
  getNumber,
  getPositional,
  getString,
  parseArgs,
  wantsHelp,
} from "../args.ts";
import { pad, printTable, requireToken, useJson } from "./shared.ts";

const ISSUE_OPTIONS = {
  team: { type: "string" as const },
  assignee: { type: "string" as const },
  state: { type: "string" as const },
  label: { type: "string" as const },
  limit: { type: "string" as const },
  title: { type: "string" as const },
  description: { type: "string" as const },
  priority: { type: "string" as const },
  project: { type: "string" as const },
  estimate: { type: "string" as const },
  json: { type: "boolean" as const },
};

export async function listIssues(args: string[]): Promise<void> {
  const parsed = parseArgs(args, ISSUE_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear issue list [flags]

List issues with optional filters.

Options:
  --team <key>       Filter by team key
  --assignee <val>   Filter by assignee ("me" or email)
  --state <name>     Filter by state name
  --label <name>     Filter by label name
  --limit <n>        Max results (default: 50)
  --json             Output as JSON
  -h, --help         Show this help
`);
    return;
  }

  const token = await requireToken();
  const json = await useJson(parsed);

  const team = getString(parsed, "team");
  const assignee = getString(parsed, "assignee");
  const state = getString(parsed, "state");
  const label = getString(parsed, "label");
  const limit = getNumber(parsed, "limit") ?? 50;

  const filter: Record<string, unknown> = {};
  if (team) filter.team = { key: { eq: team } };
  if (assignee) {
    filter.assignee =
      assignee === "me" ? { isMe: { eq: true } } : { email: { eq: assignee } };
  }
  if (state) filter.state = { name: { eqIgnoreCase: state } };
  if (label) filter.labels = { name: { eqIgnoreCase: label } };

  const query = `
    query Issues($first: Int, $filter: IssueFilter) {
      issues(first: $first, filter: $filter) {
        nodes {
          id
          identifier
          title
          priority
          priorityLabel
          state { name type }
          assignee { name email }
          team { key name }
          labels { nodes { name } }
          createdAt
          updatedAt
        }
      }
    }
  `;

  const data = await graphql<{
    issues: {
      nodes: Array<{
        id: string;
        identifier: string;
        title: string;
        priority: number;
        priorityLabel: string;
        state: { name: string; type: string };
        assignee: { name: string; email: string } | null;
        team: { key: string; name: string };
        labels: { nodes: Array<{ name: string }> };
        createdAt: string;
        updatedAt: string;
      }>;
    };
  }>(token, query, { first: limit, filter });

  const issues = data.issues.nodes;

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

export async function getIssue(args: string[]): Promise<void> {
  const parsed = parseArgs(args, ISSUE_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear issue get <identifier>

Get an issue by identifier (e.g. ENG-123) or UUID.

Options:
  --json         Output as JSON
  -h, --help     Show this help
`);
    return;
  }

  const id = getPositional(parsed, 0);
  if (!id) {
    console.error("Error: Issue identifier is required.");
    process.exit(1);
  }

  const token = await requireToken();
  const json = await useJson(parsed);

  const query = `
    query Issue($id: String!) {
      issue(id: $id) {
        id
        identifier
        title
        description
        priority
        priorityLabel
        state { name type }
        assignee { name email }
        team { key name }
        project { name }
        cycle { number name }
        labels { nodes { name } }
        estimate
        dueDate
        createdAt
        updatedAt
        url
      }
    }
  `;

  const data = await graphql<{
    issue: {
      id: string;
      identifier: string;
      title: string;
      description: string | null;
      priority: number;
      priorityLabel: string;
      state: { name: string; type: string };
      assignee: { name: string; email: string } | null;
      team: { key: string; name: string };
      project: { name: string } | null;
      cycle: { number: number; name: string } | null;
      labels: { nodes: Array<{ name: string }> };
      estimate: number | null;
      dueDate: string | null;
      createdAt: string;
      updatedAt: string;
      url: string;
    };
  }>(token, query, { id });

  const issue = data.issue;

  if (json) {
    console.log(JSON.stringify(issue, null, 2));
    return;
  }

  const description = issue.description
    ? issue.description.length > 200
      ? `${issue.description.slice(0, 200)}...`
      : issue.description
    : "";

  const fields: Array<[string, string]> = [
    ["Identifier", issue.identifier],
    ["Title", issue.title],
    ["State", `${issue.state.name} (${issue.state.type})`],
    ["Priority", issue.priorityLabel],
    ["Team", `${issue.team.name} (${issue.team.key})`],
    [
      "Assignee",
      issue.assignee ? `${issue.assignee.name} <${issue.assignee.email}>` : "",
    ],
    ["Project", issue.project?.name ?? ""],
    ["Cycle", issue.cycle ? `#${issue.cycle.number} ${issue.cycle.name}` : ""],
    ["Labels", issue.labels.nodes.map((l) => l.name).join(", ")],
    ["Estimate", issue.estimate != null ? String(issue.estimate) : ""],
    ["Due Date", issue.dueDate ?? ""],
    ["Description", description],
    ["Created", issue.createdAt],
    ["Updated", issue.updatedAt],
    ["URL", issue.url],
  ];

  const maxKey = Math.max(...fields.map(([k]) => k.length));
  for (const [key, value] of fields) {
    if (value) {
      console.log(`${pad(key, maxKey)}  ${value}`);
    }
  }
}

export async function createIssue(args: string[]): Promise<void> {
  const parsed = parseArgs(args, ISSUE_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear issue create --team <key> --title <title> [flags]

Create a new issue.

Options:
  --team <key>          Team key (required)
  --title <title>       Issue title (required)
  --description <text>  Issue description
  --priority <0-4>      Priority (0=none, 1=urgent, 2=high, 3=medium, 4=low)
  --assignee <id>       Assignee user ID
  --state <id>          State ID
  --label <ids>         Label IDs (comma-separated)
  --project <id>        Project ID
  --estimate <n>        Estimate value
  --json                Output as JSON
  -h, --help            Show this help
`);
    return;
  }

  const teamKey = getString(parsed, "team");
  const title = getString(parsed, "title");

  if (!teamKey) {
    console.error("Error: --team is required.");
    process.exit(1);
  }
  if (!title) {
    console.error("Error: --title is required.");
    process.exit(1);
  }

  const token = await requireToken();
  const json = await useJson(parsed);

  const teamQuery = `
    query TeamByKey($filter: TeamFilter!) {
      teams(filter: $filter, first: 1) {
        nodes { id key }
      }
    }
  `;

  const teamData = await graphql<{
    teams: { nodes: Array<{ id: string; key: string }> };
  }>(token, teamQuery, { filter: { key: { eq: teamKey } } });

  const team = teamData.teams.nodes[0];
  if (!team) {
    console.error(`Error: Team with key "${teamKey}" not found.`);
    process.exit(1);
  }

  const input: Record<string, unknown> = {
    teamId: team.id,
    title,
  };

  const description = getString(parsed, "description");
  if (description) input.description = description;

  const priority = getNumber(parsed, "priority");
  if (priority != null) input.priority = priority;

  const assignee = getString(parsed, "assignee");
  if (assignee) input.assigneeId = assignee;

  const state = getString(parsed, "state");
  if (state) input.stateId = state;

  const label = getString(parsed, "label");
  if (label) input.labelIds = label.split(",");

  const project = getString(parsed, "project");
  if (project) input.projectId = project;

  const estimate = getNumber(parsed, "estimate");
  if (estimate != null) input.estimate = estimate;

  const mutation = `
    mutation IssueCreate($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          title
          state { name }
          team { key }
          url
        }
      }
    }
  `;

  const data = await graphql<{
    issueCreate: {
      success: boolean;
      issue: {
        id: string;
        identifier: string;
        title: string;
        state: { name: string };
        team: { key: string };
        url: string;
      };
    };
  }>(token, mutation, { input });

  if (!data.issueCreate.success) {
    console.error("Error: Failed to create issue.");
    process.exit(1);
  }

  const issue = data.issueCreate.issue;

  if (json) {
    console.log(JSON.stringify(issue, null, 2));
    return;
  }

  console.log(`Created ${issue.identifier}: ${issue.title}`);
  console.log(`State: ${issue.state.name}`);
  console.log(`URL: ${issue.url}`);
}

export async function updateIssue(args: string[]): Promise<void> {
  const parsed = parseArgs(args, ISSUE_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear issue update <identifier> [flags]

Update an existing issue.

Options:
  --title <title>       New title
  --description <text>  New description
  --priority <0-4>      New priority
  --state <id>          New state ID
  --assignee <id>       New assignee user ID
  --label <ids>         New label IDs (comma-separated)
  --project <id>        New project ID
  --estimate <n>        New estimate value
  --json                Output as JSON
  -h, --help            Show this help
`);
    return;
  }

  const id = getPositional(parsed, 0);
  if (!id) {
    console.error("Error: Issue identifier is required.");
    process.exit(1);
  }

  const token = await requireToken();
  const json = await useJson(parsed);

  const input: Record<string, unknown> = {};

  const title = getString(parsed, "title");
  if (title) input.title = title;

  const description = getString(parsed, "description");
  if (description) input.description = description;

  const priority = getNumber(parsed, "priority");
  if (priority != null) input.priority = priority;

  const state = getString(parsed, "state");
  if (state) input.stateId = state;

  const assignee = getString(parsed, "assignee");
  if (assignee) input.assigneeId = assignee;

  const label = getString(parsed, "label");
  if (label) input.labelIds = label.split(",");

  const project = getString(parsed, "project");
  if (project) input.projectId = project;

  const estimate = getNumber(parsed, "estimate");
  if (estimate != null) input.estimate = estimate;

  if (Object.keys(input).length === 0) {
    console.error("Error: No update flags provided.");
    process.exit(1);
  }

  const mutation = `
    mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
        success
        issue {
          id
          identifier
          title
          state { name }
          url
        }
      }
    }
  `;

  const data = await graphql<{
    issueUpdate: {
      success: boolean;
      issue: {
        id: string;
        identifier: string;
        title: string;
        state: { name: string };
        url: string;
      };
    };
  }>(token, mutation, { id, input });

  if (!data.issueUpdate.success) {
    console.error("Error: Failed to update issue.");
    process.exit(1);
  }

  const issue = data.issueUpdate.issue;

  if (json) {
    console.log(JSON.stringify(issue, null, 2));
    return;
  }

  console.log(`Updated ${issue.identifier}: ${issue.title}`);
  console.log(`State: ${issue.state.name}`);
  console.log(`URL: ${issue.url}`);
}

export async function closeIssue(args: string[]): Promise<void> {
  const parsed = parseArgs(args, ISSUE_OPTIONS);

  if (wantsHelp(parsed)) {
    console.log(`
Usage: linear issue close <identifier>

Close an issue by setting it to the first completed state.

Options:
  --json         Output as JSON
  -h, --help     Show this help
`);
    return;
  }

  const id = getPositional(parsed, 0);
  if (!id) {
    console.error("Error: Issue identifier is required.");
    process.exit(1);
  }

  const token = await requireToken();
  const json = await useJson(parsed);

  const issueQuery = `
    query Issue($id: String!) {
      issue(id: $id) {
        id
        identifier
        team {
          id
          states { nodes { id name type } }
        }
      }
    }
  `;

  const issueData = await graphql<{
    issue: {
      id: string;
      identifier: string;
      team: {
        id: string;
        states: {
          nodes: Array<{ id: string; name: string; type: string }>;
        };
      };
    };
  }>(token, issueQuery, { id });

  const issue = issueData.issue;
  const completedState = issue.team.states.nodes.find(
    (s) => s.type === "completed",
  );

  if (!completedState) {
    console.error("Error: No completed state found for this team.");
    process.exit(1);
  }

  const mutation = `
    mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
        success
        issue {
          id
          identifier
          title
          state { name }
          url
        }
      }
    }
  `;

  const data = await graphql<{
    issueUpdate: {
      success: boolean;
      issue: {
        id: string;
        identifier: string;
        title: string;
        state: { name: string };
        url: string;
      };
    };
  }>(token, mutation, { id: issue.id, input: { stateId: completedState.id } });

  if (!data.issueUpdate.success) {
    console.error("Error: Failed to close issue.");
    process.exit(1);
  }

  const updated = data.issueUpdate.issue;

  if (json) {
    console.log(JSON.stringify(updated, null, 2));
    return;
  }

  console.log(`Closed ${updated.identifier}: ${updated.title}`);
  console.log(`State: ${updated.state.name}`);
  console.log(`URL: ${updated.url}`);
}
