import { parseArgs as bunParseArgs } from "node:util";
import { APP_NAME, VERSION } from "./constants.js";

export interface CliOptions {
  help: boolean;
  version: boolean;
  completion: string | null;
  command: string | null;
  subcommand: string | null;
  args: string[];
}

export function parseArgs(args: string[]): CliOptions {
  const result = bunParseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
      completion: { type: "string" },
    },
    strict: false,
    allowPositionals: true,
  });

  const positionals = result.positionals;
  const command = positionals[0] ?? null;
  const subcommand = positionals[1] ?? null;

  const subcommandArgs: string[] = [];
  let foundSubcommand = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg === command && !foundSubcommand) {
      continue;
    }
    if (arg === subcommand && !foundSubcommand) {
      foundSubcommand = true;
      continue;
    }

    if (foundSubcommand) {
      if (arg === "-v" || arg === "--version") {
        continue;
      }
      if (arg === "--completion" || arg.startsWith("--completion=")) {
        continue;
      }
      subcommandArgs.push(arg);
    }
  }

  return {
    help: Boolean(result.values.help),
    version: Boolean(result.values.version),
    completion:
      typeof result.values.completion === "string"
        ? result.values.completion
        : null,
    command,
    subcommand,
    args: subcommandArgs,
  };
}

export function printVersion(): void {
  console.log(`${APP_NAME} version ${VERSION}`);
}

export function printHelp(): void {
  const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
  const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

  console.log(`
${bold("Linear CLI")} - Access Linear from your terminal via GraphQL API

${bold("Usage:")}
  ${APP_NAME} <command> [subcommand] [flags]

${bold("Commands:")}
  auth        Manage authentication ${dim("(login, logout, status)")}
  issue       Issue operations ${dim("(list, get, create, update, close)")}
  team        Team operations ${dim("(list, get)")}
  project     Project operations ${dim("(list, get)")}
  cycle       Cycle operations ${dim("(list, get)")}
  comment     Comment operations ${dim("(list, create, update, delete)")}
  document    Document operations ${dim("(list, get, create, update, delete)")}
  label       Label operations ${dim("(list, create, update, delete)")}
  milestone   Milestone operations ${dim("(list, get, create, update, delete)")}
  initiative  Initiative operations ${dim("(list, get)")}
  user        User operations ${dim("(list, get, me)")}
  state       Workflow state operations ${dim("(list)")}
  search      Search ${dim("(issues, documents, projects)")}

${bold("Flags:")}
  -h, --help       Show help
  -v, --version    Show version
  --completion     Generate shell completion ${dim("(bash, zsh, fish)")}

${bold("Examples:")}
  ${APP_NAME} auth login
  ${APP_NAME} issue list --team ENG --limit 10
  ${APP_NAME} issue get ENG-123
  ${APP_NAME} issue create --team ENG --title "Fix bug"
  ${APP_NAME} team list
  ${APP_NAME} project list

${bold("Configuration:")}
  Config file: ~/.config/linear-cli/config.json
  API token:   Get from Linear Settings > API > Personal API keys

Use "${APP_NAME} <command> --help" for more information about a command.
`);
}

export function generateBashCompletion(): string {
  return `# ${APP_NAME} bash completion
# Add to .bashrc: source <(${APP_NAME} --completion bash)

_${APP_NAME}_completions() {
    local cur prev words cword
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"

    local commands="auth issue team project cycle comment document label milestone initiative user state search"
    local auth_cmds="login logout status"
    local issue_cmds="list get create update close"
    local team_cmds="list get"
    local project_cmds="list get"
    local cycle_cmds="list get"
    local comment_cmds="list create update delete"
    local document_cmds="list get create update delete"
    local label_cmds="list create update delete"
    local milestone_cmds="list get create update delete"
    local initiative_cmds="list get"
    local user_cmds="list get me"
    local state_cmds="list"
    local search_cmds="issues documents projects"

    case "\${COMP_CWORD}" in
        1)
            COMPREPLY=( $(compgen -W "\${commands} --help --version --completion" -- "\${cur}") )
            ;;
        2)
            case "\${prev}" in
                auth)
                    COMPREPLY=( $(compgen -W "\${auth_cmds}" -- "\${cur}") )
                    ;;
                issue)
                    COMPREPLY=( $(compgen -W "\${issue_cmds}" -- "\${cur}") )
                    ;;
                team)
                    COMPREPLY=( $(compgen -W "\${team_cmds}" -- "\${cur}") )
                    ;;
                project)
                    COMPREPLY=( $(compgen -W "\${project_cmds}" -- "\${cur}") )
                    ;;
                cycle)
                    COMPREPLY=( $(compgen -W "\${cycle_cmds}" -- "\${cur}") )
                    ;;
                comment)
                    COMPREPLY=( $(compgen -W "\${comment_cmds}" -- "\${cur}") )
                    ;;
                document)
                    COMPREPLY=( $(compgen -W "\${document_cmds}" -- "\${cur}") )
                    ;;
                label)
                    COMPREPLY=( $(compgen -W "\${label_cmds}" -- "\${cur}") )
                    ;;
                milestone)
                    COMPREPLY=( $(compgen -W "\${milestone_cmds}" -- "\${cur}") )
                    ;;
                initiative)
                    COMPREPLY=( $(compgen -W "\${initiative_cmds}" -- "\${cur}") )
                    ;;
                user)
                    COMPREPLY=( $(compgen -W "\${user_cmds}" -- "\${cur}") )
                    ;;
                state)
                    COMPREPLY=( $(compgen -W "\${state_cmds}" -- "\${cur}") )
                    ;;
                search)
                    COMPREPLY=( $(compgen -W "\${search_cmds}" -- "\${cur}") )
                    ;;
                --completion)
                    COMPREPLY=( $(compgen -W "bash zsh fish" -- "\${cur}") )
                    ;;
            esac
            ;;
    esac
    return 0
}

complete -F _${APP_NAME}_completions ${APP_NAME}
`;
}

