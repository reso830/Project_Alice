# Changelog

All notable changes to this project will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.10.4] — 2026-07-01

Update-mode picker fix — the Profile › Settings › Updates mode picker now
changes behavior and no longer offers an option the 041 spec forbids. Portable
Windows self-update only; no behavior change to hosted or demo modes. (#85)

### Changed

- **"Notify only" is now functional** — selecting it shows only the Profile nav
  badge when an update is available and suppresses the passive update-available
  toast. "Ask before installing" (the default) still surfaces the toast with the
  Install prompt. Active states triggered by an explicit install from the Profile
  page (downloading, verifying, ready-to-restart, failed) continue to surface in
  either mode. (#85)
- **Mode changes take effect immediately** — saving a new update mode dispatches
  an `alice-update-settings-changed` event that the update toast honors live, so
  switching to "Notify only" hides an already-visible toast without a reload.
  (#85)

### Removed

- **"Install automatically" update mode** — the option is removed from the picker
  and rejected by settings validation; fully automatic/consent-free updates are
  an explicit Non-Goal of feature 041. An existing `updateMode: "auto"` in
  `config/settings.json` normalizes to the default "Ask before installing" on
  read, so no user action is required. (#85)

### Tests

- Added coverage that "Notify only" keeps the toast hidden on an available
  update while "Ask before installing" renders it, that the settings-changed
  event flips a visible toast, and that `updateMode: "auto"` is rejected on write
  and normalized to "ask" on read. (#85)

## [1.10.3] — 2026-07-01

Local SQLite migration/backup hardening — closes a data-safety gap in the 041
boot-time restore guard surfaced by the post-release audit. Local runtime only;
no behavior change to hosted or demo modes. (#90)

### Fixed

- **Restore guard now covers the full schema boot, not just ledger migrations**
  — the backup/restore wrapper brackets the additive `ensureColumn` ALTERs and
  the one-time compatibility backfill as well, so a failure in any schema step
  restores `data/alice.db` from the pre-migration backup instead of leaving a
  half-migrated file. Rollback is terminal: no further DB access occurs after a
  restore. (#90)
- **Backup is taken only when schema work is pending** — the per-boot
  `alice.db` → `.migration-backup` copy is skipped when there are no unapplied
  migrations and no missing columns, removing wasted I/O on an already-current
  database while keeping the guard in force whenever a migration or ALTER
  actually runs. (#90)
- **Migration-ledger schema doc aligned** — the 041 spec now matches the shipped
  `schema_migrations` primary-key column (`id`), retiring the spec-drift finding
  without a risky primary-key rename on existing local databases. (#90)

### Tests

- Extended the migration suite with failure-injection coverage that asserts
  `alice.db` is restored byte-for-byte when an additive step throws, plus
  no-op-boot coverage asserting no backup is created when the schema is current.
  (#90)

## [1.10.2] — 2026-06-30

Portable launcher and single-instance hardening — correctness and resilience
fixes for the 041 boot/swap path surfaced by the post-release audit. No behavior
change to hosted or demo modes. (#88)

### Fixed

- **Single-instance lock is now atomic** — launch acquires the per-install lock
  with an exclusive-create (`O_EXCL`) write before starting the server, so two
  launches racing on the same `data/alice.db` can no longer both pass the check
  and start two servers. A genuinely stale lock (dead PID / failed health probe)
  is still taken over by a fresh launch. (#88)
- **Lock cleanup is owner-safe** — shutdown removes the lockfile only when the
  current process owns it (PID guard), and a failed boot closes the half-open
  server and releases its own lock instead of stranding it. (#88)
- **Launcher cleans up the staged next-launcher** — after an update finalizes,
  `data/Start-Alice.next.cmd` is deleted instead of lingering in user state
  until the next update overwrites it. (#88)

### Tests

- Added concurrent-acquisition coverage for the lock manager and extended the
  launcher and bootstrap suites for the finalize-cleanup and atomic-lock paths.
  (#88)

## [1.10.1] — 2026-06-30

Portable self-update hardening — correctness and resilience fixes for the 041
updater surfaced by a post-release audit. No behavior change to hosted or demo
modes. (#91)

### Fixed

- **Staged updates require an explicit install request** — the launcher applies
  a staged update only when `data/update-pending.json` is present; a partial or
  abandoned extraction is now cleared instead of being mirrored onto a working
  install on the next launch. (#87)
- **Download is cancellable from the toast** — the update toast's "Cancel"
  button calls `POST /api/update/cancel` instead of only hiding itself, so an
  in-flight download is actually aborted and its staging cleared. (#87)
- **Update check and download time out** — the GitHub check (~1.5s) and the
  release download (idle timeout) abort on a stalled connection instead of
  leaving the UI stuck in a `checking`/`downloading` state. (#87)
- **Background checks no longer clobber a staged update** — the periodic check
  preserves an in-progress or `ready-to-restart` state rather than resetting it,
  so a pending restart is not lost. (#87)
- **Launcher preserves the application exit code** — a non-zero Node exit is no
  longer masked while clearing an abandoned stage, restoring the visible
  error/pause path on a crash. (#87)

## [1.10.0] — 2026-06-28

Self-Update Support — a portable Windows install can now keep itself current
without manual file replacement. Alice checks GitHub Releases for a newer
version, announces it through an update toast and a Profile nav badge, and on
confirmation downloads the release ZIP to a staging folder, verifies its SHA256,
and applies it on the next restart via the launcher — swapping the program files
while preserving `data/alice.db` and `config/`. A per-install lockfile guarantees
exactly one instance across the stop → swap → restart sequence, and pending
SQLite schema migrations run automatically behind a pre-migration backup that
restores on failure. The whole in-app updater is gated to local Windows installs
(`updateSupported`); hosted (Vercel) continues to update through normal deploys.
(041-self-update-support)

### Added

- **Release detection** — a new `GET /api/update/check` endpoint proxies the
  GitHub Releases API (avoiding the unauthenticated IP rate limit), compares the
  running version against the latest tag with `v`-prefix-tolerant SemVer
  comparison, and caches the result in memory for one hour. An
  `ALICE_UPDATE_SOURCE_OVERRIDE` env var points the check at a local fixture for
  testing. (041-self-update-support)
- **Update notifications** — a single `UpdateToast` component renders the
  available / downloading / installing / error states (bottom-right on
  desktop/tablet, full-width above the tab bar on mobile, with `aria-live` and a
  `role="progressbar"` meter), plus a persistent update badge on the Profile
  nav button (`Navbar` + `BottomTabBar`) that survives toast dismissal.
  (041-self-update-support)
- **Download, staging & integrity** — `POST /api/update/download` streams the
  release ZIP and its `.sha256` to `data/update-staging/`, verifies the checksum,
  and extracts into `data/update-staging/alice/`; a failed download or checksum
  clears staging and reports a failure status. `GET /api/update/status` exposes
  the live download/staging state. (041-self-update-support)
- **Robust single-instance lockfile** — `server/portable/lock.js` records the
  live PID + bound port + app version in `data/alice.lock`, with stale-lock
  liveness handling, replacing 040's port-only health probe so the same install
  is detected regardless of port fallback and across the update window.
  (041-self-update-support)
- **Swap-on-restart launcher** — `POST /api/update/restart` writes
  `data/update-pending.json` and triggers a clean shutdown via an `onShutdown`
  callback; `Start-Alice.cmd` detects staged files on the next loop, mirrors
  `app/` and `runtime/` (the bundled Node + native SQLite binaries are unlocked
  because the old process has exited), swaps itself last, and reboots the new
  version. (041-self-update-support)
- **Greenfield SQLite migration subsystem** — `server/db/migration.js` adds a
  `schema_migrations` ledger with run-once sequential migrations, a downgrade
  gate, and legacy baselining for pre-041 databases; `server/db.js` wraps it in a
  pre-migration backup that restores `data/alice.db` and halts startup on
  failure. The base schema moves into `server/db/migrations/001-init.js`.
  (041-self-update-support)
- **Capability-aware health** — `GET /api/health` now returns `version` and an
  `updateSupported` flag (true only for local Windows), which the frontend uses
  to gate the toast, badge, and Updates settings sub-group. (041-self-update-support)
- **Updates settings sub-group** — Profile › Settings gains an **Updates**
  sub-group (middle group) with the current version, a manual **Check now**,
  status/error states (Connection Error / Update Failed + Retry), an auto-check
  toggle, and a collapsible update-mode picker (Notify only / Ask before
  installing / Install automatically), persisted to `config/settings.json` via
  `GET`/`POST /api/update/settings`. (041-self-update-support)
- **Mode-aware footer control** — the footer brand row shows a **Download**
  button (latest GitHub release) in hosted/demo and an **Open hosted version ↗**
  link in local mode. (041-self-update-support)

## [1.9.0] — 2026-06-22

Portable Distribution Package — Alice can now be distributed and run as a
self-contained portable Windows package: download a release ZIP, extract it
anywhere, and double-click a launcher. No Node.js install, no repository clone,
no installer, and no terminal. A bundled Node runtime serves the app on
localhost only, opens the browser automatically, and persists data locally
across launches. The same single codebase still deploys to hosted (Vercel)
unchanged — all portable behavior is gated to local mode. This also lays the
foundation (standardized layout, version marker, release checksum) for the
upcoming self-update feature (041), but ships no update logic.
(040-portable-distribution-package)

### Added

- **Single-action portable launcher** — a `Start-Alice.cmd` that runs the
  bundled `runtime\node.exe`, starts the server, opens the default browser, and
  surfaces a clear error (with a missing-runtime check and `errorlevel`
  handling) instead of failing silently. Closing the console window or pressing
  Ctrl+C stops Alice cleanly. (040-portable-distribution-package)
- **Single-origin static serving (local only)** — `createApp` gains an opt-in
  `serveStatic` branch that serves the built `dist/` with an SPA fallback
  alongside `/api`, so one origin serves UI + API in the portable runtime. Gated
  off by default; hosted (Vercel) and local dev (Vite) are byte-for-byte
  unchanged. (040-portable-distribution-package)
- **Portable bootstrap** — `server/portable.js` wires `APP_RUNTIME=local` and
  `ALICE_DB_PATH` to the package's `data/`, reads `config/settings.json`
  (`port`, `openBrowser`), binds to `127.0.0.1` only, and auto-selects the next
  free local port when the default is busy with a non-Alice process.
  (040-portable-distribution-package)
- **Single instance** — launching the package while Alice is already running
  detects the running instance via a `/api/health` probe on the configured port
  and re-opens the browser to it instead of starting a second server (avoiding a
  duplicate window, a separate `localStorage` origin, and a second SQLite
  connection). (040-portable-distribution-package)
- **Repeatable build + release** — `npm run build:portable` builds the frontend,
  bundles a pinned official Node runtime (with an ABI-matched `better-sqlite3`
  and a DB-open smoke check), assembles the standardized
  `alice/{app,runtime,data,config,logs}` layout with a `VERSION` marker, and
  emits `alice-v<version>-win-x64.zip` plus a SHA-256 checksum. A
  tag/dispatch-only GitHub Actions workflow (`release-portable.yml`) publishes
  them to the matching GitHub Release. (040-portable-distribution-package)

### Notes

- **AI is unchanged** — the OpenRouter key remains a client-side, browser-local
  BYOK (the server is never in the AI request path); the portable package ships
  no key and no AI configuration. (040-portable-distribution-package)
- **No application data changes** — no data model, schema, migration, or
  `/api` route behavior changed; the only server change is the gated static
  serving. (040-portable-distribution-package)

## [1.8.0] — 2026-06-21

Desktop Workspace Refresh — on wide desktops (≥ 1100px) the Tracker becomes a
master-detail workspace: the application list sits beside a docked detail pane,
and clicking a card selects it and loads its details inline instead of opening a
centered modal. The Application Details overlay body is restructured into five
collapsible panels shared across every surface. Tablet (640–1099px) and mobile
(< 640px) keep their existing centered-modal and bottom-sheet workflows.
UI-only — no data model, schema, or backend changes. (039-desktop-workspace-refresh)

### Added

- **Desktop master-detail workspace** (≥ 1100px) — the Tracker splits into a
  list column (~60%) and a sticky docked detail pane (~40%) with full-width
  pagination below both. Clicking a card selects it (indigo glow +
  `aria-selected`) and renders its details in the pane — no backdrop, no
  page-scroll lock. An empty "Nothing open yet" pane shows when nothing is
  selected (including on load). (039-desktop-workspace-refresh)
- **Pane render variant of the Application Details overlay** — the existing
  overlay now renders either as the centered `modal` (tablet/mobile) or a
  borderless `pane` (desktop), sharing all editing logic. The pane is
  non-modal: no focus trap, no document-level Esc capture. (039-desktop-workspace-refresh)
- **Panelized overlay body** — the flat field grid is replaced by five
  collapsible panels in fixed order: Overview → Skills → Compatibility →
  Timeline → Notes & Links. Only Overview is expanded by default; the rest show
  one-line previews. Long Responsibilities / General Notes clamp with a
  Show more / Show less toggle. New `OPanel` shell and `ClampText` primitive.
  (039-desktop-workspace-refresh)
- **Selection guards** — switching to another application with unsaved edits
  reuses the existing discard confirmation; the open application persists in the
  pane across filter, sort, pagination, and Active/Archived changes until another
  card is clicked. Resizing across 1100px hands off cleanly between the modal and
  the pane. (039-desktop-workspace-refresh)

### Changed

- The Application Details body is now a panel stack in **all** render variants
  (desktop pane, tablet modal, mobile sheet); archived applications render the
  same five panels read-only with no footer. No editing behavior or validation
  changed. (039-desktop-workspace-refresh)

## [1.7.1] — 2026-06-19

### Changed
- Added the internal AI Provider Abstraction Layer: AI features now route through `aiService.js`, OpenRouter transport is isolated behind a provider contract, and future providers can be registered without changing migrated feature code.
- Removed the legacy `llmClient.js` transport module after migrating Resume Import, Job Description Parser, Compatibility Notes, and key validation to the AI service facade.

## [1.7.0] — 2026-06-18

Compatibility Insights Panel — the Application Edit Modal's compatibility
section is replaced with a collapsible **Compatibility Insights Panel**.
The score is always live (deterministic, from 036) and presented as a ring
visualization with a tier-coloured verdict pill. Required and Preferred
Skill chips in modal row 6 are upgraded to **proficiency-coded chips**
(`✓ Proficient` / `● Learning` / `✕ Missing`) mapped against the user's
profile with a legend. An optional **AI-generated analysis** explains the
score in prose — citing tier, skill gaps, and alignment observations — and
carries a freshness lifecycle: `none`, `generating`, `fresh`, `stale`,
`error`. Staleness is signalled by a new `compat_scored_at` timestamp
stamped on every score recompute; notes go stale when a compat-relevant
application field or the profile changes after `notes.generatedAt`.
Non-compat edits (URL, General Notes, recruiter) do not trigger staleness.
Generation is always user-initiated (never automatic); AI failure never
blocks the score or modal. Requires an OpenRouter key in Settings.
A shared `llmClient.js` is extracted from `llmParser.js` for reuse.
(037-compatibility-insights-panel)

### Added

- **Compatibility Insights Panel** — collapsible full-width module (modal
  row 7) replacing the old `CompatBar` + `compatNotes` textarea in the
  Application Edit Modal. Presents a score ring (SVG donut), tier-coloured
  verdict pill (Low / Medium / High / Great), and an expand/collapse
  toggle. (037-compatibility-insights-panel)
- **Proficiency-coded skill chips** — Required Skills and Preferred Skills
  chip editors in modal row 6 now resolve each skill against the user's
  profile: `✓ Proficient` (rating ≥ 3), `● Learning` (rating < 3),
  `✕ Missing` (not on profile). A colour-and-glyph legend sits below both
  columns. (037-compatibility-insights-panel)
- **AI-generated compatibility notes** — `compatNotesService.generateNotes`
  calls OpenRouter client-side with score, tier, resolved skill matches,
  JD fields, and profile fields; the model explains the deterministic score
  rather than re-assessing fit. Notes carry `none` / `generating` / `fresh`
  / `stale` / `error` freshness states with dedicated UI for each.
  (037-compatibility-insights-panel)
- **`compat_scored_at` staleness signal** — new `TEXT` column on
  `applications`; stamped by `recomputeActive` on every score-computation
  attempt (not only on value change) and by the application create/update
  route when compat-relevant fields are present; notes go stale when
  `notes.generatedAt < compat_scored_at`. (037-compatibility-insights-panel)
- **`compat_analysis TEXT` column** — JSON-encoded `CompatNotes` or `null`;
  written only by the new `POST /api/applications/:id/compat-notes` route,
  never via standard PATCH. (037-compatibility-insights-panel)
- **`POST /api/applications/:id/compat-notes`** — thin persistence route;
  receives client-generated `{ summary, body }`, validates, adds
  `generatedAt`, saves to `compat_analysis`. (037-compatibility-insights-panel)
- **`src/services/llmClient.js`** — extracted shared OpenRouter HTTP
  caller (`requestChatCompletion`, `mapErrorToReason`, `LLM_TIMEOUT_MS`)
  from `llmParser.js`. (037-compatibility-insights-panel)
- **`src/services/compatNotesService.js`** — notes generation: prompt
  assembly + LLM call, imports from `llmClient.js`.
  (037-compatibility-insights-panel)
- **`src/components/CompatibilityModule.js`** — standalone module component
  owning all states and the generation orchestration; Modal.js only calls
  `render()`. (037-compatibility-insights-panel)
- **`src/utils/skillProficiency.js`** — pure `resolveSkillLevel(name,
  profileSkills)` and `resolveSkillMatches` utilities.
  (037-compatibility-insights-panel)
- **`no-profile` state** — when skills, experience, and summary are all
  absent, the module shows "Compatibility unavailable" with a "Complete
  profile →" action. (037-compatibility-insights-panel)

### Changed

- **`compat_notes` retired** — existing values nulled during migration;
  field removed from the writable API surface; column kept in schema
  (additive-only policy). The "Compat Notes" inline textarea is removed
  from the modal. (037-compatibility-insights-panel)
- **`src/services/llmParser.js`** now imports the shared HTTP transport
  from `llmClient.js`; all existing exports (`parseWithLlm`,
  `parseJobWithLlm`, `validateKey`, `REASON_CODES`) are unchanged.
  (037-compatibility-insights-panel)
- **`server/services/compatibility.js` `recomputeActive`** stamps
  `compat_scored_at` on every score-computation attempt, not only on value
  change, so notes reliably go stale after any compat-relevant data change
  regardless of whether the score numerically shifted.
  (037-compatibility-insights-panel)
- **Modal.js field order** updated to match design doc §4 (Shift / Work
  Setup before Min Years; Compatibility module at row 7).
  (037-compatibility-insights-panel)

### Deployment

- **Hosted schema migration** — adds two additive columns to
  `applications`: `compat_analysis text` (nullable) and `compat_scored_at
  text` (nullable). A `compat_scored_at` backfill sets it to `created_at`
  for existing rows (prevents false staleness on pre-037 records). Existing
  `compat_notes` values are nulled (column retained). Apply the SQL from
  [`specs/037-compatibility-insights-panel/data-model.md §1, §2`](specs/037-compatibility-insights-panel/data-model.md)
  before promoting a v1.7.0+ hosted deploy. `assertHostedSchema` probes
  both new columns and fails boot if they are missing.
  (037-compatibility-insights-panel)

## [1.6.0] — 2026-06-11

Compatibility Engine — the `compat` score shown on every application is now a
**deterministic, explainable** measure of fit between the user's profile and the
job, replacing the previous random placeholder. Scoring is pure local computation
(no LLM, no network): a shared module compares skills (weighted by 1–5
proficiency), role alignment, experience, keywords, and certifications across
configurable weighted categories, renormalizing when a category has no usable
input, and maps the 0–100 score to a Low / Medium / High / Great band. The server
is authoritative — scores are computed on application create/update and recomputed
for all active applications when the profile is saved (archived applications stay
frozen); demo mode runs the same module client-side. A new optional **Min Years
Experience** field on each application gives the experience category a comparison
target (manual entry — never parsed); the candidate's years are derived from the
profile at scoring time. (036-compatibility-engine)

### Added

- **Deterministic compatibility scoring** — `src/models/compatibility.js`:
  `computeCompatibility(profile, application, { asOf })` → `{ score, label }`,
  with `COMPAT_WEIGHTS` (skills 43 / roleAlignment 25 / experience 12 / keywords
  10 / certifications 10), pooled weighted skill coverage, `COMPAT_BANDS`, and
  `getCompatLabel()`. Same inputs always produce the same score (time enters only
  via a caller-supplied `asOf`). (036-compatibility-engine)
- **Server-authoritative scoring** — `server/services/compatibility.js` computes
  `compat` on application create/update and recomputes all **active** applications
  when the profile is saved; archived scores stay frozen. (036-compatibility-engine)
- **Min Years Experience field** — an optional `minYearsExperience` on applications
  (additive `min_years_experience` column), editable inline in the detail modal as
  a number; the experience category is graded by closeness and omitted (weights
  renormalized) when blank. (036-compatibility-engine)
- **Band label on the compatibility bar** — `CompatBar` now shows `"{score}% {label}"`
  with a four-band colour, communicating fit without relying on colour alone.
  (036-compatibility-engine)

### Changed

- **`compat` is now server-computed, not client-supplied** — removed from the
  client-writable request schema (silently ignored if sent) and from the
  job-posting parsers, which no longer assign a random score. A one-time backfill
  (local: on boot; hosted: a maintenance pass over all rows incl. archived)
  replaces legacy random values with computed scores. (036-compatibility-engine)
- **The Compatibility analysis AI toggle remains "coming soon"** — 036 scoring is
  deterministic and runs with AI off. (036-compatibility-engine)

### Deployment

- **Hosted schema migration** — adds the additive `min_years_experience integer`
  column to `applications`; `assertHostedSchema` gains a probe so an unmigrated
  deploy fails fast. After migrating, run the one-time compatibility backfill over
  all applications (including archived). See
  [`specs/036-compatibility-engine/data-model.md §1, §3`](specs/036-compatibility-engine/data-model.md)
  and [`docs/deployment.md`](docs/deployment.md). (036-compatibility-engine)

## [1.5.0] — 2026-06-08

LLM JD Parser — job-posting parsing gains an optional AI-assisted path. From the
Add-application gate's Smart entry, users paste a job posting and have it parsed
by an LLM (via OpenRouter) into a structured application draft for review before
saving. Bring-your-own-key (BYOK): the OpenRouter key is stored only in the
user's browser and the call is browser-direct, so it never reaches Alice's
server. AI is gated by the master AI toggle plus the per-feature Job-description
parsing switch in Profile → Settings; with AI off the Smart card is locked and
Manual entry is the path forward. Failures degrade gracefully — recoverable
errors offer a basic rule-based parser, an empty result ends in a clear dead-end,
and pasted text is preserved across retries. Status is never parsed (stays
Wishlisted) and no job text is persisted. Local-first is preserved: the app runs
and applications can always be created manually from a plain checkout with no
key. (035-llm-jd-parser)

### Added

- **AI job-description parsing (BYOK)** — Smart entry sends pasted job text to OpenRouter in a single browser-direct request and pre-fills the Create modal with the parsed application draft, validated through the existing application model. Gated by the master AI toggle + the Job-description parsing feature switch + a browser-local key. (035-llm-jd-parser)
- **§13 Add-application gate** — `+ New application` and the mobile FAB open a Smart vs Manual entry gate; Smart routes to a paste-only smart-input flow with a processing scrim and, on success, opens the Create modal with provenance. When AI is off the Smart card is locked with an "Enable AI in Settings →" link, and Manual entry always remains. (035-llm-jd-parser)
- **Provenance in the Create modal** — AI-filled fields carry a ✦ AI tag, basic-parser fields a neutral ⚙ Auto tag, with a dismissible fill banner, a reduced-motion-safe one-time flash, clear-on-edit, and a truncation notice when an over-length posting is trimmed. (035-llm-jd-parser)
- **Graceful failure handling** — recoverable AI errors surface reason codes with Use basic parser / Try AI again / Update key in Settings / Enter manually; an empty result ends in a `NO_TEXT` dead-end; pasted text is preserved across retries. (035-llm-jd-parser)

### Changed

- **The Job-description parsing AI feature toggle is now live** in Profile → Settings (previously "Coming soon"); compatibility analysis remains coming soon. (035-llm-jd-parser)
- **`src/services/llmParser.js` gains `parseJobWithLlm(text, key, model)`** alongside the resume `parseWithLlm`, sharing a single OpenRouter transport. (035-llm-jd-parser)

### Security

- **No new deployer surface** — feature 035 adds no environment variables, schema migrations, server-side keys, or external analytics. OpenRouter keys remain in browser `localStorage` and job text is sent only to OpenRouter from the browser, never persisted. (035-llm-jd-parser)

## [1.4.0] — 2026-06-06

Profile Page Refresh — the Profile experience now brings AI configuration,
guided setup, smart import, provenance, and account controls into one coherent
flow. Users configure BYOK OpenRouter settings from the Profile page, choose
Smart or Manual entry when starting from an empty profile, import into existing
profiles from the new Import Bar, review exactly what changed before saving,
and can undo an import before persistence. Local-first is preserved: keys stay
browser-local, AI calls remain browser-direct, and no server env vars, runtime
modes, or database schemas change. (034-profile-page-refresh)

### Added

- **Unified Settings card** — Profile now combines AI Settings and Account controls in one Settings area, with browser-local OpenRouter key storage, model selection, connection testing, master enablement, and per-feature toggles for CV, JD, and compatibility assistance. Saving a key is the consent boundary; deleting it withdraws AI access. (034-profile-page-refresh)
- **Guided Setup and Import flow** — empty profiles offer Smart entry or Manual entry; existing profiles expose an Import Bar with paste/upload smart input. Smart imports are gated by AI settings and keep manual entry available. (034-profile-page-refresh)
- **Ask-first AI-unavailable dialogs** — AI failures and unavailable states surface reason-specific choices, including Settings navigation, Retry where appropriate, and an explicit Use basic parser path instead of silently falling through. (034-profile-page-refresh)
- **Import provenance and Undo** — imported fields carry AI-filled or Auto-filled provenance until edited, freshly changed rows briefly flash with reduced-motion-safe handling, and a toast action can undo the import before the profile is saved. (034-profile-page-refresh)

### Changed

- **Resume import now uses the selected model slug** from AI Settings and treats the master AI toggle plus the CV feature toggle as the execution gate. (034-profile-page-refresh)
- **Profile documentation and release metadata now point to v1.4.0** and the Profile Page Refresh implementation package. (034-profile-page-refresh)

### Security

- **No new deployer surface** — the Profile Page Refresh adds no environment variables, schema migrations, server-side keys, or external analytics. OpenRouter keys remain in browser `localStorage` and are sent only to OpenRouter from the browser. (034-profile-page-refresh)

## [1.3.0] — 2026-06-03

LLM Resume / CV Parser — resume import gains an optional AI-assisted path. Users can paste resume text or upload a file and have it parsed by an LLM (via OpenRouter) into structured profile fields for review before saving. The feature is bring-your-own-key (BYOK): the OpenRouter key is stored only in the user's browser and the LLM call is made browser-direct, so the key never reaches Alice's server. It is opt-in (one-time consent before any external send) and degrades gracefully — with no key, declined consent, or any LLM failure/timeout it falls back to the existing rule-based parser, and resume content is never persisted. Local-first is preserved: the app runs and resume import still works from a plain checkout with no key. (033-llm-resume-cv-parser)

### Added

- **AI-assisted resume parsing (BYOK)** — paste resume text or upload a PDF/DOCX/TXT and parse it with an LLM into the full profile schema (contact fields, summary, skills, experience, education, certifications, awards, languages, links). The call goes browser-direct to OpenRouter using the user's own key; output is validated/normalised before pre-filling the Edit Profile form for manual review. Nothing is auto-saved. (033-llm-resume-cv-parser)
- **AI settings on the Profile page** — an "AI Resume Parsing" section to save/clear an OpenRouter key (stored in the browser only, with a clear "your responsibility" notice) and view/clear consent. Unavailable in demo mode. (033-llm-resume-cv-parser)
- **One-time consent gate** — before resume content is first sent to OpenRouter, an explicit notice is shown; declining keeps everything local (rule-based / manual), accepting is remembered. (033-llm-resume-cv-parser)
- **AI-generated field indicators** — fields populated by the LLM show a subtle, non-color-only "AI" badge that clears when the field is edited; rule-based imports show none. (033-llm-resume-cv-parser)
- **`POST /api/resume/extract`** — stateless, memory-only endpoint returning the raw extracted text of an uploaded resume (no key, no LLM, no persistence) so the browser can send it to OpenRouter. (033-llm-resume-cv-parser)
- **Neutral `info` toast type** — `Toast.show(msg, 'info')` renders with neutral styling, distinct from success/error. (033-llm-resume-cv-parser)

### Changed

- **Resume import now offers AI parsing with automatic rule-based fallback** — `POST /api/resume/parse` also accepts a JSON `{ text }` body (for pasted text), and the importer falls back to rule-based parsing on missing key, declined consent, or any LLM failure/timeout, with a notice when a long resume is truncated. Existing upload + merge behaviour is unchanged. (033-llm-resume-cv-parser)

### Security

- **API key and resume content never persist server-side** — the OpenRouter key lives only in the browser's `localStorage` and is sent only to OpenRouter; uploaded files pass through `/extract` for stateless, memory-only extraction; neither the key nor resume content is written to disk or database. (033-llm-resume-cv-parser)

## [1.2.0] — 2026-06-02

Profile Schema Refactor — profile skills are promoted from an array embedded in the profile JSON document to a dedicated, per-profile `profile_skill` store, in both local (SQLite) and hosted (Supabase) modes. The store is the sole source of truth for skills; reads reassemble them into the profile so the whole-profile API contract and the Profile/Profile-Edit UI are unchanged, and existing profiles migrate automatically on first read with no data loss. This readies the schema for the upcoming compatibility, ATS, and AI-parsing features. No user-visible behavior change. (032-profile-schema-refactor)

### Added

- **`profile_skill` store** — a new per-profile skill table in both backends, with `skill_name` + `proficiency` columns, a per-profile index, and a case-insensitive unique index on `(profile, skill_name)` as a no-duplicate backstop. Hosted mode adds RLS mirroring `profile` plus an atomic `save_profile_with_skills(p_data, p_skills)` RPC, and the boot-time hosted schema check now probes `profile_skill`. Hosted operators must apply the migration SQL from [`specs/032-profile-schema-refactor/data-model.md §3`](specs/032-profile-schema-refactor/data-model.md) before deploying a v1.2.0+ build. (032-profile-schema-refactor)

### Changed

- **Profile skills are now stored as first-class `profile_skill` rows** instead of inside the profile JSON document, in both persistence modes. Reads reassemble the embedded `{ name, level }` array (ordered by insertion), and saves replace a profile's skill rows transactionally — locally via a SQLite transaction, hosted via the `save_profile_with_skills` RPC. Skills are removed from the profile document; the public profile read/write contract and the UI are unchanged. (032-profile-schema-refactor)
- **Existing profiles auto-migrate on first read** — embedded skills move into the new store idempotently, reusing feature 031's normalization (legacy `string[]` → Basic, junk dropped, duplicates collapsed). Only the `skills` key is stripped from the document, so non-skill fields are preserved verbatim. No operator data step and no user action required. (032-profile-schema-refactor)

## [1.1.0] — 2026-06-01

Skill Proficiency — profile skills gain a structured 1–5 proficiency level, captured in a lightweight inline editor and shown on the Profile as graded meter rows with an in-place level reveal, a scale reference, sorting, and collapse-past-10. Existing profiles migrate automatically with no data loss. (031-skill-proficiency-system)

### Added

- **Skill proficiency levels** — each profile skill now carries a 1–5 level (1 Beginner · 2 Basic · 3 Intermediate · 4 Strong · 5 Expert). The model owns the scale and validation; segment colours live in CSS. (031-skill-proficiency-system)
- **Skills display** — the Profile Skills section renders one row per skill with a 5-segment graded meter; hovering or tapping a row cross-fades the meter to the `{level} · {Label}` word in place (no reflow, auto-reverts after a tap), a "?" opens a proficiency-scale popover, a sort control toggles Custom / By level (highest- / lowest-first), and lists over 10 collapse behind "Show all {N} skills". Rows are real buttons with `aria-label="{name}: {Label}, level {n} of 5"` — level is conveyed by text and shape, never colour alone. (031-skill-proficiency-system)
- **Inline skills editor** — the Profile editor replaces the staging overlay with inline rows (name field + tappable 1–5 level picker + remove) and an "Add skill" button; new skills start unrated. Save is gated until every named skill has a level and no name is blank or duplicate, with a footer reporting how many levels are still missing. The same "?" scale popover is available in the editor. (031-skill-proficiency-system)
- **Vercel Speed Insights** — the hosted Vercel deployment now reports anonymized Core Web Vitals (LCP, CLS, INP, etc.) to Vercel Speed Insights via `@vercel/speed-insights`, injected once on app bootstrap. The package only sends data from the production Vercel deployment; in local/dev (e.g. a GitHub checkout) it no-ops and logs to the console, so the local-first principle is preserved. It measures page-level performance only — never application data, no cookies, no PII. Explicitly enabled per the constitution's privacy clause (recorded in `constitution.md`). Requires enabling the Speed Insights tab in the Vercel dashboard to collect data.

### Changed

- **Profile `skills` are now structured `{ name, level }` objects** (previously a flat `string[]`). Legacy string skills migrate to level 2 (Basic) on load, and resume-imported skills arrive unrated — both with no data loss. The change is confined to the profile JSON blob, so no database migration is required and both local (SQLite) and hosted (Supabase) modes are unaffected at the schema level. (031-skill-proficiency-system)

## [1.0.0] — 2026-05-29

Delete Profile & User Data — completes the account lifecycle and marks the **v1.0.0** milestone (Operational Core). Users can permanently delete their hosted account (password-confirmed; the Supabase auth user is removed and the `ON DELETE CASCADE` foreign keys clear applications, profile, and the seed marker), or in local mode clear all locally stored data behind a typed-`DELETE` gate. A new **Account** section on the Profile page hosts the control (visible-but-disabled in demo). Stale sessions on other devices revalidate on their next failed request and reroute to Welcome.

### Added

- **Account section on the Profile page** — a destructive control with serious, non-alarming warning copy, rendered after the Profile section. Mode-aware: hosted → "Delete account"; local → "Clear all data"; demo → disabled with explanatory copy.
  (030-delete-profile-data)
- **Permanent hosted account deletion** — `DELETE /api/account` re-verifies the account password server-side, then uses the Supabase service-role admin client to delete the auth user; the existing `ON DELETE CASCADE` foreign keys remove all of the user's `applications`, `profile`, and `user_seed_state` rows. A confirmation modal requires re-entering the password; an incorrect password blocks deletion with an inline error and deletes nothing.
  (030-delete-profile-data)
- **Local "Clear all data"** — the same control in local mode clears all SQLite `applications` + `profile` rows in one transaction behind a typed-`DELETE` confirmation enforced at the API boundary (`{ confirm: "DELETE" }`). The app stays mounted and re-renders its empty states; no auto re-seed.
  (030-delete-profile-data)
- **Cross-device session revalidation** — `authStore.handleAuthFailure()` revalidates via `supabase.auth.getUser()` on a failed authenticated request (401/404/500); if the account no longer exists it clears the session and reroutes to Welcome. The involuntary "Your account no longer exists." message and the voluntary "Account deleted." success confirmation are staged through one one-shot notice carrier so they survive the body-clearing reroute.
  (030-delete-profile-data FR-011a / FR-013)

### Changed

- **First runtime use of `SUPABASE_SERVICE_ROLE_KEY`.** Previously required at boot but unused at runtime; account deletion is its first runtime consumer (server-only, lazy-imported on the delete path, never exposed to the browser or any response).
  (030-delete-profile-data)
- `.profile-btn--danger` now sets white text and a disabled state (it was background-only), used by the new Account control.
  (030-delete-profile-data)

## [0.15.0] — 2026-05-28

Loading & async states — standardizes the visible state of every async operation across the app. Cold loads show skeleton placeholders, list-fetch failures recover via an inline-error block with a focused Try again button, every mutation button (Save, Archive, Unarchive, Star, Status, Process, Upload) shows a busy state and guards against duplicate clicks, and the Tracker view-switcher chip carries `aria-busy` during in-flight transitions. The bare `"Loading…"` strings on Calendar / ProfileEdit / Profile applications block are gone.

### Added

- **Shared loading + async-state utilities** — `src/utils/asyncUI.js` exposes `bindBusyButton`, `bindContainerBusy`, and `renderInlineError`; `src/utils/skeletons.js` exposes five DOM-factory builders (`buildApplicationListSkeleton`, `buildProfileSkeleton`, `buildCalendarSkeleton`, `buildProfileEditSkeleton`, `buildProfileAppsSkeleton`). Every retrofit imports from these two modules — no per-component spinner or skeleton vocabulary.
  (029-loading-async-states)
- **Calendar grid + Action Panel skeletons** — replace the bare `"Loading…"` strings on cold load and on month/year refresh; the prior month stays visible during the refresh fetch.
  (029-loading-async-states)
- **ProfileEdit and Profile applications skeletons** — replace the bare `"Loading profile..."` / `"Loading applications..."` strings on cold load.
  (029-loading-async-states)
- **Inline-error recovery surface** — Tracker list fetch, Calendar cold load, Profile applications block, CreationPicker parse, and Resume Import parse failures replace the skeleton/pending UI with an `role="alert"` `aria-live="polite"` block that auto-focuses a `Try again` button. No toast for cold-load failures.
  (029-loading-async-states FR-010, FR-011)
- **Application Overlay busy states** — Save (label swap to `Saving…` + `aria-busy="true"` + disabled + peer-lockout on Discard / ★ / 🗄 / Status), Archive, Unarchive, Favorite, and Status Dropdown commit all guarantee single-request semantics on rapid clicks; the existing `_saveController.abort()` escape hatch is preserved.
  (029-loading-async-states FR-003, FR-007..FR-009)
- **Card mutation busy states** — × Archive and ↺ Unarchive surface `aria-busy="true"` + disabled during the request; duplicate clicks resolve through the same in-flight promise.
  (029-loading-async-states)
- **CreationPicker + Resume Import busy states + inline-error recovery** — Process button busy (`Processing…` label + textarea read-only via peer-lock); Resume Import upload button busy preserving the rotating processing messages; parse failures swap into a Try again surface that preserves the user's input for retry. Demo mode disables the Smart Parser card and hides the Resume Import widget so no demo-feature toast is reachable from a real user flow.
  (029-loading-async-states US-3, FR-012)
- **View-switcher chip `aria-busy`** — the Tracker `Applications ▾` / `Archived ▾` chip carries `aria-busy="true"` during an in-flight view change, and the destination list's skeleton renders in place of the source list (no stale-list / frozen-toolbar in between).
  (029-loading-async-states FR-005)
- **Channel vocabulary documented in `docs/design/loading.md`** — the six loading channels (`initial-load`, `refresh`, `save`, `parse`, `mutation`, `transition`) with helper/visual mappings, skeleton inventory, inline-error contract, button-busy contract, reduced-motion inheritance, and quickref for future feature authors.
  (029-loading-async-states)
- **Demo-mode parity tests** — `tests/regression/demo-loading-parity.test.js` exercises every retrofit through the `demoStore` adapter with a `fetch` spy that throws on any network call, locking in FR-018 / FR-019 mode parity.
  (029-loading-async-states)
- **Bare-loading regression test** — `tests/regression/no-bare-loading.test.js` asserts Tracker / Calendar / Profile / ProfileEdit never paint the strings `"Loading…"`, `"Loading applications..."`, or `"Loading profile..."`, even when the underlying fetches never resolve.
  (029-loading-async-states SC-003)

### Changed

- **View-switcher chip now signals in-flight transitions via `aria-busy`** (small additive change on top of feature 028). The chip's popup, count badge, and click semantics are unchanged.
  (029-loading-async-states FR-005)
- **Calendar month/year navigation now refetches data** through `bindContainerBusy` on the grid slot. On success, the new month renders with fresh data. On failure, a toast fires and the prior view is preserved (view-state revert via deferred pending values).
  (029-loading-async-states FR-004)

### Internal

- Removed orphaned `.profile-loading` CSS selector — the `Profile.js` and `ProfileEdit.js` callers were replaced by skeletons; the `.apps-empty-message` rule retains its remaining styles.
  (029-loading-async-states)

## [0.14.0] — 2026-05-26

Archive Applications view — closes the archive lifecycle loop. Archived applications now have a dedicated reachable surface on the Tracker (toolbar chip + `?view=archived` deep link), a read-only Application Overlay mode, and a one-click unarchive action; the Profile page surfaces an `Archived applications · N →` entry point. Archived rows remain excluded from every active workflow surface (Active list, Calendar suggestions, Action Panel sections, Month Grid chips, Profile stat tiles).

### Added

- **Archived Applications view on the Tracker** — a new toolbar view chip (`Applications ▾` / `Archived ▾`) toggles between active and archived lists. Deep-linkable via `?view=archived` (initial render honors the URL with no flash of the Active view). Pagination resets to page 1 on switch; filters and sort persist.
  (028-archive-applications-view)
- **Read-only Archived mode for the Application Overlay** — clicking any archived card opens the overlay with an `ARCHIVED` header chip, only `↺ Unarchive` and `✕ Close` in the action cluster, all body fields rendered as plain values (no click-to-edit), and no Save/Discard footer. Esc / backdrop / ✕ close immediately without a discard confirmation.
  (028-archive-applications-view §application_overlay.md §12)
- **`POST /api/applications/:id/unarchive`** endpoint mirroring the existing `archive` endpoint. The client gains an `api.unarchive(id)` helper; both SQLite and Supabase repositories implement `unarchive(id)` and `getAllArchived()`. Demo mode supports the round-trip in memory.
  (028-archive-applications-view)
- **`archived_date` column** on the `applications` table (additive, nullable). Populated automatically when `archived` flips `false → true`; cleared when it flips back. Existing archived rows in legacy databases retain `archived_date = NULL`; the card date-stamp falls back to `lastStatusUpdate` for those.
  (028-archive-applications-view)
- **"Archived applications · N →" link on the Profile page** — deep-links to `/?view=archived` and always renders, including at `N = 0`. Falls back to `N = 0` gracefully if the archived-count fetch fails.
  (028-archive-applications-view)
- **Two seeded archived rows in demo mode** (one favorited + non-terminal, one terminal-status + unfavorited) so portfolio visitors can exercise the Archived view, the unarchive action, and the favorite-preservation behavior out of the box.
  (028-archive-applications-view)

### Changed

- **Archive no longer clears the `fav` star.** A starred row archived after this version retains `fav: true` through both archive and unarchive. This is a forward-only behavior change — rows archived before this version had their `fav` cleared at archive time; that state is not retroactively recovered.
  (028-archive-applications-view FR-009)
- **Tracker `+ New application` button and mobile FAB are hidden while the Archived view is active.** Creation is suppressed at every entry point on the Archived list.
  (028-archive-applications-view FR-004)
- **Toolbar chip label no longer renames to "Results" when filters are active.** The chip now always reads `Applications` (Active view) or `Archived` (Archived view); active-filter state is still signaled by the count badge updating to the filtered count and by the highlighted filter buttons. This is a small UX change to existing chrome introduced as a side-effect of the view-chip redesign.
  (028-archive-applications-view tracker.md § View switcher)
- Demo mode's `archive` operation now keeps the row in memory with `archived: true` (previously the row was spliced out of the demo array, which made an Archived view impossible in demo mode).
  (028-archive-applications-view)
- Application Overlay header now restores the `modal-header--light` / `modal-header--dark` contrast class after each status-accent change, ensuring the new archived stamp chip and any other contrast-dependent children render with the correct variant on every render. Pre-028 the class was stripped on status change without being re-added.
  (028-archive-applications-view §07.3)
- Unarchive button (card + overlay) uses outline chrome with an `--indigo` border + icon so it matches peer card-action buttons while staying color-coded as the restore action; hover lifts to an `--indigo-dim` fill. Earlier drafts spec'd a filled `--indigo-soft` treatment; revised after the Phase 09 browser smoke walk surfaced visual inconsistency against peer buttons.
  (028-archive-applications-view §09.2)

## [0.13.3] — 2026-05-26

### Changed

- `createApp({ repositories })` now throws a clear `'createApp: repositories is required'` error when called bare, instead of letting the destructure surface a cryptic `TypeError`. Carried over from the PR #23 self-review (INFO).
- `docs/REPO_MAP.md` row descriptions for the 019 and 020 spec packages now reflect the actual artifact contents (plan scope, contract scope, quickstart scope). Carried over from the PR #30 self-review (INFO).

### Fixed

- Audit timestamps (`createdAt`, `updatedAt`, `lastStatusUpdate`) now reflect the user's **local** timezone at the moment of the write rather than the server's timezone. The client sends its local `YYYY-MM-DD` in a new `X-Client-Date` request header; the server validates it and threads the value through routes → repository wrappers → SQLite/Supabase adapters. Direct API consumers (curl, scripts) that omit the header fall back to UTC, which also unifies SQLite-mode and hosted-mode behavior. Closes [#43](https://github.com/reso830/Project_Alice/issues/43).
- Application overlay now reverts the header background, status badge, and the dropdown's seeded status when a user discards an unsaved status change. Previously the underlying draft was restored but the header chrome and the `currentStatus` closure used by the status dropdown remained stuck on the rejected status, so the overlay looked "stuck" on the new status until reopened. Closes [#35](https://github.com/reso830/Project_Alice/issues/35).

## [0.13.2] — 2026-05-25

Calendar v3 patch — Phase 13 re-smoke follow-ups plus the long-deferred collapsible Action Panel summary bar. Same feature surface as v0.13.0; no API or schema changes.

### Added

- **Collapsible Action Panel summary bar** at every stacked layout (`<1200px` — narrow desktop, tablet portrait, mobile). The full panel collapses by default into a single-row summary (`"Today · N events · N suggestions · N upcoming"` or `"Quiet day — nothing on your plate"` when all sections are empty); tap, click, Enter, or Space toggles. Esc collapses from inside the expanded panel. Returns the calendar grid to the top of the viewport at narrow widths instead of pushing it below several hundred pixels of stacked content.
  (026-calendar §11.1)
- **Shared `QuickFiltersStatusPopup` component.** Tracker and Calendar now mount the same status-filter popup across every breakpoint; one chrome, one behavior, no parallel implementations.
  (026-calendar §6.12)
- Local SQLite + demo seeds now include at least one day with 4+ distinct statuses so the `+N` overflow chip on month grid cells is exercisable out of the box.
  (026-calendar)

### Changed

- Calendar status filter retired the `.filter-dd` dropdown chrome. The filter icon button now opens the shared Tracker popup with single-select semantics on the Calendar side.
  (026-calendar)
- Inline Day Panel row meta is now `{Company} · {Job title}` (was Company only) — mirrors the Action Panel meta pattern (`§6.3` separator treatment) so the two surfaces feel cohesive.
  (026-calendar §17.5)
- Month grid header allows a controlled two-row wrap below 375px (iPhone SE / Galaxy Z Fold cover-screen class): nav cluster on row 1, `[Today*] [Filter*]` on row 2. Above 375px the single-row rule still holds.
  (026-calendar §6.6.1 + §11)
- Calendar status badge inside the Inline Day Panel switched from DM Mono to Sora — matches the page typography per `§4`.
  (026-calendar)
- DayPanel group-header dashed rule renders as an inline hairline next to the status badge instead of an unintended full extra row.
  (026-calendar)
- Action Panel ID pill now matches the Tracker ID pill treatment (font / padding / radius unified).
  (026-calendar)
- Out-of-month weekend cells render with the out-of-month weekend tint (`#F7F3EC`) instead of the in-month weekend tint that was previously winning the cascade.
  (026-calendar §6.8)
- Selected cell border ring restored — navy ring by default, indigo when the selected cell is also today.
  (026-calendar §17.3)

### Fixed

- **Picker anchoring on desktop / tablet.** Resolves the `[0.13.1] § Known limitations` entry. Month, Year, and Status filter popups now sit directly under their trigger buttons on every viewport above mobile bottom-sheet widths.

### Removed

- `src/components/calendar/StatusFilterDropdown.js` and its tests — superseded by the shared `QuickFiltersStatusPopup`. No remaining call sites.
  (026-calendar)

## [0.13.1] — 2026-05-25

Calendar v2 patch — design polish + inline Day Details Panel pivot driven by the v0.13.0 browser smoke. Same feature surface; no API or schema changes.

### Added

- **Inline Day Details Panel** below the Month Grid. Selecting a date keeps both the grid and the day's activity in view; replaces the previous popover for both desktop and mobile.
  (026-calendar §17)
- "Suggestion dismissed" toast on the Action Panel dismiss button — earlier the row exited silently.
  (026-calendar)
- Profile-name injection in the greeting (`"Good morning, Alice"` when a profile is set; no trailing comma otherwise).
  (026-calendar)
- Status filter is now a 30×30 icon button (funnel glyph idle, status swatch when active) mirroring the Tracker quick-filter control; same on desktop and mobile.
  (026-calendar)

### Changed

- Renamed the `assessment` status display label `Technical Assessment` → `Technical` globally. The status key is unchanged; no migration required. Affects Calendar chips, Tracker badges, filter dropdowns, and all status pill surfaces.
  (026-calendar)
- Month Grid cells are now keyboard-selectable whether or not they have activity (`Enter` / `Space` activate); numbered chips and `+N` overflow chips became decorative (no `role`, no tab stop). Day-detail interaction routes through the cell, not the chip.
  (026-calendar)
- Month and Year buttons in the grid header now render as text-style triggers (no border, no `▾` caret) and stay on a single row at every breakpoint, including mobile (retired the prior 3-row mobile header).
  (026-calendar)
- Status filter now dims **all** non-matching cells — including empty days — so the matching set is the only thing at full opacity.
  (026-calendar)
- Picker headers dropped the "Jump to month" / "Jump to year" labels; the Year picker's range header now uses the same Sora weight as the year buttons (no font mixing).
  (026-calendar)
- CW gutter cells gained `aria-hidden="true"` and a `Week N, {year}` tooltip so screen readers skip them while sighted users still get the year context at boundary weeks.
  (026-calendar)
- CSS polish: section subheaders/count pills sized up; DOW labels, CW numbers, day numbers, and the "Rest of week" label switched to weight 500 (no longer bold); `.cal-empty` lost its dashed border + brown tint; weekend / out-of-month hues distinguishable against the in-month white. Calendar ID pill matches the Tracker's ID treatment.
  (026-calendar)

### Removed

- `src/components/calendar/DayPopover.js` and its tests — superseded by the Inline Day Details Panel. No remaining call sites.
  (026-calendar)

### Known limitations

- **Picker anchoring on desktop/tablet (obs #5 carryover).** Month, Year, and Status filter dropdowns can still drift off their trigger in the live browser on some viewports. JSDOM positioning math is correct (regression test added in `tests/components/calendar/anchoredDropdown.test.js`), so the cause is browser-only (likely ancestor `transform` or `overflow`). Tracked for a future patch; mobile bottom-sheet behavior is unaffected.
  - _Resolved in [0.13.2](#0132--2026-05-25)._

## [0.13.0] — 2026-05-25

### Added

- **Calendar page** — new dedicated view alongside the Tracker and Profile pages.
  (026-calendar)
- Action Panel with Today, Suggested Actions, and Upcoming sections; count pills;
  five rule-based suggestion kinds (follow-up, feedback, interview follow-up, offer
  expiry, ghost flag).
  (026-calendar)
- Month Grid with always-6-week layout, ISO Monday-start, calendar-week gutter,
  status-coloured numbered chips, +N overflow, out-of-month and weekend tints, and
  today highlighting.
  (026-calendar)
- Status filter chip + dropdown; month/year navigation arrows; Month and Year
  pickers; Today button; Day Popover (status-mode and all-mode).
  (026-calendar)
- Mark Ghosted action from suggestion rows — updates status + Timeline entry in one
  step with a confirmation toast.
  (026-calendar)
- Local dismissal of suggestion rows; demo-mode dismissals stay in memory only
  (never touch localStorage).
  (026-calendar)
- Calendar suggestion-coverage assertions added to `tests/seed-data.test.js`.
  (026-calendar)

> **Operator action required (hosted only):** apply the updated
> `claim_and_seed_starter()` RPC body from
> [`docs/db/claim_and_seed_starter.md`](docs/db/claim_and_seed_starter.md) (v3)
> so new hosted users see a Calendar follow-up suggestion on day 1. Existing users
> are unaffected.
> See `specs/026-calendar/quickstart.md §4` for the full operator checklist.

## [0.12.0] — 2026-05-21

### Added

- Application Timeline section in the detail overlay: collapsed preview,
  inline add/edit/delete, future-dated entries, and automatic Timeline
  entries when status changes.
  (025-application-timeline)
- Seeded Timeline content in the local SQLite DB seed, in-browser demo
  seed, and hosted starter applications.
  (025-application-timeline)

### Changed

- Replaced the visible *Last Updated* row in the application detail
  overlay with the Timeline preview. The underlying `lastStatusUpdate`
  field is still stored and bumped for status changes.
  (025-application-timeline)
- Modal max-height now clamps at 860px so tall Timelines scroll inside
  the modal body while the header and footer remain pinned.
  (025-application-timeline)
- `claim_and_seed_starter()` RPC body updated to seed Timeline content
  for new hosted users.
  (025-application-timeline)

### Removed

- Removed the visible *Last Updated* row from the application detail
  overlay. No data was removed.
  (025-application-timeline)

### Fixed

- Timeline normalization now preserves an explicit empty array
  (`timeline: []`) instead of re-synthesizing entries on every read.
  Previously, a user who deleted every Timeline entry and saved would
  see the entries reappear after the modal received the server's
  response. Synthesis now runs only when the `timeline` field is
  absent from the input record.
  (025-application-timeline)

## [0.11.1] — 2026-05-20

> Documentation polish release — feature 022-deployment-polish-docs.
> Consolidated hosted-deployment operator surface (README refresh +
> `docs/deployment.md` expansion + new `docs/hosted-smoke-test.md`).
> No runtime, schema, endpoint, or dependency changes. Only code
> touch is the in-app `APP_VERSION` literal keeping pace with
> `package.json` per constitution Amendment 1.3.0.

### Docs

- Refreshed README "Hosted Mode" section: three runtime modes
  (local / hosted / demo) summarised in one place, with pointers to
  the consolidated operator surface in `docs/deployment.md`.
  (022-deployment-polish-docs)
- Expanded `docs/deployment.md` with four new sections:
  **Environment Variable Checklist** (deployer pass/fail framing
  alongside the existing Reference table), **Supabase Setup
  Checklist** (one ordered procedure consolidating features 018 +
  019 quickstarts plus an explicit RLS-policy verification step),
  **Demo & Free-Tier Notes** (Vercel Hobby cold starts, Supabase
  Free pause, demo reset, hosted seeded data), and
  **Migration Clarification** (local SQLite does not migrate to
  hosted; migration tooling is future work).
  (022-deployment-polish-docs)
- Added `docs/hosted-smoke-test.md` — standalone Given/When/Then
  smoke-test checklist for pre-promotion hosted verification.
  Seven sections: login, demo, CRUD, profile editing, cross-user
  authorization (RLS-scoped 404 check with proper Bearer-token
  fetch), resume-import restrictions, and 375px mobile layout.
  (022-deployment-polish-docs)
- `docs/REPO_MAP.md`: added a `## Docs` section cataloguing
  `AI_WORKFLOW_GUIDE.md`, `deployment.md`, `hosted-smoke-test.md`,
  and `REPO_MAP.md`; added Spec Packages rows for
  `specs/022-deployment-polish-docs/`.
  (022-deployment-polish-docs)

### Changed

- `APP_VERSION` literal bumped to `'v0.11.1'` in
  `src/pages/welcome/shared/appMeta.js` to stay in sync with
  `package.json` per constitution Amendment 1.3.0 (in-app version
  display in lockstep with SemVer).
  (022-deployment-polish-docs)

## [0.11.0] — 2026-05-20

> Hosted resume import security release — feature 021-hosted-resume-import-security.
> Pure security hardening + regression guards on the existing
> `POST /api/resume/parse` endpoint. No new endpoints or env vars. The
> user-observable delta is a sanitized error code for corrupted files;
> everything else is invariant-pinning plus a serverless PDF runtime shim.

### Added
- `PARSE_FAILED` error code for `POST /api/resume/parse` — returned
  when the file parser throws (corrupted PDF, malformed DOCX,
  empty/garbled file). The response is
  `400 { error: { code: 'PARSE_FAILED', message: 'Could not read this resume. Try a different file.' } }`.
  The raw library error is logged server-side via
  `console.error('[resume.parse]', { error, stack, nameSha8, mimetype, path })`
  with an 8-char SHA-256 prefix of the filename (not the raw filename)
  and the request path; the resume content and the raw filename are
  never logged.
- `specs/021-hosted-resume-import-security/contracts/api.md` —
  canonical post-021 security model for the parse endpoint:
  threat model, four-layer defense (frontend demo gate → server
  auth → multer validation → parser validation), explicit guarantees
  (`§4.1` auth required, `§4.2` no disk write, `§4.3` no Supabase
  persistence, `§4.5` fixed error code set, `§4.7` service-role-key
  unreachable), and explicit non-guarantees (no malware scan, no
  rate limiting, global 500 handler unchanged).

### Changed
- Pre-021, corrupted-file uploads fell through `next(error)` to the
  global 500 handler at `server/index.js:74-91`, which echoed
  `err.message` — exposing library internals (`pdf-parse` stack text,
  `mammoth` ZIP error strings, internal paths) to the client. The
  new resume-route catch sanitizes the response. The global 500
  handler is unchanged for every other route.
- Every non-`LIMIT_FILE_SIZE` `multer.MulterError`
  (`LIMIT_UNEXPECTED_FILE`, `LIMIT_FIELD_KEY`, `LIMIT_FIELD_VALUE`,
  `LIMIT_FIELD_COUNT`, `LIMIT_FILE_COUNT`, `LIMIT_PART_COUNT`) is
  now mapped to `400 VALIDATION_ERROR` with the raw multer message
  logged server-side — closing FR-007's "no client-shape error
  reaches the global 500 handler" guarantee.
- PDF extraction now installs `DOMMatrix`, `ImageData`, and `Path2D`
  globals from `@napi-rs/canvas` before loading `pdf-parse`, and
  points PDF.js at `pdf-parse`'s embedded data-URL worker instead of
  the default `./pdf.worker.mjs` path. Valid PDFs now parse in
  Vercel's Node/serverless runtime even when browser canvas globals
  and untraced worker files are absent. `@napi-rs/canvas` was already
  present transitively via `pdf-parse`; it is now direct so the
  runtime shim is explicit.

### Internal
- New regression guards in `tests/server/resume.test.js` —
  `describe('resume API — hosted auth gate (FR-001, FR-009)')`
  (2 cases) pins the hosted unauthenticated → 401 contract;
  `describe('resume API — in-memory invariant (FR-002, FR-010)')`
  (5 cases) installs pass-through `fs.write*` / `fs.open*` /
  `fs.promises.*` spies and asserts zero write-mode calls across
  happy + four failure paths;
  `describe('resume API — service-role credential isolation (FR-012)')`
  (5 cases) reads each resume-code-path file and asserts neither
  `SUPABASE_SERVICE_ROLE_KEY` nor `service_role` appears.
- New corrupted-file + log-shape + FR-007 sweep tests in the same
  file pin the new `PARSE_FAILED` mapping, the sanitized response
  body (no `pdf-parse`/`pdfjs`/`mammoth`/`node_modules` substrings),
  and the sanitized log object (`nameSha8` / `mimetype` / `path`
  present, raw filename absent).
- Added 18 new tests across the three new describe blocks plus the
  corrupted-file, log-shape, FR-007 sweep, and `LIMIT_UNEXPECTED_FILE`
  cases, including a valid-PDF regression with DOM canvas globals
  deleted and the embedded PDF worker selected.

## [0.10.0] — 2026-05-19

> Portfolio demo mode release — feature 020-portfolio-demo-mode.
> A purely client-side, in-memory demo of the tracker is now reachable
> from the welcome page's "Try the demo" CTA. Local SQLite and hosted
> Supabase modes are unchanged. The reserved `APP_RUNTIME=demo` slot
> from 019 is removed; setting it now fails at boot.

### Added
- Portfolio demo mode — public visitors can click **Try the demo** on
  the welcome page (or the auth-modal's demo button) to explore the
  tracker and profile with 23 seeded sample applications and a fully
  populated demo persona (Alex Rivera). Application date and
  `lastStatusUpdate` are shifted at session start so the most recent
  record reads as "today" while preserving relative spacing. Profile
  biographical dates remain static. Demo state lives in module-level
  memory only and resets on every browser refresh (FR-005); no API
  calls, no `localStorage`, `sessionStorage`, IndexedDB, or cookie
  writes occur during a demo session
- `'demo'` auth status — `src/data/authStore.js` gains `DEMO_STATUS`,
  `enterDemo()`, and `exitDemo()`; `init()` has no demo restore path
  (refresh ends the demo by design)
- In-memory demo data layer — `src/data/demoStore.js` provides the same
  CRUD surface as the network adapter (`getAll` / `getById` / `create`
  / `update` / `archive` / `getProfile` / `saveProfile` / `loadSeed` /
  `clear`) with deep-cloned reads, validation reused from
  `src/models/application.js` and `src/models/profile.js`, and the
  standard `{ code, message, fields? }` error shape; `src/data/demoSeed.js`
  exposes `buildDemoSeed()` returning a fresh applications + profile
  pair
- Side-effect-free SQLite seed modules — `server/seeds/applicationsData.js`
  and `server/seeds/profileData.js` expose `DEMO_RECORDS` and
  `DEMO_PROFILE` as pure constants so the demo's parity tests can
  assert byte-for-byte equivalence with the SQLite seed without
  opening the database or calling `process.exit`
- Service-layer mode switch — `src/services/api.js` short-circuits all
  seven exported functions to `demoStore` when `getAuthState().status
  === 'demo'`, never touching the network in demo; `src/services/resumeApi.js`
  throws `{ code: 'DEMO_FEATURE_UNAVAILABLE' }` immediately in demo
- Navbar Demo affordance — `src/components/Navbar.js` renders a
  "Demo mode" badge and an **Exit demo** button (door-arrow icon
  matching the sign-out button) when status is `'demo'`; clicking the
  button calls `authStore.exitDemo()` and toasts "Exited demo"
- ProfileEdit inline note — `src/pages/ProfileEdit.js` renders a small
  `.profile-edit__resume-demo-note` element ("Resume import is
  available after signing in.") in the resume-import slot when in
  demo, replacing the upload widget
- Design-by-contract guard — `src/components/ResumeImport.js` promotes
  its previously internal `VISIBLE_STATUSES` set to an export; a test
  asserts `!VISIBLE_STATUSES.has(DEMO_STATUS)` so a future change that
  silently adds `'demo'` to the set fails immediately
- Test coverage — `tests/data/{demoStore,authStore.demo}.test.js`,
  `tests/services/{api,resumeApi}.demo.test.js`,
  `tests/pages/welcome/demoStub.test.js`,
  `tests/components/{Navbar.demo,ResumeImport.demo}.test.js`,
  `tests/pages/ProfileEdit.demo.test.js` — including a fetch spy that
  asserts zero network calls across every demo write

### Changed
- Server-side runtime config now accepts only `local` and `hosted` —
  the reserved `'demo'` slot from 019 has been removed. Setting
  `APP_RUNTIME=demo` now fails at boot with the standard
  `Invalid APP_RUNTIME` error naming the two valid values. The
  `DemoRepositoryNotImplementedError` class, the `createDemoStub`
  factory, the dispatcher's demo branch, and the
  `config.isDemo` short-circuit in `assertHostedSchema` are deleted
- Welcome CTA wiring — `src/pages/welcome/demoStub.js` no longer fires
  a "Demo coming soon" toast. It now exports `enterDemo()` which
  delegates to `authStore.enterDemo()`. The welcome page CTA and the
  auth-modal demo button both call through this entry
- `src/main.js` routes `'demo'` status to the app shell alongside
  `'local-mode'` and `'authenticated'`, and skips the legacy
  `src/data/store.js` `localStorage` warm-up entirely in demo
- `src/pages/Tracker.js` gates both `persistFilterState` and
  `loadPersistedFilterState` on `status !== 'demo'` so demo sessions
  perform zero `localStorage` writes under `apptracker_filters` and
  start from default filter state regardless of any prior signed-in
  session's persisted prefs

### Internal
- The legacy `server/db-seed.js` and `server/db-seed-profile.js`
  scripts now import their data constants from the new
  `server/seeds/*.js` modules; `db-seed-profile.js` additionally
  guards its top-level side effects (`initSchema` / `saveProfile` /
  `process.exit`) behind an `import.meta.url === pathToFileURL(process.argv[1]).href`
  CLI check matching the pattern `db-seed.js` already uses

## [0.9.0] — 2026-05-17

> Hosted persistence release — feature 019-supabase-persistence.
> Local SQLite mode is byte-equivalent to v0.8.1 and remains the default.
> Hosted operators MUST apply the migration in
> [`specs/019-supabase-persistence/data-model.md §5`](specs/019-supabase-persistence/data-model.md)
> before deploying a v0.9.0+ build to hosted mode; the boot check refuses
> to serve until the migration is in place.

### Added
- Supabase-backed repository adapters for `applications` and `profile` —
  every read scopes by the caller's `user_id` via both server-side
  `.eq('user_id', userId)` filters and Supabase Row Level Security
  (defense in depth, FR-016)
- `user_seed_state` marker table + `claim_and_seed_starter()` RPC — first
  authenticated API call from a hosted user atomically seeds 2 sample
  applications and a starter-state marker inside one Postgres transaction;
  empty profile is intentional onboarding (FR-012, FR-013, FR-014)
- `demo` runtime mode added as a third `APP_RUNTIME` value (alongside
  `local` and `hosted`) — currently returns
  `DemoRepositoryNotImplementedError` on every method; reserved for
  feature 020
- Per-request Supabase client factory
  ([server/repositories/supabase/client.js](server/repositories/supabase/client.js))
  — constructs an anon-key client carrying the caller's JWT so PostgREST
  applies RLS as the authenticated user; never reads
  `SUPABASE_SERVICE_ROLE_KEY` at runtime
- Boot-time hosted schema check
  ([server/health.js](server/health.js)) — sentinel PostgREST probes
  against `applications`, `profile`, `user_seed_state` refuse to start
  the server until the 019 migration is applied
- `attachRepos(dispatcher)` Express middleware
  ([server/repositories/middleware.js](server/repositories/middleware.js))
  — sets `req.repos = dispatcher.forRequest(req)` so route handlers have
  one uniform contract across all three runtime modes
- `seedHostedUserIfNeeded` Express middleware
  ([server/auth/seedHostedUser.js](server/auth/seedHostedUser.js))
  — runs after `requireAuth` on every protected hosted route, invoking
  the seed RPC exactly once per user
- `server/db/columns.js` — shared module exporting column lists, the
  `FIELD_TO_COLUMN` map, `toRow`/`toRecord` translators, and SQLite-side
  helpers. Both the SQLite and Supabase adapters consume it so they
  cannot drift; backward-compat re-exports preserve existing imports
  from [server/db/applications.js](server/db/applications.js)

### Changed
- `createRepositories(config)` now returns a uniform
  `{ forRequest(req) }` shape across all three runtimes (local, hosted,
  demo). Route handlers obtain their per-request repository bundle via
  `req.repositories.forRequest(req)`. Hosted mode constructs a per-
  request RLS-scoped Supabase client; local and demo return long-lived
  bundles. Route factories now receive `{ repos, requireAuth,
  seedHostedUserIfNeeded }` instead of pre-extracted `{ repo, requireAuth }`.
- All protected route handlers converted to `async` with explicit `await`
  on every repository call — the Supabase adapter returns Promises and
  the status-transition check in `PATCH /api/applications/:id` cannot
  function without `await` (forbidden transitions would silently slip
  through validation)
- `api/index.js` (Vercel hosted entry) now passes `config` +
  lazy-imported `seedHostedUserIfNeeded` to `createApp`, fixing two
  pre-existing latent gaps (hosted Vercel runtime had not been
  receiving auth/seed middleware)
- Adapter shape (`ApplicationsRepository` / `ProfileRepository`) method
  names + arguments unchanged; only return type changed from sync values
  to Promises (route handlers add `await` to existing call sites)

### Dependencies
- `@supabase/supabase-js` (added in 018 for the frontend bundle) is now
  also used **server-side** to construct per-request RLS-scoped clients.
  No new package install required; the existing dependency is reused at
  the Node runtime. Verify with `npm ls @supabase/supabase-js`.

### Migration required
- Hosted operators MUST apply
  [`data-model.md §5`](specs/019-supabase-persistence/data-model.md) via
  Supabase dashboard → SQL Editor before deploying v0.9.0+ to hosted
  mode. The block is idempotent (CREATE TABLE IF NOT EXISTS + DROP
  POLICY IF EXISTS) and safe to re-run. Pre-019 hosted data is wiped per
  018's *Accepted Limitations* — though in practice 017's hosted schema
  was documented but never applied so most projects have nothing to
  wipe.
- The boot check in
  [server/health.js](server/health.js) refuses to start the hosted
  server if the migration has not been applied; expect a descriptive
  startup error naming the missing column or table.

### Security
- Per-user ownership enforced by RLS + server-side filters on every
  hosted read and write. Cross-user access attempts return responses
  indistinguishable from "resource does not exist" — no information
  leak via differential status codes or response bodies.
- Verified end-to-end against a live multi-tenant Supabase project
  during Task 08.2 manual smoke (quickstart §6 RLS direct-bypass):
  user A's JWT against user B's row id returned `[]` from both Express
  (404) and direct PostgREST calls — both server-side filter and RLS
  policy independently refused.

### Local mode (unchanged)
- SQLite repositories and schema are byte-equivalent to v0.8.1. Local
  developer workflow (`npm run server:dev` + `npm run dev`) requires
  no setup changes. Existing local data is untouched.

## [0.8.1] — 2026-05-17

> UI polish release on top of v0.8.0 — no API, schema, or auth-behavior
> changes. Bundles the Tracker chrome refresh (feature 018 Phase 13) and the
> full Welcome refresh (Phases 14–18).

### Changed
- Tracker top bar restyled to a unified navy band (52px sticky) with brand cluster, page nav, and right-aligned identity cluster
- Email truncation switched from JS char-count to CSS `max-width` (full email always in the `title` attribute); `EMAIL_DISPLAY_LIMIT` and `truncateEmail()` retired from `Navbar.js`
- Sign-out button restyled with a door-arrow icon; collapses to icon-only at `≤ 639px`
- Mobile chrome (`≤ 639px`) gains a bottom tab bar (`src/components/BottomTabBar.js`) for page nav and a floating "+ New application" button (`src/components/Fab.js`) above it
- Fold-narrow breakpoint (`< 380px`) hides the "Project Alice" wordmark while keeping the logo mark + sign-out icon
- Tracker toolbar flipped onto the navy band with refreshed filter chip / count badge / erase-all tints (`design/tracker.md` § Toolbar-on-navy tints)
- Welcome page rewritten to match `design/welcome_page.md` — headline accent `<em>organized.</em>` with indigo underline-glow, theme-driven brand mark; the previous floating metadata pills + "Sample data" disclaimer are no longer rendered
- Welcome mini footer sourced from a new shared `src/pages/welcome/shared/appMeta.js` (`APP_VERSION`, `ISSUE_URL`, `LICENSE_NAME`, `LICENSE_URL`) — single source of truth shared with `Footer.js`; license set to `PolyForm Noncommercial 1.0.0`
- Hero slideshow replaced — the six product-screenshot slides (`src/assets/welcome-hero/*.png`) and their imports are gone; the new cycler shows four animated scenes (`SceneStack`, `ScenePipeline`, `SceneProfile`, `SceneLogo` in `src/pages/welcome/scenes/`), 5500ms per scene, 700ms cross-fade, dot navigation with a per-scene progress bar; all motion gated behind `prefers-reduced-motion: reduce`
- Welcome page now ships fixed production defaults for layout, theme, copy intensity, and hero scene — the prototype Tweaks panel and `?key=value` URL overrides were prototyped during Phase 16 but cut before merge; responsive desktop / tablet / mobile branches remain
- Auth modal restyled per design §4.6 — 440px / 14px-radius shell, `rgba(8,8,24,.55)` overlay with 6px backdrop blur, 40px header logo, footer with primary submit → "or" divider → demo button (warm fill, green pulse dot) → swap-mode link → legal copy on signup only; the previous tab strip is replaced by the in-footer swap link
- Welcome `<760px` portrait stack lands inside the same `WelcomePage.js` module via a JS-toggled `.welcome--mobile` class; full-width CTAs with pulsing green dot on the demo button; brand mark forced to `Alice_Colored.png` regardless of theme
- Resize-driven viewport crossings mount/unmount the hero slideshow so the DOM matches the active branch (mobile omits it; desktop/tablet keep it)
- "Try the demo" CTA (welcome page + auth modal) now fires a shared "Demo coming soon" toast via `src/pages/welcome/demoStub.js` — `window.alert()` no longer used; real demo behavior owned by a future feature
- Test coverage extended in `tests/components/{bottomTabBar,fab}.test.js`, `tests/pages/welcome/heroSlideshow.test.js`, and `tests/pages/welcome/scenes/*.test.js`

## [0.8.0] — 2026-05-16

### Added
- Hosted authenticated user access via Supabase email/password — feature 018-auth-user-access; local mode is unchanged and remains the default
- `allowed_emails` table + `auth.users` `BEFORE INSERT` trigger — operator-managed allowlist enforced inside Postgres so unauthorized signups never reach `auth.users`
- `server/auth/middleware.js` — `createRequireAuth({ jwksUri, logger })` factory; verifies `Authorization: Bearer <jwt>` against Supabase's JWKS endpoint (`<SUPABASE_URL>/auth/v1/.well-known/jwks.json`) via `jose.jwtVerify`, accepting `ES256` and `RS256` (Supabase's modern asymmetric signing modes); logs categorized rejections (`missing | malformed | expired | signature | other`) with redacted-path context, never the token
- `/api/health` now returns `{ status, runtime: 'local' | 'hosted' }` so the frontend can detect a runtime/config mismatch
- `createApp({ repositories, config, requireAuth? })` — `server/index.js` factory now accepts an optional `requireAuth`; hosted mode throws if `supabase.jwtSecret` is missing and no explicit `requireAuth` is passed
- `logBoot(config)` — single-line `[runtime] mode=<runtime> port=<port>` entry so operators can grep the active mode in production logs
- `src/services/supabaseClient.js` — Supabase JS client wrapper; reads `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AUTH_EMAIL_REDIRECT_URL`; exports `isHostedAuthAvailable`
- `src/data/authStore.js` — module-state subscribable auth store with `init`, `subscribe`, `getAuthState`, `getAccessToken`, `signOut`; states: `initializing | local-mode | unauthenticated | authenticated`
- `src/services/healthApi.js` — `getHealth()` standalone fetcher returning the raw `{ status, runtime }` envelope (does not go through `request()`'s `data` unwrap)
- `Authorization: Bearer <token>` automatically attached by `src/services/api.js` and `src/services/resumeApi.js` whenever `authStore.getAccessToken()` returns a value
- `src/pages/welcome/WelcomePage.js` — diagonal-split landing page with brand block, headline, three CTAs (Sign In, Create Account, Try Demo), floating metadata pills with illustrative disclaimer, footer metadata, and a `?auth=callback` verification banner handler that cleans the URL while preserving other query params
- `src/pages/welcome/HeroSlideshow.js` — 5-second auto-rotating screenshot slideshow, single static slide under `prefers-reduced-motion: reduce`
- `src/pages/welcome/AuthOverlay.js` — centered-modal overlay with `role="dialog"` + `aria-modal`, tab strip with login/signup switching, focus trap, ESC + backdrop + close-button dismissal, previous-focus restoration, `verification_sent` state, `dispose()` cleanup path used by parent unmount
- `src/pages/welcome/LoginForm.js` — email/password login form with neutral error copy and accessible inline loading state (`aria-busy`, mirrored `aria-live` status)
- `src/pages/welcome/SignupForm.js` — email/password signup with inline field validation (email regex, password min 8), neutral signup-rejection error (never leaks the cause), and `onSuccess` → overlay transitions to `verification_sent`
- `src/pages/ConfigError.js` — operator-facing fallback page; mounted when the hosted runtime handshake (`getHealth()` returns `runtime: 'hosted'` but `isHostedAuthAvailable` is false) detects missing Vite env vars
- `bootstrap()` + `runtimeHandshake()` exports in `src/main.js` — runtime handshake now runs BEFORE `authStore.subscribe` / `init`, so a misconfigured hosted deploy never flashes the welcome page or app shell before ConfigError replaces it
- `Navbar` user segment — email (truncated past 24 chars with full value in `title`) + Sign Out button; hidden in `local-mode` and `unauthenticated`; `Navbar.destroy()` unsubscribes from `authStore`
- `ResumeImport.create()` subscribes to `authStore` and toggles `root.hidden` based on auth state — gated to `local-mode` / `authenticated` only
- Welcome + auth overlay + ConfigError CSS in `src/styles/main.css` — diagonal-split layout (55% content / 62% hero anchored right with the design's clip-path), responsive breakpoints (≥1100px / 760–1100px / <760px / <420px), reduced-motion media query disabling card transforms and overlay entrance
- Six hero screenshots in `src/assets/welcome-hero/` (`tracker`, `application-modal`, `profile`, `filters`, `calendar`, `mobile-tracker`)
- Vite build-time assertion (`assertHostedFrontendEnv`) — production builds fail closed when any of `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AUTH_EMAIL_REDIRECT_URL` is missing
- `@supabase/supabase-js` (^2.45.0) and `jose` (^6.x) dependencies
- Spec package at `specs/018-auth-user-access/` — `spec.md`, `plan.md`, `tasks.md`, `data-model.md`, `contracts/api.md`, `research.md`, `quickstart.md`, `checklists/plan-review.md`
- `design/welcome_page.md` — visual specification for the welcome experience
- Test suites: `tests/server/auth-middleware.test.js`, `tests/server/routes-protected.test.js`, `tests/data/authStore.test.js`, `tests/services/{supabaseClient,healthApi,resumeApi}.test.js`, `tests/components/{welcome,heroSlideshow,navbar,resumeImport}.test.js`, `tests/pages/configError.test.js`, `tests/main.test.js`, `tests/build/vite-config.test.js`

### Changed
- `createApp()` signature now `({ repositories, config, requireAuth? })`; route factories (`createApplicationsRouter`, `createProfileRouter`, `createResumeRouter`) likewise accept `{ repo, requireAuth }`
- `unmountAppShell` in `src/main.js` calls `Navbar.destroy()` to clean up the auth-store subscription on transitions back to the welcome page
- `ResumeImport.create()` always returns an element; visibility now driven by `root.hidden` from a subscription, with completion state tracked separately so post-import hiding survives auth-state transitions

### Security
- Allowlist enforcement lives in a Postgres `SECURITY DEFINER` trigger on `auth.users` — an Express endpoint approach was considered and rejected because it could be bypassed by direct Supabase calls from the browser
- `SUPABASE_SERVICE_ROLE_KEY` is server-only — never appears in `src/` or in the Vite production bundle (verified in Phase 12)
- JWT verification pins `['ES256', 'RS256']` algorithm allowlist explicitly to defeat `alg: none` and downgrade attacks
- No long-lived shared HS256 secret is configured anywhere; signing key material is fetched at runtime from the Supabase-managed JWKS endpoint
- Token contents are never logged; categorized rejection logs include `category` and request path only

## [0.7.0] — 2026-05-13

### Added
- Resume Import — upload a PDF, DOCX, or TXT resume from the Profile page; extracted text is parsed and mapped into profile fields; the Edit Profile page opens pre-filled for review before the user decides to save; no automatic profile saving occurs
- `POST /api/resume/parse` — multipart upload endpoint; enforces a 5 MB size limit; dispatches to `pdf-parse` (PDF) or `mammoth` (DOCX) for text extraction; regex-based section and field parser extracts structured profile data
- `server/resume/extractor.js` — file-type dispatcher for PDF and DOCX text extraction
- `server/resume/parser.js` — regex and pattern-based parser; maps section headings and field patterns to typed profile field shapes
- `src/components/ResumeImport.js` — drag-and-drop upload component with idle, uploading, success, and error states; accessible file-input fallback
- `src/services/resumeApi.js` — frontend API client for the resume parse endpoint
- `mergeResumeIntoProfile()` in `src/models/profile.js` — non-destructive merge of AI-extracted fields into an existing profile; existing non-empty fields are never overwritten
- `mammoth` and `pdf-parse` server dependencies for document text extraction
- Test suites for resume parsing (`tests/server/resumeParser.test.js`), API routes (`tests/server/resume.test.js`), and profile merge logic (`tests/models/resumeMerge.test.js`)
- `LICENSE` — PolyForm Noncommercial License 1.0.0; Copyright 2026 Alvin

## [0.6.0] — 2026-05-09

### Added
- Inline edit modal — click any field in the detail view to edit it in place; outside-click commits the change to draft; Esc reverts the field without committing; Cmd/Ctrl+S saves; Cmd/Ctrl+Enter commits a multi-line field
- Create mode — `+ New application` button opens an empty draft modal with status defaulting to Wishlisted; saving creates the record and switches the modal to edit mode; Archive button hidden in create mode; footer always visible
- Draft management — footer appears when any field differs from the saved record; Save and Discard buttons; discard confirmation guard on ✕, backdrop click, and Esc; Favorite and Archive bypass the draft
- Six new optional application fields: `location` (free text), `shift` (Day/Mid/Night/Flexible), `workSetup` (Remote/Hybrid/On-site/Field), `compatNotes` (rich notes alongside the compatibility bar), `generalNotes` (free-text notes), `preferredSkills` (chip editor, separate from required skills)
- Quick filters toolbar — filter the card list by Status, Salary range (₱50k–₱250k dual-handle slider), Compatibility range (0–100 dual-handle slider), Company, Favorites, Shift, Work Setup, and Location; multiple filters stack with AND logic; subheader label switches to "Results" when any filter is active; erase-all button clears all filters at once
- "(Not set)" option in Shift, Work Setup, and Location filter panels — matches applications where that field is empty or null
- Sort panel — sort by Job ID, Status, Compatibility, Salary, or Company in ascending or descending order; Restore default resets to Job ID ascending
- Filter state persists to `localStorage` (key `apptracker_filters`) and is restored on page load; invalid enum values stripped on restore; location strings kept as-is; sort state is session-only
- Empty-filter state — "No applications match the active filters." shown in place of the card list when active filters return zero results
- Required field visual indicators (asterisk `*`) on job title, company name, and responsibilities fields within the overlay
- `parseSalaryInput()` and `formatSalaryDisplay()` utilities in `src/utils/currency.js` — parse user-entered peso amounts from formatted strings; format integers for display
- `scripts/ai-flow.ps1` — PowerShell orchestrator for a two-agent AI pipeline (Claude + Codex) with hard gates at each stage; includes `run-all` action to loop through all phases automatically
- `scripts/prompts/` — nine prompt templates covering the full pipeline: specify, plan, tasks, spec review, requirements check, phase implementation, phase review, and PR review (Claude and Codex variants)
- `docs/AI_WORKFLOW_GUIDE.md` — full reference for the local AI workflow: actions, gate system, log locations, recovery flows, and FAQ
- `docs/REPO_MAP.md` — codebase navigation shortcut for AI-assisted implementation; covers pages, components, backend, utilities, key boundaries, and common change patterns
- `features/` directory with example feature brief template
- `.gitignore` entries for AI workflow state files (`specs/**/.ai-phase`, `specs/**/.ai-requirements-ready`, `specs/**/.ai-phase-*-review`)

### Changed
- `responsibilities` field promoted to required — must be non-empty on Save and Create; existing records retain their stored value but validation is enforced on all new saves
- Detail modal header background is now the status `borderAccent` color (not `--navy`); header text color resolves to white or black based on relative-luminance contrast
- Status change in the modal now routes through the draft — the header color and badge update immediately but the `lastStatusUpdate` date is not written until Save
- DB schema auto-migrates — six new nullable columns (`location`, `shift`, `work_setup`, `compat_notes`, `general_notes`, `preferred_skills`) are added via `ensureColumn` on server start; existing records are unaffected
- `db:seed` updated — demo records include representative values for all new fields (shift, workSetup, location, compatNotes, generalNotes, preferredSkills)
- `CLAUDE.md` and `AGENTS.md` updated to reflect implemented app state (Vite/Express/SQLite), constitution v1.0.1, required date field (`lastStatusUpdate`), and correct directory conventions (`.agents/skills/` as shared source; `.codex/` lowercase for Codex-specific state)

### Fixed
- Newline characters in multi-line fields (responsibilities, compatibility notes, general notes) now render as visual line breaks in display mode instead of collapsing to a single line
- Sort popup no longer clips above the visible viewport when opened while the page is scrolled down on desktop
- Overlay quick action buttons now show exactly one tooltip via the `title` attribute; duplicate `aria-label` removed to prevent double-tooltip in some browsers
- Chip editor (Required Skills, Preferred Skills) no longer throws JavaScript errors when Enter keydown and blur fire simultaneously — a `_committingByEnter` flag prevents concurrent DOM re-renders
- Long text and URLs in the overlay no longer overflow their containers on narrow viewports — `overflow-wrap: break-word` applied
- Status pill in the overlay header remains legible on very narrow viewports (≤320px) — text centered when wrapped to two lines
- Salary field now displays "–" instead of blank when no value is set, consistent with all other optional text fields
- Modal discard in create mode no longer no-ops — `_attemptDiscardDraft()` now calls `close()` directly when `_mode === 'create'` instead of falling through the null guard
- `Find-SpeckitSpecDir` now resolves the requested feature name before falling back to the current branch, preventing misrouting when `-FeatureName` differs from the active branch
- Removed silent latest-spec fallback in `Find-SpeckitSpecDir`; unresolved names now throw immediately

## [0.5.1] — 2026-04-29

### Added
- Overlay-based add and edit flows for all six structured profile sections — Experience, Education, Certifications, Awards, Languages, and Links; modal on desktop (≥ 640 px), bottom-sheet on mobile with fly-in animation; overlay includes focus trap, ESC dismiss, and backdrop-click cancel
- Skills staging overlay — skills are staged as pills inside the overlay and merged into the main form only on Save; case-insensitive duplicate deduplication
- Discard confirmation inside overlays — "Discard entry changes?" with a red Discard button appears when cancelling a dirty overlay; ESC and backdrop click route through the same flow
- Edit icon on each structured entry row — opens a pre-filled overlay; saving updates the entry in-place without adding a duplicate
- Structured display for Certifications on the View Profile page — name, issuing body, date range, and optional Certificate ID rendered in a hierarchy matching the Education section
- Structured display for Awards on the View Profile page — award name, issuing body and date as meta, details paragraph below
- `validateYear` — four-digit year validator (≥ 1900) applied to Education's Year Completed field in both the overlay form and `validateProfile`
- `beforeunload` guard on the Edit Profile page — triggers the browser's native "Leave site?" dialog when there are unsaved changes

### Changed
- Edit Profile section order now matches View Profile: Basic Info → Summary → Experience → Education → Skills → Certifications → Awards → Languages → Links
- All structured entry sections use a title/meta/desc hierarchy with dedicated Edit and Remove icon buttons; "Add" button moved to the section header with primary styling
- Edit overlay saves use card-local re-render instead of full page rebuild, preventing scroll position reset on every entry edit
- Overlay form fields have consistent 14 px gap between fields
- Discard button styled red (`#c1121f`) across both the overlay discard dialog and the page-level discard modal
- iPad Mini stat chip layout — `.apps-desktop-vis__stats .stat-chip-row` overrides to a 2 × 2 grid, preventing chip overflow at 768 px

### Fixed
- Education Year Completed now validates year format in addition to required-field check
- Remove icon on the main skills card now uses `×` (was ASCII `x`)
- `.entry-row__edit` CSS now uses `var(--color-accent)` directly; undefined `--accent` fallback removed
- Awards entry no longer passes an empty string to the display helper when details are absent

## [0.5.0] — 2026-04-29

### Added
- Profile Edit page — full rewrite from section-by-section placeholder to a centralized inline editor with global Save/Cancel controls, dirty-state tracking, and a discard confirmation modal (keyboard-accessible, scroll-locked backdrop)
- Sticky subheader bar on the Edit Profile page — "Edit Profile" title with Save and Cancel buttons always visible without scrolling; Cancel triggers the discard flow; no separate back button
- Navbar discard guard — clicking any nav bar link while unsaved changes exist shows the discard confirmation modal before navigation proceeds
- Inline add/remove flows for all seven list-based profile sections: Skills (pill tags, case-insensitive duplicate deduplication, Enter key shortcut), Languages (language + proficiency dropdown), Certifications, Education (sorted newest-first by year), Professional Experience (sorted current-first then by end date), Links (URL validation, safe-protocol enforcement), Awards
- One-at-a-time inline form constraint — opening a second section's form while one is already open has no effect; Save is blocked and shows a persistent inline error (not a toast) while any form is open
- Structured entry data model — Experience, Education, Certifications, Awards, Languages, and Links now stored as typed entry objects instead of plain strings; backward-compatible normaliser migrates old string-array profiles on first read
- Client-side validation for all entry types: required fields, MM/YYYY date format, URL protocol enforcement, email format; errors surfaced inline below the relevant field before save; section-level summary shown if migrated entries have unfilled required fields
- Server-side validation for all structured entry fields via extended `validateProfile`; server returns `400 VALIDATION_ERROR` on invalid entries
- Required field visual indicators — red asterisk appended to all required field labels throughout the editor
- Inline form two-column row layouts — Language (language + proficiency), Certification (issuance date + expiry date), Experience (date started + date ended + current work checkbox) on viewports ≥ 640 px
- Experience Date Ended field disabled and dimmed when Current Work is checked; re-enabled and required when unchecked
- Compact icon remove button on all list entry rows (26 × 26 px, accessible `aria-label`, red hover state)
- Section header navy accent color on the Edit Profile page
- `src/utils/validate.js` — `validateRequired`, `validateMonthYear`, `validateUrl`, `validateEmail` pure validators
- `src/utils/sort.js` — `sortEducation` (by year completed descending) and `sortExperience` (current roles first, then by end date descending, then by start date)
- `src/utils/url.js` — `getSafeExternalHref` extracted and shared by Profile and ProfileEdit pages

### Changed
- Profile page updated to render new structured entry shapes: `responsibilities`/`dateStarted`/`currentWork` for experience; `degreeMajor`/`university`/`yearCompleted` for education; certifications, awards, languages, and links rendered as objects
- `src/models/profile.js` extended with per-type entry normalisers and comprehensive `validateProfile` covering all entry-level required fields; `PROFICIENCY_LEVELS` exported
- `certifications[].issuingBody` is now required (was previously optional); profiles with a blank issuing body will fail validation at save, prompting the user to update before saving

## [0.4.0] — 2026-04-28

### Added
- Profile page — welcome header personalised with first name, application stats (total, active, pending, offer) with an interactive donut chart and collapsible legend, and a full profile card with collapsible subsections (Summary, Experience, Education, Skills, Languages, Certifications, Awards, Links)
- Profile edit page — section-by-section editing; each card saves independently using a read-merge-write pattern so unedited fields are never overwritten
- `GET /api/profile` and `PUT /api/profile` — SQLite-backed profile persistence; profile stored as a single JSON record
- `server/db/profile.js` — profile repository with UPSERT logic
- `server/routes/profile.js` — `createProfileRouter()` factory matching the existing applications router pattern
- `src/models/profile.js` — `validateProfile`, `normaliseProfile`, `computeAppCounts`, `computeStats`, `STATUS_COLORS`, `STATUS_LABELS`
- `src/components/DonutChart.js` — SVG donut chart with per-segment hover tooltips; Largest Remainder Method for exact integer percentages; degenerate 100% case handled as two arcs to avoid invalid SVG paths
- `src/components/StackedBar.js` — horizontal proportional bar with tap-to-label interaction for mobile
- Responsive chart layout — desktop shows donut + legend, mobile shows stacked bar + tap labels; both always in DOM, toggled via CSS `@media`
- Collapsible profile subsections — expanded on desktop, collapsible on mobile via `.is-collapsed` class toggle
- XSS-safe external link rendering — only `http:`/`https:` hrefs are passed through; `javascript:` and all other schemes fall back to `#`
- `npm run db:seed:profile` — populate the profile table with demo data
- `npm run db:clear:profile` — clear the profile table (returns the profile page to the no-profile state)
- Server integration tests for the profile API (`tests/server/profile.test.js`)
- Page-level tests for the Profile page (`tests/pages/Profile.test.js`)
- Component tests for DonutChart (`tests/components/DonutChart.test.js`)

## [0.3.0] — 2026-04-26

### Added
- Client-side pagination on the application list — visible only when total records exceed 10; 3-page sliding window with first/last anchors and non-clickable ellipsis separators
- Persistent site footer on every page — brand identity, version info, tech stack credits, and feedback links (GitHub Issues)
- `src/utils/pagination.js` — `getPaginationModel()` pure function encapsulating the windowing algorithm
- `src/components/Pagination.js` — page navigation component with full ARIA labelling (`aria-label`, `aria-current="page"`)
- `src/components/Footer.js` — footer component with inline brand SVG, version/stack sections, and feedback links
- `src/assets/` — project logo files (`Alice_White.png`, `Alice_Colored.png`); white variant used in header and footer
- `jsdom` dev dependency for component-level DOM tests
- Page-change behaviour: scrolls to top and moves keyboard focus to the list region
- Page preservation on dataset change: current page retained when still valid; clamped to highest valid page when invalid; reset to 1 when pagination disappears
- Component tests for Pagination and Footer (`tests/components/`)
- `npm run db:seed` — loads 23 demo records covering all 9 statuses (one archived); clears existing data first
- `npm run db:clear` — deletes all rows without touching the schema

### Changed
- Footer and navbar now use `Alice_White.png` logo instead of placeholder SVG/div icons
- Sticky footer layout: `body` uses flex column with `min-height: 100%`; `#app` takes `flex: 1` to push footer to viewport bottom on short pages
- Footer reflows to 2-column grid on viewports narrower than 640 px

## [0.2.0] — 2026-04-26

### Added
- SQLite-backed Express REST API (`server/`) replacing `localStorage` as the persistence layer
- `POST /api/applications` — create an application with full validation (Zod)
- `GET /api/applications` — list all non-archived applications
- `GET /api/applications/:id` — fetch a single application (archived records included)
- `PATCH /api/applications/:id` — partial update with status-change tracking (`lastStatusUpdate` bumped only on actual status change)
- `POST /api/applications/:id/archive` — soft-delete via `archived` flag
- `GET /api/health` — liveness probe
- Shared `STATUS_VALUES` constant (`shared/constants.js`) imported by both frontend and backend
- `src/services/api.js` — fetch-based API client with typed error envelopes (`NETWORK_ERROR`, `VALIDATION_ERROR`, `NOT_FOUND`)
- `npm run db:init` script to initialize or re-initialize the SQLite schema
- `npm run server:dev` / `npm run server:start` scripts
- Integration test suite for all API endpoints (`tests/server/applications.test.js`)
- `makeMemoryDb()` and `makeTestDb()` test helpers for isolated SQLite databases
- GitHub Actions Node.js CI workflow for pushes to `main` and pull requests targeting `main`
- CI test-result generation via `npm run test:ci`, with Vitest JUnit output written under `test-results/vitest/`
- Ignored output directories for local logs and generated test results

### Changed
- Frontend reads (`getAll`, `getById`) and writes (`create`, `update`, `archive`, `fav` toggle) now go through the API instead of `localStorage`
- `src/data/store.js` retained but marked `@deprecated` — no longer the active persistence layer
- Card and modal field references updated to match API names (`jobTitle`, `companyName`, `jobPostingUrl`, `lastStatusUpdate`)
- Lint script now covers `server/` and `shared/` in addition to `src/` and `tests/`
- All system date fields (`createdAt`, `updatedAt`, `lastStatusUpdate`) stored as `YYYY-MM-DD` (date-only)

## [0.1.0] — 2026-04-25

### Added
- Application tracker UI with card-based list view
- Nine-state status workflow (Wishlist, Applied, Phone Screen, Interview, Technical Assessment, Offer, Rejected, Withdrawn, Ghosted)
- Add and edit forms with required-field validation and URL checking
- Full detail modal with all application fields
- Search and status filter
- Compatibility bar (0–100% job match indicator)
- Quick actions per card: star, copy URL, status change, edit
- Local-first `localStorage` persistence
- Centralized data store (`src/data/`)
- Application model and validation rules (`src/models/application.js`)
- CSS design tokens for colors, typography, spacing, and responsive breakpoints
- Vitest test suite for core validation logic
- ESLint v9 configuration

[Unreleased]: https://github.com/reso830/Project_Alice/compare/v1.10.4...HEAD
[1.10.4]: https://github.com/reso830/Project_Alice/compare/v1.10.3...v1.10.4
[1.10.3]: https://github.com/reso830/Project_Alice/compare/v1.10.2...v1.10.3
[1.10.2]: https://github.com/reso830/Project_Alice/compare/v1.10.1...v1.10.2
[1.10.1]: https://github.com/reso830/Project_Alice/compare/v1.10.0...v1.10.1
[1.10.0]: https://github.com/reso830/Project_Alice/compare/v1.9.0...v1.10.0
[1.9.0]: https://github.com/reso830/Project_Alice/compare/v1.8.0...v1.9.0
[1.8.0]: https://github.com/reso830/Project_Alice/compare/v1.7.1...v1.8.0
[1.7.1]: https://github.com/reso830/Project_Alice/compare/v1.7.0...v1.7.1
[1.7.0]: https://github.com/reso830/Project_Alice/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/reso830/Project_Alice/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/reso830/Project_Alice/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/reso830/Project_Alice/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/reso830/Project_Alice/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/reso830/Project_Alice/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/reso830/Project_Alice/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/reso830/Project_Alice/compare/v0.15.0...v1.0.0
[0.15.0]: https://github.com/reso830/Project_Alice/compare/v0.14.0...v0.15.0
[0.14.0]: https://github.com/reso830/Project_Alice/compare/v0.13.3...v0.14.0
[0.13.3]: https://github.com/reso830/Project_Alice/compare/v0.13.2...v0.13.3
[0.13.2]: https://github.com/reso830/Project_Alice/compare/v0.13.1...v0.13.2
[0.13.1]: https://github.com/reso830/Project_Alice/compare/v0.13.0...v0.13.1
[0.13.0]: https://github.com/reso830/Project_Alice/compare/v0.12.0...v0.13.0
[0.12.0]: https://github.com/reso830/Project_Alice/compare/v0.11.1...v0.12.0
[0.11.1]: https://github.com/reso830/Project_Alice/compare/v0.11.0...v0.11.1
[0.11.0]: https://github.com/reso830/Project_Alice/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/reso830/Project_Alice/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/reso830/Project_Alice/compare/v0.8.1...v0.9.0
[0.8.1]: https://github.com/reso830/Project_Alice/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/reso830/Project_Alice/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/reso830/Project_Alice/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/reso830/Project_Alice/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/reso830/Project_Alice/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/reso830/Project_Alice/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/reso830/Project_Alice/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/reso830/Project_Alice/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/reso830/Project_Alice/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/reso830/Project_Alice/releases/tag/v0.1.0
