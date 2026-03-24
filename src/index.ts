#!/usr/bin/env bun
import { Command, InvalidArgumentError, Option } from "commander";
import ora from "ora";
import {
  getAuthStatus,
  login,
  logout,
  promptForToken,
  promptForTokenKind,
  readTokenFromStdin,
} from "./auth";
import { printCompletion } from "./cli";
import {
  type CreateCommentOptions,
  createComment,
  type DeleteCommentOptions,
  deleteComment,
  type ListCommentsOptions,
  listComments,
  type UpdateCommentOptions,
  updateComment,
} from "./commands/comment";
import {
  type GetCycleOptions,
  getCycle,
  type ListCyclesOptions,
  listCycles,
} from "./commands/cycle";
import {
  type CreateDocumentOptions,
  createDocument,
  type DeleteDocumentOptions,
  deleteDocument,
  type GetDocumentOptions,
  getDocument,
  type ListDocumentsOptions,
  listDocuments,
  type UpdateDocumentOptions,
  updateDocument,
} from "./commands/document";
import { type RunGraphqlOptions, runGraphql } from "./commands/graphql";
import {
  type GetInitiativeOptions,
  getInitiative,
  type ListInitiativesOptions,
  listInitiatives,
} from "./commands/initiative";
import {
  type CloseIssueOptions,
  type CreateIssueOptions,
  closeIssue,
  createIssue,
  type GetIssueOptions,
  getIssue,
  type ListIssuesOptions,
  listIssues,
  type UpdateIssueOptions,
  updateIssue,
} from "./commands/issue";
import {
  type CreateLabelOptions,
  createLabel,
  type DeleteLabelOptions,
  deleteLabel,
  type ListLabelsOptions,
  listLabels,
  type UpdateLabelOptions,
  updateLabel,
} from "./commands/label";
import {
  type CreateMilestoneOptions,
  createMilestone,
  type DeleteMilestoneOptions,
  deleteMilestone,
  type GetMilestoneOptions,
  getMilestone,
  type ListMilestonesOptions,
  listMilestones,
  type UpdateMilestoneOptions,
  updateMilestone,
} from "./commands/milestone";
import {
  type GetProjectOptions,
  getProject,
  type ListProjectsOptions,
  listProjects,
} from "./commands/project";
import {
  type SearchDocumentsOptions,
  type SearchIssuesOptions,
  type SearchProjectsOptions,
  searchDocuments,
  searchIssues,
  searchProjects,
} from "./commands/search";
import {
  getWorkspaceContext,
  printTable,
  resetWorkspaceContext,
  setWorkspaceContext,
} from "./commands/shared";
import { type ListStatesOptions, listStates } from "./commands/state";
import {
  type GetTeamOptions,
  getTeam,
  type ListTeamsOptions,
  listTeams,
} from "./commands/team";
import {
  type GetUserOptions,
  getUser,
  type ListUsersOptions,
  listUsers,
  type MeOptions,
  me,
} from "./commands/user";
import {
  getConfigPath,
  loadConfig,
  migrateConfigOnStartup,
  setDefaultWorkspace,
} from "./config";
import { APP_NAME, VERSION } from "./constants";
import { printCliError } from "./errors";

function parsePositiveInt(name: string): (value: string) => number {
  return (value: string): number => {
    const n = Number.parseInt(value, 10);
    if (!Number.isInteger(n) || n < 1) {
      throw new InvalidArgumentError(`${name} must be a positive integer.`);
    }
    return n;
  };
}

function parseNonNegativeInt(name: string): (value: string) => number {
  return (value: string): number => {
    const n = Number.parseInt(value, 10);
    if (!Number.isInteger(n) || n < 0) {
      throw new InvalidArgumentError(`${name} must be a non-negative integer.`);
    }
    return n;
  };
}

function parsePriority(value: string): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n) || n < 0 || n > 4) {
    throw new InvalidArgumentError("priority must be an integer from 0 to 4.");
  }
  return n;
}

function strict(command: Command): Command {
  return command.allowUnknownOption(false).allowExcessArguments(false);
}

function addWorkspaceOption(command: Command): Command {
  return command.option(
    "-w, --workspace <name>",
    "Use a specific workspace profile",
  );
}

function detectCompletionShell(args: string[]): string | null {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === "--completion") {
      return args[i + 1] ?? null;
    }
    if (arg.startsWith("--completion=")) {
      return arg.slice("--completion=".length);
    }
  }
  return null;
}

