---
description: "Phased implementation tasks for feature 034 — Profile Page Refresh"
---

# Tasks: Profile Page Refresh

**Input**: Design documents in `specs/034-profile-page-refresh/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/api.md](./contracts/api.md), [quickstart.md](./quickstart.md)
**Design refs**: `docs/design/profile_page.md`, `docs/design/edit_profile_page.md`

**Tests**: REQUIRED. This feature touches forms, settings, parsing orchestration,
and validation, so core logic must have automated tests (constitution Principle V).
Write each test task first and confirm it FAILS before implementing.

**Task format**: `- [ ] T### [P?] [US?] description (path)` followed by an
indented detail block (Files / Behavior / Constraints / Validation /
Out-of-scope). `[P]` = parallelizable (different files, no incomplete deps).

**Architecture anchor**: no DB schema or server API changes; new state is
browser-local (`aiSettings`); the only external call is browser→OpenRouter (BYOK),
reusing the 033 engine. The read-only Profile page is **already shipped** (031/028)
— 034 verifies it. See [research.md](./research.md) R-1…R-11 and its current-state
audit.

**Operator legend**: 👤 = needs a human operator (running app, real browser, or a
real disposable OpenRouter key). Unmarked tasks are agent-executable (code +
automated tests). Any *live* OpenRouter key is operator-supplied; unit/component
tests mock it.

---

## Phase Map

| Phase | Theme | Tasks | Blocks | Operator? |
|---|---|---|---|---|
| 01 | **Foundational** — `aiSettings` rewrite + 033 migration + derived status (+ tests) | T001–T002 | 03,05,06,07 | — |
| 02 | **Foundational** — `llmParser` model param + `validateKey` + reason-code map (+ tests) | T003–T004 | 03,07 | — |
| 03 | **Settings §4.5 redesign** — unified card (AI + Account sub-groups) + CSS | T005–T007 | 05 (deep-link target) | — |
| 04 | **Read-only Profile regression guard** — verify shipped skills/archived/empty | T008 | — | — |
| 05 | **Edit reconcile** — fold consent into key, model slug, AI-off gating + deep-link | T009–T011 | 06 | — |
| 06 | **Mode gate + smart input + Import Bar** | T012–T015 | 07 | — |
| 07 | **Failure handling + provenance + Undo** | T016–T020 | — | 👤 T016 live (opt) |
| 08 | **Reduced-motion + responsive polish + green build** | T021–T023 | 09 | 👤 T022 |
| 09 | **Release Prep (REQUIRED)** — 1.3.0→1.4.0, CHANGELOG, README, REPO_MAP, roadmap, lockfile, docs | T024–T031 | 10 | 👤 T031 |
| 10 | **Browser Smoke Test (REQUIRED — UI)** — walk user stories in a real browser | T032–T036 | merge | 👤 all |

**Sequencing notes:**
- Phases 01 + 02 are foundational and mutually `[P]` (different files); both block the UI phases.
- Phase 03 builds the Settings surface that the Phase 05 "Enable AI in Settings →" deep-link targets — do 03 before finalising that link.
- Same-file chains (NOT parallel): `Profile.js` T006; `ResumeImport.js` T010→T013→T017; `ProfileEdit.js` T011→T013→T014→T017→T018→T019; `main.css` T007→T015→T020→T021.
- Release Prep (09) is second-to-last; Browser Smoke (10) is last — constitution Amendment 1.3.0.

---

## Phase 01: Foundational — AI settings store

**Purpose**: The browser-local source of truth every other phase reads. Rewrite
`aiSettings` to the §7 shape with a one-way migration from 033's key/consent.

