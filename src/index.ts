#!/usr/bin/env bun
import {
  getAuthStatus,
  login,
  logout,
  promptForToken,
  readTokenFromStdin,
} from "./auth.js";
import { parseArgs, printCompletion, printHelp, printVersion } from "./cli.js";
import { getConfigPath } from "./config.js";

async function main(): Promise<void> {
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

  // Pass help flag to subcommand handlers
  const subcommandArgs = options.help
    ? ["--help", ...options.args]
    : options.args;

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
    default:
      console.error(`Unknown command: ${options.command}`);
      printHelp();
      process.exit(1);
  }
}

function parseAuthArgs(args: string[]): { token?: string; help: boolean } {
  let token: string | undefined;
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-h" || arg === "--help") {
      help = true;
    } else if (arg === "--token" && args[i + 1]) {
      token = args[i + 1];
      i++;
    } else if (arg?.startsWith("--token=")) {
      token = arg.slice(8);
    }
  }

  return { token, help };
}

async function handleAuth(
  subcommand: string | null,
  args: string[],
): Promise<void> {
  const parsed = parseAuthArgs(args);

  switch (subcommand) {
    case "login": {
      if (parsed.help) {
        console.log(`
Usage: linear auth login [--token <token>]

Authenticate with Linear using an API token.

Options:
  --token <token>  API token (can also be piped via stdin)
  -h, --help       Show this help

Get your API token from:
  Linear Settings > API > Personal API keys
`);
        return;
      }

      let token = parsed.token;

      if (!token) {
        token = (await readTokenFromStdin()) ?? undefined;
      }

      if (!token) {
        token = await promptForToken();
      }

      if (!token) {
        console.error("Error: No API token provided");
        process.exit(1);
      }

      console.log("Validating token...");
      const result = await login(token);

      if (result.success) {
        console.log(`Authenticated as: ${result.name}`);
        if (result.email) {
          console.log(`Email: ${result.email}`);
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
Usage: linear auth logout

Remove stored API token from config file.

Options:
  -h, --help  Show this help
`);
        return;
      }

      await logout();
      console.log("Logged out. Token removed from config.");
      break;
    }

    case "status": {
      if (parsed.help) {
        console.log(`
Usage: linear auth status

Show current authentication status.

Options:
  -h, --help  Show this help
`);
        return;
      }

      const status = await getAuthStatus();

      if (status.authenticated) {
        console.log("Status: Authenticated");
        console.log(`User: ${status.name}`);
        if (status.email) {
          console.log(`Email: ${status.email}`);
        }
        console.log(
          `Token source: ${status.tokenSource === "env" ? "LINEAR_API_TOKEN env var" : "config file"}`,
        );
      } else {
        console.log("Status: Not authenticated");
        if (status.error) {
          console.log(`Reason: ${status.error}`);
        }
        if (status.tokenSource) {
          console.log(
            `Token source: ${status.tokenSource === "env" ? "LINEAR_API_TOKEN env var" : "config file"}`,
          );
        }
        process.exit(1);
      }
      break;
    }

    default:
      console.error(
        `Usage: linear auth <login|logout|status>\n\nSubcommands:\n  login   Authenticate with API token\n  logout  Remove stored credentials\n  status  Show authentication status`,
      );
      process.exit(1);
  }
}

async function handleIssue(
  subcommand: string | null,
  args: string[],
): Promise<void> {
  const { listIssues, getIssue, createIssue, updateIssue, closeIssue } =
    await import("./commands/issue.js");

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
  const { listTeams, getTeam } = await import("./commands/team.js");

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
  const { listProjects, getProject } = await import("./commands/project.js");

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
  const { listCycles, getCycle } = await import("./commands/cycle.js");

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
  const { listComments, createComment, updateComment, deleteComment } =
    await import("./commands/comment.js");

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
  const {
    listDocuments,
    getDocument,
    createDocument,
    updateDocument,
    deleteDocument,
  } = await import("./commands/document.js");

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
  const { listLabels, createLabel, updateLabel, deleteLabel } = await import(
    "./commands/label.js"
  );

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
  const {
    listMilestones,
    getMilestone,
    createMilestone,
    updateMilestone,
    deleteMilestone,
  } = await import("./commands/milestone.js");

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
  const { listInitiatives, getInitiative } = await import(
    "./commands/initiative.js"
  );

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
  const { listUsers, getUser, me } = await import("./commands/user.js");

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
  const { listStates } = await import("./commands/state.js");

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
  const { searchIssues, searchDocuments, searchProjects } = await import(
    "./commands/search.js"
  );

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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
