---
description: "Phased implementation tasks for feature 033 — LLM Resume / CV Parser"
---

# Tasks: LLM Resume / CV Parser

**Input**: Design documents in `specs/033-llm-resume-cv-parser/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/api.md](./contracts/api.md), [quickstart.md](./quickstart.md)

**Tests**: REQUIRED. This feature touches forms, parsing, and validation, so core
validation logic must have automated tests (constitution Principle V). Write each
test task first and confirm it FAILS before implementing.

**Task format**: `- [ ] T### [P?] [US?] description (path)` followed by an
indented detail block (Files / Behavior / Constraints / Validation /
Out-of-scope). `[P]` = parallelizable (different files, no incomplete deps).

**Architecture anchor**: browser-direct OpenRouter call (BYOK, browser-only key +
consent); server only does stateless text extraction. See [research.md](./research.md) R-1…R-10.

**Operator legend**: 👤 = task needs a human operator (running app, real browser,
a real disposable OpenRouter key, or manual sign-off). Unmarked tasks are
agent-executable (code + automated tests). The OpenRouter key used for any *live*
test is operator-supplied; unit/component tests mock it.

---

## Phase Map

| Phase | Theme | Tasks | Blocks | Operator? |
|---|---|---|---|---|
| 01 | **Setup** — browser→OpenRouter CORS de-risk spike | T001 | 02 | 👤 spike |
| 02 | **Foundational** — `aiSettings`, `llmParser`, `/api/resume/extract`, `/parse` text mode, `resumeApi` (+ unit/server tests) | T002–T010 | 03–06 | — |
| 03 | **US1 (P1) 🎯 MVP** — paste input + AI orchestration + Edit Profile merge | T011–T013 | 06 | — |
| 04 | **US2 (P1)** — Profile-page key settings + one-time consent gate | T014–T017 | — | — |
| 05 | **US3 (P2)** — rule-based fallback + truncation + no data loss | T018–T019 | — | — |
| 06 | **US4 (P3)** — AI-field indicators (render + clear-on-edit) | T020–T021 | — | — |
| 07 | **Polish** — privacy/a11y review, lint+test, quickstart | T022–T025 | 08 | 👤 T023, T025 |
| 08 | **Release Prep (REQUIRED)** — version 1.2.0→1.3.0, CHANGELOG, README, REPO_MAP, roadmap, lockfile, docs sanity | T026–T033 | 09 | 👤 T033 |
| 09 | **Browser Smoke Test (REQUIRED — UI)** — walk US1–US4 Independent Tests + mobile | T034–T038 | merge | 👤 all |

**Sequencing notes:**
- Phase 01 (spike) gates the architecture — do first. Browser-direct is firm; if the spike fails, STOP and escalate (a proxy needs an explicit spec/contracts/consent amendment), do not silently pivot.
- Phase 02 blocks all user stories (shared modules + endpoints). The four test→impl pairs + T010 are mutually `[P]`.
- Same-file chains (NOT parallel): `ResumeImport.js` T012→T017→T019; `ProfileEdit.js` T013→T021.
- Release Prep (08) is second-to-last; Browser Smoke (09) is last — constitution Amendment 1.3.0.

---

## Phase 01: Setup & De-risking

**Purpose**: Resolve the one load-bearing assumption before building on it.

- [x] T001 👤 De-risk the browser→OpenRouter CORS assumption (R-2) — **PASS** (2026-06-02, local origin; see research.md "R-2 Spike result")
  - Files: throwaway probe only (a temporary HTML/JS snippet or devtools `fetch`); append the outcome to [research.md](./research.md) under a new "## R-2 Spike result" note. No production code committed from this task.
  - Behavior: from (a) `http://localhost` dev origin and (b) a Vercel preview origin, perform a real `fetch` to `https://openrouter.ai/api/v1/chat/completions` with a disposable test key; confirm a non-CORS-blocked response (any 2xx/4xx that is *not* a CORS failure counts as "reachable").
  - Constraints: do not commit the test key; revoke it after. Browser-direct is a FIRM requirement (contracts §4: "Alice's server never receives the key"). If either origin is CORS-blocked, **STOP and escalate** — do NOT switch to a server-proxy here; a proxy would break contracts §4 and requires an explicit spec/contracts/consent amendment with user approval first. Record the spike outcome in research.md.
  - Validation: documented spike result in research.md (reachable / blocked + chosen path).
  - Out-of-scope: any `src/` or `server/` changes.

