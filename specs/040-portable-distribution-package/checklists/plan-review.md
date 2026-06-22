# Plan-Review Checklist: Portable Distribution Package

**Feature**: 040-portable-distribution-package | **Date**: 2026-06-22
**Purpose**: Pre-implementation gate. Verify the **plan and design** before any code is written. Items are checkable against the spec/plan/artifacts only — not post-implementation outcomes.

---

## Scope alignment

- [ ] Every spec user story (US1–US8) maps to a plan phase or affected-area change.
- [ ] Every functional requirement (FR-001…FR-032) is addressed by the plan or explicitly deferred to 041 with rationale.
- [ ] Plan Non-goals match spec Non-goals (no self-update, no installer, no single EXE, no macOS/Linux, no LAN, no desktop fork).
- [ ] AI is described as **client-side localStorage BYOK** everywhere (no server-side key file or proxy anywhere in plan/contracts/data-model).

## Architecture soundness

- [ ] Static serving is **gated** (`serveStatic` off by default); hosted (Vercel) and local dev (Vite) paths are provably unaffected.
- [ ] `/api/*` cannot be shadowed by `express.static` or the SPA fallback (ordering specified).
- [ ] Portable orchestration lives in a **separate entry** (`server/portable.js`); the existing `server/index.js` dev/hosted boot (incl. `assertHostedSchema` + lazy Supabase import) is untouched.
- [ ] Server binds to **`127.0.0.1`** only; no path binds to all interfaces.
- [ ] Port auto-select increments on `EADDRINUSE`, stays localhost-bound, and the browser opens to the **actual** port.
- [ ] Browser-open / console-lifecycle coupling is confined to the portable entry (not `createApp`, not hosted).

## Data-model & persistence

- [ ] No DB schema, column, or migration change; `initSchema()` runs unchanged.
- [ ] `data/` (SQLite) and `config/` are separated from `app/`/`runtime/` (041 foundation).
- [ ] `config/settings.json` parsing handles missing/malformed/out-of-range safely (defaults, no crash).
- [ ] AI key is never written to disk or to `config/`.
- [ ] **Dual runtimes addressed**: local (SQLite, exercised) and hosted (Supabase, untouched) both covered; demo noted as local-path, unaffected.

## Contract correctness

- [ ] Launcher→server runtime contract sets `APP_RUNTIME=local`, `ALICE_DB_PATH`, host, and port before config/db import.
- [ ] Release-artifact contract specifies ZIP name, `.sha256`, `VERSION` marker, reproducibility, and tag/dispatch-only publication.
- [ ] Startup-error contract covers missing files, unlaunchable runtime, and busy port — all non-silent.

## Test strategy

- [ ] Unit tests planned for: SPA-fallback routing + serving-off safety, port auto-select, `config/settings.json` parsing.
- [ ] Build verified via quickstart dry run (layout, ZIP, checksum, no secrets, DB open).
- [ ] Browser Smoke Test (final phase) walks each US Independent Test against the **built package** on a clean Windows path with no global Node.
- [ ] Plan does not rely on a non-existent `npm run format` (project has `lint` + `test:run` only).

## Constitution compliance

- [ ] Required fields (company, job title, status, `last_status_update`, responsibilities) unaffected — no data/validation change.
- [ ] Centralized/reusable validation untouched (no new validation path).
- [ ] **No new runtime or build dependency** introduced (zip via `Compress-Archive`; download/checksum via Node built-ins). Any future dep is called out as separate/justified.
- [ ] Local-first/privacy preserved or strengthened (localhost-only; no analytics; no key on disk).
- [ ] Mandatory final phases present and ordered: **Release Prep** (version bump, CHANGELOG, README, `docs/deployment.md`, `docs/REPO_MAP.md`, `package-lock.json` version, `docs/feature_roadmap.md`) **then** Browser Smoke Test.

## Risks acknowledged

- [ ] `better-sqlite3` ABI match strategy is defined (pin Node, match prebuilt/rebuild, DB smoke).
- [ ] Port-drift vs. `localStorage` documented with mitigation (stable/pinned port).
- [ ] SmartScreen/mark-of-the-web one-time prompt documented as expected.