- [X] T001 Update unit tests for the AI settings store (`tests/data/aiSettings.test.js`)
  - Files: `tests/data/aiSettings.test.js` (extend existing).
  - Behavior: assert the new shape against a mocked `localStorage` —
    `isEnabled/setEnabled`, `getKey/setKey/clearKey/hasKey` (saving a key = consent),
    `getModel/setModel` (defaults to `DEFAULT_MODEL` when blank/absent),
    `getFeature/setFeature` for `cv|jd|compat`, and `getConnectionStatus(testState?)`
    deriving `none|testing|connected|error`. Cover the **migration matrix**
    (data-model §1): (a) key+consent → enabled=true, key kept, model default,
    `features={cv:true,jd:false,compat:false}`; (b) key, no consent → key kept,
    enabled=false, defaults; (c) no key → brand-new defaults (enabled=false). Assert
    migration runs once and never deletes `alice.ai.openrouterKey`.
  - Constraints: mock `localStorage` (jsdom); no network; no cross-test leakage; never log the key.
  - Validation: this file; must FAIL before T002.
  - Out-of-scope: any DOM/UI; the live `validateKey` network call (Phase 02).

- [X] T002 Implement the AI settings store rewrite + migration (`src/data/aiSettings.js`)
  - Files: `src/data/aiSettings.js` (modify).
  - Behavior: persist `alice.ai.openrouterKey` (reused), `alice.ai.enabled`,
    `alice.ai.model`, `alice.ai.features`; expose the helpers in T001; retire
    `consent` (fold into key — `setKey` is the consent point; remove/redirect
    `hasConsent`); add a one-way migration on first read (data-model §1); provide a
    pure `getConnectionStatus(testState)` deriving status from key presence + the
    in-memory last-Test outcome (never persisted, R-2). Pure logic, no DOM.
  - Constraints: business logic separate from UI (constitution II); trim keys; treat
    empty/whitespace as "no key"; never persist connection status; never log the key.
  - Validation: `tests/data/aiSettings.test.js` passes.
  - Out-of-scope: rendering; the OpenRouter call itself (delegated to `llmParser`).

---

## Phase 02: Foundational — parser service

**Purpose**: Let the parser take a model slug, add a cheap key-validation call, and
centralise the error→reason-code mapping used by both Test and the import dialog.

- [X] T003 [P] Update LLM parser tests — model param, `validateKey`, reason map (`tests/services/llmParser.test.js`)
  - Files: `tests/services/llmParser.test.js` (extend).
  - Behavior: with mocked `fetch`/timers — `parseWithLlm(text, key, model)` sends the
    passed `model` (and defaults to `DEFAULT_MODEL` when omitted, preserving 033
    behavior); `validateKey(key, model?)` issues one auth/models request (NOT a
    résumé parse) → `{ok:true}` on 2xx, `{ok:false, reason}` otherwise; the
    error→reason map (contracts §"Error → reason-code mapping") returns the right key
    for 429/timeout/5xx/network/401/402/NO_TEXT and defaults unknown → `rate_limit` (wait).
  - Constraints: never hit a real network; no real key; assert no résumé tokens spent by `validateKey`.
  - Validation: this file; must FAIL before T004.
  - Out-of-scope: dialog rendering (Phase 07).

- [X] T004 [P] Implement parser model param + `validateKey` + reason map (`src/services/llmParser.js`)
  - Files: `src/services/llmParser.js` (modify).
  - Behavior: change signature to `parseWithLlm(text, key, model = DEFAULT_MODEL)`;
    add `validateKey(key, model?)` (one cheap authenticated request with the existing
    `AbortController` timeout); export a `REASON_CODES` map + a `mapErrorToReason(err|status)`
    helper (R-6 / contracts). Reuse existing JSON sanitisation via `normaliseProfile`.
  - Constraints: keep single-request-per-call; provider-agnostic reason copy; no new dependency; key never logged.
  - Validation: `tests/services/llmParser.test.js` passes.
  - Out-of-scope: which caller passes the model (Phase 05).

---

## Phase 03: Settings §4.5 redesign (unified card)

**Purpose**: Replace the two separate AI/Account cards with one **Settings** card
holding the §4.5.1 AI sub-group and the relocated §4.5.2 Account sub-group.

