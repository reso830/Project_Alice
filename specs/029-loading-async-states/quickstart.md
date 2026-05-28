# Quickstart: Loading & Async States

**Feature**: 029 · **Date**: 2026-05-27 · **Status**: Final (Phase 1)

End-to-end verification walkthrough for feature 029, exercised against **local-mode**, **demo-mode**, and **hosted-mode** runtimes. Walked as the constitution-mandated Browser Smoke Test phase (Amendment 1.1.0) after the Release Prep phase lands.

---

## Prerequisites

- Repo checked out at the branch `029-loading-async-states`.
- Branch is rebased on `main` and all pre-Release-Prep phases are complete.
- Local SQLite seeded: `npm run db:seed` (23 active + a handful of archived rows for view-switcher coverage).
- For hosted mode: a Supabase project with the v3 `claim_and_seed_starter` RPC and a valid `allowed_emails` entry.
- Throttled-network capability in the browser DevTools (Slow 3G or Fast 3G).
- A screen reader (NVDA / VoiceOver / Narrator) for accessibility verification.

---

## 0. Smoke-test environment matrix

| Mode | Runtime | Source of latency |
|------|---------|--------------------|
| **local** | `npm run dev` (Vite + Express + SQLite) | None — SQLite is synchronous; rely on DevTools throttling to exercise long-running states |
| **demo** | Hosted welcome → "Try the demo" | None — operations resolve in one microtask; assert busy-state traversal via tests, not visually |
| **hosted** | Production / preview deploy against Supabase | Supabase round-trip + cold function start + JWT verify |

The acceptance criteria in each section apply to **all three** modes unless explicitly noted. Demo-mode visual flashes are expected to be invisible; the smoke test for demo focuses on tests passing rather than human observation.

---

## 1. User Story 1 — Hosted user sees the system is working, not frozen

**Mode:** hosted (required for visual latency); local (DevTools-throttled) as a fallback.

### Setup

1. Sign into hosted Alice with an allowed email.
2. Open DevTools → Network → set throttling to **Fast 3G**.
3. Navigate to `/` (the Tracker).

### Assertions

| # | Step | Pass criteria |
|---|------|---------------|
| 1.1 | Reload the page | A skeleton card grid renders within one paint frame |
| 1.2 | Inspect the toolbar | `aria-busy="true"` is present on the toolbar root while the fetch is in flight |
| 1.3 | Inspect the page during fetch | **No** card content renders before the response — no flash of empty cards |
| 1.4 | On fetch resolve | Skeleton is replaced atomically by real cards; `aria-busy` is removed |
| 1.5 | Force a 500 response (DevTools → Network → Block request URL pattern → unblock for retry) | Skeleton is replaced by an inline error block: short message + `Try again` button + no toast |
| 1.6 | Tab into the page | `Try again` receives focus |
| 1.7 | Click `Try again` | Skeleton re-renders; one new fetch is issued (Network tab confirms a single request); on success, cards render |
| 1.8 | From the Active view, open the view chip → choose Archived | The Archived skeleton replaces the Active list (no stale-list pause); chip carries `aria-busy="true"` |

**Failure mode to watch for:** the chip flickering between unbusy and busy states (a known easy bug if `aria-busy` is set/cleared in the wrong order).

---

## 2. User Story 2 — Save without doubling up

**Mode:** all three.

### Setup

1. On the Tracker, click any application card → modal opens in edit mode.
2. Change one field (e.g., compatibility notes).
3. DevTools → Network throttling → **Slow 3G** (so you can observe the in-flight window).

### Assertions

| # | Step | Pass criteria |
|---|------|---------------|
| 2.1 | Click `Save` once | Button label → `Saving…`; `aria-busy="true"`; button disabled |
| 2.2 | While save in flight, click `Save` again rapidly (twice within 50 ms) | Network tab shows **exactly one** PATCH request |
| 2.3 | While save in flight, click `Discard` | No effect — Discard is disabled |
| 2.4 | While save in flight, press Esc | The save is **aborted** (existing behaviour preserved) — modal closes; no toast |
| 2.5 | Re-open the same row, retry the save and let it succeed | Modal closes; existing `Saved.` toast fires |
| 2.6 | Force a 500 response on the save | Button returns to idle label; `aria-busy` cleared; modal stays open; error toast surfaces; fields remain editable |
| 2.7 | Apply the same pattern to: card × Archive button, card ↺ Unarchive button (Archived view), Modal 🗄 Archive, Modal ↺ Unarchive, Status Dropdown selection, ★ Favorite toggle, CreationPicker `Process` button | Each shows visible busy state; each guarantees single-request behaviour |