async function run(): Promise<void> {
  await migrateConfigOnStartup();

  const rawArgs = process.argv.slice(2);
  const completionShell = detectCompletionShell(rawArgs);
  if (completionShell) {
    process.exit(printCompletion(completionShell) ? 0 : 1);
  }

  const program = strict(new Command());
  program
    .name(APP_NAME)
    .description("Access Linear from your terminal via GraphQL API")
    .version(VERSION, "-v, --version", "Show version")
    .helpOption("-h, --help", "Show help")
    .showHelpAfterError()
    .option("--completion <shell>", "Generate shell completion")
    .option("-w, --workspace <name>", "Use a specific workspace profile")
    .hook("preAction", (_command, actionCommand) => {
      const opts = actionCommand.optsWithGlobals<{ workspace?: string }>();
      setWorkspaceContext(opts.workspace);
    })
    .hook("postAction", () => {
      resetWorkspaceContext();
    });

  registerAuth(program);
  registerIssue(program);
  registerTeam(program);
  registerProject(program);
  registerCycle(program);
  registerComment(program);
  registerDocument(program);
  registerLabel(program);
  registerMilestone(program);
  registerInitiative(program);
  registerUser(program);
  registerState(program);
  registerSearch(program);
  registerGraphql(program);

  await program.parseAsync(process.argv);
}

function registerAuth(program: Command): void {
  const auth = strict(program.command("auth")).description(
    "Manage authentication",
  );

  strict(addWorkspaceOption(auth.command("login")))
    .description("Authenticate with API token or OAuth token")
    .addOption(
      new Option("--type <type>", "Token type").choices(["api", "oauth"]),
    )
    .option("--token <token>", "Token value")
    .option("--refresh-token <token>", "OAuth refresh token")
    .option("--expires-at <iso>", "Access token expiry as ISO timestamp")
    .action(async (options) => {
      const workspace = options.workspace ?? getWorkspaceContext();
      let token: string | undefined = options.token;

      if (token && !options.type) {
        throw new Error("--type <api|oauth> is required with --token");
      }

      if (!token) {
        if (!process.stdin.isTTY && !options.type) {
          throw new Error(
            "--type <api|oauth> is required when reading token from stdin",
          );
        }
        token = (await readTokenFromStdin()) ?? undefined;
      }

      const kind =
        (options.type as "api" | "oauth" | undefined) ??
        (await promptForTokenKind());

      if (!token) {
        token = await promptForToken();
      }

      if (!token) {
        throw new Error("No token provided");
      }

      const spinner = ora({
        text: "Validating token...",
        isSilent: !process.stderr.isTTY,
      }).start();

      const loginOptions =
        kind === "oauth"
          ? {
              refreshToken: options.refreshToken as string | undefined,
              expiresAt: options.expiresAt as string | undefined,
              workspace,
            }
          : { workspace };

      const result = await login(token, kind, loginOptions);

      if (!result.success) {
        spinner.fail("Login failed");
        throw new Error(result.error ?? "Unknown login error");
      }

      spinner.succeed("Authenticated");
      console.log(
        `Authenticated as: ${result.name}${result.email ? ` (${result.email})` : ""}`,
      );
      if (result.workspace) {
        console.log(
          `Workspace: ${result.orgName ?? result.workspace} (${result.workspace})`,
        );
      }
      console.log(`Token saved to: ${getConfigPath()}`);
    });

  strict(addWorkspaceOption(auth.command("logout")))
    .description("Remove stored credentials")
    .action(async (options) => {
      const workspace = options.workspace ?? getWorkspaceContext();
      await logout(workspace);
      if (workspace) {
        console.log(
          `Logged out from workspace "${workspace}". Token removed from config.`,
        );
      } else {
        console.log("Logged out. Token removed from config.");
      }
    });

  strict(addWorkspaceOption(auth.command("status")))
    .description("Show current authentication status")
    .action(async (options) => {
      const workspace = options.workspace ?? getWorkspaceContext();
      const status = await getAuthStatus(workspace);

      if (status.authenticated) {
        console.log("Status: Authenticated");
        console.log(`User: ${status.name}`);
        if (status.email) console.log(`Email: ${status.email}`);
        if (status.workspace) {
          console.log(
            `Workspace: ${status.orgName ?? status.workspace} (${status.workspace})`,
          );
        }
        console.log(
          `Token source: ${status.tokenSource === "env" ? "environment variable" : "config file"}`,
        );
      } else {
        console.log("Status: Not authenticated");
        if (status.error) {
          console.log(`Reason: ${status.error}`);
        }
        if (status.tokenSource) {
          console.log(
            `Token source: ${status.tokenSource === "env" ? "environment variable" : "config file"}`,
          );
        }
        process.exitCode = 1;
      }
    });

  strict(auth.command("list"))
    .description("List configured workspace profiles")
    .action(async () => {
      const config = await loadConfig();
      const entries = Object.entries(config.workspaces ?? {});

      if (entries.length === 0) {
        console.log("No workspace profiles configured.");
        return;
      }

      const rows = entries.map(([name, profile]) => {
        const type = profile.accessToken
          ? "oauth"
          : profile.apiToken
            ? "api"
            : "-";
        const marker = config.defaultWorkspace === name ? "*" : "";
        return [name, profile.orgName ?? "-", type, marker];
      });

      printTable(["NAME", "ORG", "TYPE", "DEFAULT"], rows);
    });

  strict(auth.command("use"))
    .description("Set default workspace profile")
    .argument("<name>", "Workspace profile name")
    .action(async (name: string) => {
      await setDefaultWorkspace(name);
      console.log(`Default workspace set to "${name}".`);
    });
}