---

## Phase 02: Foundational (Blocking Prerequisites)

**Purpose**: Shared modules + server endpoints used by every user story. No story
can be completed until these exist.

**⚠️ Blocks all user-story phases.**

- [x] T002 [P] Unit tests for the AI settings store (`tests/data/aiSettings.test.js`)
  - Files: `tests/data/aiSettings.test.js` (new).
  - Behavior: assert `getKey/setKey/clearKey/hasKey` and `getConsent/setConsent/clearConsent/hasConsent` against a mocked `localStorage`; empty/whitespace key → `hasKey()` false; values persist across reads; clear removes them.
  - Constraints: mock `localStorage` (jsdom); no real network/storage leakage between tests.
  - Validation: this file; must FAIL before T003.
  - Out-of-scope: UI, consent prompt rendering.

- [x] T003 [P] Implement the AI settings store (`src/data/aiSettings.js`)
  - Files: `src/data/aiSettings.js` (new).
  - Behavior: own two `localStorage` keys `alice.ai.openrouterKey` and `alice.ai.consent`; expose get/set/clear/has for key and consent (data-model §1.1–1.2). Pure logic, no DOM.
  - Constraints: business logic separated from UI (constitution II); trim keys; treat empty/whitespace as "no key"; never log the key.
  - Validation: `tests/data/aiSettings.test.js` passes.
  - Out-of-scope: any rendering; sending the key anywhere.

- [x] T004 [P] Unit tests for the LLM parser service (`tests/services/llmParser.test.js`)
  - Files: `tests/services/llmParser.test.js` (new).
  - Behavior: with mocked `fetch`: builds the OpenRouter request (model, `response_format`, system+user messages); parses assistant JSON and sanitizes via `normaliseProfile`; aborts at `LLM_TIMEOUT_MS` (fake timers/AbortController) → throws; non-2xx / network error / non-JSON / empty-after-normalise → throws a typed error; truncates input over `MAX_INPUT_CHARS` and reports truncation.
  - Constraints: never assert on a real network; no real key.
  - Validation: this file; must FAIL before T005.
  - Out-of-scope: fallback wiring (lives in ResumeImport, US1/US3).

