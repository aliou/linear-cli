---
"linear-cli": patch
---

Add config setters with optional local scope.

- Add `linear config workspace <name>` and `linear config team <key>` for global defaults
- Add `--local` to those config setters to write project-local config values
- Add `--local` to `linear auth use <name>` to set local workspace directly
- Remove unreleased `linear config local ...` command group in favor of unified `--local` UX
- Document the new commands in README
