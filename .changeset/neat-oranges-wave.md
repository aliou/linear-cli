---
"linear-cli": minor
---

Migrate CLI parsing to Commander with strict validation, typed command handlers, Clack prompts for auth input, Ora spinner feedback, and cli-table3 table rendering.

This removes legacy internal arg parsing (`src/args.ts`) and centralizes validation at the command definition level.