- [X] T005 [US7] Page tests for the unified Settings card (`tests/pages/profile.aiSettings.test.js`, `tests/pages/Profile.account.test.js`)
  - Files: `tests/pages/profile.aiSettings.test.js` (extend), `tests/pages/Profile.account.test.js` (extend), `tests/pages/Profile.test.js` (adjust if it asserts the old two-card layout).
  - Behavior: exactly one `Settings` card with two labelled sub-groups
    (ARTIFICIAL INTELLIGENCE + ACCOUNT); the old "AI RESUME PARSING" standalone card
    is gone. AI sub-group: master toggle gates the body (panel + feature toggles
    inert when off); status pill reflects `none/testing/connected/error`; key
    save/show-hide/Test/Replace/Delete present; model field is free-text with a
    datalist; **CV** toggle functional + default-on (after key+master); **JD/Compat**
    rendered disabled ("coming soon"). Account sub-group: mode-aware
    (hosted/local/demo) and opens `DeleteAccountModal` unchanged; demo disabled.
  - Constraints: mock `aiSettings`/`authStore`/network; assert structure + a11y
    (labels, `aria-disabled`, non-color status text), not pixels.
  - Validation: these files; must FAIL before T006.
  - Out-of-scope: edit-page flow; CSS values.

- [X] T006 [US7] Implement the unified Settings card (`src/pages/Profile.js`)
  - Files: `src/pages/Profile.js` (modify): replace `renderAiSettingsSection` +
    `renderAccountSection` with a single `renderSettingsSection` composing an AI
    sub-group (master toggle, connection panel: key + show/hide + Test + Replace +
    Delete, status pill via `aiSettings.getConnectionStatus`, model slug + datalist,
    feature toggles) and the Account sub-group (relocated, behavior intact). Update
    `mount()` to render the one card.
  - Behavior: wire controls to `aiSettings` (T002) and `llmParser.validateKey` (T004,
    Test → `testing` → `connected`/`error`); CV default-on; JD/Compat disabled;
    saving a key = consent (no separate consent UI); Delete → `none`.
  - Constraints: reuse `DeleteAccountModal`, `Toast`, `createSection`; keep business
    logic in `aiSettings`/`llmParser`; demo mode handled.
  - Validation: T005 files pass.
  - Out-of-scope: `ProfileEdit`/`ResumeImport`; reduced-motion CSS.

- [X] T007 [P] Settings card styles (`src/styles/main.css`)
  - Files: `src/styles/main.css` (modify).
  - Behavior: styles per design §4.5 — `.section-card` Settings header, `.set-group`
    sub-groups + dividers, `.master-row`+`.sw` master toggle, `.conn-panel` inset +
    status pill states (`connected/none/testing/error`), `.feat-list` toggles,
    disabled ("coming soon") toggle styling, saved-key action row `flex-wrap`
    (no overflow ≤ 344px).
  - Constraints: reuse existing tokens (§8); no JS in CSS; non-color-only status (pair color with text/glyph).
  - Validation: visual in Phase 10; structural assertions in T005.
  - Out-of-scope: gate/dialog/provenance CSS (later phases).

---

## Phase 04: Read-only Profile regression guard

**Purpose**: The read-only page is already shipped (031/028). Lock it in; only fix
a gap if found.

- [X] T008 [P] [US1][US3][US8] Verify read-only Profile render tests (`tests/pages/Profile.test.js`)
  - Files: `tests/pages/Profile.test.js` (extend/verify).
  - Behavior: confirm skills proficiency rows + Sort (Custom / By level ▾▴) +
    collapse-past-10 + scale popover render; mobile sub-section collapse; archived
    link always present (incl. 0) and degrades to 0 on fetch failure; empty state +
    "Set Up Profile". If any assertion reveals a gap vs `profile_page.md`, file the
    minimal fix in `src/pages/Profile.js` and note it here; otherwise this is a
    pure regression guard.
  - Constraints: do NOT rebuild shipped behavior; mock data/network.
  - Validation: this file passes.
  - Out-of-scope: Settings card (Phase 03); chart/stats computation.

---

