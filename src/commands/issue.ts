import { graphql } from "../api.ts";
import {
  pad,
  printTable,
  requireToken,
  resolveAssignee,
  resolveDelegate,
  useJson,
} from "./shared.ts";

export interface ListIssuesOptions {
  team?: string;
  assignee?: string;
  delegate?: string;
  agent?: string;
  state?: string;
  label?: string;
  limit?: number;
  json?: boolean;
}

export async function listIssues(options: ListIssuesOptions): Promise<void> {
  const token = await requireToken();
  const json = await useJson(options.json);
  const limit = options.limit ?? 50;

  const filter: Record<string, unknown> = {};
  if (options.team) filter.team = { key: { eq: options.team } };

  const assigneeRaw = options.assignee;
  if (assigneeRaw) {
    if (assigneeRaw.toLowerCase() === "me") {
      filter.assignee = { isMe: { eq: true } };
    } else if (assigneeRaw.toLowerCase() === "none") {
      filter.assignee = { null: true };
    } else {
      try {
        const assigneeId = await resolveAssignee(token, assigneeRaw);
        if (assigneeId) {
          filter.assignee = { id: { eq: assigneeId } };
        } else {
          filter.assignee = { null: true };
        }
      } catch (err) {
        console.error(
          `Error: ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(1);
      }
    }
  }

  const delegateRaw = options.delegate ?? options.agent;
  if (delegateRaw) {
    if (delegateRaw.toLowerCase() === "none") {
      filter.delegate = { null: true };
    } else {
      try {
        const delegateId = await resolveDelegate(token, delegateRaw);
        if (delegateId) {
          filter.delegate = { id: { eq: delegateId } };
        } else {
          filter.delegate = { null: true };
        }
      } catch (err) {
        console.error(
          `Error: ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(1);
      }
    }
  }

  if (options.state) filter.state = { name: { eqIgnoreCase: options.state } };
  if (options.label) filter.labels = { name: { eqIgnoreCase: options.label } };

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
          delegate { name email app }
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
        delegate: { name: string; email: string; app: boolean } | null;
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

  const headers = [
    "IDENTIFIER",
    "TITLE",
    "STATE",
    "PRIORITY",
    "ASSIGNEE",
    "AGENT",
  ];
  const rows = issues.map((issue) => [
    issue.identifier,
    issue.title,
    issue.state.name,
    issue.priorityLabel,
    issue.assignee?.name ?? "",
    issue.delegate?.name ?? "",
  ]);

  printTable(headers, rows);
}

export interface GetIssueOptions {
  identifier: string;
  json?: boolean;
}

export async function getIssue(options: GetIssueOptions): Promise<void> {
  const token = await requireToken();
  const json = await useJson(options.json);

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
        delegate { name email app }
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
      delegate: { name: string; email: string; app: boolean } | null;
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
  }>(token, query, { id: options.identifier });

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
    [
      "Agent",
      issue.delegate
        ? `${issue.delegate.name} <${issue.delegate.email}>${issue.delegate.app ? " (app)" : ""}`
        : "",
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

export interface CreateIssueOptions {
  team: string;
  title: string;
  description?: string;
  priority?: number;
  assignee?: string;
  delegate?: string;
  agent?: string;
  state?: string;
  label?: string;
  project?: string;
  estimate?: number;
  json?: boolean;
}

export async function createIssue(options: CreateIssueOptions): Promise<void> {
  const token = await requireToken();
  const json = await useJson(options.json);

  const teamQuery = `
    query TeamByKey($filter: TeamFilter!) {
      teams(filter: $filter, first: 1) {
        nodes { id key }
      }
    }
  `;

  const teamData = await graphql<{
    teams: { nodes: Array<{ id: string; key: string }> };
  }>(token, teamQuery, { filter: { key: { eq: options.team } } });

  const team = teamData.teams.nodes[0];
  if (!team) {
    console.error(`Error: Team with key "${options.team}" not found.`);
    process.exit(1);
  }

  const input: Record<string, unknown> = {
    teamId: team.id,
    title: options.title,
  };

  if (options.description) input.description = options.description;
  if (options.priority != null) input.priority = options.priority;

  if (options.assignee) {
    try {
      const assigneeId = await resolveAssignee(token, options.assignee);
      if (assigneeId) {
        input.assigneeId = assigneeId;
      }
    } catch (err) {
      console.error(
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  }

  const delegateRaw = options.delegate ?? options.agent;
  if (delegateRaw) {
    try {
      const delegateId = await resolveDelegate(token, delegateRaw);
      if (delegateId) {
        input.delegateId = delegateId;
      }
    } catch (err) {
      console.error(
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  }

  if (options.state) input.stateId = options.state;
  if (options.label) input.labelIds = options.label.split(",");
  if (options.project) input.projectId = options.project;
  if (options.estimate != null) input.estimate = options.estimate;

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
          assignee { name email }
          delegate { name email app }
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
        assignee: { name: string; email: string } | null;
        delegate: { name: string; email: string; app: boolean } | null;
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
  if (issue.assignee) {
    console.log(`Assignee: ${issue.assignee.name} <${issue.assignee.email}>`);
  }
  if (issue.delegate) {
    console.log(`Agent: ${issue.delegate.name} <${issue.delegate.email}>`);
  }
  console.log(`URL: ${issue.url}`);
}

export interface UpdateIssueOptions {
  identifier: string;
  title?: string;
  description?: string;
  priority?: number;
  state?: string;
  assignee?: string;
  delegate?: string;
  agent?: string;
  label?: string;
  project?: string;
  estimate?: number;
  json?: boolean;
}

export async function updateIssue(options: UpdateIssueOptions): Promise<void> {
  const token = await requireToken();
  const json = await useJson(options.json);

  const input: Record<string, unknown> = {};

  if (options.title) input.title = options.title;
  if (options.description) input.description = options.description;
  if (options.priority != null) input.priority = options.priority;
  if (options.state) input.stateId = options.state;

  if (options.assignee) {
    try {
      const assigneeId = await resolveAssignee(token, options.assignee);
      if (assigneeId) {
        input.assigneeId = assigneeId;
      } else {
        input.assigneeId = null;
      }
    } catch (err) {
      console.error(
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  }

  const delegateRaw = options.delegate ?? options.agent;
  if (delegateRaw) {
    try {
      const delegateId = await resolveDelegate(token, delegateRaw);
      if (delegateId) {
        input.delegateId = delegateId;
      } else {
        input.delegateId = null;
      }
    } catch (err) {
      console.error(
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  }

  if (options.label) input.labelIds = options.label.split(",");
  if (options.project) input.projectId = options.project;
  if (options.estimate != null) input.estimate = options.estimate;

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
          assignee { name email }
          delegate { name email app }
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
        assignee: { name: string; email: string } | null;
        delegate: { name: string; email: string; app: boolean } | null;
        url: string;
      };
    };
  }>(token, mutation, { id: options.identifier, input });

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
  if (issue.assignee) {
    console.log(`Assignee: ${issue.assignee.name} <${issue.assignee.email}>`);
  }
  if (issue.delegate) {
    console.log(`Agent: ${issue.delegate.name} <${issue.delegate.email}>`);
  }
  console.log(`URL: ${issue.url}`);
}

export interface CloseIssueOptions {
  identifier: string;
  json?: boolean;
}

export async function closeIssue(options: CloseIssueOptions): Promise<void> {
  const token = await requireToken();
  const json = await useJson(options.json);

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
  }>(token, issueQuery, { id: options.identifier });

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
