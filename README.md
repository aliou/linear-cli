# linear-cli

A CLI for [Linear](https://linear.app) via the GraphQL API.

## Install

### From release binaries

Download the latest binary from [Releases](https://github.com/aliou/linear-cli/releases) for your platform:

- `linear-darwin-arm64` (macOS Apple Silicon)
- `linear-linux-arm64` (Linux ARM64)
- `linear-linux-x64` (Linux x64)

```sh
chmod +x linear-*
mv linear-* /usr/local/bin/linear
```

### With Nix

```nix
# flake.nix
{
  inputs.linear-cli.url = "github:aliou/linear-cli";
  # ...
  # Add linear-cli.packages.${system}.default to your packages
}
```

### From source

Requires [Bun](https://bun.sh).

```sh
git clone https://github.com/aliou/linear-cli.git
cd linear-cli
bun install
bun run src/index.ts --help
```

## Authentication

Get a personal API token from **Linear Settings > API > Personal API keys**.

```sh
# Interactive login
linear auth login

# With token directly
linear auth login --token <token>

# Save under a specific workspace profile name
linear auth login --token <token> --workspace personal

# Via API token environment variable
export LINEAR_API_TOKEN=<token>

# Workspace selection for config-stored credentials
export LINEAR_WORKSPACE=acme
linear --workspace personal issue list

# Via pipe
echo <token> | linear auth login
```

Interactive `linear auth login` prompts for your API token and validates it before saving.

You do not need a special `-` argument for stdin. Piped input is detected automatically.

Config is stored in `~/.config/linear-cli/config.json` with `0600` permissions.

List and switch workspace profiles:

```sh
linear auth list
linear auth use <name>
```

### Config format

```json
{
  "$schema": "https://raw.githubusercontent.com/aliou/linear-cli/v0.2.2/schemas/config.schema.json",
  "defaultWorkspace": "acme",
  "workspaces": {
    "acme": {
      "apiToken": "...",
      "orgName": "Acme Inc",
      "defaultTeamKey": "ENG",
      "outputFormat": "table"
    },
    "personal": {
      "apiToken": "...",
      "orgName": "Personal Workspace"
    }
  },
  "defaultTeamKey": "ENG",
  "outputFormat": "table"
}
```

Credentials are stored per workspace profile under `workspaces.<name>`. The CLI auto-detects workspace profile name from Linear organization `urlKey` during login. Use `--workspace` to override the profile name.

The CLI writes and updates `$schema` automatically, pointing to the schema file for the CLI version used to write the config.


## Usage

```sh
linear <command> <subcommand> [flags]
```

### Commands

| Command | Subcommands | Description |
|---|---|---|
| `auth` | `login`, `logout`, `status`, `list`, `use` | Manage authentication |
| `issue` | `list`, `get`, `create`, `update`, `close` | Issue operations |
| `team` | `list`, `get` | Team operations |
| `project` | `list`, `get` | Project operations |
| `cycle` | `list`, `get` | Cycle operations |
| `comment` | `list`, `create`, `update`, `delete` | Comment operations |
| `document` | `list`, `get`, `create`, `update`, `delete` | Document operations |
| `label` | `list`, `create`, `update`, `delete` | Label operations |
| `milestone` | `list`, `get`, `create`, `update`, `delete` | Milestone operations |
| `initiative` | `list`, `get` | Initiative operations |
| `user` | `list`, `get`, `me` | User operations |
| `state` | `list` | Workflow state operations |
| `search` | `issues`, `documents`, `projects` | Search |
| `graphql` | - | Run arbitrary GraphQL queries and mutations |

### Examples

```sh
# List issues for a team
linear issue list --team ENG --limit 10

# Get a specific issue
linear issue get ENG-123

# Create an issue
linear issue create --team ENG --title "Fix bug" --priority 2

# Create an issue with assignee and delegate/agent
linear issue create --team ENG --title "Fix bug" --assignee me --agent "Linear AI"

# Update an issue to assign a delegate/agent
linear issue update ENG-123 --delegate "agent@example.com"

# Clear delegate from an issue
linear issue update ENG-123 --delegate none

# List issues filtered by delegate/agent
linear issue list --agent "Linear AI"

# List users to discover agents (look for app=true)
linear user list

# Close an issue
linear issue close ENG-456

# Search issues
linear search issues "login bug"

# List projects
linear project list --status started

# JSON output
linear issue list --json

# List and switch workspace profiles
linear auth list
linear auth use personal

# Run an arbitrary GraphQL query
linear graphql 'query { viewer { id name email } }'

# Run GraphQL with variables
linear graphql 'query Issue($id: String!) { issue(id: $id) { id title } }' \
  --variables '{"id":"ENG-123"}'

# Read long values from files
linear issue create --team ENG --title "Spec" --description-file ./issue.md
linear comment create --issue ENG-123 --body-file ./comment.md
linear document create --title "Runbook" --content-file ./runbook.md
linear graphql --query-file ./query.graphql --variables-file ./variables.json

# Use - to read from stdin
cat ./comment.md | linear comment update cmt_123 --body-file -

# Or pipe a query via stdin
echo 'query { viewer { id name } }' | linear graphql
```

### Global flags

```
-h, --help                Show help
-v, --version             Show version
-w, --workspace <name>    Use a specific workspace profile
--json                    Output as JSON (available on all commands)
--completion              Generate shell completion (bash, zsh, fish)
```

## Shell completion

```sh
# Bash
source <(linear --completion bash)

# Zsh
source <(linear --completion zsh)

# Fish
linear --completion fish | source
```

## Configuration

### Global config

Stored at `~/.config/linear-cli/config.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/aliou/linear-cli/v0.2.2/schemas/config.schema.json",
  "defaultWorkspace": "acme",
  "workspaces": {
    "acme": {
      "apiToken": "...",
      "orgName": "Acme Inc"
    },
    "personal": {
      "apiToken": "...",
      "orgName": "Personal Workspace"
    }
  },
  "defaultTeamKey": "ENG",
  "outputFormat": "table"
}
```

### Local config

Place a config file in your project directory to set defaults per-project. Searched paths (walking up from cwd):

- `.agents/linear.json`
- `.linear.json`
- `.linear/config.json`

```json
{
  "workspace": "acme",
  "defaultTeamKey": "ENG",
  "outputFormat": "json"
}
```

Local config overrides global/workspace defaults for `defaultTeamKey` and `outputFormat`, and can select the active profile via `workspace`.

## Agent Delegation

Linear supports delegating issues to AI agents (app users). The CLI provides first-class support for this:

### Discovering Agents

```sh
# List all users, agents will have app=true
linear user list

# Get details for a specific user
linear user get <uuid>
```

### Assigning Agents to Issues

```sh
# Create an issue with an agent
linear issue create --team ENG --title "Research" --agent "Linear AI"

# Assign an agent to an existing issue
linear issue update ENG-123 --delegate "agent@example.com"

# Clear the agent from an issue
linear issue update ENG-123 --agent none
```

### Filtering by Agent

```sh
# List issues assigned to a specific agent
linear issue list --agent "Linear AI"

# List issues with no agent
linear issue list --agent none
```

Both `--delegate` and `--agent` flags are aliases and accept:
- UUID of the agent user
- Email address
- Display name or name
- `none` to clear the assignment

Note: Only users with `app=true` can be assigned as delegates. Regular users cannot be delegates.

## License

MIT