function registerIssue(program: Command): void {
  const issue = strict(program.command("issue")).description(
    "Issue operations",
  );

  strict(addWorkspaceOption(issue.command("list")))
    .description("List issues")
    .option("--team <key>", "Filter by team key")
    .option("--assignee <value>", "Filter by assignee")
    .option("--delegate <value>", "Filter by delegate/agent")
    .option("--agent <value>", "Alias for --delegate")
    .option("--state <name>", "Filter by state")
    .option("--label <name>", "Filter by label")
    .option("--limit <n>", "Max results", parsePositiveInt("limit"))
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: ListIssuesOptions = {
        team: options.team,
        assignee: options.assignee,
        delegate: options.delegate,
        agent: options.agent,
        state: options.state,
        label: options.label,
        limit: options.limit,
        json: options.json,
      };
      await listIssues(opts);
    });

  strict(addWorkspaceOption(issue.command("get")))
    .description("Get issue by identifier")
    .argument("<identifier>", "Issue identifier or UUID")
    .option("--json", "Output as JSON")
    .action(async (identifier: string, options) => {
      const opts: GetIssueOptions = {
        identifier,
        json: options.json,
      };
      await getIssue(opts);
    });

  strict(addWorkspaceOption(issue.command("create")))
    .description("Create an issue")
    .requiredOption("--team <key>", "Team key")
    .requiredOption("--title <title>", "Issue title")
    .option("--description <text>", "Issue description")
    .option("--priority <0-4>", "Issue priority", parsePriority)
    .option("--assignee <value>", "Assignee")
    .option("--delegate <value>", "Delegate/agent")
    .option("--agent <value>", "Alias for --delegate")
    .option("--state <id>", "State ID")
    .option("--label <ids>", "Comma-separated label IDs")
    .option("--project <id>", "Project ID")
    .option("--estimate <n>", "Estimate", parseNonNegativeInt("estimate"))
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: CreateIssueOptions = {
        team: options.team,
        title: options.title,
        description: options.description,
        priority: options.priority,
        assignee: options.assignee,
        delegate: options.delegate,
        agent: options.agent,
        state: options.state,
        label: options.label,
        project: options.project,
        estimate: options.estimate,
        json: options.json,
      };
      await createIssue(opts);
    });

  strict(addWorkspaceOption(issue.command("update")))
    .description("Update an issue")
    .argument("<identifier>", "Issue identifier or UUID")
    .option("--title <title>", "New title")
    .option("--description <text>", "New description")
    .option("--priority <0-4>", "New priority", parsePriority)
    .option("--state <id>", "New state ID")
    .option("--assignee <value>", "New assignee")
    .option("--delegate <value>", "New delegate/agent")
    .option("--agent <value>", "Alias for --delegate")
    .option("--label <ids>", "New comma-separated label IDs")
    .option("--project <id>", "New project ID")
    .option("--estimate <n>", "New estimate", parseNonNegativeInt("estimate"))
    .option("--json", "Output as JSON")
    .action(async (identifier: string, options) => {
      const opts: UpdateIssueOptions = {
        identifier,
        title: options.title,
        description: options.description,
        priority: options.priority,
        state: options.state,
        assignee: options.assignee,
        delegate: options.delegate,
        agent: options.agent,
        label: options.label,
        project: options.project,
        estimate: options.estimate,
        json: options.json,
      };
      await updateIssue(opts);
    });

  strict(addWorkspaceOption(issue.command("close")))
    .description("Close an issue")
    .argument("<identifier>", "Issue identifier or UUID")
    .option("--json", "Output as JSON")
    .action(async (identifier: string, options) => {
      const opts: CloseIssueOptions = {
        identifier,
        json: options.json,
      };
      await closeIssue(opts);
    });
}

