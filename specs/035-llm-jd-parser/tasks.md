# Tasks: LLM JD Parser

**Feature**: `035-llm-jd-parser`
**Spec**: [`spec.md`](spec.md) · **Plan**: [`plan.md`](plan.md) · **Contracts**: [`contracts/api.md`](contracts/api.md)

Dependency order: service → settings → Modal provenance → smart-input flow → gate →
styling → integration → Release Prep → Browser Smoke Test. Each task is scoped to a
minimal file set. Tests use the existing Vitest setup (`npm run test:run`, `npm run lint`).

---

## Phase 01 — AI JD parse service

### T001 — Extract shared OpenRouter transport [X]
- **Target**: `src/services/llmParser.js`
- **Behavior**: Factor the fetch + `AbortController` timeout + fenced-JSON extraction +
  error-mapping out of `parseWithLlm` into a private helper (e.g. `requestChatCompletion({ text, key, model, systemPrompt })`) returning the raw parsed JSON object + `truncated`.
- **Constraints**: `parseWithLlm` (resume) public signature and observable behavior MUST
  stay identical; reuse existing `LLM_TIMEOUT_MS`, `MAX_INPUT_CHARS`, `REASON_CODES`,
  `mapErrorToReason`. No new dependencies.
- **Validation**: `tests/services/llmParser.test.js` (existing resume tests must stay green).
- **Out of scope**: JD prompt/normalizer (T002); any UI.

### T002 — Add `parseJobWithLlm` [X]
- **Target**: `src/services/llmParser.js`; import from `src/models/application.js`.
- **Behavior**: New `parseJobWithLlm(text, key, model)` using a JD system prompt (per
  [`contracts/api.md`](contracts/api.md)); pipe the LLM JSON through `normalizeApplication()`
  then `validateApplication()`. Distinguish three outcomes: unparseable/non-object →
  `LLM_INVALID_RESPONSE` (recoverable); valid object with zero usable fields →
  `LLM_EMPTY_RESPONSE` (→ NO_TEXT dead-end); ≥1 usable field → `{ draft, truncated }`.
- **Constraints**: Status MUST NOT be parsed (stays `wishlisted`); `compat` not requested;
  **no "years of experience"** field (non-goal — not in the prompt/output); enums
  constrained, salary annual-PHP integer (lower bound), skills deduped, invalid URL
  dropped — all via the application model. Single request; no chaining.
- **Validation**: New `tests/services/llmParser.jd.test.js` with mocked `fetch` — JSON/fence
  extraction, enum/salary/URL/skill normalization, truncation flag, **invalid→`LLM_INVALID_RESPONSE`
  vs empty→`LLM_EMPTY_RESPONSE`**, and error→reason mapping (401/402/429/timeout/network/5xx).
- **Out of scope**: `parseJobPost` (unchanged); components.

---

## Phase 02 — Settings: make the `jd` toggle live (US2)

### T003 — Enable the Job-description parsing toggle [X]
- **Target**: `src/pages/Profile.js` (feature list near line 1090; `FEATURE_COPY`).
- **Behavior**: Change the coming-soon gate from `key !== 'cv'` to `key === 'compat'` so
  `cv` and `jd` are interactive and only `compat` shows "Coming soon."; ensure the `jd`
  toggle reads/writes `aiSettings.setFeature('jd', …)` and persists across reload.
- **Constraints**: `compat` stays disabled/coming-soon; demo mode AI gating unchanged.
- **Validation**: `tests/pages/profile.aiSettings.test.js` — `jd` toggle is enabled,
  togglable, persisted, and not labeled "Coming soon".
- **Out of scope**: consuming the toggle (gate does that in Phase 05); `compat` toggle.

---

## Phase 03 — Modal provenance (Create mode) (US1 / US4)

### T004 — Accept provenance params in `Modal.open` [X]
- **Target**: `src/components/Modal.js` (`open()` options near line 981).
- **Behavior**: Add `aiFields` (Set of field paths) and `fillSource` (`'ai' | 'basic'`) to
  the options; store as Modal-local state for Create mode only; default to no-provenance
  (Manual create path unchanged).
- **Constraints**: When `aiFields`/`fillSource` are absent, Create renders exactly as today.
- **Validation**: `tests/components/Modal.test.js` — opening with no provenance is unchanged.
- **Out of scope**: marker rendering (T005); edit/archived modes.

