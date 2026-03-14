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

Get an API token from **Linear Settings > API > Personal API keys**.

```sh
# Interactive login
linear auth login

# With token directly
linear auth login --token <token>

# Via environment variable
export LINEAR_API_TOKEN=<token>

# Via pipe
echo <token> | linear auth login
```

Token is stored in `~/.config/linear-cli/config.json` with `0600` permissions.

## Usage

```sh
linear <command> <subcommand> [flags]
```

### Commands

| Command | Subcommands | Description |
|---|---|---|
| `auth` | `login`, `logout`, `status` | Manage authentication |
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
```

### Global flags

```
-h, --help       Show help
-v, --version    Show version
--json           Output as JSON (available on all commands)
--completion     Generate shell completion (bash, zsh, fish)
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
  "apiToken": "...",
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
  "defaultTeamKey": "ENG",
  "outputFormat": "json"
}
```

Local config overrides global config for `defaultTeamKey` and `outputFormat`.

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