function registerTeam(program: Command): void {
  const team = strict(program.command("team")).description("Team operations");

  strict(addWorkspaceOption(team.command("list")))
    .description("List teams")
    .option("--limit <n>", "Maximum results", parsePositiveInt("limit"))
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: ListTeamsOptions = {
        limit: options.limit,
        json: options.json,
      };
      await listTeams(opts);
    });

  strict(addWorkspaceOption(team.command("get")))
    .description("Get team by key or ID")
    .argument("<team-key-or-id>")
    .option("--json", "Output as JSON")
    .action(async (teamRef: string, options) => {
      const opts: GetTeamOptions = {
        teamRef,
        json: options.json,
      };
      await getTeam(opts);
    });
}

function registerProject(program: Command): void {
  const project = strict(program.command("project")).description(
    "Project operations",
  );

  strict(addWorkspaceOption(project.command("list")))
    .description("List projects")
    .option("--limit <n>", "Maximum results", parsePositiveInt("limit"))
    .addOption(
      new Option("--status <status>", "Project status").choices([
        "planned",
        "started",
        "paused",
        "completed",
        "canceled",
      ]),
    )
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: ListProjectsOptions = {
        limit: options.limit,
        status: options.status,
        json: options.json,
      };
      await listProjects(opts);
    });

  strict(addWorkspaceOption(project.command("get")))
    .description("Get project by ID")
    .argument("<id>")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const opts: GetProjectOptions = {
        id,
        json: options.json,
      };
      await getProject(opts);
    });
}

function registerCycle(program: Command): void {
  const cycle = strict(program.command("cycle")).description(
    "Cycle operations",
  );

  strict(addWorkspaceOption(cycle.command("list")))
    .description("List cycles")
    .option("--team <key>", "Filter by team key")
    .option("--limit <n>", "Maximum results", parsePositiveInt("limit"))
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: ListCyclesOptions = {
        team: options.team,
        limit: options.limit,
        json: options.json,
      };
      await listCycles(opts);
    });

  strict(addWorkspaceOption(cycle.command("get")))
    .description("Get cycle by ID")
    .argument("<id>")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const opts: GetCycleOptions = {
        id,
        json: options.json,
      };
      await getCycle(opts);
    });
}

function registerComment(program: Command): void {
  const comment = strict(program.command("comment")).description(
    "Comment operations",
  );

  strict(addWorkspaceOption(comment.command("list")))
    .description("List comments")
    .requiredOption("--issue <identifier>", "Issue identifier")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: ListCommentsOptions = {
        issue: options.issue,
        json: options.json,
      };
      await listComments(opts);
    });

  strict(addWorkspaceOption(comment.command("create")))
    .description("Create comment")
    .requiredOption("--issue <identifier>", "Issue identifier")
    .requiredOption("--body <text>", "Comment body")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: CreateCommentOptions = {
        issue: options.issue,
        body: options.body,
        json: options.json,
      };
      await createComment(opts);
    });

  strict(addWorkspaceOption(comment.command("update")))
    .description("Update comment")
    .argument("<id>")
    .requiredOption("--body <text>", "Updated comment body")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const opts: UpdateCommentOptions = {
        id,
        body: options.body,
        json: options.json,
      };
      await updateComment(opts);
    });

  strict(addWorkspaceOption(comment.command("delete")))
    .description("Delete comment")
    .argument("<id>")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const opts: DeleteCommentOptions = {
        id,
        json: options.json,
      };
      await deleteComment(opts);
    });
}

