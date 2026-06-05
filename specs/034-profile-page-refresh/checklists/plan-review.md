# Plan Review Checklist: Profile Page Refresh (034)

Pre-implementation quality gates. Resolve every item (or document why deferred)
before `/speckit.tasks` / implementation. Token meanings: `[ ]` open, `[x]` done,
`[~]` deferred-with-reason.

**Sign-off:** reviewed 2026-06-05 against spec.md, plan.md, research.md,
data-model.md, contracts/api.md, tasks.md (pre-implementation). One item deferred
(lint/tests green) — it can only be confirmed once code exists; tracked as tasks
T001/T023. All other gates satisfied by the design artifacts.

## Scope & alignment
- [x] Spec, plan, research, data-model, contracts agree on scope (full proposed
      flow + Settings §4.5 redesign; read-only page is verify-only). *(Spec scope
      wording corrected 2026-06-05 to remove the "delivered by 033 / minor changes"
      contradiction.)*
- [x] The "build the full proposed flow" decision is reflected in phasing
      (Phases 06–07) and Affected Areas.
- [x] Out-of-scope list excludes JD/Compat feature logic, DB/API changes, new deps,
      new parser engine.
- [x] Brief vs design-doc tension is resolved and recorded (spec Clarifications).

## Constitution gates
- [x] Local-first preserved: app fully usable with no key; the OpenRouter key never
      reaches Alice servers; pasted résumé text goes browser-direct to the provider;
      uploaded files pass through `/api/resume/extract` transiently (memory-only, not
      persisted).
- [x] No analytics/tracking added.
- [x] Empty / loading / error states explicit on both pages.
- [x] Non-color-only signals: status pill, provenance pills, reason chips carry
      text/glyphs, not color alone.
- [x] Keyboard operability + labeled controls for all new UI.
- [x] Reduced-motion honored for new animations (FR-013).
- [x] Desktop + tablet + mobile + demo mode covered.
- [x] Final two phases are Release Prep (09) then Browser Smoke Test (10), in order.

## Data & migration
- [x] AI settings target shape matches `profile_page.md` §7 (enabled/apiKey/model/features).
- [x] Connection status is derived, never persisted.
- [x] Migration matrix (key+consent / key-no-consent / no-key) is specified
      (data-model §1) and each row has a planned unit test (T001).
- [x] Existing `alice.ai.openrouterKey` store is reused, never destructively rewritten.
- [x] `hasConsent` retirement: caller identified for update (`ResumeImport.js`, T010/T011).
- [x] Defaults: CV on (after key+master), JD/Compat persisted off + disabled in UI.

## Parser / contracts
- [x] `parseWithLlm(text,key,model)` change is backward-compatible (defaults to
      `DEFAULT_MODEL`).
- [x] `validateKey` does not consume a parse / résumé.
- [x] One shared reason-code map drives both Test and the import failure dialog.
- [x] Unknown errors default to retryable `wait`; copy is provider-agnostic.
- [x] No new server endpoint or response-shape change.

## Edit-page flow correctness
- [x] Mode gate shows only when no profile exists; existing profile → Import Bar.
- [x] No partial writes: data applied only after full parse success.
- [x] Existing-profile Cancel/failed import leaves the form byte-for-byte unchanged.
- [x] Append-only for existing profiles; Summary appends as a paragraph; singular
      Basic Info filled only if empty (reuses `mergeResumeData`).
- [x] Imported skills arrive unrated and gate save.
- [x] Undo restores the exact pre-import snapshot.
- [x] Provenance: ✦ AI on AI fill, ⚙ neutral on basic fill; first-time marks all,
      append marks only touched sections.
- [x] AI-off (or CV-off): Smart entry / Import Bar disabled with "Enable AI in
      Settings →" deep-link; manual unaffected.
- [x] Discard-confirmation on dirty Back/Cancel still works (shipped; guarded by T011).

## Tests & tooling
- [x] Every new behavior in the spec's Acceptance Criteria maps to a planned test
      (tasks.md "Coverage: acceptance criteria → tasks").
- [~] `npm run lint` clean; `npm run test:run` green — **deferred**: cannot be green
      before implementation exists. Gated as a target per phase and enforced at T023
      (and each phase's test task must fail first, then pass).
- [x] Demo-mode variants updated (`*.demo.test.js`) where behavior differs (planned
      T009 ResumeImport.demo).

## Affected-areas accuracy
- [x] "Modify" list is minimal and correct; uncertain files marked "inspect only".
- [x] No unrelated files listed for exhaustiveness.
