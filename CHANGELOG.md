# linear-cli

## 0.2.2

### Patch Changes

- 1fa7e49: Add OAuth token support to auth login and require explicit token type for non-interactive login via `--token` or stdin.

## 0.2.1

### Patch Changes

- df88aa0: Add `@aliou/biome-plugins` and fix all inline import violations. Converts dynamic `await import()` calls inside functions to static imports and removes `.js` extensions from import paths.

## 0.2.0

### Minor Changes

- dba18c5: Add first-class support for Linear issue delegates so the CLI can display and assign agents separately from human assignees.
