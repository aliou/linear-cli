---
name: developing-linear-cli
description: "Develops and maintains the linear-cli project. Use when adding commands, fixing bugs, or modifying the CLI codebase."
---

# Developing linear-cli

A CLI for Linear built with Bun + TypeScript, using raw GraphQL queries against `https://api.linear.app/graphql`.

## Running

```sh
bun run src/index.ts <command> <subcommand> [flags]
bun run typecheck    # type checking
bun run lint         # lint (biome)
bun run format       # auto-fix formatting
bun run test         # tests
bun run build        # compile binaries for all platforms
```

## Architecture

- `src/index.ts` - Entry point. Routes commands to handler functions. Uses `.js` import extensions.
- `src/cli.ts` - Top-level arg parsing, help text, shell completions (bash/zsh/fish).
- `src/api.ts` - `graphql()` function for raw GraphQL queries against Linear API.
- `src/args.ts` - Shared `parseArgs()` helper wrapping `node:util` parseArgs. Provides `wantsHelp()`, `getString()`, `getNumber()`, `getBoolean()`, `getPositional()`.
- `src/config.ts` - Config loading/saving. Global config at `~/.config/linear-cli/config.json`, local config via `.agents/linear.json`, `.linear.json`, or `.linear/config.json`. `loadMergedConfig()` merges local overrides into global. `getApiToken()` checks env var `LINEAR_API_TOKEN` first, then config file.
- `src/auth.ts` - Auth functions: `login()`, `logout()`, `getAuthStatus()`, `readTokenFromStdin()`, `promptForToken()`.
- `src/constants.ts` - `APP_NAME`, `VERSION`, `LINEAR_API_URL`, `CONFIG_FILE`.
- `src/commands/` - One file per command resource. Each exports named handler functions.
- `src/commands/shared.ts` - Shared helpers: `requireToken()`, `useJson()`, `pad()`, `formatDate()`, `truncate()`, `printTable()`.

## Adding a New Command

1. Create `src/commands/<resource>.ts`.
2. Define options object, import helpers from `../args.ts` and shared helpers from `./shared.ts`.
3. Export named async functions (`listX`, `getX`, `createX`, etc.) that take `args: string[]`.
4. Each function should: parse args, check `wantsHelp()`, call `requireToken()`, build GraphQL query, call `graphql()`, format output with `printTable()` or `--json`.
5. Add handler function in `src/index.ts` with dynamic import using `.js` extension.
6. Add to the switch statement in `main()`.
7. Update `printHelp()` in `src/cli.ts`.
8. Update shell completions in `src/cli.ts` (bash, zsh, fish).

## Conventions

- Command files use `.ts` import extensions internally. `src/index.ts` uses `.js` extensions for dynamic imports.
- All commands support `--help` and `--json` flags.
- Default output is table format using `printTable()` from `src/commands/shared.ts`.
- Auth token resolution: CLI flags > `LINEAR_API_TOKEN` env var > config file.
- Config resolution: CLI flags > local config > global config.
- Use `graphql()` from `src/api.ts` for all API calls. Inline the GraphQL query strings.
- Use `parseArgs()` from `src/args.ts` for argument parsing with named option definitions.
- Error messages go to `console.error`, exit with `process.exit(1)`.
- Biome for linting/formatting, tsc for type checking. Run both before committing.
- Commit messages follow Conventional Commits.

## Testing

- Two Linear teams exist: `TMP` (for mutations/testing) and `GEN` (read-only, has issues/states/labels/projects).
- Use team `TMP` for any mutating operations during testing.
- API token is already configured. Do NOT read config files or attempt to view the token.

## Release Process

- Uses changesets for versioning: `bunx changeset` to create a changeset.
- `bun run version` runs changeset version, builds binaries, computes nix hashes, updates `flake.nix` and `src/constants.ts`.
- CI runs lint + typecheck on PRs. Version workflow creates release PRs and GitHub releases with binaries.
- Build targets: `bun-darwin-arm64`, `bun-linux-arm64`, `bun-linux-x64`.

## Key Files

When modifying commands, these files often need updates together:
- `src/commands/<resource>.ts` - Command implementation
- `src/index.ts` - Command routing
- `src/cli.ts` - Help text and shell completions