function registerDocument(program: Command): void {
  const document = strict(program.command("document")).description(
    "Document operations",
  );

  strict(addWorkspaceOption(document.command("list")))
    .description("List documents")
    .option("--project <id>", "Filter by project ID")
    .option("--limit <n>", "Maximum results", parsePositiveInt("limit"))
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: ListDocumentsOptions = {
        project: options.project,
        limit: options.limit,
        json: options.json,
      };
      await listDocuments(opts);
    });

  strict(addWorkspaceOption(document.command("get")))
    .description("Get document by ID")
    .argument("<id>")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const opts: GetDocumentOptions = {
        id,
        json: options.json,
      };
      await getDocument(opts);
    });

  strict(addWorkspaceOption(document.command("create")))
    .description("Create document")
    .requiredOption("--title <title>", "Document title")
    .requiredOption("--content <markdown>", "Document content markdown")
    .option("--project <id>", "Project ID")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: CreateDocumentOptions = {
        title: options.title,
        content: options.content,
        project: options.project,
        json: options.json,
      };
      await createDocument(opts);
    });

  strict(addWorkspaceOption(document.command("update")))
    .description("Update document")
    .argument("<id>")
    .option("--title <title>", "New title")
    .option("--content <content>", "New content")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const opts: UpdateDocumentOptions = {
        id,
        title: options.title,
        content: options.content,
        json: options.json,
      };
      await updateDocument(opts);
    });

  strict(addWorkspaceOption(document.command("delete")))
    .description("Delete document")
    .argument("<id>")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const opts: DeleteDocumentOptions = {
        id,
        json: options.json,
      };
      await deleteDocument(opts);
    });
}

function registerLabel(program: Command): void {
  const label = strict(program.command("label")).description(
    "Label operations",
  );

  strict(addWorkspaceOption(label.command("list")))
    .description("List labels")
    .option("--team <key>", "Filter by team key")
    .option("--limit <n>", "Maximum results", parsePositiveInt("limit"))
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: ListLabelsOptions = {
        team: options.team,
        limit: options.limit,
        json: options.json,
      };
      await listLabels(opts);
    });

  strict(addWorkspaceOption(label.command("create")))
    .description("Create label")
    .requiredOption("--name <name>", "Label name")
    .requiredOption("--color <hex>", "Label color")
    .option("--team <key>", "Team key")
    .option("--description <text>", "Description")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: CreateLabelOptions = {
        name: options.name,
        color: options.color,
        team: options.team,
        description: options.description,
        json: options.json,
      };
      await createLabel(opts);
    });

  strict(addWorkspaceOption(label.command("update")))
    .description("Update label")
    .argument("<id>")
    .option("--name <name>", "New name")
    .option("--color <hex>", "New color")
    .option("--description <text>", "New description")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const opts: UpdateLabelOptions = {
        id,
        name: options.name,
        color: options.color,
        description: options.description,
        json: options.json,
      };
      await updateLabel(opts);
    });

  strict(addWorkspaceOption(label.command("delete")))
    .description("Delete label")
    .argument("<id>")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const opts: DeleteLabelOptions = {
        id,
        json: options.json,
      };
      await deleteLabel(opts);
    });
}

function registerMilestone(program: Command): void {
  const milestone = strict(program.command("milestone")).description(
    "Milestone operations",
  );

  strict(addWorkspaceOption(milestone.command("list")))
    .description("List milestones")
    .option("--project <id>", "Filter by project ID")
    .option("--limit <n>", "Maximum results", parsePositiveInt("limit"))
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: ListMilestonesOptions = {
        project: options.project,
        limit: options.limit,
        json: options.json,
      };
      await listMilestones(opts);
    });

  strict(addWorkspaceOption(milestone.command("get")))
    .description("Get milestone")
    .argument("<id>")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const opts: GetMilestoneOptions = {
        id,
        json: options.json,
      };
      await getMilestone(opts);
    });

  strict(addWorkspaceOption(milestone.command("create")))
    .description("Create milestone")
    .requiredOption("--project <id>", "Project ID")
    .requiredOption("--name <name>", "Milestone name")
    .option("--description <text>", "Description")
    .option("--targetDate <date>", "Target date (YYYY-MM-DD)")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: CreateMilestoneOptions = {
        project: options.project,
        name: options.name,
        description: options.description,
        targetDate: options.targetDate,
        json: options.json,
      };
      await createMilestone(opts);
    });

  strict(addWorkspaceOption(milestone.command("update")))
    .description("Update milestone")
    .argument("<id>")
    .option("--name <name>", "New name")
    .option("--description <text>", "New description")
    .option("--targetDate <date>", "New target date")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const opts: UpdateMilestoneOptions = {
        id,
        name: options.name,
        description: options.description,
        targetDate: options.targetDate,
        json: options.json,
      };
      await updateMilestone(opts);
    });

  strict(addWorkspaceOption(milestone.command("delete")))
    .description("Delete milestone")
    .argument("<id>")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const opts: DeleteMilestoneOptions = {
        id,
        json: options.json,
      };
      await deleteMilestone(opts);
    });
}