export function generateZshCompletion(): string {
  return `#compdef ${APP_NAME}
# ${APP_NAME} zsh completion
# Add to .zshrc: source <(${APP_NAME} --completion zsh)

_${APP_NAME}() {
    local -a commands auth_cmds issue_cmds team_cmds project_cmds cycle_cmds

    commands=(
        'auth:Manage authentication'
        'issue:Issue operations'
        'team:Team operations'
        'project:Project operations'
        'cycle:Cycle operations'
        'comment:Comment operations'
        'document:Document operations'
        'label:Label operations'
        'milestone:Milestone operations'
        'initiative:Initiative operations'
        'user:User operations'
        'state:Workflow state operations'
        'search:Search'
    )

    auth_cmds=('login:Authenticate with API token' 'logout:Remove stored credentials' 'status:Show auth status')
    issue_cmds=('list:List issues' 'get:Get issue by identifier' 'create:Create an issue' 'update:Update an issue' 'close:Close an issue')
    team_cmds=('list:List teams' 'get:Get team by key')
    project_cmds=('list:List projects' 'get:Get project by ID')
    cycle_cmds=('list:List cycles' 'get:Get cycle by ID')
    comment_cmds=('list:List comments' 'create:Create a comment' 'update:Update a comment' 'delete:Delete a comment')
    document_cmds=('list:List documents' 'get:Get document by ID' 'create:Create a document' 'update:Update a document' 'delete:Delete a document')
    label_cmds=('list:List labels' 'create:Create a label' 'update:Update a label' 'delete:Delete a label')
    milestone_cmds=('list:List milestones' 'get:Get milestone by ID' 'create:Create a milestone' 'update:Update a milestone' 'delete:Delete a milestone')
    initiative_cmds=('list:List initiatives' 'get:Get initiative by ID')
    user_cmds=('list:List users' 'get:Get user by ID' 'me:Get authenticated user')
    state_cmds=('list:List workflow states')
    search_cmds=('issues:Search issues' 'documents:Search documents' 'projects:Search projects')

    _arguments -s \\
        '-h[Show help]' \\
        '--help[Show help]' \\
        '-v[Show version]' \\
        '--version[Show version]' \\
        '--completion[Generate completion]:shell:(bash zsh fish)' \\
        '1:command:->command' \\
        '2:subcommand:->subcommand' \\
        '*::args:->args'

    case "$state" in
        command)
            _describe 'command' commands
            ;;
        subcommand)
            case "$words[1]" in
                auth) _describe 'subcommand' auth_cmds ;;
                issue) _describe 'subcommand' issue_cmds ;;
                team) _describe 'subcommand' team_cmds ;;
                project) _describe 'subcommand' project_cmds ;;
                cycle) _describe 'subcommand' cycle_cmds ;;
                comment) _describe 'subcommand' comment_cmds ;;
                document) _describe 'subcommand' document_cmds ;;
                label) _describe 'subcommand' label_cmds ;;
                milestone) _describe 'subcommand' milestone_cmds ;;
                initiative) _describe 'subcommand' initiative_cmds ;;
                user) _describe 'subcommand' user_cmds ;;
                state) _describe 'subcommand' state_cmds ;;
                search) _describe 'subcommand' search_cmds ;;
            esac
            ;;
    esac
}

compdef _${APP_NAME} ${APP_NAME}
`;
}

