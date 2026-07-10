# Plan Review Quality Checklist: Hosted Password Management

**Gate result**: PASS (revised 2026-07-10 — item 10's finding fixed; original FAIL record preserved unchanged below)
**Purpose**: Validate technical plan completeness and sound design **before** any code is written.
**Created**: 2026-07-10
**Feature**: [plan.md](../plan.md)

> Pre-implementation gate only. Items are checkable against the spec/plan/contracts/data-model themselves. Post-implementation checks (tests pass, grep confirms, Release Prep done) belong to the final review/verification step, not here.

---

## Re-review 2026-07-10 (Codex plan-review finding — Reset Password abandonment)

**Finding (Codex, MINOR)**: the design handoff exposes a close button, Escape, backdrop-click, and a "Back to sign in" link on the Reset Password overlay in addition to Submit, but the spec/plan/tasks package only ever defined an auth-state outcome for the successful-submit path (explicit `signOut()`, spec Clarification 2026-07-10). Since `password-recovery` has no natural expiry of its own once `PASSWORD_RECOVERY` is confirmed (data-model.md §1), an unresolved abandon path could leave `authStore` reporting `password-recovery` while the visible UI had already moved off the Reset Password overlay — a state/UI mismatch, not merely a missing nicety.

**Verified against the actual package**: confirmed the gap was real — spec.md's AC-11/FR-12 and plan.md's Architecture section both described only the submit-success outcome; tasks.md's T020 (as originally written) only wired `updateUser`'s success/failure paths, with no task covering close/Escape/backdrop/"Back to sign in".

**Fixed**, in dependency order:
- **spec.md**: new Clarifications entry (Session 2026-07-10) and new **AC-11a** — every exit from Reset Password, not just a successful submit, ends the recovery session via explicit sign-out; new Edge Case entry states the same.
- **research.md**: D5 extended to cover both the success and abandon paths, with the rejected alternative (leave the session alive until natural expiry) recorded and why it was rejected.
- **data-model.md**: §1's invariant rewritten from "a successful Reset Password transitions..." to "every exit from `password-recovery` transitions...".
- **contracts/api.md**: new guarantee **R7** alongside R6, covering the abandon path explicitly.
- **plan.md**: Architecture's Reset Password mechanism paragraph, Data Flow, and Risks and Tradeoffs all updated to state the resolved invariant instead of flagging it as open.
- **tasks.md**: new **T021** ("Wire explicit sign-out on the Reset Password abandon path") inserted between the former T020 and T021, with T017/T018's task bodies cross-referencing it so the close-handling divergence isn't built by omission; all subsequent task IDs (T021→T042) shifted by one and every cross-reference re-verified against the final numbering; T022's (test suite) and T038's (Browser Smoke Test) expected behavior extended to cover the abandon path and AC-11a respectively.

- [x] 10. (re-confirmed) The extended `authStore` status union's invariants now cover **every** exit from `password-recovery` (success and abandon alike), not just the successful-submit case — see data-model.md §1, contracts/api.md R6/R7, research.md D5, and tasks.md T021.

---

## Re-review 2026-07-10 (Phase 01 implementation — event-ordering correction)

**Not a plan-review finding** (raised during implementation, not by a reviewer) — recorded here because it corrects a claim item 40 below relied on when it was originally checked off.

Line 40 below evidenced the `SIGNED_IN`-before-`PASSWORD_RECOVERY` architectural risk against "a web search of Supabase's documented behavior." During Phase 01 implementation (2026-07-10), that web-search-based hypothesis was checked against the actual installed/pinned `@supabase/auth-js@2.105.4` source (`node_modules/@supabase/auth-js/dist/main/GoTrueClient.js` — see research.md D1 for exact lines) and found to be **factually wrong about the specific event name**: the real sequence is `INITIAL_SESSION` (not `SIGNED_IN`) then `PASSWORD_RECOVERY`. The guard's actual *code* was unaffected — it was written to hold any event that isn't literally `PASSWORD_RECOVERY`, an allow-list design that turned out correct regardless of which other event arrives first — so no implementation change was required, only the comments and test suite (which had modeled the wrong event name) and this planning package's documentation (plan.md, data-model.md, contracts/api.md, quickstart.md, research.md).

Item 40's checkmark is **not revised** — it accurately reflects what was evidenced *at the time of that review* (a web search was the best available evidence pre-implementation), and the risk it identified (an early event could flash `authenticated`) and the mitigation it approved (a guard) were both correct in substance. The correction is to the *specific event name* cited as evidence, not to the soundness of the architecture it was reviewing.

---

## Spec/Plan Alignment

- [x] Plan covers all six spec user stories (US-1 through US-6), each mapped to a phase (US-1→WS2, US-2→WS3, US-3/US-4→WS4, US-5/US-6→cross-cutting gating in WS2/WS3/WS4).
- [x] All three spec Clarifications (2026-07-10) are reflected in the plan: Demo Mode gating (WS2, Persistence Runtimes), explicit post-reset sign-out (research.md D5, contracts R6), dedicated expired-link state on load (research.md D1, contracts R4).
- [x] Non-goals match the spec: no MFA/email-change/social-login/provider-migration, no new rate limiting, no password-composition-rule change beyond the existing 8-char floor.
- [x] The "supersedes feature 018" framing from spec.md's Problem Statement is carried into plan.md's Summary and Architecture ("reversing feature 018's deliberate... decision").

## Architecture Soundness

- [x] Plan identifies the actual current-state seam (`authStore.init()`'s event handling, `AuthOverlay`'s view state machine, `renderAccountGroup`'s mode gate) rather than describing a generic/hypothetical implementation.
- [x] The primary architectural risk (`SIGNED_IN`-before-`PASSWORD_RECOVERY` event ordering) is identified, evidenced (web search of Supabase's documented behavior), and given a concrete mitigation (synchronous URL guard + timeout) rather than left as an unaddressed assumption.
- [x] Change Password's server-side mechanism is grounded in an already-shipped, already-reviewed precedent (`deleteAccount`'s anon-verify + admin-update shape) rather than a novel pattern.
- [x] Forgot/Reset Password are correctly scoped as **no new server route** (client-direct Supabase calls), consistent with how `signInWithPassword`/`signUp` already work — the plan doesn't over-build a server layer that isn't needed.
- [x] Phase dependency ordering is explicit (WS1 is foundational; WS2/WS3 are independent of each other; WS4 depends on WS1) — added during this review (see Follow-up below).

## Data-Model & State Risks

- [x] The extended `authStore` status union's invariants are spelled out (recovery states reachable only at boot; guard fires at most once; explicit sign-out ordering **on every exit path, success or abandon**) — not just a list of new values with no behavioral contract. (Re-checked 2026-07-10 — see Re-review above.)
- [x] The `AuthOverlay`/`WelcomePage` view union extension follows the exact precedent already set by `verification_sent` (reached via `onSuccess`, not a click) rather than inventing a new navigation mechanism.
- [x] No application data model (`applications`/`profile`) is touched; explicitly confirmed against `createRepositories`'s two entities, not just asserted.
- [x] The new `account` repository method (`changePassword`) is specified for **both** runtimes (hosted: real logic; local: `NOT_SUPPORTED` stub), consistent with the existing `delete()` interface-uniformity convention — not hosted-only code that would crash a local/portable request.

## Contract Correctness

- [x] `PATCH /api/account/password`'s error codes (`VALIDATION_ERROR`, `INVALID_PASSWORD`, `NOT_SUPPORTED`, `INTERNAL_ERROR`) are each mapped to a specific triggering condition, not just enumerated.
- [x] The recovery-detection contract (R1–R6) and the direct-Supabase-call contract (F1–F4) are both stated as guarantees the implementation MUST preserve, matching the style/rigor of 044's contracts.md rather than a looser prose description.
- [x] Non-enumeration (F1) is stated as a contract-level guarantee (identical confirmation copy regardless of Supabase's actual result), not left implicit in the UI description alone.

## Test & Measurement Strategy

- [x] Validation Approach names concrete unit/integration coverage for both client (`authStore` guard, `AuthOverlay` views, `PasswordChangeModal`) and server (`PATCH /password`'s four error paths, `requireAuth` gating, local stub).
- [x] The one behavior that unit tests against a mocked client cannot fully verify (D1's real event-ordering assumption) is explicitly called out as requiring a manual/exploratory check, rather than silently assumed correct — and scheduled early (WS1) rather than discovered late (WS4).
- [x] Browser Smoke Test scope is named (US-1 through US-6) and positioned as the final phase per the constitution.

## Constitution Compliance

- [x] No required-field / persistence / `createRepositories` impact.
- [x] Centralized validation: `validatePassword` consolidation into `src/utils/validate.js` is planned as part of this feature, not deferred — directly serves the constitution's "centralized, reusable validation rules" requirement rather than adding a third/fourth duplicate of `PASSWORD_MIN`.
- [x] No new dependency — confirmed against `package.json` (`@supabase/supabase-js` already present); the plan explicitly states which already-available client APIs (`updateUser`, `resetPasswordForEmail`, `admin.updateUserById`) are newly *called*, distinct from newly *installed*.
- [x] No new analytics/tracking; local-first preserved (all three workflows gated to hosted-only code paths, Local Mode structurally unreachable).
- [x] Accessibility: focus trap / ESC / ARIA dialog semantics planned by reuse of `DeleteAccountModal.js`/`AuthOverlay.js`'s existing patterns, not left unaddressed.

---

## Follow-up items from this review (resolved before finalizing)

- **Missing explicit phase list** — the plan referenced `WS1`–`WS4` by name in the Risks and research.md's Open Questions sections without ever defining what each phase contains, which would have left dependency ordering ambiguous for whoever picks this up next (e.g., is WS2 safe to start before WS1 lands, given they share `validatePassword`?). **Fixed**: added an explicit "Phasing (dependency-ordered)" subsection to plan.md's Architecture, stating each phase's scope and cross-phase dependencies (WS2/WS3 independent of each other; both depend only on WS1's shared `validatePassword`; WS4 depends on WS1's status/state-machine work).

## Items intentionally left open (not blocking, tracked in research.md)

These are genuine open questions the plan documents rather than resolves, because resolving them requires information not available from static analysis (an actual deployed env var value, or real-world event timing) — consistent with this checklist's scope (checkable against the plan itself, not requiring implementation first):

- ~~Reset Password abandonment path~~ — resolved 2026-07-10 (see Re-review above); no longer open.
- D1's event-ordering assumption — flagged for a manual verification step at the start of WS1/WS4, not asserted as certain.
- D4's `redirectTo` env var reuse — flagged for a direct inspection of the deployed value before WS3 ships.