## Phase 05: Edit reconcile to the new settings

**Purpose**: Make the existing basic import obey the new settings model (consent
folded into the key, model slug, master + CV gating) and add the AI-off deep-link.

- [X] T009 [US5] Tests for import reconcile (`tests/components/ResumeImport.test.js`, `tests/components/ResumeImport.demo.test.js`)
  - Files: `tests/components/ResumeImport.test.js` (extend), `tests/components/ResumeImport.demo.test.js` (extend).
  - Behavior: the separate consent dialog ("Send resume text to OpenRouter?") is
    GONE; the AI path runs only when `isEnabled() && getFeature('cv') && hasKey()`;
    `parseWithLlm` is called with `getModel()`; when AI is off/CV off, Smart input is
    disabled and shows an **"Enable AI in Settings →"** affordance (deep-links to the
    Profile Settings surface). Process button gating unchanged (file chosen or >~20 chars).
  - Constraints: mock `aiSettings`/`llmParser`/extractor; no real network.
  - Validation: these files; must FAIL before T010.
  - Out-of-scope: mode gate / failure dialogs (Phases 06–07).

- [X] T010 [US5] Reconcile `ResumeImport.js` to the new settings (`src/components/ResumeImport.js`)
  - Files: `src/components/ResumeImport.js` (modify).
  - Behavior: remove `shouldAskForConsent`/consent notice; gate the AI path on
    `aiSettings.isEnabled() && aiSettings.getFeature('cv') && aiSettings.hasKey()`;
    pass `aiSettings.getModel()` to `parseWithLlm`; add the AI-off "Enable AI in
    Settings →" affordance (navigates to Profile + scrolls/focuses the Settings card).
  - Constraints: rule-based fallback still works with no key; keep upload/paste UI.
  - Validation: T009 files pass.
  - Out-of-scope: gate/dialog/provenance.

- [X] T011 [US5] Update `ProfileEdit.js` consent/import wiring (`src/pages/ProfileEdit.js`)
  - Files: `src/pages/ProfileEdit.js` (modify).
  - Behavior: remove any `hasConsent` references; ensure the import entry point reads
    the new settings; keep `highlightImport` and discard protection intact. Prepares
    the mount path for the mode gate / Import Bar (Phase 06).
  - Constraints: do not regress save/dirty/discard behavior.
  - Validation: existing `tests/pages/ProfileEdit.test.js` stays green; extended in Phase 06.
  - Out-of-scope: building the gate/Import Bar (Phase 06).

---

## Phase 06: Mode gate + smart input + Import Bar

**Purpose**: Net-new entry flow — split-card gate for first-time setup; collapsed
Import Bar for existing profiles.

- [X] T012 [US5] Tests for mode gate + Import Bar (`tests/pages/ProfileEdit.test.js`)
  - Files: `tests/pages/ProfileEdit.test.js` (extend).
  - Behavior: opening with **no profile** shows the split-card gate over an empty
    form; **Manual entry** / dismiss (X/Esc/backdrop) → blank form; **Smart entry** →
    smart input step. Opening with an **existing profile** shows **no gate** + a
    collapsed Import Bar at top that expands to the smart input. AI-off: gate's Smart
    card disabled + Import Bar non-expandable, both with "Enable AI in Settings →".
  - Constraints: mock profile load + `aiSettings`; assert structure/focus, not pixels.
  - Validation: this file; must FAIL before T013/T014.
  - Out-of-scope: parse success/failure handling (Phase 07).

- [X] T013 [US5] Implement the split-card mode gate (`src/pages/ProfileEdit.js`, `src/components/ResumeImport.js`)
  - Files: `src/pages/ProfileEdit.js` (modify), `src/components/ResumeImport.js` (modify).
  - Behavior: at mount, if the profile is empty show the gate (§3.2) — Smart entry
    (AI sparkle, "Fastest") vs Manual entry; dismiss defaults to manual; Smart →
    smart input step. Gate suppressed when a profile exists. AI-off disables the Smart
    card with the Settings deep-link.
  - Constraints: reuse `AI_sparkle.png`; keyboard + focus-trap; no new persistence (rule is "profile empty?").
  - Validation: T012 passes.
  - Out-of-scope: failure dialogs / provenance.