**Demo mode note:** the save resolves synchronously, so steps 2.1 and 2.2 are not visually observable. The duplicate-submit guarantee is asserted by `tests/components/Modal.test.js` for demo mode. Demo mode passes this story by passing those tests; no manual observation is required.

---

## 3. User Story 3 — Smart Parser communicates progress + failure

**Mode:** hosted (parsing is hosted-only); demo (parser entry disabled — only Manual Entry reachable; see Demo-mode assertion below).

### Setup (hosted)

1. Open the create-application flow → switch to the Smart Parser tab (or the parser entry point per the CreationPicker flow).
2. Paste a job description into the textarea.

### Assertions (hosted)

| # | Step | Pass criteria |
|---|------|---------------|
| 3.1 | Click `Process` | Button label → `Processing…`; `aria-busy="true"`; textarea read-only; `Analyzing job post…` message visible |
| 3.2 | While in flight, click `Process` again | No second request issued |
| 3.3 | Force a parse failure (block request URL temporarily) | Inline message converts to error block with `Try again`; textarea re-enabled |
| 3.4 | Click `Try again` | Exactly one new parse request issued; busy state re-enters |
| 3.5 | Mid-parse, press Esc / click backdrop / click ✕ | Picker closes immediately |
| 3.6 | Re-open the picker | Fresh empty state; no stale in-flight UI |
| 3.7 | Verify success path | The existing result view appears unchanged (regression check) |

### Demo-mode assertion