export function generateFishCompletion(): string {
  return `# ${APP_NAME} fish completion
# Add to fish: ${APP_NAME} --completion fish | source

# Disable file completion by default
complete -c ${APP_NAME} -f

# Global flags
complete -c ${APP_NAME} -s h -l help -d 'Show help'
complete -c ${APP_NAME} -s v -l version -d 'Show version'
complete -c ${APP_NAME} -l completion -d 'Generate completion' -xa 'bash zsh fish'

# Commands
complete -c ${APP_NAME} -n __fish_use_subcommand -a auth -d 'Manage authentication'
complete -c ${APP_NAME} -n __fish_use_subcommand -a issue -d 'Issue operations'
complete -c ${APP_NAME} -n __fish_use_subcommand -a team -d 'Team operations'
complete -c ${APP_NAME} -n __fish_use_subcommand -a project -d 'Project operations'
complete -c ${APP_NAME} -n __fish_use_subcommand -a cycle -d 'Cycle operations'
complete -c ${APP_NAME} -n __fish_use_subcommand -a comment -d 'Comment operations'
complete -c ${APP_NAME} -n __fish_use_subcommand -a document -d 'Document operations'
complete -c ${APP_NAME} -n __fish_use_subcommand -a label -d 'Label operations'
complete -c ${APP_NAME} -n __fish_use_subcommand -a milestone -d 'Milestone operations'
complete -c ${APP_NAME} -n __fish_use_subcommand -a initiative -d 'Initiative operations'
complete -c ${APP_NAME} -n __fish_use_subcommand -a user -d 'User operations'
complete -c ${APP_NAME} -n __fish_use_subcommand -a state -d 'Workflow state operations'
complete -c ${APP_NAME} -n __fish_use_subcommand -a search -d 'Search'

# auth subcommands
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from auth' -a login -d 'Authenticate with API token'
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from auth' -a logout -d 'Remove stored credentials'
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from auth' -a status -d 'Show auth status'

# issue subcommands
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from issue' -a list -d 'List issues'
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from issue' -a get -d 'Get issue by identifier'
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from issue' -a create -d 'Create an issue'
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from issue' -a update -d 'Update an issue'
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from issue' -a close -d 'Close an issue'

# team subcommands
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from team' -a list -d 'List teams'
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from team' -a get -d 'Get team by key'

# project subcommands
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from project' -a list -d 'List projects'
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from project' -a get -d 'Get project by ID'

# cycle subcommands
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from cycle' -a list -d 'List cycles'
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from cycle' -a get -d 'Get cycle by ID'

# comment subcommands
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from comment' -a list -d 'List comments'
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from comment' -a create -d 'Create a comment'
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from comment' -a update -d 'Update a comment'
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from comment' -a delete -d 'Delete a comment'

# document subcommands
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from document' -a list -d 'List documents'
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from document' -a get -d 'Get document by ID'
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from document' -a create -d 'Create a document'
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from document' -a update -d 'Update a document'
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from document' -a delete -d 'Delete a document'

# label subcommands
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from label' -a list -d 'List labels'
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from label' -a create -d 'Create a label'
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from label' -a update -d 'Update a label'
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from label' -a delete -d 'Delete a label'

# milestone subcommands
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from milestone' -a list -d 'List milestones'
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from milestone' -a get -d 'Get milestone by ID'
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from milestone' -a create -d 'Create a milestone'
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from milestone' -a update -d 'Update a milestone'
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from milestone' -a delete -d 'Delete a milestone'

# initiative subcommands
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from initiative' -a list -d 'List initiatives'
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from initiative' -a get -d 'Get initiative by ID'

# user subcommands
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from user' -a list -d 'List users'
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from user' -a get -d 'Get user by ID'
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from user' -a me -d 'Get authenticated user'

# state subcommands
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from state' -a list -d 'List workflow states'

# search subcommands
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from search' -a issues -d 'Search issues'
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from search' -a documents -d 'Search documents'
complete -c ${APP_NAME} -n '__fish_seen_subcommand_from search' -a projects -d 'Search projects'
`;
}

export function printCompletion(shell: string): boolean {
  switch (shell.toLowerCase()) {
    case "bash":
      console.log(generateBashCompletion());
      return true;
    case "zsh":
      console.log(generateZshCompletion());
      return true;
    case "fish":
      console.log(generateFishCompletion());
      return true;
    default:
      console.error(`Unknown shell: ${shell}`);
      console.error("Supported shells: bash, zsh, fish");
      return false;
  }
}