- [X] T014 [US5] Implement the existing-profile Import Bar (`src/pages/ProfileEdit.js`)
  - Files: `src/pages/ProfileEdit.js` (modify).
  - Behavior: collapsed Import Bar above Basic Info (§3.5); expands to reveal the
    smart input inline (chevron rotates); AI-off → non-expandable lock + Settings link.
  - Constraints: append path only (Phase 07 merge); no overwrite of existing fields.
  - Validation: T012 passes.
  - Out-of-scope: merge/Undo (Phase 07).

- [X] T015 [P] Gate + Import Bar + smart-input styles (`src/styles/main.css`)
  - Files: `src/styles/main.css` (modify).
  - Behavior: split-card gate (backdrop blur, `--indigo-soft` wash on Smart card,
    stack < 600px), Import Bar (indigo-outline + wash + chevron), smart-input
    segmented control/dropzone/paste.
  - Constraints: reuse tokens incl. additions (§8 of edit doc: `--indigo-soft`); responsive.
  - Validation: visual in Phase 10.
  - Out-of-scope: dialog/provenance CSS.

---

## Phase 07: Failure handling + provenance + Undo

**Purpose**: The safety-critical parts — ask-first failures with reason codes,
basic-vs-AI provenance, append + Undo, no partial writes.

- [X] T016 [US5] Tests for failure/provenance/merge (`tests/pages/ProfileEdit.test.js`, `tests/pages/profileEdit.aiIndicators.test.js`)
  - Files: `tests/pages/ProfileEdit.test.js` (extend), `tests/pages/profileEdit.aiIndicators.test.js` (extend).
  - Behavior: AI-unavailable → ask-first dialog showing the correct **code chip +
    cause** (per reason); wait-reasons offer **Try AI again**, settings-reasons offer
    **Update key in Settings →**; **Use basic parser** fills/append + tags sections
    **⚙ Auto-filled** (never ✦). Unreadable → amber dead-end (`NO_TEXT`) with the
    right actions per first-time/existing; no "Use basic parser". **No partial
    writes** — nothing changes until a parse fully succeeds; existing-profile Cancel/
    failure leaves the form unchanged. First-time success marks all sections **✦ AI
    FILLED**; existing append marks only touched sections; **Undo** restores the
    pre-import snapshot exactly. Imported skills arrive unrated.
  - Constraints: mock `llmParser` (success + each reason); deep-clone assertions for Undo.
  - Validation: these files; must FAIL before T017–T019.
  - Out-of-scope: live network.

- [X] T017 [US5] Implement failure dialogs (`src/pages/ProfileEdit.js`, `src/components/ResumeImport.js`)
  - Files: `src/pages/ProfileEdit.js` (modify), `src/components/ResumeImport.js` (modify).
  - Behavior: ask-first AI-unavailable dialog + unreadable dead-end dialog driven by
    `llmParser` reason codes (T004); recovery actions per `fix` class; "Use basic
    parser" routes to the rule-based parser.
  - Constraints: reason copy from the shared map; offending file name shown; no silent fallback.
  - Validation: T016 passes.
  - Out-of-scope: provenance styling.

- [X] T018 [US5] Implement basic-vs-AI provenance markers (`src/pages/ProfileEdit.js`)
  - Files: `src/pages/ProfileEdit.js` (modify).
  - Behavior: section-level pills — `✦ AI FILLED` (sparkle, indigo) for AI fills,
    `⚙ Auto-filled` (neutral, no sparkle) for basic fills; first-time marks all
    populated sections, append marks only touched; transient `epfFlash` on imported
    rows; persists until that section is edited/saved.
  - Constraints: reuse existing AI-indicator infra where practical; sparkle reserved for genuine LLM output.
  - Validation: T016 passes.
  - Out-of-scope: CSS values (T020).

