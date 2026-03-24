---
"linear-cli": minor
---

Add multi-workspace auth profiles with `--workspace`, `auth list`, and `auth use`; add startup config migration with automatic backup to `config.<previous-version>.json`; and make auth/config resolution workspace-aware across login, status, logout, and OAuth refresh.