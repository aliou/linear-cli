#!/usr/bin/env bun
import {
  getAuthStatus,
  login,
  logout,
  promptForToken,
  promptForTokenKind,
  readTokenFromStdin,
} from "./auth";
import {
  type CliOptions,
  parseArgs,
  printCompletion,
  printHelp,
  printVersion,
} from "./cli";
import {
  createComment,
  deleteComment,
  listComments,
  updateComment,
} from "./commands/comment";
import { getCycle, listCycles } from "./commands/cycle";
import {
  createDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  updateDocument,
} from "./commands/document";
import { runGraphql } from "./commands/graphql";
import { getInitiative, listInitiatives } from "./commands/initiative";
import {
  closeIssue,
  createIssue,
  getIssue,
  listIssues,
  updateIssue,
} from "./commands/issue";
import {
  createLabel,
  deleteLabel,
  listLabels,
  updateLabel,
} from "./commands/label";
import {
  createMilestone,
  deleteMilestone,
  getMilestone,
  listMilestones,
  updateMilestone,
} from "./commands/milestone";
import { getProject, listProjects } from "./commands/project";
import {
  searchDocuments,
  searchIssues,
  searchProjects,
} from "./commands/search";
import {
  getWorkspaceContext,
  resetWorkspaceContext,
  setWorkspaceContext,
} from "./commands/shared";
import { listStates } from "./commands/state";
import { getTeam, listTeams } from "./commands/team";
import { getUser, listUsers, me } from "./commands/user";
import {
  getConfigPath,
  loadConfig,
  migrateConfigOnStartup,
  setDefaultWorkspace,
} from "./config";
import { printCliError } from "./errors";

async function main(): Promise<void> {
  await migrateConfigOnStartup();

  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.version) {
    printVersion();
    process.exit(0);
  }

  if (options.completion) {
    const success = printCompletion(options.completion);
    process.exit(success ? 0 : 1);
  }

  // Show global help only if no command specified
  if (!options.command) {
    printHelp();
    process.exit(options.help ? 0 : 1);
  }

  setWorkspaceContext(options.workspace ?? undefined);

  // Pass help flag to subcommand handlers
  const subcommandArgs = options.help
    ? ["--help", ...options.args]
    : options.args;

  try {
    // Route to command handlers
    switch (options.command) {
      case "auth":
        await handleAuth(options.subcommand, subcommandArgs);
        break;
      case "issue":
        await handleIssue(options.subcommand, subcommandArgs);
        break;
      case "team":
        await handleTeam(options.subcommand, subcommandArgs);
        break;
      case "project":
        await handleProject(options.subcommand, subcommandArgs);
        break;
      case "cycle":
        await handleCycle(options.subcommand, subcommandArgs);
        break;
      case "comment":
        await handleComment(options.subcommand, subcommandArgs);
        break;
      case "document":
        await handleDocument(options.subcommand, subcommandArgs);
        break;
      case "label":
        await handleLabel(options.subcommand, subcommandArgs);
        break;
      case "milestone":
        await handleMilestone(options.subcommand, subcommandArgs);
        break;
      case "initiative":
        await handleInitiative(options.subcommand, subcommandArgs);
        break;
      case "user":
        await handleUser(options.subcommand, subcommandArgs);
        break;
      case "state":
        await handleState(options.subcommand, subcommandArgs);
        break;
      case "search":
        await handleSearch(options.subcommand, subcommandArgs);
        break;
      case "graphql":
        await handleGraphql(getGraphqlArgs(options));
        break;
      default:
        console.error(`Unknown command: ${options.command}`);
        printHelp();
        process.exit(1);
    }
  } finally {
    resetWorkspaceContext();
  }
}