- [X] T019 [US5] Implement append merge + pre-import snapshot + Undo (`src/pages/ProfileEdit.js`)
  - Files: `src/pages/ProfileEdit.js` (modify).
  - Behavior: first-time → fill all from `ParsedProfile`; existing → `mergeResumeData`
    append (lists append, Summary as new paragraph, singular Basic Info only-if-empty,
    skills unrated); capture a deep-clone snapshot before applying; post-import toast
    offers **Undo** restoring the snapshot. Apply only after full parse success.
  - Constraints: reuse `mergeResumeData`/`dedupeSkillsForStorage`; no overwrite/reorder; all-or-nothing.
  - Validation: T016 passes.
  - Out-of-scope: dialog rendering (T017).

- [X] T020 [P] Dialog + provenance + flash styles (`src/styles/main.css`)
  - Files: `src/styles/main.css` (modify).
  - Behavior: ask-first (indigo cloud-off) + unreadable (amber) dialogs, reason
    **code chip** (solid-red rounded-rect on soft-red inset), provenance pills
    (`✦`/`⚙`), `epfFlash` keyframes (~2.6s), processing scrim/spinner.
  - Constraints: reuse tokens (`--indigo-dim`, amber tints, `--color-danger`); non-color-only.
  - Validation: visual in Phase 10.
  - Out-of-scope: reduced-motion (T021).

---

## Phase 08: Reduced-motion, responsive polish, green build

- [X] T021 [P] Reduced-motion coverage for new animations (`src/styles/main.css`)
  - Files: `src/styles/main.css` (modify).
  - Behavior: extend the existing `@media (prefers-reduced-motion: reduce)` block so
    the skill-meter cross-fade, `epfFlash`, and bottom-sheet slide present without
    animation (end-state shown); functional reveals resolve instantly; auto-revert
    timers still fire (FR-013).
  - Constraints: reuse the existing media block; no JS motion gating.
  - Validation: manual in Phase 10; assert the rule exists.
  - Out-of-scope: new animations beyond those above.

- [X] T022 👤 Responsive + reduced-motion spot-check
  - Files: none (manual against `npm run dev`).
  - Behavior: verify Settings card has no overflow at ≤344px (saved-key row wraps);
    gate/Import Bar/dialogs reflow on tablet/mobile; with OS reduce-motion on,
    transitions are suppressed and states reachable.
  - Constraints: real browser; record findings.
  - Validation: noted here; blocks Release Prep if a breakpoint regresses.
  - Result: 2026-06-05 headless Chrome spot-check passed. Settings at 344px had
    no horizontal overflow (`pageOverflow=0`, saved-key/action containers no
    overflow); first-time gate at 390px reflowed to one column with no overflow;
    Import Bar + AI failure dialog at 768px had no overflow and showed `HTTP 429`;
    reduced-motion at 390px produced `0s` skill-meter transitions and no bottom-sheet
    animation.
  - Out-of-scope: code changes (file any as a fix task).

- [X] T023 Lint + full test suite green
  - Files: repo-wide.
  - Behavior: `npm run lint` clean; `npm run test:run` green (incl. demo variants).
  - Constraints: fix only feature-related failures; no unrelated churn.
  - Validation: both commands pass.
  - Out-of-scope: unrelated test debt.

---

## Phase 09: Release Prep (REQUIRED)

**Purpose**: Constitution Amendment 1.1.0/1.3.0 second-to-last phase.

- [x] T024 Version bump 1.3.0 → 1.4.0 (`package.json`, `package-lock.json`, `src/pages/welcome/shared/appMeta.js`)
  - Files: `package.json` (version), `package-lock.json` (root `version` + the root package entry), `src/pages/welcome/shared/appMeta.js` (in-app version display).
  - Behavior: bump all three to `1.4.0` consistently.
  - Constraints: do not run a full `npm install` solely to bump; edit the root version fields only.
  - Validation: `tests/release-metadata.test.js` passes (see T030).
  - Out-of-scope: dependency upgrades.

