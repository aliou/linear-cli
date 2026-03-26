---
name: developing-linear-cli
description: "Develop and maintain the linear-cli codebase (commands, config/auth behavior, docs, tests, release metadata)."
---

# Developing linear-cli

`linear-cli` is a Bun + TypeScript CLI for Linear using raw GraphQL calls to `https://api.linear.app/graphql`.

## Run and validate

```sh
bun run src/index.ts <command> <subcommand> [flags]
bun run lint
bun run typecheck
bun run test
bun run build
```

Always run lint + typecheck + test before committing.

## Current architecture

- `src/index.ts` - CLI entrypoint (`run()` + top-level error handling)
- `src/cli/app.ts` - Commander program setup, global flags/options, help wiring
- `src/cli/registry.ts` - Registers all command groups
- `src/cli/commands/**` - CLI command definitions and option parsing
- `src/commands/**` - Command business logic and GraphQL operations
- `src/commands/shared.ts` - Shared command helpers (`requireToken`, output helpers, workspace context)
- `src/config.ts` - Global/local config loading, validation, merge precedence, auth resolution
- `src/auth.ts` - Login/logout/status token flows
- `src/api.ts` - GraphQL transport/error handling
- `schemas/config.schema.json` - Config schema used in persisted config

## Config model

Global config path:
- `~/.config/linear-cli/config.json`

Local config discovery (walk up from cwd):
- `.agents/linear.json`
- `.linear.json`
- `.linear/config.json`

Workspace/profile + local resolution is implemented in `src/config.ts` (`loadMergedConfig`, `resolveAuth`, workspace resolution helpers).

## Command conventions

- Use Commander command modules under `src/cli/commands/<resource>/...`
- Keep API/query logic in `src/commands/<resource>.ts`
- Most read commands support `--json`; default output is table
- Use `CliError` for actionable user errors
- Use `strict(...)` helper for command definition consistency

## Defaults and scope behavior

Global setters:
- `linear config workspace <name>`
- `linear config team <key>`

Local setters:
- same commands with `--local`
- `linear auth use <name> --local` sets project-local workspace

## Release + versioning

- Use Changesets for release notes/version bumps
- Add a changeset for user-visible changes
- Keep `README.md` and CLI help text aligned with behavior

## Maintenance checklist for command changes

1. Update command registration if adding/removing command files
2. Update README command examples/documentation
3. Add or update tests when behavior changes
4. Run `bun run lint && bun run typecheck && bun run test`
5. Add a changeset for user-visible changes
