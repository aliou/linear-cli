---
"linear-cli": minor
---

Remove OAuth authentication support and legacy auth parsing.

The CLI now accepts API keys only. Authentication resolves from `LINEAR_API_TOKEN` or `workspaces.<name>.apiToken`.

Top-level legacy auth fields and OAuth fields in config are now ignored and never written back.