function registerInitiative(program: Command): void {
  const initiative = strict(program.command("initiative")).description(
    "Initiative operations",
  );

  strict(addWorkspaceOption(initiative.command("list")))
    .description("List initiatives")
    .option("--limit <n>", "Maximum results", parsePositiveInt("limit"))
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: ListInitiativesOptions = {
        limit: options.limit,
        json: options.json,
      };
      await listInitiatives(opts);
    });

  strict(addWorkspaceOption(initiative.command("get")))
    .description("Get initiative")
    .argument("<id>")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const opts: GetInitiativeOptions = {
        id,
        json: options.json,
      };
      await getInitiative(opts);
    });
}

function registerUser(program: Command): void {
  const user = strict(program.command("user")).description("User operations");

  strict(addWorkspaceOption(user.command("list")))
    .description("List users")
    .option("--limit <n>", "Maximum results", parsePositiveInt("limit"))
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: ListUsersOptions = {
        limit: options.limit,
        json: options.json,
      };
      await listUsers(opts);
    });

  strict(addWorkspaceOption(user.command("get")))
    .description("Get user")
    .argument("<id>")
    .option("--json", "Output as JSON")
    .action(async (id: string, options) => {
      const opts: GetUserOptions = {
        id,
        json: options.json,
      };
      await getUser(opts);
    });

  strict(addWorkspaceOption(user.command("me")))
    .description("Get authenticated user")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: MeOptions = {
        json: options.json,
      };
      await me(opts);
    });
}

function registerState(program: Command): void {
  const state = strict(program.command("state")).description(
    "Workflow state operations",
  );

  strict(addWorkspaceOption(state.command("list")))
    .description("List workflow states")
    .option("--team <key>", "Filter by team key")
    .option("--limit <n>", "Maximum results", parsePositiveInt("limit"))
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const opts: ListStatesOptions = {
        team: options.team,
        limit: options.limit,
        json: options.json,
      };
      await listStates(opts);
    });
}

function registerSearch(program: Command): void {
  const search = strict(program.command("search")).description("Search");

  strict(addWorkspaceOption(search.command("issues")))
    .description("Search issues")
    .argument("<term>")
    .option("--team <key>", "Filter by team")
    .option("--limit <n>", "Maximum results", parsePositiveInt("limit"))
    .option("--json", "Output as JSON")
    .action(async (term: string, options) => {
      const opts: SearchIssuesOptions = {
        term,
        team: options.team,
        limit: options.limit,
        json: options.json,
      };
      await searchIssues(opts);
    });

  strict(addWorkspaceOption(search.command("documents")))
    .description("Search documents")
    .argument("<term>")
    .option("--limit <n>", "Maximum results", parsePositiveInt("limit"))
    .option("--json", "Output as JSON")
    .action(async (term: string, options) => {
      const opts: SearchDocumentsOptions = {
        term,
        limit: options.limit,
        json: options.json,
      };
      await searchDocuments(opts);
    });

  strict(addWorkspaceOption(search.command("projects")))
    .description("Search projects")
    .argument("<term>")
    .option("--limit <n>", "Maximum results", parsePositiveInt("limit"))
    .option("--json", "Output as JSON")
    .action(async (term: string, options) => {
      const opts: SearchProjectsOptions = {
        term,
        limit: options.limit,
        json: options.json,
      };
      await searchProjects(opts);
    });
}

function registerGraphql(program: Command): void {
  strict(addWorkspaceOption(program.command("graphql")))
    .description("Run arbitrary GraphQL")
    .argument("[query...]", "GraphQL query/mutation string")
    .option("--variables <json>", "Variables object as JSON")
    .action(async (queryParts: string[] | undefined, options) => {
      const query =
        Array.isArray(queryParts) && queryParts.length > 0
          ? queryParts.join(" ")
          : undefined;
      const opts: RunGraphqlOptions = {
        query,
        variables: options.variables,
      };
      await runGraphql(opts);
    });
}

run().catch((err) => {
  printCliError(err);
  process.exit(1);
});
