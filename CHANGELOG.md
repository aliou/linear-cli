# linear-cli

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
