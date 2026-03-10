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

## License

MIT