function parseAuthArgs(args: string[]): {
  token?: string;
  type?: "api" | "oauth";
  refreshToken?: string;
  expiresAt?: string;
  workspace?: string;
  positionals: string[];
  help: boolean;
} {
  let token: string | undefined;
  let type: "api" | "oauth" | undefined;
  let refreshToken: string | undefined;
  let expiresAt: string | undefined;
  let workspace: string | undefined;
  let help = false;
  const positionals: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-h" || arg === "--help") {
      help = true;
    } else if (arg === "--token" && args[i + 1]) {
      token = args[i + 1];
      i++;
    } else if (arg?.startsWith("--token=")) {
      token = arg.slice(8);
    } else if (arg === "--type" && args[i + 1]) {
      const value = args[i + 1];
      if (value === "api" || value === "oauth") {
        type = value;
      }
      i++;
    } else if (arg?.startsWith("--type=")) {
      const value = arg.slice(7);
      if (value === "api" || value === "oauth") {
        type = value;
      }
    } else if (arg === "--refresh-token" && args[i + 1]) {
      refreshToken = args[i + 1];
      i++;
    } else if (arg?.startsWith("--refresh-token=")) {
      refreshToken = arg.slice(16);
    } else if (arg === "--expires-at" && args[i + 1]) {
      expiresAt = args[i + 1];
      i++;
    } else if (arg?.startsWith("--expires-at=")) {
      expiresAt = arg.slice(13);
    } else if (arg === "-w" || arg === "--workspace") {
      workspace = args[i + 1];
      i++;
    } else if (arg?.startsWith("--workspace=")) {
      workspace = arg.slice(12);
    } else if (arg && !arg.startsWith("-")) {
      positionals.push(arg);
    }
  }

  return { token, type, refreshToken, expiresAt, workspace, positionals, help };
}

async function handleAuth(
  subcommand: string | null,
  args: string[],
): Promise<void> {
  const parsed = parseAuthArgs(args);
  const workspace = parsed.workspace ?? getWorkspaceContext();

  switch (subcommand) {
    case "login": {
      if (parsed.help) {
        console.log(`
Usage: linear auth login [--token <token>] [--type <api|oauth>] [--workspace <name>]

Authenticate with Linear using an API token or an OAuth token.

Options:
  --token <token>             Token value
  --type <api|oauth>          Required with --token or stdin
  --refresh-token <token>     OAuth refresh token (only with --type oauth)
  --expires-at <iso>          Access token expiry as ISO timestamp (only with --type oauth)
  -w, --workspace <name>      Save credentials to a specific workspace profile
  -h, --help                  Show this help

Interactive login will ask for the token type first.

Get your API token from:
  Linear Settings > API > Personal API keys
`);
        return;
      }

      let token = parsed.token;

      if (token) {
        if (!parsed.type) {
          console.error("Error: --type <api|oauth> is required with --token");
          process.exit(1);
        }
      } else {
        if (!process.stdin.isTTY && !parsed.type) {
          console.error(
            "Error: --type <api|oauth> is required when reading token from stdin",
          );
          process.exit(1);
        }

        token = (await readTokenFromStdin()) ?? undefined;
      }

      const kind = parsed.type ?? (await promptForTokenKind());

      if (!token) {
        token = await promptForToken();
      }

      if (!token) {
        console.error("Error: No token provided");
        process.exit(1);
      }

      console.log("Validating token...");
      const loginOptions =
        kind === "oauth"
          ? {
              refreshToken: parsed.refreshToken,
              expiresAt: parsed.expiresAt,
              workspace,
            }
          : {
              workspace,
            };
      const result = await login(token, kind, loginOptions);

      if (result.success) {
        console.log(
          `Authenticated as: ${result.name}${result.email ? ` (${result.email})` : ""}`,
        );
        if (result.workspace) {
          console.log(
            `Workspace: ${result.orgName ?? result.workspace} (${result.workspace})`,
          );
        }
        console.log(`Token saved to: ${getConfigPath()}`);
      } else {
        console.error(`Login failed: ${result.error}`);
        process.exit(1);
      }
      break;
    }

    case "logout": {
      if (parsed.help) {
        console.log(`
Usage: linear auth logout [--workspace <name>]

Remove stored API token from config file.

Options:
  -w, --workspace <name>  Workspace profile to remove
  -h, --help              Show this help
`);
        return;
      }

      await logout(workspace);
      if (workspace) {
        console.log(
          `Logged out from workspace "${workspace}". Token removed from config.`,
        );
      } else {
        console.log("Logged out. Token removed from config.");
      }
      break;
    }

    case "status": {
      if (parsed.help) {
        console.log(`
Usage: linear auth status [--workspace <name>]

Show current authentication status.

Options:
  -w, --workspace <name>  Workspace profile to inspect
  -h, --help              Show this help
`);
        return;
      }

      const status = await getAuthStatus(workspace);

      if (status.authenticated) {
        console.log("Status: Authenticated");
        console.log(`User: ${status.name}`);
        if (status.email) {
          console.log(`Email: ${status.email}`);
        }
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
        process.exit(1);
      }
      break;
    }

    case "list": {
      if (parsed.help) {
        console.log(`
Usage: linear auth list

List configured workspace profiles.

Options:
  -h, --help  Show this help
`);
        return;
      }

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

      const headers = ["NAME", "ORG", "TYPE", "DEFAULT"];
      const widths = headers.map((header, index) =>
        Math.max(
          header.length,
          ...rows.map((row) => (row[index] ?? "").length),
        ),
      );

      console.log(headers.map((h, i) => h.padEnd(widths[i] ?? 0)).join("  "));
      for (const row of rows) {
        console.log(
          row.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join("  "),
        );
      }
      break;
    }

    case "use": {
      if (parsed.help) {
        console.log(`
Usage: linear auth use <name>

Set default workspace profile.

Options:
  -h, --help  Show this help
`);
        return;
      }

      const name = parsed.positionals[0];
      if (!name) {
        console.error(
          "Error: Missing workspace name. Usage: linear auth use <name>",
        );
        process.exit(1);
      }

      await setDefaultWorkspace(name);
      console.log(`Default workspace set to "${name}".`);
      break;
    }

    default:
      console.error(
        `Usage: linear auth <login|logout|status|list|use>\n\nSubcommands:\n  login   Authenticate with API token\n  logout  Remove stored credentials\n  status  Show authentication status\n  list    List workspace profiles\n  use     Set default workspace`,
      );
      process.exit(1);
  }
}

