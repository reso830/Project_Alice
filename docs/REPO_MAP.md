# REPO_MAP.md

## Purpose

This file guides AI-assisted implementation. It is not full documentation; it is a navigation shortcut to reduce unnecessary repo scanning.

Job application tracker. Vanilla JS frontend (Vite), Express backend, SQLite persistence. No framework, no state manager.

**Stack:** Vite 8 · Express 4 · better-sqlite3 · Zod · Vitest

---

## Pages / Screens

| Path | Purpose |
|------|---------|
| `src/pages/Tracker.js` | Main page — card grid, filters, sort, pagination, modal wiring. Feature 039: desktop master-detail workspace at ≥1100px (`matchMedia`) — `.tracker-split` (master list + sticky `.tracker-detail` pane + full-width `.split-pagination`), `_selectedId` selection state, `selectApplication()` routing (pane on desktop, modal below), dirty-switch guard via `Modal.requestClose()`, selection persistence across list re-renders, and modal↔pane breakpoint handoff. Issue #81: `showApplicationLoadError()` now renders the `ErrorPane` component instead of the generic `renderInlineError`, replacing the full-pane text fallback with a contained card |
| `src/pages/Calendar.js` | Calendar page — month-grid view of all Timeline activity; mounts MonthGrid, ActionPanel, MonthPicker, YearPicker, and the shared QuickFiltersStatusPopup; manages nav state and status filter |
| `src/pages/Profile.js` | User profile screen — refreshed overview layout, Archived Applications entry point, Skills meters, and unified Settings card for browser-local AI Settings plus Account controls. Feature 041: when `health.updateSupported`, renders the middle **Updates** Settings sub-group — current version, **Check now**, Connection Error / Update Failed (+ Retry) states, auto-check toggle, and a collapsible update-mode radio picker — hydrating from and polling `/api/update/status` and persisting prefs via `/api/update/settings` |
| `src/pages/ProfileEdit.js` | Profile editor — sticky Save/Cancel, dirty-state tracking, section overlays, first-time Setup gate, existing-profile Import Bar, smart paste/upload import, provenance tags, Undo, and `epfFlash` import highlighting. In demo (feature 020) the resume-import slot renders an inline `.profile-edit__resume-demo-note` ("Resume import is available after signing in.") instead of mounting `ResumeImport` |
| `src/pages/ConfigError.js` | Operator-facing fallback when hosted runtime detects missing Vite env vars |
| `public/404.html` | Issue #93 — standalone, self-contained branded 404 page (no JS bundle dependency, no client router involved). Dark navy full-viewport screen with a one-time "vanishing act" intro (CSS keyframes + inline vanilla JS, gated behind `body.anim`, itself gated behind `prefers-reduced-motion`); without JS the page already renders in its final, fully-revealed state. Self-hosts Sora 400/600/700/800 + DM Mono 400/500 from `public/fonts/` (no external font request). Copied verbatim to `dist/404.html` by Vite's public-dir passthrough; Vercel's static-output convention auto-serves it for unmatched hosted paths, and `server/index.js`'s `serveStatic` fallback serves it (404 status) for unmatched portable/local paths |
| `src/pages/welcome/WelcomePage.js` | Welcome landing page — applies fixed production layout/theme/copy classes plus viewport matchMedia; mounts the hero slideshow on desktop/tablet and tears it down on mobile; `?auth=callback` verification banner handler |
| `src/pages/welcome/HeroSlideshow.js` | 5-scene cycler — auto 8600ms cycle + 700ms cross-fade + click-to-jump dots with per-scene progress bar; reduced-motion → static scene 1 (constellation), no dots |
| `src/pages/welcome/scenes/SceneConstellation.js` · `SceneParse.js` · `ScenePipeline.js` · `SceneMomentum.js` · `SceneDeck.js` · `trackerCard.js` | Five hero scene modules (constellation / paste→parse→card / status pipeline / momentum donut / tracker-card deck), each exporting `{ mount(container, { variant }), unmount() }`; `trackerCard.js` is the shared tracker-card builder used by the pipeline and deck scenes |
| `src/pages/welcome/AuthOverlay.js` | Centered-modal overlay — header (40px Alice mark + title + close), focus trap, ESC/backdrop dismissal, footer with "or" divider + demo button + swap-mode link + signup-only legal copy; `verification_sent` state |
| `src/pages/welcome/LoginForm.js` | Email/password login — neutral error, accessible inline loading |
| `src/pages/welcome/SignupForm.js` | Email/password signup — inline validation, neutral rejection, → `verification_sent` |
| `src/pages/welcome/shared/appMeta.js` | `APP_VERSION` / `ISSUE_URL` / `LICENSE_NAME` / `LICENSE_URL` — single source consumed by both `Footer.js` and the welcome mini footer |
| `src/pages/welcome/demoStub.js` | Shared `enterDemo()` entry point for the portfolio demo — wired by both the welcome CTA and the auth-modal demo button (feature 020). Delegates to `authStore.enterDemo()` |
| `index.html` | Vite entry HTML |

---

## Components

