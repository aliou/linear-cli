---
"linear-cli": patch
---

Improve agent ergonomics for destructive commands and help output.

- Add `--dry-run` preview mode for destructive operations (`comment delete`, `document delete`, `issue close`, `label delete`, `milestone delete`)
- Add `--yes` to skip interactive confirmations in non-interactive flows
- Add automatic command examples to leaf subcommand `--help` output
- Improve `auth login` missing-token errors with actionable hints