### T005 — Render markers, banner, flash; clear-on-edit [X]
- **Target**: `src/components/Modal.js` (field rendering + Create body).
- **Behavior**: Mirror `src/pages/ProfileEdit.js` provenance (`_aiFields`,
  `section-provenance` ✦ AI / ⚙ Auto, `clearAiIndicator`): per-filled-field tag beside the
  label, dismissible fill banner ("Filled from the job posting" / "Filled by the basic
  parser"), one-time flash on filled fields, and marker clears when the user edits that
  field. Job Title editor MUST NOT auto-open when prefilled.
- **Constraints**: Non-color-only (glyph + text); compat random 0–100; status `wishlisted`;
  markers never persist.
- **Validation**: `tests/components/Modal.test.js` — markers render for `ai` and `basic`
  sources, banner copy differs by source, marker clears on edit, no markers on Manual create.
- **Out of scope**: the parse flow that supplies the data (Phase 04).

---

## Phase 04 — JD smart-input flow (US1 / US3)

### T006 — New `JobPostingImport` component (paste → processing → success) [X]
- **Target**: **new** `src/components/JobPostingImport.js`.
- **Behavior**: Paste-only smart-input mirroring `src/components/ResumeImport.js`: idle
  paste area with live char count, **Parse posting** disabled under ~40 chars, processing
  scrim ("Reading the job posting…"), then on success call back with `{ draft, aiFieldSet,
  fillSource:'ai', notice }` (truncation notice when `truncated`). Uses `parseJobWithLlm`
  (T002) when `aiSettings.isEnabled() && getFeature('jd') && hasKey()`.
- **Constraints**: Paste only (no file upload); no save; preserve pasted text in local state.
- **Validation**: New `tests/components/JobPostingImport.test.js` — char-min gating,
  processing state, success handoff shape, truncation notice.
- **Out of scope**: gate/cards (Phase 05); CSS (Phase 06).

### T007 — Failure handling, basic fallback, dead-end, locked state [X]
- **Target**: `src/components/JobPostingImport.js`; uses `src/utils/jobPostParser.js`.
- **Behavior**: Route by three outcomes. **Transport error / unparseable-or-non-object
  output** → recoverable reason-code dialog (reuse `REASON_CODES` / `mapErrorToReason`) with
  **Use basic parser** (`parseJobPost` → handoff `fillSource:'basic'` ⚙ Auto), **Try AI
  again** (wait reasons) / **Update key in Settings** (key/credit reasons), and **Enter
  manually**. **Valid object with zero usable fields** → `NO_TEXT` dead-end (Try again /
  Enter manually, **no** basic-parser option); the basic parser, if chosen and also empty,
  ends at the same dead-end. When AI is off, render the locked "Enable AI in Settings →"
  affordance (mirror `ResumeImport.renderSettingsAffordance`) — no parse attempted.
- **Constraints**: No raw provider internals surfaced; pasted text preserved across
  retries/fallback (as `ResumeImport` does with `pendingBasicText`).
- **Validation**: `tests/components/JobPostingImport.test.js` — reason routing, basic
  fallback marks ⚙ Auto, dead-end omits basic option, locked affordance when AI off, text
  preserved across retry.
- **Out of scope**: Modal marker rendering (Phase 03, already done).

---

## Phase 05 — Add-application gate (US1 / US2)

### T008 — Upgrade `CreationPicker` to the §13.1 gate [X]
- **Target**: `src/components/CreationPicker.js`.
- **Behavior**: Render the gate per `application_overlay.md` §13.1: **Smart entry** and
  **Manual entry** cards. Smart routes to `JobPostingImport`; Manual opens
  `Modal.open(null, { mode:'create' })` (empty draft). When `aiSettings.isEnabled() &&
  getFeature('jd') && hasKey()` is false, the **Smart card is locked** (dimmed sparkle, no
  *Fastest* badge, "Enable AI in Settings →" in place of its CTA); Manual always available.
- **Constraints**: Wire the success handoff into `Modal.open(null, { mode:'create', prefill:
  draft, aiFields: aiFieldSet, fillSource })`. Keyboard-navigable; demo gating preserved
  (parser hidden for demo status per existing `PARSER_VISIBLE_STATUSES`).
- **Validation**: `tests/components/CreationPicker.test.js` — Smart locked when AI off,
  Manual opens empty Create, Smart (AI on) routes to the JD flow, success opens Modal with
  provenance params.
- **Out of scope**: parsing internals (Phase 04); CSS (Phase 06).

---

## Phase 06 — Styling

### T009 — Gate, scrim, failure dialog, and provenance styles [X]
- **Target**: feature stylesheet(s) under `src/styles/` (follow the file the existing
  CreationPicker / ResumeImport / Modal styles live in; inspect before adding).
- **Behavior**: Style the §13 gate cards + locked Smart state, the processing scrim, the
  reason-code failure/dead-end dialogs, and the ✦ AI / ⚙ Auto markers + fill banner, using
  the design tokens in `docs/design/tracker.md` (colors, radii, shadows, z-index).
- **Constraints**: Reuse existing tokens/classes where the resume flow already defines
  equivalents; responsive (desktop + mobile bottom-sheet); non-color-only indicators.
- **Validation**: Visual check during the Browser Smoke Test (Phase 09); no unit test.
- **Out of scope**: behavior (earlier phases).

---

## Phase 07 — Integration & constitution validation

### T010 — Parsed-data validation & gating integration pass [X]
- **Target**: tests across `tests/services/`, `tests/components/`, `tests/pages/`.
- **Behavior**: Confirm parsed data flows through the same validation as manual entry —
  required company/title/responsibilities/status/lastStatusUpdate, URL validity, enum
  whitelist, date handling; demo mode keeps AI unavailable; local + hosted both work with a
  key (logic is client-side, runtime-agnostic).
- **Constraints**: No new production code unless a gap is found; add focused tests only.
- **Validation**: `npm run test:run` green; `npm run lint` clean.
- **Out of scope**: new feature behavior.

---

## Phase 08 — Release Prep (mandatory)

### T011 — Version bump & lockfile [X]
- **Target**: `package.json`, `package-lock.json` (root version), any in-app version display.
- **Behavior**: Bump `1.4.0` → `1.5.0` (minor — additive feature); sync the
  `package-lock.json` root `version`; update any in-app version readout if present.
- **Validation**: `node -p "require('./package.json').version"` → `1.5.0`; lockfile matches.

### T012 — CHANGELOG, README, roadmap, docs sanity [X]
- **Target**: `CHANGELOG.md`, `README.md`, `docs/feature_roadmap.md`, `docs/REPO_MAP.md`,
  `docs/deployment.md`.
- **Behavior**: Add a `## [1.5.0]` CHANGELOG entry (AI JD parsing, §13 gate, provenance,
  live `jd` toggle); update `README.md` user-facing surface; tick feature 035 on
  `docs/feature_roadmap.md`; add `src/components/JobPostingImport.js` to `docs/REPO_MAP.md`;
  update `docs/deployment.md` **only if** env vars / runtime modes changed (they do not —
  BYOK is browser-only — so note "no change" if accurate).
- **Constraints**: Keep entries factual and scoped to this feature.
- **Validation**: Manual docs read-through; links resolve.

---

## Phase 09 — Browser Smoke Test (mandatory, UI feature)

### T013 — Walk each user story's Independent Test against the merge state
- **Target**: running app (local mode); merged/to-be-merged branch state.
- **Behavior**: Execute, in a real browser:
  - **US1**: key + `jd` on → Smart entry → paste a full posting → Create modal pre-fills
    with ✦ AI markers, status Wishlisted, random compat; edit clears a marker; Create saves.
  - **US2**: Settings `jd` toggle persists; gate shows AI affordance when on; **Smart card
    locked** ("Enable AI in Settings →") when key/toggle off; Manual unaffected.
  - **US3**: simulate AI failure → reason dialog routes correctly (Try AI again / Update key)
    + **Use basic parser** (⚙ Auto) + **Enter manually**; gibberish → NO_TEXT dead-end (no
    basic option); pasted text preserved across retries.
  - **US4**: ✦ AI vs ⚙ Auto markers + correct fill banner; basic fallback never labeled AI.
- **Constraints**: Test desktop and mobile (bottom-sheet/FAB) viewports; verify no key/JD
  text is persisted server-side.
- **Validation**: All Independent Tests pass; record any deviation as a residual-risk note.
- **Out of scope**: automated coverage (handled in earlier phases).