async function handleIssue(
  subcommand: string | null,
  args: string[],
): Promise<void> {
  switch (subcommand) {
    case "list":
      await listIssues(args);
      break;
    case "get":
      await getIssue(args);
      break;
    case "create":
      await createIssue(args);
      break;
    case "update":
      await updateIssue(args);
      break;
    case "close":
      await closeIssue(args);
      break;
    default:
      console.error(
        `Usage: linear issue <list|get|create|update|close>\n\nSubcommands:\n  list    List issues\n  get     Get issue by identifier\n  create  Create an issue\n  update  Update an issue\n  close   Close an issue`,
      );
      process.exit(1);
  }
}

async function handleTeam(
  subcommand: string | null,
  args: string[],
): Promise<void> {
  switch (subcommand) {
    case "list":
      await listTeams(args);
      break;
    case "get":
      await getTeam(args);
      break;
    default:
      console.error(
        `Usage: linear team <list|get>\n\nSubcommands:\n  list  List teams\n  get   Get team by key`,
      );
      process.exit(1);
  }
}

async function handleProject(
  subcommand: string | null,
  args: string[],
): Promise<void> {
  switch (subcommand) {
    case "list":
      await listProjects(args);
      break;
    case "get":
      await getProject(args);
      break;
    default:
      console.error(
        `Usage: linear project <list|get>\n\nSubcommands:\n  list  List projects\n  get   Get project by ID`,
      );
      process.exit(1);
  }
}

async function handleCycle(
  subcommand: string | null,
  args: string[],
): Promise<void> {
  switch (subcommand) {
    case "list":
      await listCycles(args);
      break;
    case "get":
      await getCycle(args);
      break;
    default:
      console.error(
        `Usage: linear cycle <list|get>\n\nSubcommands:\n  list  List cycles\n  get   Get cycle by ID`,
      );
      process.exit(1);
  }
}

async function handleComment(
  subcommand: string | null,
  args: string[],
): Promise<void> {
  switch (subcommand) {
    case "list":
      await listComments(args);
      break;
    case "create":
      await createComment(args);
      break;
    case "update":
      await updateComment(args);
      break;
    case "delete":
      await deleteComment(args);
      break;
    default:
      console.error(
        `Usage: linear comment <list|create|update|delete>\n\nSubcommands:\n  list    List comments on an issue\n  create  Add a comment to an issue\n  update  Edit a comment\n  delete  Delete a comment`,
      );
      process.exit(1);
  }
}

