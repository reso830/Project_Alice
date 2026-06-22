# Data Model: Portable Distribution Package

**Feature**: 040-portable-distribution-package | **Date**: 2026-06-22

> **No application data-model change.** This feature adds **no** tables, columns, or migrations and changes **no** validation. The constitution's required application fields (company name, job title, status, `last_status_update`, responsibilities) and the entire existing SQLite schema (`server/db.js` `initSchema()`) are untouched. The "data model" here is the **packaging/runtime structure**: the on-disk layout, the launch-settings file, the version marker, and the release artifact.

---

## 1. Package layout (on disk, after extraction)

```
alice/
├── Start-Alice.cmd          # root launcher (single double-click)
├── VERSION                  # installed-version marker (e.g. "1.9.0")
├── app/                     # REPLACEABLE program files
│   ├── server/              #   Express app + portable bootstrap
│   ├── src/                 #   runtime-imported frontend/shared modules
│   ├── shared/              #   shared modules (if present)
│   ├── dist/                #   built Vite frontend (served statically)
│   ├── node_modules/        #   prod deps incl. ABI-matched better-sqlite3
│   └── package.json
├── runtime/                 # REPLACEABLE bundled Node
│   └── node.exe (+ required runtime files)
├── data/                    # PRESERVED user state — SQLite DB
│   └── alice.db             #   created on first run
├── config/                  # PRESERVED user state — launch settings
│   └── settings.json
└── logs/                    # PRESERVED diagnostics
    └── alice.log            #   startup/runtime log
```

**Separation contract** (foundation for 041): `app/` + `runtime/` are **replaceable**; `data/` + `config/` + `logs/` are **preserved**. A future update may swap the former without touching the latter.

---

## 2. Launch settings — `config/settings.json`

Optional, user-editable, non-secret. Read by the portable bootstrap at startup. **Never** contains the AI key.

| Field | Type | Default | Meaning |
|---|---|---|---|
| `port` | integer | `3001` | Preferred local port. Pinning it keeps the `127.0.0.1:<port>` origin (and thus the `localStorage` AI key/prefs) stable across launches. |
| `openBrowser` | boolean | `true` | Whether the launcher auto-opens the default browser after start. |

**Parsing rules**:
- Missing file → use all defaults.
- Malformed JSON or an out-of-range/`non-integer` `port` → fall back to default `port` (3001), log a warning, do not crash.
- Unknown fields → ignored.

A `config/settings.default.json` template ships in source control; the build copies it to `config/settings.json` in the package.

---

## 3. Version marker — `VERSION`

- Plain text, single line, the `package.json` `version` at build time (e.g. `1.9.0`).
- Written at the package root and also available via the bundled `app/package.json`.
- Purpose: a stable, documented location for a future updater (041) to read the installed version. Not consumed by the running app's behavior in 040.

---

## 4. Release artifact

| Artifact | Name pattern | Notes |
|---|---|---|
| Portable ZIP | `alice-v<version>-win-x64.zip` | Extracts to `alice/`. Excludes `.env`, Supabase creds, AI keys, dev-only files. |
| Checksum | `alice-v<version>-win-x64.zip.sha256` | SHA-256 of the ZIP; integrity validation prerequisite for 041. |

Both are attached to the corresponding GitHub Release by the CI workflow.

---

## 5. Runtime environment (set by the launcher, not persisted as data)

These are process env vars the bootstrap sets before importing config/db — not files, listed here for completeness of the runtime "shape":

| Env var | Value (portable) | Source |
|---|---|---|
| `APP_RUNTIME` | `local` | bootstrap (forces local SQLite path) |
| `ALICE_DB_PATH` | `<package>/data/alice.db` | bootstrap (overrides `server/db.js` default) |
| `PORT` | resolved port (config or auto-selected) | bootstrap |

No Supabase env vars are set (portable is local-only); `serveStatic`/host binding are passed in-process to `createApp`/`listen`, not via env.

---

## 6. Browser-local state (unchanged, noted for completeness)

Not part of the package; lives in the browser for the `127.0.0.1:<port>` origin via the existing `src/data/aiSettings.js`:
`alice.ai.openrouterKey`, `alice.ai.enabled`, `alice.ai.model`, `alice.ai.features`. The server never reads or stores these. Port stability (§2 `port`) keeps them across launches.