| Path | Purpose |
|------|---------|
| `src/components/Card.js` | Application card (status badge, star, compat score). Archived-card variant (`.card-archived`) collapses the actions row to a single ↺ Unarchive button, prefixes the date-stamp with `Archived`, and renders an "Archived" stamp chip in row 1. Feature 039: third options arg `{ selected }` adds `.card--selected` + `aria-selected="true"` to mark the active card in the desktop master-detail pane |
| `src/components/Modal.js` | Inline-edit detail modal — edit/create modes, draft management, focus trap. Create mode accepts `aiFields`/`fillSource` (feature 035) to render ✦ AI / ⚙ Auto provenance tags, a dismissible fill banner, a reduced-motion-safe one-time flash, a truncation `notice`, and clear-on-edit. Third `archived` mode (selected by `row.archived === true` at open time) is read-only: ARCHIVED chip in header, ↺+✕ action cluster only, body fields inert, no Save/Discard footer, Esc/backdrop/✕ close without confirmation. Feature 037: `open()` accepts a `profile` parameter; skill chips at row 6 are proficiency-coded via `skillProficiency.js`; row 7 embeds `CompatibilityModule` (replaces old `CompatBar` + `compatNotes` textarea). Feature 039: body restructured into five collapsible `OPanel` panels (Overview → Skills → Compatibility → Timeline → Notes & Links; long Responsibilities / General Notes use `ClampText`); `open()` gains `variant: 'modal' \| 'pane'` + `target` for the desktop docked detail pane (non-modal — no backdrop / scroll-lock / focus-trap) and exports `requestClose()` for the Tracker dirty-switch guard |
| `src/components/QuickFiltersToolbar.js` | Full filter + sort toolbar — 8 filter dimensions, sort panel, erase-all. Leading view chip toggles Applications ↔ Archived (popup with unfiltered counts for both views); chip count badge reflects current view's filtered count. View chip carries `aria-busy="true"` during in-flight view transitions (feature 029 FR-005) |
| `src/components/FilterPanel.js` | Filter popup renderer — checklist and range-slider panels; used by QuickFiltersToolbar |
| `src/components/SortPanel.js` | Sort popup renderer — used by QuickFiltersToolbar |
| `src/components/ConfirmDialog.js` | Reusable confirmation dialog (archive, discard) |
| `src/components/DeleteAccountModal.js` | Destructive confirmation modal for account deletion / clear-all-data (feature 030) — mode-aware (`hosted` password gate / `local` typed-`DELETE` gate), inline error, busy state, focus trap; `onConfirm(value)` owns the network call (rejecting `INVALID_PASSWORD` keeps it open) |
| `src/components/Pagination.js` | 3-page sliding window UI |
| `src/components/StatusDropdown.js` | Inline status change control |
| `src/components/Timeline.js` | Application Timeline section for the detail modal — collapsed preview, expanded add/edit/delete rows, inline status picker, and status-change helper |
| `src/components/RangeSlider.js` | Dual-handle range slider (salary, compat) |
| `src/components/Toast.js` | User feedback notifications |
| `src/components/UpdateToast.js` | Update notification toast (feature 041) — `mount({ health, onStatusChange })` (no-op unless `health.updateSupported`); renders available / downloading / installing / failed states bottom-right (desktop) or full-width above the tab bar (mobile), with `aria-live`, a `role="progressbar"` meter, "What's new ↗", Install / Restart actions, and a dismiss control; polls `/api/update/status` during a download and reports status to the nav badges via `onStatusChange` |
| `src/components/Navbar.js` | Top navigation bar — sticky navy band (52px), brand cluster + page nav + identity cluster; email truncated via CSS `max-width` with full value in `title`; door-arrow sign-out button (icon-only at `≤ 639px`); subscribes to `authStore`; `destroy()` unsubscribes. In demo (feature 020) the identity cluster renders a "Demo mode" badge and an Exit demo button that calls `authStore.exitDemo()`. Feature 041: `setUpdateStatus(status)` renders a persistent update badge (`aria-label="Update available"`) on the Profile nav button for available/downloading/ready states |
| `src/components/BottomTabBar.js` | Mobile bottom tab bar (`≤ 639px`) — three tabs (Tracker / Calendar / Profile); same `setActive(page)` contract as Navbar. Feature 041: `setUpdateStatus(status)` mirrors Navbar's persistent update badge on the Profile tab |
| `src/components/Fab.js` | Mobile floating action button — "+ New application" above the bottom tab bar at `≤ 639px`; opens the Create-mode detail modal. Hidden while the Archived view is active |
| `src/components/Footer.js` | Page footer; sources `APP_VERSION` / `ISSUE_URL` / `LICENSE_NAME` / `LICENSE_URL` from `src/pages/welcome/shared/appMeta.js`. Feature 041: `render({ runtime })` adds a mode-aware brand-row control — a **Download** button (latest GitHub release) in hosted/demo, an **Open hosted version ↗** link in local (hidden below `1024px`). Feature 043: 64px vector sigil with version dissolved inline under the tagline, no more STACK section or rule, a GitHub repo-root link ahead of the feedback links, License-column Terms & Conditions / Privacy Policy triggers (`onLegalLink(type)`), a 3-line copyright block with an `alvinresoso.com` link, and a spotlight-and-grid background |
| `src/components/LegalModal.js` | Stateless Terms & Conditions / Privacy Policy dialog renderer (feature 043) — `render(type, onClose)` builds the overlay (centered modal on desktop/tablet, bottom sheet on mobile), injects static copy from `src/data/legalContent.js`, locks body scroll, traps focus, and binds Escape/backdrop/close-button dismissal. Mounted via shell-level `setLegalDialog(type)` state in `src/main.js` (authenticated pages) and `src/pages/welcome/WelcomePage.js` (Welcome/AuthOverlay) |
| `legal/terms.md`, `legal/privacy.md` | Git-tracked source text for the Terms & Conditions and Privacy Policy, at repo root alongside `LICENSE`/`CHANGELOG.md`. Parsed by `src/data/legalMarkdown.js` into the shape `LegalModal.js` renders. Edit these files directly to change the legal copy — do not edit `src/data/legalContent.js`, which just loads and parses them |
| `src/data/legalMarkdown.js` | Dependency-free parser converting the `legal/*.md` convention (`# Title`, `Version:` line, `> Notice:` disclaimer, flat `## ` sections — no nested subsections, no markdown emphasis/links/lists since `LegalModal.js` renders section content as plain `textContent`) into `{ title, version, disclaimer, sections }` |
| `src/components/ResumeImport.js` | Drag-and-drop / paste resume parser; subscribes to `authStore` and hides outside `local-mode` / `authenticated`. Feature 034 adds smart-input mode, AI Settings deep link, ask-first AI-unavailable dialogs with reason codes, explicit basic-parser choice, model-aware LLM calls, and Import Bar integration. Exports `VISIBLE_STATUSES` (feature 020 design-by-contract guard — `'demo'` intentionally excluded). Issue #65: `runParser()` now wraps `extractText()` in the same try/catch as `parseWithLlm()`, so an offline/network failure during text extraction is classified via `mapErrorToReason` and shown in the existing `renderFailureDialog` instead of falling through to the generic inline-error overlay |
| `src/components/JobPostingImport.js` | Paste-only AI job-description parser (feature 035) used by the Add-application gate's Smart entry — processing scrim, recoverable reason-code dialogs with a `Use basic parser` fallback, `NO_TEXT` dead-end, locked "Enable AI in Settings →" affordance when AI is off, and a field-level provenance handoff (`aiFieldSet`/`fillSource`) to the Create modal. Calls `parseJobWithLlm`; gated by `aiSettings.canUseJdParser()` |
| `src/components/CompatBar.js` | Compatibility score visual bar — renders `"{score}% {label}"` with a four-band colour from `getCompatLabel` (036), communicating fit without relying on colour alone. Still used on `Card.js` (tracker list). Replaced in the Application Edit Modal by `CompatibilityModule.js` (037) |
| `src/components/CompatibilityModule.js` | Collapsible Compatibility Insights Panel (037) — score ring SVG, tier-coloured verdict pill, proficiency-coded skill chips with legend, and AI-generated notes with `none`/`generating`/`fresh`/`stale`/`error` freshness states and a `no-profile` unavailable state. Standalone; Modal.js only calls `render()`. Orchestrates `compatNotesService.generateNotes` + `api.saveCompatNotes` on user action. Feature 039: `render({ embedded: true })` drops its own toggle/wash-box so the host `OPanel` owns collapse; `renderCollapsedPreview()` supplies the panel's mini-ring preview |
| `src/components/OPanel.js` | Collapsible panel shell (039) — `OPanel({ icon, title, tone, open, onToggle, preview, children })` → `.panel.panel--elevated` with a `role="button"` header (Enter/Space toggle, `aria-expanded`); renders `children` when open else `preview`; `tone:'ai'` adds `.panel-ai`. The `.sec-toggle` chevron is decorative (`aria-hidden`, `tabindex=-1`). Used for the five Application Details panels |
| `src/components/EmptyPane.js` | "Nothing open yet" placeholder (039) for the desktop docked detail pane — layered-cards illustration + cursor + invitation copy, no CTA. Rendered by `Tracker.js` when no application is selected |
| `src/components/PaneLoading.js` | Spinner + "Loading application details…" message (#109) shown in the desktop docked detail pane between an optimistic card selection and the `api.getById()` response landing or failing; replaced by the real pane content on success or `EmptyPane` on failure |
| `src/components/ErrorPane.js` | Issue #81 — contained error-state card (icon + `error-pane-icon.svg`, "ERROR · &lt;code&gt;" status badge, title, copy, "Try again" button, muted hint) mirroring `EmptyPane`'s layout convention. `render({ title, message, onRetry, retryLabel, code })` returns a detached element; used by `Tracker.js`'s `showApplicationLoadError()` in place of the generic `renderInlineError` |
| `src/components/DonutChart.js` | SVG donut chart with per-segment hover tooltips (Profile page) |
| `src/components/StackedBar.js` | Horizontal proportional bar for mobile stats (Profile page) |
| `src/components/calendar/MonthGrid.js` | Month-grid calendar — 7-column layout with day cells showing timeline event dots; keyboard-selectable cells (Enter/Space); chips decorative; cell selection drives the inline DayPanel below the grid |
| `src/components/calendar/ActionPanel.js` | Calendar right-panel — Today section, Suggested Actions (5 rule-based kinds), Upcoming section; Mark Ghosted from suggestion rows; local dismissals (with "Suggestion dismissed" toast); collapsible summary bar at `<1200px` stacked layouts |
| `src/components/calendar/DayPanel.js` | Inline Day Details Panel (v2) — sits below the Month Grid in the same card; renders prompt/empty/populated state for the selected date; replaces the retired DayPopover |
| `src/components/calendar/MonthPicker.js` | Month picker dropdown — 12-month grid anchored to the nav chevron |
| `src/components/calendar/YearPicker.js` | Year picker dropdown — scrollable year list anchored to the nav chevron |
| `src/components/QuickFiltersStatusPopup.js` | Shared status filter popup used by Tracker quick filters and Calendar status filtering |
| `src/components/calendar/anchoredDropdown.js` | `mountAnchoredDropdown({ anchorEl, contentEl, align, asBottomSheet, scrim, ariaLabel, onClose })` — shared primitive; handles positioning, outside-click/Esc dismiss, `bsIn` animation for bottom-sheet mode |

---

## Data / Models

| Path | Purpose |
|------|---------|
| `src/models/application.js` | Client-side field validation + `STATUS_CONFIG` (colors, labels per status) · `SHIFT_VALUES` · `WORK_SETUP_VALUES` · `normalizeApplication()` · TimelineEntry helpers · `applyStatusChange(app, status, options)` · `STATUS_DISPLAY_PRIORITY` · `TERMINAL_STATES` |
| `src/models/profile.js` | Profile validation, normalisation, stat computation, `PROFICIENCY_LEVELS` (language enum). Feature 031: structured skills (`{ name, level }`) with the 1–5 proficiency scale (`SKILL_LEVELS`, `SKILL_FLAVOR`, `SKILL_MAX`, `getSkillLabel`); `normaliseSkillEntry` migrates legacy `string[]` → level 2 and coerces/validates levels; `mergeResumeData` imports skills unrated. Feature 032: `splitProfileForStorage` / `joinProfileWithSkills` (split skills out of / reassemble skills into the profile document) and `skillNameKey` / `dedupeSkillsForStorage` (case-insensitive dedup + blank-drop, reused by `validateProfile`, `DUPLICATE_KEYS`, and both persistence adapters) |
| `src/models/compatibility.js` | Deterministic compatibility engine (036) — pure `computeCompatibility(profile, application, { asOf })` → `{ score, label }`; `COMPAT_WEIGHTS` (skills 43 / roleAlignment 25 / experience 12 / keywords 10 / certifications 10), pooled weighted skill coverage, `COMPAT_BANDS`, `getCompatLabel`, `derivedYears`. No I/O, no `Math.random`, no clock read — time enters only via the caller-supplied `asOf`. Shared by the server service, the demo store, and `CompatBar` |
| `shared/constants.js` | `STATUS_VALUES` — 10 status strings shared between frontend and backend |
| `shared/util/date.js` | `isValidISODate(value)` — round-trip parse that rejects impossible dates like `2030-02-30`. Re-exported by `src/utils/date.js` for the client (form/timeline) and imported by `server/middleware/requestDate.js` for server-side `X-Client-Date` validation (#43) |
| `shared/startupLoader.js` | `stripStartupLoaderMarkup(html)` + the `STARTUP_LOADER_START_MARKER`/`STARTUP_LOADER_END_MARKER` HTML comment markers (feature 044/WS1) — single source used by both `server/index.js` (portable's `serveStatic` catch-all) and `vite.config.js` (the `stripStartupLoaderInDev` plugin) to strip the inlined hosted-only loader block from `index.html` for every non-hosted serving path |

**Application fields (required):** `jobTitle`, `companyName`, `status`, `lastStatusUpdate`, `responsibilities`

**Application fields (optional):** `compat` (0–100, **server-computed** since 036 — not client-writable), `compatScoredAt` (ISO timestamp, **server-set** since 037 — stamped on every score computation), `compatAnalysis` (`CompatNotes | null`, **written only by the notes route** since 037 — not client-writable via PATCH), `minYearsExperience` (036; non-negative integer or null), `skills[]`, `preferredSkills[]`, `fav` (starred), `jobPostingUrl`, `recruiter`, `salary`, `location`, `shift`, `workSetup`, `generalNotes`

**Status values:** `wishlisted → applied → phone_screen → interview → assessment → offer → accepted / rejected / withdrawn / ghosted`

---

## Backend / API

| Path | Purpose |
|------|---------|
| `server/index.js` | Express app factory `createApp({ repositories, config, requireAuth?, seedHostedUserIfNeeded?, onShutdown?, serveStatic?, distDir?, portableRuntime? })`; `GET /api/health` returns `createHealthPayload(runtime, { portableRuntime })` → `{ status, runtime, version, updateSupported }`; `logBoot()`. CLI boot block lazy-imports the seed middleware in hosted mode only. Feature 040: opt-in `serveStatic` (default off) registers `express.static(distDir)` + an SPA fallback for non-`/api` GETs after the routers — used only by the portable bootstrap; hosted/dev are byte-for-byte unchanged. Feature 041: mounts `/api/update` (the update router) only when `portableRuntime:true` is injected by `server/portable.js` after `Start-Alice.cmd` passes its launcher marker, and remains gated by `runtime === 'local' && process.platform === 'win32'`, threading the `onShutdown` callback through. Issue #93: the `serveStatic` fallback now splits into an explicit `GET /` route (still `index.html`, 200) and a catch-all that returns `distDir/404.html` with a real `404` status for every other unmatched non-`/api` GET path — no more silent 200-to-shell for unknown paths |
| `api/index.js` | Vercel serverless entry — lazy-imports the seed middleware in hosted mode; passes `config` + dispatcher + seed middleware into `createApp` |
| `server/portable.js` | Portable/local launcher entry (feature 040) — exported `run({ root, open, probe, launchedByLauncher })`; resolves the package root, then the **single-instance check**: feature 041 replaces 040's port-only probe with `checkLock()` against `data/alice.lock` (per-install PID + bound port, stale-lock liveness), so the same install is detected regardless of which port it fell back to; if active, opens the browser to the running port and exits. Otherwise sets `APP_RUNTIME=local` + `ALICE_DB_PATH` + `ALICE_CONFIG_DIR`, **dynamically** imports `config.js`/`repositories`/`index.js`, builds the app with `serveStatic:true`, `portableRuntime` only when `Start-Alice.cmd` passed the launcher marker, and an `onShutdown` callback (closes the listener + DB then exits), binds `127.0.0.1` via `listenWithFallback`, `writeLock(port)`, opens the browser, logs to `logs/alice.log`, and removes the lock + stops cleanly on `SIGINT`/`SIGTERM` |
| `server/portable/settings.js` | `readLaunchSettings(configDir)` (feature 040) — reads `config/settings.json` → `{ port, openBrowser }`; defaults `3001`/`true`; missing/malformed/non-object/out-of-range degrade to defaults with a warning, never throws. Feature 041: adds `readUpdateSettings` / `writeUpdateSettings` (merge-preserving `port`/`openBrowser`) and `validateUpdateSettings` for `autoCheckUpdates` (boolean) + `updateMode` (`notify`\|`ask`; `auto` normalizes to `ask` on read and is rejected on write after #85) |
| `server/portable/lock.js` | Single-instance lockfile manager (feature 041; atomic acquisition hardened in #88) — `acquireLock({ dataDir, port, probe })` atomically claims `data/alice.lock` (`{ version, pid, port, appVersion, launchTime, pending }`) with an exclusive-create (`wx`/`O_EXCL`) write, taking over a stale lock and returning `{ acquired }` so a racing second launch loses; `writeLock(port, { dataDir })` finalizes the real bound port; `checkLock({ dataDir, probe })` validates the recorded PID is alive (`process.kill(pid,0)`, EPERM = alive) **and** the port answers `/api/health`, removing stale locks; `removeLock({ dataDir, pid })` is owner-safe (only deletes when the PID matches, unless `force`). Node-native only |
| `server/portable/listen.js` | `listenWithFallback(app, { host, port, maxTries })` (feature 040) — binds the given localhost host; on `EADDRINUSE` increments the port (bounded) and retries; resolves `{ server, port }` or rejects after exhausting tries |
| `server/health.js` | `createHealthPayload(runtime, { portableRuntime })` (feature 041) → `{ status:'ok', runtime, version: APP_VERSION, updateSupported }` where `updateSupported` (via `isPortableUpdateRuntime(runtime, { portableRuntime })`) is true only under the portable Windows launcher loop — `portableRuntime:true` injected after the `Start-Alice.cmd` launcher marker, plus local + win32 guards; a plain `node`/source checkout or direct `node app/server/portable.js` boot on Windows is *not* update-supported and `/api/update` is not mounted. `assertHostedSchema(config, { logger? })` — hosted-mode boot check; PostgREST sentinel probes against `applications` (including `applications.timeline`, `applications.min_years_experience` (036), `applications.compat_analysis` (037), `applications.compat_scored_at` (037)), `profile`, `profile_skill` (032), and `user_seed_state`; throws on `42703` / `42P01` (migration not applied); soft-warns on transient errors |
| `server/routes/applications.js` | CRUD route handlers — accepts `{ repos, requireAuth?, seedHostedUserIfNeeded? }`; uses `attachRepos(repos)` to populate `req.repos`; all handlers `async` with `await` on every repo call (Supabase adapter returns Promises). `GET /` accepts `?view=archived` (strict scalar equality; unknown values fall back to active). `POST /:id/unarchive` mirrors archive. On create/update, computes the server-authoritative `compat` from the current profile via `server/services/compatibility.js` (036; any client-supplied `compat` is ignored). Feature 037: create always stamps `compatScoredAt`; update stamps only when compat-relevant fields (`skills`, `preferredSkills`, `responsibilities`, `jobTitle`, `minYearsExperience`) are present in the body. New `POST /:id/compat-notes` accepts `{ summary, body }` from the client, validates, adds `generatedAt`, persists to `compat_analysis` |
| `server/routes/profile.js` | Profile route handlers — same `{ repos, requireAuth, seedHostedUserIfNeeded }` shape. On `PUT /`, after upsert calls `recomputeActive` (036) to rescore all active applications against the saved profile (archived frozen) |
| `server/services/compatibility.js` | Server-authoritative compatibility orchestration (036) — `scoreApplication(appFields, profile, asOf)` (delegates to the pure `src/models/compatibility.js`) and `recomputeActive(repos, profile, asOf)` (rescores active applications via `getAll()`, persisting only changed `compat`). Depends only on the injected `{ applications, profile }` repos + the pure module. Feature 037: `recomputeActive` now stamps `compatScoredAt` on every score-computation attempt (not only on value change) so notes go stale even when a compat-relevant edit leaves the score numerically identical |
| `server/routes/resume.js` | Resume parse + extract handlers — `{ requireAuth, seedHostedUserIfNeeded }`; doesn't consume repos but mounts seed so a hosted user's first action via resume upload still seeds. `POST /parse` accepts a multipart file **or** a JSON `{ text }` body (rule-based, feature 033); `POST /extract` (033) returns `{ data: { text } }` raw extracted text — stateless, memory-only, no persistence — for the browser-direct LLM path |
| `server/routes/account.js` | `DELETE /api/account` (feature 030) — `{ repos, requireAuth? }`; calls the uniform `req.repos.account.delete(body)` and maps typed adapter errors (`VALIDATION_ERROR` 400 / `INVALID_PASSWORD` 401) to responses. Intentionally mounts **no** `seedHostedUserIfNeeded` (no re-seed on the delete path) |
| `server/routes/update.js` | Self-update router (feature 041) — `createUpdateRouter({ repos, onShutdown, dataDir?, configDir? })`; mounted only on local Windows. `GET /check` proxies GitHub Releases (or `ALICE_UPDATE_SOURCE_OVERRIDE`) with `v`-tolerant SemVer compare + 1h in-memory cache; `POST /download` stages the release ZIP + `.sha256` to `data/update-staging/`, verifies the checksum, and extracts; `GET /status` reports the download/staging state machine; `POST /restart` writes `data/update-pending.json` and delegates a clean shutdown via `onShutdown`; `GET`/`POST /settings` read/write `autoCheckUpdates` + `updateMode` in `config/settings.json`. Exports pure helpers `normalizeVersion` / `compareVersions` / `isNewerVersion` / `sha256File` / `verifyChecksum` |
| `server/auth/middleware.js` | `createRequireAuth({ jwksUri, jwks?, logger })` — verifies Supabase JWTs against the project's JWKS endpoint (`['ES256', 'RS256']` algorithm allowlist) via `jose.jwtVerify`; categorized rejection logging (token contents never logged) |
| `server/auth/seedHostedUser.js` | `seedHostedUserIfNeeded(req, res, next)` — async middleware; reuses `req.supabase` from `attachRepos`/the hosted dispatcher when available, then calls `client.rpc('claim_and_seed_starter')`; the RPC atomically claims the per-user seed marker and inserts 2 starter applications in one Postgres transaction (idempotent, race-safe, deletion-survivable per FR-014) |
| `server/repositories/index.js` | `createRepositories(config)` returns uniform `{ forRequest(req) }` across `local` and `hosted` runtimes. Hosted lazy-imports the Supabase modules, constructs one per-request Supabase client, and stores it on `req.supabase` for downstream hosted middleware; local never loads `@supabase/supabase-js`. Each bundle includes `applications`, `profile`, and `account` (feature 030) |
| `server/repositories/middleware.js` | `attachRepos(dispatcher)` — Express middleware factory that sets `req.repos = dispatcher.forRequest(req)`; mounted after `requireAuth` in every protected router |
| `server/middleware/requestDate.js` | `resolveRequestDate(req)` — derives the user's local `YYYY-MM-DD` from the `X-Client-Date` request header (regex-validated); falls back to UTC `currentDate()` when the header is missing/malformed (#43) |
| `server/repositories/applications.js` | `createSqliteApplicationsRepository(db)` — local SQLite adapter. `create/update/archive/unarchive` accept an optional `now` (YYYY-MM-DD) which the router supplies via `resolveRequestDate(req)` to stamp audit columns in the user's local timezone (#43). Also exposes `getAllArchived` (returns rows where `archived = 1` in `created_at DESC` order) |
| `server/repositories/profile.js` | `createSqliteProfileRepository(db)` — local SQLite adapter |
| `server/repositories/supabase/client.js` | `createSupabaseClientForRequest(req)` — per-request anon-key Supabase client initialized with the caller's JWT; never reads `SUPABASE_SERVICE_ROLE_KEY` |
| `server/repositories/supabase/applications.js` | `createSupabaseApplicationsRepository(client, userId)` — hosted adapter. RLS-scoped reads/writes via PostgREST; `normalizeForPostgres()` helper coerces SQLite-shaped int booleans + JSON strings to Postgres `bool`/`jsonb` before any write. `archive`/`unarchive` use atomic conditional UPDATE with `.eq('archived', <opposite>)` predicate + fallback `getById` on the no-op path — race-free idempotency symmetric with the SQLite adapter. `getAllArchived` filters `.eq('archived', true)` |
| `server/repositories/supabase/profile.js` | `createSupabaseProfileRepository(client, userId)` — hosted adapter; one-row-per-user `profile` doc + per-user `profile_skill` rows (032). `get` reads the doc then ordered skill rows and reassembles `{ name, level }`; `upsert` and the lazy on-read migration write atomically via the `save_profile_with_skills(p_data, p_skills)` RPC |
| `server/repositories/supabase/account.js` | `createSupabaseAccountRepository({ userId, email })` (feature 030) — hosted `delete(body)`: re-verifies `body.password` via a throwaway anon `signInWithPassword`, then service-role `admin.deleteUser(userId)` (cascade clears the user's rows). Lazy-imports `@supabase/supabase-js` + `adminClient.js` inside `delete()`; password never logged |
| `server/repositories/supabase/adminClient.js` | `createSupabaseAdminClient()` (feature 030) — service-role Supabase client (bypasses RLS; can call the GoTrue Admin API). **Server-only**, lazy-imported on the delete path; never reaches the Vite bundle |
| `server/repositories/account.js` | `createSqliteAccountRepository(db)` (feature 030) — local `delete(body)`: requires `body.confirm === 'DELETE'` (else `VALIDATION_ERROR`), then clears all `applications` + `profile` rows in a single transaction. No re-seed |
| `server/db/applications.js` | SQL query layer for SQLite (re-exports `toRow`/`toRecord` from columns.js for backward compat with foundation.test.js) |
| `server/db/profile.js` | SQL query layer for SQLite profile (`getProfile` / `saveProfile`). Feature 032: skills persist as `profile_skill` rows — `saveProfile` splits skills out of the document and replaces rows inside a transaction; `getProfile` reads ordered rows and reassembles, lazily migrating any still-embedded `skills` on first read (non-skill document preserved verbatim) |
| `server/db/columns.js` | Pure data-layer helpers shared by SQLite + Supabase adapters — `FIELD_TO_COLUMN`, `toRow`, `toRecord`, `currentDate` (UTC fallback, see #43), `APPLICATION_COLUMNS_WITHOUT_USER_ID`, `PROFILE_COLUMNS_WITHOUT_USER_ID`, including `timeline` JSON mapping and read-only `archived_date` projection (`archivedDate` is deliberately absent from `FIELD_TO_COLUMN` — server-set only, dropped from any client PATCH). Feature 037: adds `compatAnalysis` (JSON-serialised in `toRow`/`toRecord`) and `compatScoredAt` mappings. MUST NOT import `db.js` (would trigger SQLite load in hosted cold start) |
| `server/db.js` | SQLite connection and schema creation; `ADDITIVE_COLUMNS` is the shared source for in-place column adds and backup pending-work checks (e.g. `archived`, `timeline`, `archived_date`, `min_years_experience` (036)). Feature 032: creates the `profile_skill` table (one row per profile skill) with a per-profile index and a case-insensitive unique index on `(profile_id, lower(skill_name))`. Feature 036: `initSchema` runs an idempotent `backfillCompatibility` after the column adds — rescores every application row (active + archived) against the current profile and writes only changed `compat` (injectable `compatBackfillAsOf`). Feature 041: `initSchema` wraps the full schema mutation region in `runWithBackup` for local on-disk DBs when migration or additive-column work is pending; success deletes `.migration-backup`, failure restores it and rethrows |
| `server/db/migration.js` | Greenfield SQLite migration subsystem (feature 041) — `runMigrations(db, { migrations })` creates the `schema_migrations` ledger, baselines pre-041 databases (existing `applications`/`profile` tables but no ledger → mark `001-init` applied), runs unapplied migrations sequentially inside a transaction (logging each to the ledger), and throws a downgrade gate when the ledger holds an unknown future migration. `pendingMigrationIds(db, { migrations })` performs a read-only pending-work probe for the local DB backup gate. `discoverMigrationScripts(dir)` lists numbered `NNN-*.js` scripts |
| `server/db/migrations/001-init.js` | First migration (feature 041) — the relocated base schema (`applications`, `profile`, `profile_skill` + indexes) as an idempotent `up(db)` using `CREATE TABLE IF NOT EXISTS`. Exported as `{ id: '001-init', up }` |
| `server/validation/application.js` | Zod schemas for request validation |
| `server/db-seed.js` | Load 23 demo records (local SQLite only); imports `DEMO_RECORDS` from `server/seeds/applicationsData.js` |
| `server/db-init.js` | Standalone schema init script (local SQLite only) |
| `server/seeds/applicationsData.js` | Side-effect-free module exporting `DEMO_RECORDS` (23 records in SQLite storage shape); consumed by `db-seed.js` and by the demo-store parity test |
| `server/seeds/profileData.js` | Side-effect-free module exporting `DEMO_PROFILE` (frontend shape); consumed by `db-seed-profile.js` and the demo-store parity test |

**API proxy:** Vite dev server proxies `/api/*` → Express on port 3001.

---

## Build / Release

| Path | Purpose |
|------|---------|
| `Start-Alice-Dev.cmd` | Local dev launcher entry (issue #64) — double-clickable in File Explorer; a thin `@echo off` wrapper that invokes `scripts/Start-Alice-Dev.ps1` under `powershell.exe -NoProfile -ExecutionPolicy Bypass`, forwarding any args and its exit code |
| `scripts/Start-Alice-Dev.ps1` | Backing script for `Start-Alice-Dev.cmd` and `npm run alice` (issue #64) — starts the backend (`npm run server:dev`, always local) and frontend (`npm run dev`) together in one terminal with interleaved labelled output. Keeps the frontend local **non-destructively**: it launches the Vite child with `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` cleared (a value already in the child env wins over Vite's `.env` files), so a stale `.env.local` can't flip the UI into hosted-auth mode — no file is moved or renamed. Teardown is OS-guaranteed: children are assigned to a Win32 job object (`KILL_ON_JOB_CLOSE`, via `Add-Type` P/Invoke) so the whole tree dies when the launcher exits for any reason — Ctrl+C, hard window close (where `finally` never runs), or crash — while the `finally` still handles the clean Ctrl+C path. Runs under Windows PowerShell 5.1 (uses `ProcessStartInfo.Arguments`, not `.ArgumentList`, which 5.1 lacks). `npm.cmd` is launched via `cmd.exe /d /s /c` — `CreateProcess` cannot execute `.cmd`/`.bat` batch files directly. `-PrepareOnly` prints the frontend overrides and exits; `-SelfTest` drives real short-lived processes through the start path (node arg passing + env override + job assignment, and a `npm --version` run through the same `cmd.exe` batch-file path the dev servers use) for tests; `-ProjectRoot` overrides the repo root |
| `scripts/build-portable.mjs` | `npm run build:portable` (feature 040) — Windows-only. Builds the frontend (`--mode portable`), stages the standardized `alice/{app,runtime,data,config,logs}` layout, bundles a pinned official `node-win-x64` runtime (verified vs the official `SHASUMS256`, with an ABI-matched `better-sqlite3` and a DB-open smoke), writes the `VERSION` marker, prunes dev deps, then emits `alice-v<version>-win-x64.zip` + a `.sha256` checksum under `portable-dist/`. Node built-ins + `Compress-Archive` only — no new dependency |
| `scripts/portable/Start-Alice.cmd` | Portable launcher template (feature 040) — checks `runtime\node.exe` exists, runs `app\server\portable.js --alice-launcher` so the server can safely advertise self-update only under the swap-capable launcher loop, keeps the console window open ("close to stop"), and surfaces a clear error + `pause` on a missing runtime or non-zero `errorlevel`. Feature 041: a `:run` loop applies a staged update on launch (or after the node process exits) — if `data\update-staging\alice` exists, mirrors `app\` + `runtime\` via robocopy, swaps the launcher itself last, and reboots the new version |
| `config/settings.default.json` | Default portable launch settings (feature 040) — `{ "port": 3001, "openBrowser": true }`; copied to `config/settings.json` in the package |
| `.github/workflows/release-portable.yml` | Release workflow (feature 040) — `windows-latest`; `npm ci` → `npm run build:portable` → attaches the ZIP + `.sha256` to the GitHub Release. Triggers **only** on a `v*` tag or `workflow_dispatch` (never on per-feature pushes/PRs) |
| `.github/workflows/node-ci.yml` | CI — lint, build (stub Supabase env), and `test:ci` on Node 20.x/22.x for pushes/PRs to `main` |

---

## Utilities / Shared

| Path | Purpose |
|------|---------|
| `src/services/api.js` | Fetch wrapper for all `/api/*` calls; auto-attaches `Authorization: Bearer <token>` when `authStore.getAccessToken()` returns one; in demo, every export short-circuits to `src/data/demoStore.js` and never calls `fetch`. `getAll({ view })` accepts an optional `view: 'archived'` to fetch the archived list; `unarchive(id)` mirrors `archive(id)`. `deleteAccount(payload)` issues `DELETE /api/account` (feature 030); `request()` fires `authStore.handleAuthFailure()` on a 401/404/500 of an authenticated request |
| `src/services/resumeApi.js` | Resume client — same auth-header + demo-guard behavior as `api.js`; `parseResume(file)` (multipart) and, for feature 033, `extractText(file)` (→ `POST /api/resume/extract`, returns raw text) and `parseText(text)` (→ `POST /api/resume/parse` JSON, rule-based). Never references the OpenRouter key |
| `src/services/aiErrors.js` | Shared AI error utilities (038) — `createLlmError(code, message, status?)` and `mapErrorToReason(errorOrStatus)` are the single source for standardized AI reason mapping (`timeout`, `network`, `invalid_key`, `quota`, `rate_limit`, `bad_request`, `server`, `NO_TEXT`). Issue #65: `mapErrorToReason` also recognizes `resumeApi.js`'s `NETWORK_ERROR` code (not just the LLM provider's `LLM_NETWORK_ERROR`), so backend-connectivity failures during resume-text extraction map to `network` too |
| `src/services/aiProvider.js` | AI provider registry (038) — plain-object provider map, active provider slug, `getActiveProvider()`, `setActiveProvider(slug)`, and `resolveProvider(slug)`; v1 registers OpenRouter only and has no `aiSettings.js` dependency |
| `src/services/aiService.js` | Public AI service facade (038) — delegates `complete(params)` and `validateKey(key)` to the active provider, exposes `DEFAULT_MODEL`, `REASON_CODES`, `createLlmError`, and `mapErrorToReason`; feature code should use this boundary instead of provider modules |
| `src/services/providers/` | AI provider implementations (038); each file exports one named aggregate provider object matching `contracts/provider.md` (`defaultModel`, `complete`, `validateKey`) |
| `src/services/providers/openrouter.js` | OpenRouter provider (038) — absorbs the removed `llmClient.js` transport, owns OpenRouter endpoints/request shape, `LLM_TIMEOUT_MS` (30s), `MAX_INPUT_CHARS`, assistant JSON parsing, and key validation via auth-enforcing `/api/v1/key` |
| `src/services/llmClient.js` | Removed in 038 — legacy shared OpenRouter transport replaced by `src/services/providers/openrouter.js` + `src/services/aiService.js` |
| `src/services/llmParser.js` | Resume and job-posting AI parsing — `parseWithLlm(text, key, model)` (resume → profile) and `parseJobWithLlm(text, key, model)` (feature 035; job posting → application draft validated through the application model), both → `{ draft, truncated }` via `aiService.complete({ userContent, ... })`; re-exports `DEFAULT_MODEL`, `REASON_CODES`, and `mapErrorToReason` for component compatibility |
| `src/services/compatNotesService.js` | Compatibility notes generation (037/038) — `generateNotes(application, profile, aiSettings)` builds a system + user prompt (score, resolved skill matches, JD fields, profile fields), calls `aiService.complete`, parses the JSON response `{ summary, body }`, truncates `summary` to 34 chars if needed |
| `src/data/legalContent.js` | Static Terms & Conditions / Privacy Policy content (feature 043) — exports `TERMS_AND_CONDITIONS` / `PRIVACY_POLICY`, each `{ title, version, disclaimer, sections: [{ title, content }] }`; consumed by `src/components/LegalModal.js` |
| `src/data/aiSettings.js` | browser-only AI Settings store (feature 034) — `localStorage`-backed enabled flag, OpenRouter key, model slug, feature toggles, and derived connection status. Exposes `canUseJdParser()` (feature 035 gate: master enabled + `jd` feature + key). Lazily migrates feature 033 key/consent into the new shape; consent is folded into saving a key while compatibility shims remain for old callers |
| `src/data/updateController.js` | Portable self-update controller (feature 041 hardening) — singleton owner for update settings cache, ref-counted status polling, restart-health polling, version matching, auto-check scheduling, `/api/update/*` command actions, and store publishing. `UpdateToast.js` and Profile's Updates panel subscribe/render from `updateStatusStore.js`; tests reset with `resetUpdateControllerForTesting()` |
| `src/services/supabaseClient.js` | Supabase JS client wrapper; reads `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AUTH_EMAIL_REDIRECT_URL`; exports `isHostedAuthAvailable` |
| `src/services/healthApi.js` | `getHealth()` — standalone fetcher returning raw `{ status, runtime }` (does not unwrap `data`) |
| `src/data/authStore.js` | Module-state subscribable auth store — `init`, `subscribe`, `getAuthState`, `getAccessToken`, `signOut`, `enterDemo`, `exitDemo`, `DEMO_STATUS`; states `initializing | local-mode | unauthenticated | authenticated | demo`. `init()` has no demo restore path — refresh always ends the demo (feature 020). Feature 030 adds `handleAuthFailure()` (revalidates via `getUser()` and signs out a deleted account) plus a one-shot reroute-notice carrier `setAuthNotice(message, type)` / `consumeAuthNotice()` (`ACCOUNT_DELETED_NOTICE`) surfaced by `main.js` on the Welcome reroute |
| `src/data/demoStore.js` | In-memory portfolio-demo data adapter (feature 020) — `loadSeed`, `clear`, `getAll`, `getAllArchived`, `getById`, `create`, `update`, `archive`, `unarchive`, `getProfile`, `saveProfile`. Reads deep-clone; `archive` flips `archived` + sets `archivedDate` (does NOT remove the row); `unarchive` mirrors. Validation reuses `src/models/application.js` + `src/models/profile.js`; no `localStorage`, `sessionStorage`, `IndexedDB`, or `fetch`. Feature 036: `create`/`update` compute `compat` via the shared module (fixed `DEMO_COMPAT_AS_OF`); `saveProfile` recomputes active rows (archived frozen) — server parity client-side |
| `src/data/demoSeed.js` | Demo seed fixture (feature 020) — `buildDemoSeed()` returns `{ applications, profile }` with 23 active SQLite seed records plus 2 client-only archived rows (one favorited non-terminal, one terminal-status unfavorited) translated to frontend shape and dates shifted so the most recent `lastStatusUpdate` anchors to today; profile biographical dates static |
| `src/utils/filterSort.js` | Client-side filter + sort logic (all 8 filter dimensions) |
| `src/utils/currency.js` | `parseSalaryInput`, `formatSalaryDisplay` — peso salary formatting |
| `src/utils/pagination.js` | Pagination state model |
| `src/utils/date.js` | Date formatting helpers |
| `src/utils/dom.js` | DOM utility helpers |
| `src/utils/icons.js` | SVG icon markup helpers |
| `src/utils/sort.js` | `sortEducation`, `sortExperience` — profile entry sorting |
| `src/utils/url.js` | `getSafeExternalHref` — safe external link handling |
| `src/utils/clampText.js` | `createClampText(value, { lines, mlines, className })` (039) — read-only line-clamp display with a Show more / Show less toggle that appears only when the text overflows (`scrollHeight − clientHeight > 2`). Drives Responsibilities (2/4) and General Notes (3/3) in the overlay |
| `src/utils/skillProficiency.js` | Pure proficiency resolution (037) — `resolveSkillLevel(skillName, profileSkills)` → `'proficient'` (level ≥ 3) / `'learning'` (level < 3) / `'missing'`; `resolveSkillMatches(names, profileSkills)` → `SkillMatch[]`. Normalises names (trim/lowercase/collapse-spaces) for matching. No I/O |
| `src/utils/validate.js` | `validateRequired`, `validateMonthYear`, `validateUrl`, `validateEmail` |
| `src/utils/calendar.js` | Date math helpers for the Calendar page — week-start offset, day-of-week index, ISO week number, month boundary helpers |
| `src/utils/calendarProjection.js` | `projectCalendarMonth(apps, year, month)` — maps application Timeline entries onto a month grid; returns `{ days, eventsByDate }` |
| `src/utils/calendarSuggestions.js` | `evaluateSuggestions(apps, todayISO, dismissals)` — 5 rule-based suggestion kinds: `followup`, `feedback`, `interview_followup`, `offer_expiry`, `ghost`; skips terminal-state apps and apps with future entries |
| `src/utils/calendarDismissals.js` | In-memory dismissal store for Calendar Suggested Actions; `dismiss(key)`, `isDismissed(key)`, `clearAll()` — never touches localStorage (feature 020 FR-004) |
| `src/utils/asyncUI.js` | Shared client-side loading + async-state utilities — `bindBusyButton`, `bindContainerBusy`, `renderInlineError`. Used by Modal, Card, CreationPicker, ResumeImport, StatusDropdown, Tracker, Calendar, Profile, ProfileEdit (feature 029) |
| `src/utils/skeletons.js` | Shared DOM-factory builders for loading skeletons — `buildApplicationListSkeleton`, `buildProfileSkeleton`, `buildCalendarSkeleton`, `buildProfileEditSkeleton`, `buildProfileAppsSkeleton` (feature 029); `buildTrackerBootSkeleton` (feature 044/WS3) — same card shape as `buildApplicationListSkeleton`, distinct class/label, used for the signed-in boot handoff in `main.js` and as the generic workspace placeholder while `navigate()` dynamic-imports `Calendar`/`Profile`/`ProfileEdit` (WS4) |
| `src/styles/main.css` | Global styles and CSS design tokens |

---

## Tests

| Path | Purpose |
|------|---------|
| `tests/models/` | Application field validation, status transitions |
| `tests/models/timeline.test.js` | TimelineEntry model helper tests — id allocation, sorting, and legacy synthesis |
| `tests/utils/` | filterSort, pagination, date utilities |
| `tests/utils/calendar.test.js` | Calendar date math helpers |
| `tests/utils/calendarProjection.test.js` | `projectCalendarMonth` — event mapping, boundary cases, empty months |
| `tests/utils/calendarSuggestions.test.js` | `evaluateSuggestions` — all 5 rule kinds, terminal/future-entry guards, dismissal filtering |
| `tests/utils/calendarDismissals.test.js` | In-memory dismissal store — dismiss, isDismissed, clearAll |
| `tests/components/` | Component render / DOM behavior (jsdom) |
| `tests/components/Timeline.test.js` | Timeline component DOM behavior — collapsed/expanded states, add/edit/delete, picker, and sorting interactions |
| `tests/components/calendar/anchoredDropdown.test.js` | `mountAnchoredDropdown` — positioning, outside-click/Esc dismiss, bottom-sheet animation |
| `tests/components/calendar/ActionPanel.test.js` | ActionPanel DOM — Today/Suggestions/Upcoming render, Mark Ghosted, dismiss |
| `tests/components/calendar/MonthGrid.test.js` | MonthGrid DOM — day cells, event dots, keyboard nav, filter-hidden cells |
| `tests/components/calendar/MonthPicker.test.js` | MonthPicker DOM — 12-month grid, current-month highlight, selection |
| `tests/components/calendar/YearPicker.test.js` | YearPicker DOM — year list, current-year highlight, selection |
| `tests/components/QuickFiltersStatusPopup.test.js` | Shared status popup DOM — Tracker-compatible surface, status ordering, Calendar single-select mount behavior |
| `tests/components/calendar/DayPanel.test.js` | DayPanel DOM — prompt/empty/populated states, status priority grouping, mouse + keyboard (Enter/Space) row activation, root identity preserved across updates, deferred variant-prop guard |
| `tests/server/` | Route handlers, Zod validation, DB queries, `requireAuth` middleware, protected-routes wiring |
| `tests/server/api-entry.test.js` | Hosted-mode integration boot of `api/index.js` (Vercel entry) — exercises `assertHostedSchema` wiring, dynamic seed-middleware import, dispatcher construction, and `GET /api/applications` end-to-end against a mocked Supabase client (closes the CI gap left by the cold-start subprocess test) |
| `tests/services/` | API client, supabase client, resume API, health API, LLM parser (`llmParser.test.js`, 033), AI error mapping (`aiErrors.test.js`), AI provider/service abstraction (`aiProvider.test.js`, `aiService.test.js`, `providers/openrouter.test.js`, 038), compat notes service (`compatNotesService.test.js`, 037) |
| `tests/components/CompatibilityModule.test.js` | CompatibilityModule state machine — tier bands, all five notes states, `no-profile` detection, stale detection, Create mode disabled button, AI disabled → Enable link, generation flow (037) |
| `tests/server/compatNotes.test.js` | `POST /api/applications/:id/compat-notes` route — valid persistence, body validation (summary ≤ 34 chars, non-empty body), 404 on missing app, `compat_scored_at` unchanged (037) |
| `tests/utils/skillProficiency.test.js` | `resolveSkillLevel` — proficient/learning/missing at all level boundaries, name normalisation, empty inputs (037) |
| `tests/data/` | Auth store, legacy localStorage store, AI settings (`aiSettings.test.js`, 033) |
| `tests/pages/` | Page-level integration (Tracker, Profile, ProfileEdit, ConfigError) |
| `tests/pages/Calendar.test.js` | Calendar page integration — month nav, status filter, inline DayPanel selection, ActionPanel wiring, greeting name injection, dismiss toast |
| `tests/seed-data.test.js` | Cross-validates demo seed and SQLite seed — parity checks + Calendar suggestion coverage (all 5 kinds exercised with date-shifted records) |
| `tests/build/` | Vite build-time env-var assertion (`vite-config.test.js`, incl. `stripStartupLoaderInDev`); favicon asset staging (`favicon.test.js`); feature 044 — `code-splitting.test.js` (real `vite build` asserts `Calendar`/`Profile`/`ProfileEdit` split into separate chunks, `Tracker` stays in the main chunk) and `font-loading.test.js` (built `index.html` has no `fonts.googleapis.com`, self-hosted `@font-face`/`.woff2` present); issue #93 — `notFound.test.js` (asserts `public/404.html` exists, is branded, and self-hosts the Sora 800 weight it needs) |
| `tests/main.test.js` | `bootstrap()` + runtime handshake → ConfigError wiring; feature 044 — parallel handshake (C1–C6), startup-loader lifecycle + boot-timeout Retry, and `navigate()` lazy-route tests (N1–N6: pre-await nav highlight/skeleton, latest-wins, chunk-failure revert + Reload, `ProfileEdit.confirmNavigation` guard) |
| `tests/scripts/start-alice-dev.test.js` | Dev launcher guard (issue #64) — runs `scripts/Start-Alice-Dev.ps1 -PrepareOnly` against a temp project and asserts a present `.env.local` is renamed to a single `.env.local.disabled-YYYYMMDD-HHMMSS` file with its contents preserved (Windows/PowerShell-only) |

Run: `npm test` (watch) · `npm run test:run` (CI)

---

## Spec Packages

| Path | Purpose |
|------|---------|
| `specs/018-auth-user-access/spec.md` | Hosted authenticated user access — feature spec (US1–US5, FR-001..019, SC-001..010) |
| `specs/018-auth-user-access/plan.md` | Architecture, file structure, risks, validation approach |
| `specs/018-auth-user-access/tasks.md` | Phased implementation tasks ledger |
| `specs/018-auth-user-access/data-model.md` | `allowed_emails` schema + Postgres trigger contract |
| `specs/018-auth-user-access/contracts/api.md` | Env vars, Authorization header, `requireAuth` behavior, `/api/health`, trigger contract |
| `specs/018-auth-user-access/quickstart.md` | Operator install steps + pre-deploy verification gate (§10) |
| `specs/018-auth-user-access/research.md` | 13 design decisions with rejected alternatives |
| `specs/018-auth-user-access/checklists/plan-review.md` | Pre-implementation review gate |
| `specs/019-supabase-persistence/spec.md` | Hosted Supabase Postgres persistence layer — feature spec |
| `specs/019-supabase-persistence/plan.md` | Repository factory, RLS policies, migration architecture, boot-time schema check, and per-user seed middleware |
| `specs/019-supabase-persistence/tasks.md` | Phased implementation tasks ledger |
| `specs/019-supabase-persistence/data-model.md` | Postgres schema (applications, profile) + RLS + indices; §5 holds the canonical operator-applied SQL (no separate `.sql` file) |
| `specs/019-supabase-persistence/contracts/api.md` | Internal contracts (dispatcher, Supabase adapter, per-request client, seed step, schema check) — wire-level API responses explicitly unchanged |
| `specs/019-supabase-persistence/quickstart.md` | Operator migration steps + verification |
| `specs/019-supabase-persistence/research.md` | Design decisions with rejected alternatives |
| `specs/019-supabase-persistence/checklists/plan-review.md` | Pre-implementation review gate |
| `specs/020-portfolio-demo-mode/spec.md` | Client-side in-memory portfolio demo — feature spec |
| `specs/020-portfolio-demo-mode/plan.md` | Demo store, auth-status switch, seeded sample data architecture, removal of the 019 `APP_RUNTIME=demo` server slot, and side-effect-free seed extraction |
| `specs/020-portfolio-demo-mode/tasks.md` | Phased implementation tasks ledger |
| `specs/020-portfolio-demo-mode/data-model.md` | In-memory demo data shape (no persistence layer) |
| `specs/020-portfolio-demo-mode/contracts/api.md` | Service-layer demo-mode short-circuit contracts |
| `specs/020-portfolio-demo-mode/quickstart.md` | End-to-end verification walkthrough — exercised against both local dev and the hosted Vercel deploy |
| `specs/020-portfolio-demo-mode/research.md` | Design decisions with rejected alternatives |
| `specs/020-portfolio-demo-mode/checklists/plan-review.md` | Pre-implementation review gate |
| `specs/021-hosted-resume-import-security/spec.md` | Hosted resume import security hardening — feature spec |
| `specs/021-hosted-resume-import-security/plan.md` | Four-layer defense architecture + regression-guard strategy |
| `specs/021-hosted-resume-import-security/tasks.md` | Phased implementation tasks ledger |
| `specs/021-hosted-resume-import-security/data-model.md` | Request/response shapes + sanitized log shape (no persistence added) |
| `specs/021-hosted-resume-import-security/contracts/api.md` | Canonical security model: threat model, four-layer defense, guarantees / non-guarantees |
| `specs/021-hosted-resume-import-security/quickstart.md` | Manual verification recipe for the sanitized-error contract |
| `specs/021-hosted-resume-import-security/research.md` | Design + post-implementation decisions |
| `specs/021-hosted-resume-import-security/checklists/plan-review.md` | Pre-implementation review gate |
| `specs/022-deployment-polish-docs/spec.md` | Deployment polish & docs — feature spec (US1–US4, FR-001..013, SC-001..011) |
| `specs/022-deployment-polish-docs/plan.md` | Docs-only architecture with one `APP_VERSION` literal carve-out; affected areas, risks, validation approach |
| `specs/022-deployment-polish-docs/tasks.md` | Phased implementation tasks ledger |
| `specs/022-deployment-polish-docs/research.md` | Clarification decisions D1–D6 with rejected alternatives |
| `specs/022-deployment-polish-docs/checklists/plan-review.md` | Pre-implementation review gate |
| `specs/025-application-timeline/` | Application Timeline feature spec package — timeline persistence, modal UI, seed updates, hosted migration, release prep, and smoke plan |
| `specs/026-calendar/` | Calendar page feature spec package — month-grid, Action Panel, suggestions engine, day popovers, seed augmentation, release prep, and smoke plan |
| `specs/028-archive-applications-view/` | Archive Applications view feature spec package — view-switcher toolbar chip, archived card variant, read-only Application Overlay archived mode, `unarchive` operation, `archived_date` column, Profile entry-point link, demo-mode archived seeds, and exclusion of archived rows from active workflow surfaces |
| `specs/029-loading-async-states/` | Loading & async states feature spec package — six loading channels (`initial-load` / `refresh` / `save` / `parse` / `mutation` / `transition`), shared `asyncUI.js` + `skeletons.js` utilities, inline-error recovery, button-busy + peer-lockout contracts, view-switcher chip `aria-busy`, demo-mode parity regression suite |
| `specs/030-delete-profile-data/` | Delete Profile & User Data feature spec package — `DELETE /api/account`, service-role admin delete + cascade, server-side password re-verification, local `confirm`-gated clear, Account section on Profile, `DeleteAccountModal`, cross-device session revalidation (`handleAuthFailure`), and v1.0.0 release prep |
| `specs/031-skill-proficiency-system/` | Skill proficiency feature spec package — structured `{ name, level }` skills with a 1–5 scale (`SKILL_LEVELS`), normalise-on-load migration (legacy `string[]` → Basic), centralized validation (unrated / blank / duplicate / max-50), graded-meter Profile display with reveal/sort/collapse, inline level-picker editor, demo + persistence parity, and v1.1.0 release prep |
| `specs/032-profile-schema-refactor/` | Profile schema refactor spec package — promotes profile skills from the JSON document to a first-class `profile_skill` store (SQLite + Supabase), sole-source-of-truth with read-reassembly (transparent API/UI), transactional saves (SQLite txn / `save_profile_with_skills` RPC), idempotent auto-migration on first read, case-insensitive unique-index backstop, `assertHostedSchema` probe, and v1.2.0 release prep |
| `specs/033-llm-resume-cv-parser/` | LLM Resume / CV Parser spec package — AI-assisted resume parsing via browser-direct OpenRouter (BYOK, browser-only key + one-time consent), paste-or-upload input, new `POST /api/resume/extract` + `/parse` JSON text mode, LLM output sanitized through `normaliseProfile` and merged for review, AI-generated field indicators, automatic rule-based fallback (no key / declined / failure / timeout), no server-side persistence of key or content, and v1.3.0 release prep |
| `specs/036-compatibility-engine/` | Compatibility Engine spec package — deterministic profile-vs-JD scoring in a pure shared module (weighted skills/role/experience/keywords/certifications, proficiency weighting, graded experience, renormalization, Low/Medium/High/Great bands), server-authoritative compute on create/update + active recompute on profile save (archived frozen), demo parity via the same module, optional `min_years_experience` column + `assertHostedSchema` probe, removal of client-writable/random `compat`, one-time legacy backfill (all rows incl. archived), CompatBar band label, and v1.6.0 release prep |
| `specs/037-compatibility-insights-panel/` | Compatibility Insights Panel spec package — collapsible CompatibilityModule (score ring, proficiency-coded chips, AI notes lifecycle), `compat_analysis` + `compat_scored_at` columns, staleness cascade via `compat_scored_at`, `llmClient.js` extraction, `compatNotesService.js`, `POST /api/applications/:id/compat-notes` persistence route, `skillProficiency.js`, demo parity, and v1.7.0 release prep |
| `specs/038-ai-provider-abstraction/` | AI Provider Abstraction spec package — provider contract, OpenRouter provider implementation, central `aiService.js` facade, provider registry, migration away from `llmClient.js`, and v1.7.1 release prep |
| `specs/044-hosted-startup-performance/` | Hosted Startup Performance spec package — inlined startup loader (hosted-only, stripped for portable/local dev), parallel + optimistic boot handshake, Tracker-boot skeleton, `Calendar`/`Profile`/`ProfileEdit` route-level code-splitting, self-hosted fonts, `metrics.md` before/after measurements, and v1.12.0 release prep |
| `docs/design/` | Visual specifications and screen-level interaction notes |
| `docs/features/` | Lightweight feature briefs used as Speckit inputs |
| `HostedAlice_StartupLoader/design_handoff_startup_loader/` | Design reference for the hosted startup loader (feature 044/WS1) — high-fidelity HTML/CSS prototype + brand sigil SVG; recreated (not copied verbatim) as the inlined loader in `index.html` |

---

## Docs

| Path | Purpose |
|------|---------|
| `docs/AI_WORKFLOW_GUIDE.md` | Local two-agent AI orchestration reference (Claude + Codex pipeline) |
| `docs/deployment.md` | Operator-facing deployment guide — local + hosted modes, Supabase Setup Checklist, Environment Variable Checklist, Demo & Free-Tier Notes, Migration Clarification (consolidated in feature 022) |
| `docs/design/welcome_page.md` | Visual specification for the welcome experience |
| `docs/design/calendar.md` | Calendar page interaction and visual design — month-grid layout, Action Panel sections, popover anatomy, suggestion rule logic |
| `docs/design/loading.md` | Channels + visual conventions for loading + async UX — six channels, skeleton vocabulary, inline-error block, button-busy contract, reduced-motion inheritance, quickref for adding new surfaces (feature 029) |
| `docs/db/claim_and_seed_starter.md` | `claim_and_seed_starter()` RPC evolution — v1 (019), v2 (025 Timeline), v3 (026 Calendar suggestions); SQL bodies and operator apply instructions |
| `docs/hosted-smoke-test.md` | Hosted smoke-test checklist — Given/When/Then verification flow run before promoting a deploy (feature 022) |
| `docs/REPO_MAP.md` | This file — navigation shortcut for AI-assisted work |

---

## Static Assets

| Path | Purpose |
|------|---------|
| `src/assets/logo/alice-sigil-full.svg` · `alice-sigil-full-white.svg` | Brand vector marks (used by Navbar, Footer, WelcomePage, ConfigError, Auth modal header, and HeroSlideshow scene) |
| `src/assets/graphics/` | Empty-state illustrations (used by ActionPanel, DayPanel, and Profile) |

---

## Where to Start (Quick Guide)

- UI change → `src/pages/Tracker.js` → relevant component in `src/components/`
- Form/modal change → `src/components/Modal.js` → `src/models/application.js`
- Data model change → `shared/constants.js` → `server/validation/application.js` → `src/models/application.js`
- Backend/API issue → `server/routes/applications.js` → `server/db/applications.js`
- Filter/sort behavior → `src/utils/filterSort.js` → `src/pages/Tracker.js` wiring
- Pagination behavior → `src/utils/pagination.js` → `src/components/Pagination.js` → `src/pages/Tracker.js`
- Auth / welcome / overlay → `src/main.js` (bootstrap) → `src/data/authStore.js` → `src/pages/welcome/WelcomePage.js` → `AuthOverlay.js` → `LoginForm.js` / `SignupForm.js`
- Auth middleware / JWT → `server/auth/middleware.js` → `server/index.js` (`createApp` wiring)

---

## Key Boundaries

- **Tracker page** is self-contained — filters, sort, and pagination state live only in `Tracker.js`. Calendar and Profile are independent.
- **`shared/constants.js`** is the only file intentionally shared across frontend/backend. Changing status values there affects validation, UI badges, and DB queries simultaneously.
- **`src/models/application.js`** (client) and **`server/validation/application.js`** (server) are parallel but separate — both need updating when fields change.
- Do **not** touch `server/db.js` schema without also updating `server/db/applications.js` queries.

---

## Common Change Patterns

**New field on an application:**
`shared/constants.js` (if status-related) → `server/validation/application.js` → `server/db.js` (schema) → `server/db/applications.js` (queries) → `src/models/application.js` → `src/components/Modal.js` → `src/components/Card.js` (if surfaced on card)

**UI-only change (label, color, layout):**
`src/styles/main.css` or the specific component in `src/components/`

**New status value:**
`shared/constants.js` → `src/models/application.js` (STATUS_CONFIG) → `server/validation/application.js` → tests

**Filter or sort behavior:**
`src/utils/filterSort.js` → `src/components/QuickFiltersToolbar.js` (toolbar + popups via FilterPanel/SortPanel) → `Tracker.js` wiring

**API endpoint change:**
`server/routes/applications.js` → `server/validation/application.js` → `src/services/api.js`

---

## Notes for AI Implementation

Before exploring:
- Identify target files from `tasks.md`
- Limit inspection to those files unless expansion is required
- If expanding scope, state why before inspecting more files

**Start here:**
- Feature touching UI → `src/pages/Tracker.js` to understand wiring, then the relevant component
- Feature touching data shape → `src/models/application.js` + `shared/constants.js` first
- Backend bug → `server/routes/applications.js` → `server/db/applications.js`

**Do NOT scan unless necessary:**
- `server/db-seed.js`, `server/db-clear.js` — dev tooling only, never touches production logic
- `src/assets/` — brand logos and empty-state graphics, no logic
- `src/data/store.js` — legacy localStorage store, superseded by API; avoid
- `src/components/Toolbar.js` — orphaned; superseded by QuickFiltersToolbar; do not use

**Validation lives in two places** — always update both client (`src/models/`) and server (`server/validation/`) when changing field rules.
