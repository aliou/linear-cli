# linear-cli

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
