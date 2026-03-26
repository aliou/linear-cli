# linear-cli

## 0.5.0

### Minor Changes

- 8dcf9e6: Remove OAuth authentication support and legacy auth parsing.

  The CLI now accepts API keys only. Authentication resolves from `LINEAR_API_TOKEN` or `workspaces.<name>.apiToken`.

  Top-level legacy auth fields and OAuth fields in config are now ignored and never written back.

### Patch Changes

- b4dc162: Add config setters with optional local scope.

  - Add `linear config workspace <name>` and `linear config team <key>` for global defaults
  - Add `--local` to those config setters to write project-local config values
  - Add `--local` to `linear auth use <name>` to set local workspace directly
  - Remove unreleased `linear config local ...` command group in favor of unified `--local` UX
  - Document the new commands in README

- b16190f: Improve agent ergonomics for destructive commands and help output.

  - Add `--dry-run` preview mode for destructive operations (`comment delete`, `document delete`, `issue close`, `label delete`, `milestone delete`)
  - Add `--yes` to skip interactive confirmations in non-interactive flows
  - Add automatic command examples to leaf subcommand `--help` output
  - Improve `auth login` missing-token errors with actionable hints

## 0.4.0

### Minor Changes

- bb09508: Add multi-workspace auth profiles with `--workspace`, `auth list`, and `auth use`; add startup config migration with automatic backup to `config.<previous-version>.json`; and make auth/config resolution workspace-aware across login, status, logout, and OAuth refresh.
- b7db802: Migrate CLI parsing to Commander with strict validation, typed command handlers, Clack prompts for auth input, Ora spinner feedback, and cli-table3 table rendering.

  This removes legacy internal arg parsing (`src/args.ts`) and centralizes validation at the command definition level.

## 0.3.0

### Minor Changes

- 392cd95: Add a top-level `graphql` command to run arbitrary Linear GraphQL queries and mutations from a positional argument or stdin.
- 7ce12da: Add refreshable OAuth config support, write a versioned `$schema` entry to config.json, and document the nested OAuth config format.

### Patch Changes

- 1783870: Inject the CLI version at build time so release artifacts use the package.json version without rewriting source files during runtime.
- 9d8c9b2: Improve CLI error output for failed API requests.

## 0.2.2

### Patch Changes

- 1fa7e49: Add OAuth token support to auth login and require explicit token type for non-interactive login via `--token` or stdin.

## 0.2.1

### Patch Changes

- df88aa0: Add `@aliou/biome-plugins` and fix all inline import violations. Converts dynamic `await import()` calls inside functions to static imports and removes `.js` extensions from import paths.

## 0.2.0

### Minor Changes

- dba18c5: Add first-class support for Linear issue delegates so the CLI can display and assign agents separately from human assignees.