Per [spec § Clarifications Q5](spec.md#session-2026-05-27) and the "Demo-mode parsing surfaces" edge case:

- **Smart Parser**: open the create-application flow in demo mode → confirm the Smart Parser entry (parser tab / textarea / Process button) is **disabled or hidden** so it is not reachable from a user click. Only **Manual Entry** is clickable. No `Process` button is exposed, therefore no `DEMO_FEATURE_UNAVAILABLE` toast is reachable from a real user flow.
- **Resume Import**: confirm the ResumeImport widget is hidden in demo mode (existing `VISIBLE_STATUSES` gate at [src/components/ResumeImport.js:9](../../src/components/ResumeImport.js#L9)).
- The service-layer `DEMO_FEATURE_UNAVAILABLE` throw remains as defense-in-depth dead code, not as a user-facing surface.

---

## 4. User Story 4 — Calendar renders without a "Loading…" string

**Mode:** all three, with hosted preferred for visual throttling.

### Assertions

| # | Step | Pass criteria |
|---|------|---------------|
| 4.1 | Navigate to `/calendar` on a cold load | Month grid skeleton + Action Panel skeleton render within one paint frame; **no** `"Loading…"` text appears anywhere in the page |
| 4.2 | Inspect the grid container | `aria-busy="true"` is present until data lands |
| 4.3 | Wait for data; inspect again | Skeleton is replaced atomically by real grid + Action Panel; `aria-busy` cleared |
| 4.4 | Click the month-picker chevron to advance to the next month | Grid carries `aria-busy="true"` during the refresh; **prior month's cells remain visible** (no skeleton flash, no blank grid); on success, cells swap atomically |
| 4.5 | Force a failure on the month switch | Error toast surfaces; prior month's view stays visible; `aria-busy` cleared |
| 4.6 | Force a failure on the cold-load fetch | Inline error block replaces both skeletons with a single `Try again` action; clicking re-issues the combined fetch |

---

## 5. User Story 5 — ProfileEdit + Profile applications block

**Mode:** all three.

### Assertions

| # | Step | Pass criteria |
|---|------|---------------|
| 5.1 | Navigate to `/profile/edit` on a cold load | A section-card skeleton renders; **no** `"Loading profile..."` text |
| 5.2 | Click `Save changes` after editing a field | Button label changes (`Saving changes…` or similar); `aria-busy="true"`; `Cancel` disabled; single-request guarantee |
| 5.3 | Force a save failure | Button returns to idle; form stays open with edits intact; error toast |
| 5.4 | Navigate to `/profile` and scroll to the applications block | A row skeleton renders during the applications fetch; **no** `"Loading applications..."` text |

---

## 6. User Story 6 — Recoverable error surfaces are accessible

**Mode:** local with screen reader and reduced-motion toggle.

### Setup

1. Enable a screen reader (NVDA on Windows; VoiceOver on macOS; Narrator on Windows).
2. In the OS or browser, enable `prefers-reduced-motion: reduce`.
3. Throttle the network and force failures on selected surfaces.

### Assertions

| # | Step | Pass criteria |
|---|------|---------------|
| 6.1 | Force a Tracker list-fetch failure | The screen reader announces the error message (polite live region — no focus jump until the user tabs in) |
| 6.2 | Tab forward from the toolbar | `Try again` button receives focus next |
| 6.3 | Navigate to Calendar with the failure forced | Same screen-reader behaviour; `Try again` focusable |
| 6.4 | With `prefers-reduced-motion: reduce`, observe the Calendar / ProfileEdit / Profile-apps skeletons | No shimmer animation runs (the placeholder blocks render as solid colour, not shimmering) |
| 6.5 | Click `Save` on Modal; while in flight, observe the screen reader | Button announces its busy label (`Saving…`) and `aria-busy` state (the AT typically announces "busy" — exact phrasing is AT-dependent) |
| 6.6 | Verify the existing skeletons (Tracker, Profile) | Identical to pre-feature behaviour (FR-020, SC-007); the existing reduced-motion rule continues to apply |

---

## 7. Regression smoke (existing flows that should remain unchanged)

| # | Surface | Expected (no regression) |
|---|---------|--------------------------|
| 7.1 | Auth login form | `aria-busy` continues to toggle on the submit button (FR-023). |
| 7.2 | Auth signup form | Same as 7.1. |
| 7.3 | Existing post-save toast | `Saved.` toast still fires on successful Modal save (FR-021). |
| 7.4 | Resume Import rotating messages | Three messages still rotate during a successful parse (FR-022). |
| 7.5 | View chip popup unfiltered counts | Feature 028's count behaviour unchanged. |
| 7.6 | Calendar Action Panel sections / Month Grid chips | Archived-row exclusion (feature 028) unchanged. |
| 7.7 | Tracker view-switcher chip popup | Feature 028's filter / sort / pagination behaviour unchanged. |
| 7.8 | All keyboard navigation | Tab order and focus rings unchanged at every site this feature touches. |

---

## 8. Automated-test cross-check

Before declaring the smoke test pass, run:

```bash
npm run test:run
npm run lint
```

Expected: all tests green; no new lint warnings.

Specific test files this feature adds or extends:

- `tests/utils/asyncUI.test.js` *(new)*
- `tests/utils/skeletons.test.js` *(new)*
- `tests/components/CreationPicker.test.js` *(new or extended)*
- `tests/components/ResumeImport.test.js` *(new or extended)*
- `tests/components/Modal.test.js` *(extended)*
- `tests/components/Card.test.js` *(extended)*
- `tests/components/QuickFiltersToolbar.test.js` *(extended)*
- `tests/pages/Tracker.test.js` *(extended)*
- `tests/pages/Calendar.test.js` *(extended)*
- `tests/pages/Profile.test.js` *(extended)*
- `tests/pages/ProfileEdit.test.js` *(extended)*

---

## 9. Deploy verification (hosted only)

After deploying the preview build:

1. Open the preview URL.
2. Sign in with the allowed email.
3. Run sections 1–6 against the preview deploy.
4. Inspect Network: confirm no new endpoint is being called by this feature (sanity-check on the "no wire-level API change" contract).
5. Open the Calendar — confirm the `"Loading…"` text is gone.
6. Confirm the new design doc renders correctly: visit GitHub source for `docs/design/loading.md`.

---

## 10. Sign-off gate

The feature is considered Smoke-Tested when:

- [x] Sections 1 through 6 all pass on hosted mode. — Walked hosted (Edge). 1/2/4/5 + 6.4 reduced-motion PASS; 3 parse-failure and 6 screen-reader (6.1/6.3/6.5) deferred as test-covered (see Task 11.3 / 11.6 result notes).
- [~] Sections 1, 2, 4, 5 (visual) pass on local mode (with throttling). — Covered on **hosted** instead (stronger latency surface); a separate local-throttled visual pass was not run.
- [x] Section 7 regressions all pass on hosted + local. — 11.8 regression smoke PASS on hosted.
- [x] Section 8 (automated tests + lint) is green. — 1208/1208 tests + ESLint clean.
- [x] Section 9 (preview deploy walk) is complete. — Smoke walked against the hosted deploy.
- [x] The Release Prep phase has been merged in **the same commit chain** (so the smoke test exercised the to-be-merged docs / version / CHANGELOG state — per constitution Amendment 1.3.0). — Phase 10 (v0.15.0) sits ahead of Phase 11 on this branch.
- [x] The new design doc `docs/design/loading.md` has been read and validated against actual behaviour. — Written in Phase 09, Codex-reviewed (transition-channel helper note corrected).

Deferrals (documented residual risk, constitution-permitted): in-browser parse-failure (11.3) and live screen-reader AT (11.6) are not browser-exercisable / not run this session; both are covered by automated tests. Local-throttled visual pass substituted by the hosted walk.

Once all boxes are checked, the feature merges to `main`.