- [x] T005 [P] Implement the LLM parser service (`src/services/llmParser.js`)
  - Files: `src/services/llmParser.js` (new). Reuse: `src/models/profile.js` (`normaliseProfile`).
  - Behavior: export `DEFAULT_MODEL`, `LLM_TIMEOUT_MS = 30000`, `MAX_INPUT_CHARS` constants and `parseWithLlm(text, key)` → returns `{ draft, truncated }` or throws a typed error. Browser-direct `fetch` to OpenRouter (contracts §3); `AbortController` timeout; JSON-parse → must be plain object → `normaliseProfile` → must have extracted data, else throw (R-5).
  - Constraints: single request (no chaining); timeout/model/max-length are single adjustable constants (Q4); never surface raw provider errors upward (caller maps to friendly text); reuse a shared "has extracted data" check — extract the helper currently inline in `ResumeImport.js` (it isn't exported) or add a small local one; don't depend on the unexported version (I3).
  - Validation: `tests/services/llmParser.test.js` passes.
  - Out-of-scope: deciding when to call it (component concern); persistence.

- [x] T006 [P] Server tests for `POST /api/resume/extract` (`tests/server/resumeExtract.test.js`)
  - Files: `tests/server/resumeExtract.test.js` (new). Pattern: mirror `tests/server/resume.test.js`.
  - Behavior: success returns `{ data: { text } }`; no file → 400 `VALIDATION_ERROR`; >5 MB → 400 `FILE_TOO_LARGE`; unsupported type → 400 `UNSUPPORTED_FILE_TYPE`; extractor throw → 400 `PARSE_FAILED` (no internals leaked); hosted demo (no JWT) → 401.
  - Constraints: assert memory-only (no disk write); generic error messages only.
  - Validation: this file; must FAIL before T007.
  - Out-of-scope: LLM behavior.

- [x] T007 Add `POST /api/resume/extract` endpoint (`server/routes/resume.js`)
  - Files: `server/routes/resume.js` (modify). Reuse: `server/resume/extractor.js`.
  - Behavior: multer memoryStorage (5 MB), `requireAuth`/`seedHostedUserIfNeeded` like `/parse`; extract text via `extractText` and return `{ data: { text } }`; same error mapping as `/parse` (contracts §1).
  - Constraints: no persistence; reuse existing extractor and error-response shapes; no new deps.
  - Validation: `tests/server/resumeExtract.test.js` passes.
  - Out-of-scope: rule-based parsing on this route.

- [x] T008 [P] Server tests for `/api/resume/parse` JSON text mode (`tests/server/resume.text.test.js`)
  - Files: `tests/server/resume.text.test.js` (new).
  - Behavior: JSON `{ text }` → 200 rule-based `{ data }`; missing/empty `text` → 400 `VALIDATION_ERROR`; over `TEXT_MAX` → 400 (`PAYLOAD_TOO_LARGE`); existing multipart file mode still works; hosted demo → 401.
  - Constraints: don't regress existing `tests/server/resume.test.js`.
  - Validation: this file; must FAIL before T009.
  - Out-of-scope: extract endpoint.

- [x] T009 Extend `POST /api/resume/parse` with JSON text mode (`server/routes/resume.js`)
  - Files: `server/routes/resume.js` (modify). Reuse: `server/resume/parser.js` (`parseResumeText`).
  - Behavior: if `Content-Type` is JSON with `{ text }`, skip multer and run `parseResumeText(text)` → `{ data }`; otherwise keep the existing multipart path (contracts §2). Enforce a `TEXT_MAX` length guard.
  - Constraints: single endpoint serves both modes; preserve all existing behavior/tests; generic errors; add the new `PAYLOAD_TOO_LARGE` code to the route's `ERROR_RESPONSES` map (I2) so the over-cap case returns a consistent envelope.
  - Validation: `tests/server/resume.text.test.js` + existing `tests/server/resume.test.js` pass.
  - Out-of-scope: AI logic.

- [x] T010 [P] Extend the resume API client (`src/services/resumeApi.js`)
  - Files: `src/services/resumeApi.js` (modify). Tests: extend `tests/services/resumeApi.test.js` (+ `.demo` if needed).
  - Behavior: add `extractText(file)` → `POST /api/resume/extract` and `parseText(text)` → `POST /api/resume/parse` (JSON); reuse existing auth-header + demo-guard + error-normalisation patterns from `parseResume`.
  - Constraints: keep the existing `parseResume(file)`; same `NETWORK_ERROR`/demo handling; no key handling here (key never touches the server).
  - Validation: `tests/services/resumeApi.test.js` passes.
  - Out-of-scope: OpenRouter calls (those are in `llmParser.js`).

**Checkpoint**: settings store, LLM service, both server endpoints, and API client exist and are unit-tested.

---

## Phase 03: User Story 1 — AI-Assisted Parse and Review (P1) 🎯 MVP

**Goal**: With a key + consent present, paste/upload a resume → LLM → validated
draft pre-fills the Edit Profile form for review; nothing auto-saves.

**Independent Test**: spec.md US1 Independent Test — key configured (set via the
settings store), paste a resume, process, confirm fields pre-fill and an edit +
Save persists reviewed values; no auto-save.

- [x] T011 [US1] Component tests for the AI parse path + paste input (`tests/components/ResumeImport.test.js`)
  - Files: `tests/components/ResumeImport.test.js` (modify). Mock: `llmParser`, `resumeApi`, `aiSettings`.
  - Behavior: a paste textarea is present; with key+consent set, Process → `llmParser.parseWithLlm` called → `onSuccess(draft, aiFieldSet)` with the AI-field set populated; uploaded file routes through `resumeApi.extractText` then the LLM; empty paste / empty file → blocked with a clear message and NO `extractText`/LLM call (C3); no auto-save side effects.
  - Constraints: no real network; assert `onSuccess` payload shape (draft + Set of field paths).
  - Validation: this file; must FAIL before T012.
  - Out-of-scope: failure/fallback cases (US3), consent prompt (US2), indicator rendering (US4).

- [x] T012 [US1] Add paste input + AI orchestration to ResumeImport (`src/components/ResumeImport.js`)
  - Files: `src/components/ResumeImport.js` (modify), `src/styles/main.css` (paste-input styles). Uses: `aiSettings`, `llmParser`, `resumeApi`.
  - Behavior: render a labeled "paste resume text" textarea alongside the existing uploader; on Process: guard against empty paste/empty file first (clear message, no downstream call — C3); obtain raw text (paste = direct; upload = `extractText`); if `aiSettings.hasKey()` && `hasConsent()` → `parseWithLlm` → build the AI-field set from non-empty draft fields → `onSuccess(draft, aiFieldSet)`; if no key → rule-based baseline (`parseText`/`parseResume`) with an empty AI-field set.
  - Constraints: keep existing loading messages/aria-busy; demo gating preserved (component already hides for non-`VISIBLE_STATUSES`); textarea labeled + keyboard accessible; no auto-save. NOTE: the first-use **consent prompt** is added in T017 — until that lands, a key-but-no-consent user simply routes to the rule-based baseline here (US1 tests grant consent via the store).
  - Validation: `tests/components/ResumeImport.test.js` (T011) passes.
  - Out-of-scope: AI-failure fallback + truncation (US3), consent prompt (US2), indicators (US4).

- [x] T013 [US1] Thread the AI-field set through Edit Profile merge (`src/pages/ProfileEdit.js`)
  - Files: `src/pages/ProfileEdit.js` (modify, around `renderResumeImportArea` line ~1271–1299).
  - Behavior: update `onSuccess` to accept `(parsedData, aiFieldSet)`; keep `mergeResumeData(_formState, parsedData)`; store the provided `aiFieldSet` in a module-level `_aiFields` (default empty Set) for later rendering.
  - Constraints: merged data must still save identically to manual entry; no schema/provenance leakage into saved profile.
  - Validation: covered indirectly here; indicator rendering/tests land in US4 (T020/T021). Add one assertion that an AI-filled draft, once merged, passes through the existing `validateProfile` at Save exactly like manually entered data (C2 / FR-021) — i.e. AI provenance does not bypass validation.
  - Out-of-scope: rendering the indicator (US4), settings UI (US2).

**Checkpoint**: with a key set (via store), paste/upload produces a reviewable pre-filled form. MVP functional.

---

## Phase 04: User Story 2 — BYOK Key Setup and Consent (P1)

**Goal**: A Profile-page settings section to enter/clear the OpenRouter key (with
the browser-only responsibility notice), plus the one-time consent gate at first
parse.

**Independent Test**: spec.md US2 Independent Test — enter key in settings, reload
→ persists; first parse shows consent; decline = nothing sent; accept = remembered.

- [x] T014 [US2] Tests for the Profile AI settings section (`tests/pages/profile.aiSettings.test.js`)
  - Files: `tests/pages/profile.aiSettings.test.js` (new). Mock: `aiSettings`.
  - Behavior: renders key field + browser-only notice; save → `aiSettings.setKey`; clear → `aiSettings.clearKey`; consent status shown + clearable; demo mode shows a non-interactive "available after signing in" note (like the Account section).
  - Constraints: assert the notice text conveys "stored only in this browser / your responsibility"; no key value rendered back in plaintext logs.
  - Validation: this file; must FAIL before T015.
  - Out-of-scope: the parse-time consent prompt (T016/T017).

- [x] T015 [US2] Add the "AI Resume Parsing" settings section (`src/pages/Profile.js`)
  - Files: `src/pages/Profile.js` (modify, near `renderAccountSection` ~line 858), `src/styles/main.css` (settings-section styles). Uses: `aiSettings`.
  - Behavior: new section (same `section-label` pattern) with a labeled key input, browser-only responsibility notice, Save + Clear, and consent status with a Clear-consent control; demo mode renders a note instead of inputs.
  - Constraints: accessible labels/keyboard; non-color-only status; reuse existing button classes; key stored only via `aiSettings`.
  - Validation: `tests/pages/profile.aiSettings.test.js` passes.
  - Out-of-scope: parse orchestration.

- [x] T016 [US2] Tests for the first-use consent gate (`tests/components/ResumeImport.test.js`)
  - Files: `tests/components/ResumeImport.test.js` (modify).
  - Behavior: key set but `!hasConsent()` → Process shows an explicit consent notice before any `llmParser` call; decline → `parseWithLlm` NOT called, rule-based/manual path available, nothing sent; accept → `aiSettings.setConsent` then `parseWithLlm` called; with consent already set, no re-prompt.
  - Constraints: assert no **LLM / OpenRouter / external-provider** call occurs before consent (`llmParser.parseWithLlm` not called). Note: Alice's own `/extract` for uploads MAY run before consent — it is not the gated external send (FR-011).
  - Validation: this file; must FAIL before T017.
  - Out-of-scope: settings-section UI (T015).

- [x] T017 [US2] Add the consent gate to ResumeImport (`src/components/ResumeImport.js`)
  - Files: `src/components/ResumeImport.js` (modify), `src/styles/main.css` (consent-notice styles). Uses: `aiSettings`.
  - Behavior: before the first AI send, show an explicit one-time consent notice (what is sent + to whom); on accept set consent and proceed; on decline, do not send — offer rule-based/manual; remember consent thereafter (Q before parse).
  - Constraints: consent strictly gates the external call (FR-011); labeled/keyboard accessible.
  - Validation: `tests/components/ResumeImport.test.js` (T016) passes.
  - Out-of-scope: indicator rendering (US4).

**Checkpoint**: users can manage their key + consent; first AI use is gated.

---

## Phase 05: User Story 3 — Graceful Degradation & Failure Handling (P2)

**Goal**: No key / declined / AI failure / invalid output → automatic rule-based
fallback; both-fail → retry + manual without data loss; over-length → truncate
with notice.

**Independent Test**: spec.md US3 Independent Test — no-key uses rule-based;
simulated LLM failure falls back; total failure preserves form data + offers
retry/manual.

- [x] T018 [US3] Tests for fallback + truncation behavior (`tests/components/ResumeImport.test.js`)
  - Files: `tests/components/ResumeImport.test.js` (modify). Mock: `llmParser` throwing; `resumeApi`.
  - Behavior: `parseWithLlm` throws (timeout/network/invalid) → rule-based (`parseText`/`parseResume`) is called and `onSuccess` fires with an EMPTY AI-field set + a friendly message (no internals); rule-based also fails → existing retry + "Continue Manually" shown and form state preserved; `parseWithLlm` reports `truncated` → a visible truncation notice is shown.
  - Constraints: assert no provider/library internals reach the DOM (FR-017).
  - Validation: this file; must FAIL before T019.
  - Out-of-scope: server behavior.

- [x] T019 [US3] Implement fallback + truncation notice in ResumeImport (`src/components/ResumeImport.js`)
  - Files: `src/components/ResumeImport.js` (modify), `src/styles/main.css` (notice styles).
  - Behavior: wrap the AI path so any failure routes to the rule-based parser (empty AI-field set); map errors to friendly copy; on `truncated`, render a visible "resume was long — some content may not be parsed" notice; preserve the existing retry + Continue-Manually flow on total failure without clearing form data.
  - Constraints: never lose in-progress form data (FR-014); single adjustable timeout already in `llmParser` (Q4).
  - Validation: `tests/components/ResumeImport.test.js` (T018) passes.
  - Out-of-scope: indicators (US4).

**Checkpoint**: every no-key/failure path yields a working result with no data loss.

---

## Phase 06: User Story 4 — AI-Generated Field Indicators (P3)

**Goal**: AI-populated fields show a subtle non-color-only indicator that clears
on edit; rule-based results carry no indicator.

**Independent Test**: spec.md US4 Independent Test — AI parse shows indicators;
editing a field clears its indicator; fallback shows none.

- [x] T020 [US4] Tests for AI indicators (`tests/pages/profileEdit.aiIndicators.test.js`)
  - Files: `tests/pages/profileEdit.aiIndicators.test.js` (new).
  - Behavior: given a non-empty `_aiFields` set, AI-populated fields render an indicator (with accessible text, not color-only); editing a field removes its entry → indicator gone; an empty `_aiFields` set (rule-based) renders no indicators.
  - Constraints: indicator must not alter saved values.
  - Validation: this file; must FAIL before T021.
  - Out-of-scope: parse orchestration.

- [x] T021 [US4] Render + clear AI indicators (`src/pages/ProfileEdit.js`)
  - Files: `src/pages/ProfileEdit.js` (modify), `src/styles/main.css` (AI-badge styles).
  - Behavior: when rendering fields, if the field path is in `_aiFields`, show a subtle "AI" badge + `aria-label`/`title`; on the field's input/change handler, delete its path from `_aiFields` (clears on edit, Q3); collection entries keyed by index path (e.g. `experience[0]`).
  - Constraints: non-color-only (constitution); fields remain fully editable and save identically to manual entry; rule-based path (empty set) shows nothing.
  - Validation: `tests/pages/profileEdit.aiIndicators.test.js` passes.
  - Out-of-scope: changing merge/validation logic.

**Checkpoint**: all four user stories independently functional.

---

## Phase 07: Polish & Cross-Cutting

**Purpose**: Quality gates spanning the feature.

- [x] T022 [P] Privacy review — confirm the **key** never reaches Alice's server (browser-direct LLM call; key only in `localStorage`); confirm resume **content** is transient/memory-only and **never persisted** — pasted text goes browser→OpenRouter directly, uploaded files pass through `/extract` only for stateless extraction; `/extract` and `/parse` persist nothing (no disk, no DB). Matches FR-010 / SC-006.
  - Files: review `src/services/llmParser.js`, `src/services/resumeApi.js`, `src/data/aiSettings.js`, `server/routes/resume.js`.
  - Validation: written confirmation in the PR/notes; matches FR-010 / SC-006.
- [ ] T023 👤 [P] Accessibility & responsive review — paste textarea, consent notice, settings section, AI badge: labels, keyboard, ≤640px layout, non-color-only.
  - Files: `src/components/ResumeImport.js`, `src/pages/Profile.js`, `src/pages/ProfileEdit.js`, `src/styles/main.css`.
  - Validation: manual checklist; matches FR-022.
- [x] T024 Run full test + lint gates.
  - Behavior: `npm run test:run` and `npm run lint` clean (including unchanged resume suites: `resumeMerge`, `resumeParser`, `ResumeImport.demo`, `resumeApi.demo`).
  - Validation: both commands pass.
- [ ] T025 👤 Validate quickstart end-to-end against a running app (`specs/033-llm-resume-cv-parser/quickstart.md`).
  - Validation: each quickstart step works as written.

---

## Phase 08: Release Prep (REQUIRED)

**Purpose**: Land docs + version metadata in the to-be-merged state. Per
constitution Amendment 1.3.0. Current version: `1.2.0` (package.json) — this is a
new user-facing feature → **MINOR** bump (→ `1.3.0`).

- [x] T026 Bump version to `1.3.0` in `package.json`; confirm where the app renders its version (e.g. `src/components/Footer.js` `APP_VERSION`, or wherever it actually lives) and keep that in sync (R1); update any test pinning the literal version string.
- [x] T027 Sync `package-lock.json` root version fields (top-level `version` + `packages[""].version`) to `1.3.0`; leave dependency versions untouched (`npm install --package-lock-only` or surgical 2-line edit). The release-metadata test asserts these.
- [x] T028 `docs/feature_roadmap.md` — tick feature 033 `[x]` (note shipped `1.3.0`) and advance its theme/version row status if changed.
- [x] T029 `CHANGELOG.md` — add `## [1.3.0] — <merge-date>` above the previous entry; **Added** (AI resume parsing, BYOK key + consent, paste input, `/api/resume/extract`, `/parse` text mode), **Changed**/**Security** as applicable; update `[Unreleased]`/`[1.3.0]` diff links.
- [x] T030 `README.md` — Features bullet(s) for AI resume parsing (BYOK, browser-only key, opt-in); update `Current version` to `1.3.0`. No per-feature `specs/…` link under Further Reading.
- [x] T031 `docs/deployment.md` — short BYOK note: AI parsing is browser-side and adds **no server env vars / no runtime-mode change**; link `quickstart.md`. (No env-var table change.)
- [x] T032 `docs/REPO_MAP.md` — add entries for new files (`src/data/aiSettings.js`, `src/services/llmParser.js`, new tests) and the `/api/resume/extract` route; update `server/routes/resume.js` and `src/services/resumeApi.js` descriptions; add/confirm the Spec Packages row for `specs/033-llm-resume-cv-parser/`.
- [ ] T033 👤 Docs sanity check — `grep` `1.2.0` across `package.json`, `package-lock.json` (root only), `src/`, `README.md`, `CHANGELOG.md`, `docs/`; confirm remaining matches are only historical CHANGELOG headings / diff URLs / dependency versions; verify new cross-link paths exist; confirm the running app shows `1.3.0`.

---

## Phase 09: Browser Smoke Test (REQUIRED — UI feature)

**Purpose**: Walk each user story's Independent Test in a real browser against the
to-be-merged state. **Setup**: start `npm run dev` + the backend; sign in (not
demo); have a real OpenRouter key and a sample resume ready.

- [ ] T034 👤 [US1] AI parse & review — set key, paste a resume, Process, confirm fields pre-fill with AI indicators and Save persists reviewed values; no auto-save. Verify US1 acceptance scenarios 1–7. Also run the SAME sample resume through the rule-based path (no key) and note, qualitatively, whether the AI path fills more fields more correctly (A1 / SC-001–SC-002 — observation only, not a pass/fail gate).
- [ ] T035 👤 [US2] Key & consent — enter key in the Profile settings section, reload (persists), trigger first parse (consent appears), decline (nothing sent) then accept (remembered). Verify US2 acceptance scenarios 1–7, including demo-mode unavailability.
- [ ] T036 👤 [US3] Graceful degradation — (a) no key → rule-based pre-fill; (b) bad key/forced failure → falls back with a friendly message; (c) both fail → retry + Continue Manually preserve form data; (d) very long resume → truncation notice. Verify US3 scenarios 1–5.
- [ ] T037 👤 [US4] AI indicators — confirm indicators on AI-populated fields, that editing clears them, and that a rule-based fallback shows none. Verify US4 scenarios 1–3.
- [ ] T038 👤 Mobile layout — DevTools ≤640px: paste input, consent notice, settings section, and AI badges stack/readable; all interactions work via touch/click.

**Runtime note (FR-019 / C1)**: the AI path is browser-direct and runtime-agnostic, but verify it at least in **local mode**; if a hosted preview is available, confirm the same flow there. The rule-based fallback already runs in both runtimes today.

---

## Dependencies & Execution Order

- **Phase 01 (spike)** → gates the architecture; do first.
- **Phase 02 (foundational)** → blocks all user stories. Within it: T002→T003, T004→T005, T006→T007, T008→T009 are test→impl pairs; the four pairs + T010 are mutually `[P]` (different files).
- **Phase 03 (US1)** depends on Phase 02 (llmParser, resumeApi, endpoints).
- **Phase 04 (US2)** depends on Phase 02 (aiSettings); T015 is independent of ResumeImport; T017 builds on T012 (same file).
- **Phase 05 (US3)** builds on the ResumeImport AI path from T012/T017 (same file — sequential).
- **Phase 06 (US4)** depends on T013 (the `_aiFields` set).
- **Phase 07 → 08 → 09** in order; Release Prep before Smoke Test (constitution).

**Same-file sequencing note**: `src/components/ResumeImport.js` is edited in
T012 → T017 → T019, and `src/pages/ProfileEdit.js` in T013 → T021 — these are NOT
parallel.

## Implementation Strategy

- **MVP**: Phase 01 + 02 + 03 (US1) + the key entry **and consent gate** from
  US2 (T014–T017) → a working AI parse you can demo end-to-end through the UI.
  (The consent gate T016/T017 is in the MVP because US1's AI path gates on
  `hasConsent()` and T017 is the only UI that grants it — N1.) Then US3
  robustness, US4 polish.
- **Incremental**: each user-story phase is an independently testable increment;
  stop at any checkpoint to validate.

## Notes

- `[P]` = different files, no incomplete deps.
- Write each test task first; confirm FAIL before its impl task.
- Commit after each task or logical pair.
- No new runtime dependency; no schema change; no new server env var.
- Browser-direct is a firm requirement (contracts §4). If the T001 spike shows
  CORS is blocked, STOP and escalate before Phase 02 — a server-proxy would break
  contracts §4 and may not be adopted without an explicit spec/contracts/consent
  amendment and user approval.