async function handleDocument(
  subcommand: string | null,
  args: string[],
): Promise<void> {
  switch (subcommand) {
    case "list":
      await listDocuments(args);
      break;
    case "get":
      await getDocument(args);
      break;
    case "create":
      await createDocument(args);
      break;
    case "update":
      await updateDocument(args);
      break;
    case "delete":
      await deleteDocument(args);
      break;
    default:
      console.error(
        `Usage: linear document <list|get|create|update|delete>\n\nSubcommands:\n  list    List documents\n  get     Get document by ID\n  create  Create a document\n  update  Update a document\n  delete  Delete a document`,
      );
      process.exit(1);
  }
}

async function handleLabel(
  subcommand: string | null,
  args: string[],
): Promise<void> {
  switch (subcommand) {
    case "list":
      await listLabels(args);
      break;
    case "create":
      await createLabel(args);
      break;
    case "update":
      await updateLabel(args);
      break;
    case "delete":
      await deleteLabel(args);
      break;
    default:
      console.error(
        `Usage: linear label <list|create|update|delete>\n\nSubcommands:\n  list    List labels\n  create  Create a label\n  update  Update a label\n  delete  Delete a label`,
      );
      process.exit(1);
  }
}

async function handleMilestone(
  subcommand: string | null,
  args: string[],
): Promise<void> {
  switch (subcommand) {
    case "list":
      await listMilestones(args);
      break;
    case "get":
      await getMilestone(args);
      break;
    case "create":
      await createMilestone(args);
      break;
    case "update":
      await updateMilestone(args);
      break;
    case "delete":
      await deleteMilestone(args);
      break;
    default:
      console.error(
        `Usage: linear milestone <list|get|create|update|delete>\n\nSubcommands:\n  list    List milestones\n  get     Get milestone by ID\n  create  Create a milestone\n  update  Update a milestone\n  delete  Delete a milestone`,
      );
      process.exit(1);
  }
}

async function handleInitiative(
  subcommand: string | null,
  args: string[],
): Promise<void> {
  switch (subcommand) {
    case "list":
      await listInitiatives(args);
      break;
    case "get":
      await getInitiative(args);
      break;
    default:
      console.error(
        `Usage: linear initiative <list|get>\n\nSubcommands:\n  list  List initiatives\n  get   Get initiative by ID`,
      );
      process.exit(1);
  }
}

async function handleUser(
  subcommand: string | null,
  args: string[],
): Promise<void> {
  switch (subcommand) {
    case "list":
      await listUsers(args);
      break;
    case "get":
      await getUser(args);
      break;
    case "me":
      await me(args);
      break;
    default:
      console.error(
        `Usage: linear user <list|get|me>\n\nSubcommands:\n  list  List users\n  get   Get user by ID\n  me    Get authenticated user`,
      );
      process.exit(1);
  }
}

async function handleState(
  subcommand: string | null,
  args: string[],
): Promise<void> {
  switch (subcommand) {
    case "list":
      await listStates(args);
      break;
    default:
      console.error(
        `Usage: linear state <list>\n\nSubcommands:\n  list  List workflow states`,
      );
      process.exit(1);
  }
}

async function handleSearch(
  subcommand: string | null,
  args: string[],
): Promise<void> {
  switch (subcommand) {
    case "issues":
      await searchIssues(args);
      break;
    case "documents":
      await searchDocuments(args);
      break;
    case "projects":
      await searchProjects(args);
      break;
    default:
      console.error(
        `Usage: linear search <issues|documents|projects>\n\nSubcommands:\n  issues     Search issues by text\n  documents  Search documents by text\n  projects   Search projects by text`,
      );
      process.exit(1);
  }
}

async function handleGraphql(args: string[]): Promise<void> {
  await runGraphql(args);
}

function getGraphqlArgs(options: CliOptions): string[] {
  return [
    ...(options.help ? ["--help"] : []),
    ...(options.subcommand ? [options.subcommand] : []),
    ...options.args,
  ];
}

main().catch((err) => {
  printCliError(err);
  process.exit(1);
});