- [x] T025 CHANGELOG entry (`CHANGELOG.md`)
  - Files: `CHANGELOG.md`.
  - Behavior: add a `1.4.0` section summarising the Settings §4.5 redesign, the
    full smart-import flow (gate/provenance/Undo/reason codes), and reduced-motion.
  - Validation: T030.
  - Out-of-scope: unrelated history edits.

- [x] T026 README updates (`README.md`)
  - Files: `README.md`.
  - Behavior: document the new user-facing surface — unified Settings (BYOK key,
    model, feature toggles), and the guided Setup/Import flow.
  - Constraints: keep concise; no secrets.
  - Validation: T031 docs sanity.
  - Out-of-scope: deployment specifics.

- [x] T027 REPO_MAP check (`docs/REPO_MAP.md`)
  - Files: `docs/REPO_MAP.md`.
  - Behavior: 034 modifies existing files (no new dirs expected). Confirm and update
    only if a new file/asset was introduced; otherwise refresh the module notes for
    `aiSettings.js`/Settings card.
  - Validation: T031.
  - Out-of-scope: large restructures.

- [x] T028 Feature roadmap tick (`docs/feature_roadmap.md`)
  - Files: `docs/feature_roadmap.md`.
  - Behavior: mark 034 Profile Page Refresh delivered.
  - Validation: T031.
  - Out-of-scope: future-feature planning.

- [x] T029 Deployment docs sanity (`docs/deployment.md`)
  - Files: `docs/deployment.md` (likely no change).
  - Behavior: 034 adds no env vars / runtime modes (browser-local only) — confirm and
    note "no change", or add a line if anything shifted.
  - Validation: T031.
  - Result: confirmed no env vars, runtime modes, schema migrations, or deployment action; deployment docs now state the no-change surface for 034.
  - Out-of-scope: infra changes.

- [x] T030 Release-metadata test sync (`tests/release-metadata.test.js`)
  - Files: `tests/release-metadata.test.js`.
  - Behavior: update expected version/CHANGELOG assertions to `1.4.0`.
  - Validation: `npm run test:run` green.
  - Out-of-scope: unrelated tests.

- [x] T031 👤 Docs sanity check
  - Files: docs touched above.
  - Behavior: read-through for accuracy/links; version consistent across package.json,
    lockfile, appMeta, CHANGELOG.
  - Validation: signed off here.
  - Result: `npm run test:run -- tests/release-metadata.test.js`, `npm run test:run`, and `npm run lint` pass on 2026-06-06.
  - Out-of-scope: code.

---

## Phase 10: Browser Smoke Test (REQUIRED — UI)

**Purpose**: Walk each user story's Independent Test in a real browser against the
to-be-merged state (constitution Amendment 1.3.0), using quickstart.md.

- [X] T032 👤 [US1][US7][US8] Read-only Profile + Settings smoke
  - Behavior: profile-exists + empty states render; skills meters/sort/collapse/popover;
    archived link navigates; **one** Settings card with AI + Account sub-groups; master
    gating; status pill (save/Test/Replace/Delete); model datalist; CV on, JD/Compat
    disabled; Account mode-aware; returning-033-user auto-enabled.
  - Validation: noted; screenshots optional.
  - Result: 2026-06-06 PASS — (.1) seeded profile rendered skills meters/sort/collapse/
    popover, archived link navigated, single Settings card with master gating, status
    pill + Save/Test/Replace/Delete, model datalist, CV on / JD-Compat disabled,
    Account mode-correct; (.2) cleared profile showed empty state + Set Up Profile;
    (.3) returning-033 browser (key + granted consent) auto-enabled with master ON,
    key preserved, CV on, no re-entry/consent prompt.

- [X] T033 👤 [US5] First-time setup smoke
  - Behavior: empty profile → Set Up Profile → split-card gate → Smart entry → upload/
    paste → Process → fill all → ✦ AI FILLED on sections; Manual path → blank form.
  - Validation: noted.
  - Result: 2026-06-06 PASS (functional) — empty profile → Set Up Profile → split-card
    gate; Smart entry → smart input → Process filled the form with ✦ AI FILLED on
    populated sections; Manual entry / dismiss → blank form. Operator noted UI/polish
    gripes (non-blocking) to be discussed separately; functionality passes.

- [X] T034 👤 [US5] Existing-profile import + Undo smoke
  - Behavior: Edit Profile → Import Bar → expand → Process → append (nothing
    overwritten) → only touched sections tagged → Undo restores prior state.
  - Validation: noted.
  - Result: 2026-06-06 PASS — existing profile opened to the form with a collapsed
    Smart import bar (no gate); expand → Process appended new entries without
    overwriting/reordering existing ones (Summary appended as a new paragraph, singular
    Basic Info filled only if empty), only touched sections tagged ✦ AI FILLED, imported
    skills unrated; Undo restored the exact pre-import state.

- [X] T035 👤 [US5] Failure paths + AI-off smoke (operator-supplied key)
  - Behavior: trigger AI-unavailable → ask-first dialog with reason chip → Use basic
    parser → ⚙ Auto-filled; unreadable file → NO_TEXT dead-end; AI off/CV off → Smart
    entry + Import Bar disabled with "Enable AI in Settings →" deep-link.
  - Validation: noted.
  - Result: 2026-06-06 PASS — (A) invalid key → ask-first dialog with HTTP 401 chip +
    "Update key in Settings →" (not retry); "Use basic parser" filled ⚙ Auto-filled.
    (C) AI off/CV off → Smart entry + Import Bar disabled with working "Enable AI in
    Settings →" deep-link. (B) initially FAILED — image-only PDF skipped NO_TEXT and the
    LLM hallucinated firstName:"Alice" (system-prompt leak); fixed (empty-text guard in
    ResumeImport.runParser before the LLM call + buildSystemPrompt hardening) and
    re-verified: image-based résumé → NO_TEXT dead-end, text-based résumé still parses.

- [X] T036 👤 [US2][US6] Mobile + reduced-motion + discard smoke
  - Behavior: mobile sub-section collapse; Settings no overflow ≤344px; OS reduce-motion
    suppresses transitions; dirty Back/Cancel → discard-confirmation.
  - Validation: noted; blocks merge if any fails.
  - Result: 2026-06-06 PASS (functional) — mobile sub-section collapse works (desktop
    stays expanded); Settings card no horizontal overflow at ≤344px (saved-key row
    wraps); reduce-motion suppressed skill reveal / import flash / bottom-sheet with
    states still reachable; dirty Back/Cancel showed the discard-confirmation. Operator
    noted a visual bug (non-blocking, details to follow) to be addressed separately.

---

## Coverage: acceptance criteria → tasks

| Spec AC | Tasks |
|---|---|
| AC-001 Profile layout/states | T008, T032 |
| AC-002 Unified Settings card | T005–T007, T032 |
| AC-003 Skill meters | T008, T032 |
| AC-004 Skill sort/collapse/popover | T008, T032 |
| AC-005 Archived link | T008, T032 |
| AC-006 Empty / present states | T008, T032/T033 |
| AC-007 View vs edit separation | T012–T014, T032/T033 |
| AC-008 Sticky Save/Cancel, dirty | T011, T036 |
| AC-009 Discard confirmation | T011, T036 |
| AC-010 Master gating + status pill | T005/T006, T032 |
| AC-011 AI-off Smart/Import deep-link | T009/T010, T012/T013/T014, T035 |
| AC-012 No partial writes; provenance | T016–T019, T034/T035 |
| AC-013 Responsive + mobile collapse | T015, T021, T022, T036 |
| AC-014 Legacy skills render | T008 |
| AC-015 No regression | T008, T023, T032–T036 |
| AC-016 CV functional/JD-Compat disabled | T005/T006, T032 |
| AC-017 033 migration auto-enable | T001/T002, T032 |
| AC-018 Reduced motion | T021, T022, T036 |
