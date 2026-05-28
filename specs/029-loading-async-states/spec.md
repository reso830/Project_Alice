# Feature Specification: Loading & Async States

**Feature Branch**: `029-loading-async-states`
**Created**: 2026-05-27
**Status**: Draft
**Input**: [`docs/features/029-loading-async-states.md`](../../docs/features/029-loading-async-states.md)
**Depends on**: [`001-app-tracker-ui`](../001-app-tracker-ui/spec.md) (Tracker list rendering), [`007-profile-page`](../007-profile-page/spec.md) (Profile sections), [`012-inline-edit-overlay`](../012-inline-edit-overlay/spec.md) (Application Overlay save lifecycle), [`013-application-smart-parser`](../013-application-smart-parser/spec.md) (CreationPicker parsing flow), [`014-resume-parser-profile`](../014-resume-parser-profile/spec.md) (Resume import parsing), [`019-supabase-persistence`](../019-supabase-persistence/spec.md) (hosted runtime latency surface), [`020-portfolio-demo-mode`](../020-portfolio-demo-mode/spec.md) (demo-mode async parity), [`026-calendar`](../026-calendar/spec.md) (Calendar grid + Action Panel async loads), [`028-archive-applications-view`](../028-archive-applications-view/spec.md) (Archived list + unarchive action)

---

## Clarifications

### Session 2026-05-27 (plan-time)

- Q: FR-008 says modal close paths MUST be "inert" during a Save, but the existing Modal save uses Esc / backdrop / ✕ to abort via `_saveController.abort()`. What is the canonical resolution? → A: **Preserve the abort escape hatch.** "Inert" in FR-008 means "does not commit a different action (does not open a different row, does not switch modes)" — the abort path is allowed and preserved. FR-008 wording revised to remove the literal contradiction.
- Q: Should the 429 `Retry-After` countdown UI (`Try again in N s`) be built in this feature? → A: **Defer.** No current server path returns `Retry-After`; the countdown is speculative UI. The 429 edge case is scoped to "toast + immediate retry available." When/if a future feature returns 429 with `Retry-After`, the countdown is added then. Edge-case wording revised below.
- Q: Is the ">150 ms" in US-1 Acceptance Scenario 5 a behaviour gate (min-display hold) or descriptive perception language? → A: **Descriptive.** Skeleton swap is **immediate** on every view switch — there is no 150 ms timer. Matches Assumption #2 ("no minimum-display-time hold"). AS-5 wording revised to remove the numeric ambiguity.
- Q: Does Discard-with-changes confirmation need its own busy state (FR-007 lists it)? → A: **No — remove from FR-007.** Discard never issues a network request; its only relevant behaviour is being a *peer* of Save (locked while Save is in flight, covered by Task 03.4). The confirm dialog stays synchronous. FR-007 enumeration revised below.
- Q: In demo mode, how should the Smart Parser and Resume Import failure surfaces behave? → A: **Gate the entry UI; no toast.** Demo mode should disable the parser entry in CreationPicker (only Manual Entry remains clickable) and continue to hide the Resume Import widget (already gated via `VISIBLE_STATUSES` in [src/components/ResumeImport.js:9](../../src/components/ResumeImport.js#L9)). Because the user can never click into an in-flight parse in demo mode, no failure / `DEMO_FEATURE_UNAVAILABLE` toast surface is reachable from a real user flow. The defense-in-depth throw in [src/services/resumeApi.js](../../src/services/resumeApi.js) remains as dead-code fallback but is not user-facing. New edge case added below.

---

## Problem Statement

Alice currently runs in two modes with very different latency profiles: a local-mode where SQLite responses return synchronously fast, and a hosted mode where Supabase round-trips, JWT verification, the seed RPC, and AI-backed parsing routinely introduce hundreds of milliseconds — sometimes several seconds on a cold Supabase or a cold serverless function. In hosted mode the application can look frozen, double-clicked actions can fire twice, and parsing flows complete with no clear signal of whether the system is working or stuck.

Today the codebase has **inconsistent loading UX** across surfaces. Tracker and Profile use proper skeleton placeholders ([src/pages/Tracker.js:370-388](../../src/pages/Tracker.js#L370-L388), [src/pages/Profile.js:36-54](../../src/pages/Profile.js#L36-L54)). The Calendar grid and panel show a bare `"Loading…"` string ([src/pages/Calendar.js:159-160](../../src/pages/Calendar.js#L159-L160)). The Profile applications section shows `"Loading applications..."` ([src/pages/Profile.js:153](../../src/pages/Profile.js#L153)). ProfileEdit shows `"Loading profile..."` ([src/pages/ProfileEdit.js:1278](../../src/pages/ProfileEdit.js#L1278)). Auth submit buttons toggle `aria-busy` ([src/pages/welcome/LoginForm.js:65-74](../../src/pages/welcome/LoginForm.js#L65-L74)). The Application Overlay's Save button has **no visible busy state** during persistence. The Smart Parser flow uses a `"Analyzing job post…"` text element ([src/components/CreationPicker.js:99-102](../../src/components/CreationPicker.js#L99-L102)). The Resume import rotates three processing messages ([src/components/ResumeImport.js:22-26](../../src/components/ResumeImport.js#L22-L26)). Five different conventions are visible to users on the same product.

Beyond cosmetics, the inconsistency creates real safety gaps: there is no documented duplicate-submit guard on the Application Overlay's Save button, no cancel/abort path for an in-flight parse, no shared retry surface for failed list loads, and no documented loading state for switching between Tracker views (the recently shipped feature 028 view switcher silently reuses an unmodified list while the new list fetches — see [src/pages/Tracker.js](../../src/pages/Tracker.js)).

This feature **standardises** Alice's loading and async-state behaviour: it names the channels (initial load, refresh, save, parse, mutation, transition), names the visual conventions for each (skeleton, inline indicator, button busy, inline message, disabled-while-pending), retrofits the inconsistent surfaces to those conventions, and adds the safety + recovery affordances (duplicate-submit prevention, error toasts with retry, accessible status messaging) that hosted mode and AI-parsing flows now demand.

---

## Scope

### In scope

- A **shared loading vocabulary** (channels + visual conventions) documented in a design reference, reused across pages and components.
- **Skeleton placeholders** for: Tracker list (existing; preserve), Profile sections (existing; preserve), Calendar month grid, Calendar Action Panel, ProfileEdit, Profile applications section. Replace bare `"Loading…"` strings where a skeleton makes sense given the surface's known dimensions.
- **Button busy state** on: Application Overlay Save, Tracker quick-action buttons that issue writes (Archive, Unarchive, Change Status), Profile "Save changes" / "Cancel", CreationPicker `Process`, Resume import upload, view-switcher chip during an in-flight view change.
- **Inline pending message** for long parses: Smart Parser ("Analyzing job post…"), Resume import (existing rotating messages; preserve), with the channel formalised so future parsers reuse the same convention.
- **Disabled transitional states** to prevent duplicate submits, double-archives, and double-saves while a request is in flight. Re-enable on response (success **or** error).
- **Inline error recovery** for failed list loads — Tracker, Calendar, Profile applications block, Archived list. Surface a `Try again` action where the skeleton lived, not just a toast.
- **Toast-based recovery** for failed mutations (save, archive, unarchive, status change, parse, profile save), with retry where the action is replayable and a clear error message where it is not.
- **View-switch loading state** (Tracker view switcher chip): switching from Active ↔ Archived shows the destination view's skeleton while the new list loads — not a blank list or the stale list with a frozen toolbar.
- **Accessible status messaging**: every busy surface MUST expose `aria-busy="true"` while pending; every recoverable error MUST be announced to assistive tech via the existing toast pattern; new skeleton/spinner UI MUST honour the existing `prefers-reduced-motion` rules already wired for `.skeleton-line` ([src/styles/main.css:5403-5411](../../src/styles/main.css#L5403-L5411)).
- **Mode parity**: behaviour is identical (within latency capability) across local (SQLite), hosted (Supabase), and demo (in-memory). Demo mode operations resolve synchronously but MUST still pass through the same loading channels — no special-case bypass that would mask state-management bugs.

### Out of scope (Non-Goals)

- **Backend performance optimisation** (cache layers, prefetching strategies, query rewrites). The feature improves *perceived* responsiveness only; actual latency is unchanged.
- **Real-time / websocket infrastructure** for live updates.
- **Offline mode** (service worker, request queueing, conflict resolution on reconnect).
- **Background queue systems** for deferred work (resume parsing in a background worker, etc.).
- **Push notifications** for completed long-running work.
- **Optimistic UI updates** — the feature keeps the current pessimistic model (UI commits on response). A separate feature can layer optimistic flows on top of the standardised channels.
- **Request cancellation** for in-flight parses (closing the dialog mid-parse is allowed but does not abort the request server-side).
- **A global progress bar** at the top of the viewport for cross-page navigation. Each page surfaces its own initial-load skeleton.
- **New loading visuals beyond the existing skeleton + inline-busy vocabulary** — no new shimmer styles, no new spinner glyphs, no animations beyond what is already in `main.css`.
- **Retroactive schema or repository changes** — the feature does not alter `applications`, `profile`, or any RPC contract.

---

## User Scenarios & Testing

### User Story 1 — Hosted user sees the system is working, not frozen (Priority: P1)

A user signs into hosted Alice on a slow connection. The Tracker page loads. While the application list is being fetched from Supabase the screen shows a skeleton placeholder that resembles the eventual card grid: shimmering blocks where cards will be, the toolbar dimmed and marked `aria-busy="true"`. The user can see *something* is happening within the first paint, not a blank screen and not a frozen toolbar. When the response arrives, the skeleton is replaced by the real cards. If the response fails, the skeleton is replaced by an inline error message with a `Try again` button — not a silent empty list.

**Why this priority**: This is the highest-impact, most-frequent perceived-performance pain. Every hosted user hits a list fetch on first paint of every page. Without this, hosted Alice feels broken on slow connections regardless of how fast the rest of the app is.

**Independent Test**: With a hosted account, throttle the network in DevTools (Fast 3G), reload the Tracker. The skeleton renders within one frame, the toolbar shows `aria-busy="true"`, no card content flashes before real data arrives. Force the list fetch to 500 — the skeleton is replaced by an inline error with `Try again`. Clicking `Try again` re-issues the fetch and the skeleton returns.

**Acceptance Scenarios**:

1. **Given** a Tracker cold load against a 1.5 s list-fetch latency, **When** the page paints, **Then** a skeleton card grid renders within the first frame, the toolbar carries `aria-busy="true"`, and no real card flashes before the response.
2. **Given** the same cold load, **When** the response arrives, **Then** the skeleton is removed atomically with the real cards (no double-paint flicker), and `aria-busy` is removed.
3. **Given** the list fetch fails (network error, 5xx, parse error), **When** the failure is observed, **Then** an inline error block replaces the skeleton with: a short message, a `Try again` button, and `aria-busy` cleared. No toast is necessary for this surface (the inline error *is* the surface).
4. **Given** a successful retry from the inline error, **When** the user clicks `Try again`, **Then** the skeleton re-renders and the fetch is re-issued; on second success, the cards render normally.
5. **Given** the user has been on the Active view, **When** they switch to Archived via the view-switcher chip, **Then** an Archived-view skeleton replaces the prior Active list **immediately** (no stale-list pause, no blank list, no minimum-display-time hold — a fast response simply produces a brief skeleton flash); the toolbar chip itself carries `aria-busy="true"` for the duration.

---

### User Story 2 — Save without doubling up (Priority: P1)

A user edits an application in the Application Overlay and clicks `Save`. The button immediately enters a busy state: label changes to `Saving…`, `aria-busy="true"`, the button (and the Discard button) become non-interactive. The Esc / backdrop / ✕ close paths during a Save remain available as the user's escape hatch: per [FR-008](#functional-requirements) (resolved at [Clarifications § Q1](#session-2026-05-27)), they invoke the existing abort path (`_saveController.abort()`) — closing the modal also cancels the in-flight save. When the save succeeds the modal closes and the existing toast (`Saved.` or equivalent — the existing flow is preserved) fires. When the save fails the modal stays open, the button returns to its idle state, and an error toast surfaces with the failure reason. When the save is aborted (close path), the modal closes silently — no error toast (preserving the current `AbortError`-handled-silently behaviour at [src/components/Modal.js:755-757](../../src/components/Modal.js#L755-L757)). Clicking `Save` twice in rapid succession **never** causes two network requests.

**Why this priority**: Without this, a hosted user on a flaky connection can — and at the current state, will — double-save, double-archive, or double-create. The data layer's idempotency guard ([server/repositories/supabase/applications.js](../../server/repositories/supabase/applications.js)) catches archive/unarchive races but not general save dupes. Visible busy + disabled-while-pending closes the dupes at the UI.

**Independent Test**: Open an application in Edit mode. Change one field. Click `Save` and immediately click `Save` again before the response lands. Observe the network panel: exactly one PATCH request issued. The button shows `Saving…` for the duration; Discard is inert (no abort wired — Discard is a "throw away edits and close" action with no in-flight request to cancel). Press Esc — the save aborts via `_saveController.abort()`, the modal closes silently, no toast. Repeat from the start; let the save succeed: modal closes, success toast fires. Repeat with a forced 500 response: button returns to idle, error toast fires, modal stays open, fields remain editable.

**Acceptance Scenarios**:

1. **Given** an unsaved edit in the Application Overlay, **When** the user clicks `Save` twice within 50 ms, **Then** exactly one network request is issued.
2. **Given** an in-flight save, **When** the user clicks `Discard`, **Then** the click is inert — the modal stays open and the save continues (Discard has no abort path).
3. **Given** an in-flight save, **When** the user presses Esc, clicks the backdrop, or clicks ✕, **Then** the existing abort path runs (`_saveController.abort()`), the modal closes immediately, **no** post-save toast fires, **no** error toast fires (per FR-008 and the existing `AbortError`-handled-silently behaviour).
4. **Given** an in-flight save, **When** the save resolves successfully (and the user has not aborted), **Then** the modal closes and the existing post-save toast fires (no new toast added by this feature).
5. **Given** an in-flight save, **When** the save resolves with a non-Abort error, **Then** the modal stays open, the button returns to its idle label, the form remains editable, and a single error toast surfaces.
6. **Given** the same pattern, **Then** the same single-request + busy-state guarantees apply to: Tracker card `Archive` button, Tracker card `Unarchive` button, Application Overlay `🗄 Archive`, Application Overlay `↺ Unarchive`, Profile `Save changes`, Status Dropdown selection, and the CreationPicker `Process` button. (Mutations other than Save do not have an abort path in this feature — closing the modal during e.g. an Archive does not cancel the request; see Edge Cases.)

---

### User Story 3 — Smart Parser communicates progress + failure (Priority: P1)

A user pastes a job description into the Smart Parser textarea and clicks `Process`. The `Process` button enters a busy state (label: `Processing…`); an inline status message appears with `Analyzing job post…`. The textarea becomes read-only for the duration. If parsing succeeds the picker advances to its result view (existing behaviour, preserved). If parsing fails (5xx, parse error, AI timeout) the inline message becomes a friendly error with a `Try again` button that re-issues the parse against the same textarea content; the textarea is re-enabled. If the user closes the picker mid-parse (Esc / backdrop / ✕) the picker closes without aborting the request — the request completes server-side and the result is discarded silently. Re-opening the picker shows a fresh empty state, not the prior in-flight UI.

**Why this priority**: AI parsing is the slowest hosted operation (often >3 s); it is also user-initiated and high-trust (the user is waiting deliberately). A frozen-looking `Process` button is the most visible failure mode of hosted mode today.

**Independent Test**: With an AI-backed hosted runtime, paste a known-good job description. Click `Process`. Within one frame: button label switches to `Processing…`, `aria-busy="true"` on the button, inline `Analyzing job post…` message appears, textarea is read-only. While in-flight, attempt to click `Process` again — no second request. On success: existing result view renders. Forcing a 500 response: inline message converts to error with `Try again`. Clicking `Try again` re-issues exactly one new request against the textarea's current content.

**Acceptance Scenarios**:

1. **Given** a populated parser textarea, **When** the user clicks `Process`, **Then** the button enters a busy state, the inline `Analyzing job post…` message renders, the textarea becomes read-only, and `aria-busy="true"` is set on the button.
2. **Given** an in-flight parse, **When** the user clicks `Process` again, **Then** no second request is issued.
3. **Given** a parse failure (AI timeout, 5xx, malformed response, network error), **When** the failure is observed, **Then** the inline message converts to an error block with `Try again` and the textarea is re-enabled.
4. **Given** a parse failure, **When** the user clicks `Try again`, **Then** exactly one new parse request is issued against the textarea's current content; the busy state re-enters.
5. **Given** an in-flight parse, **When** the user closes the picker, **Then** the picker closes immediately. Re-opening shows a fresh empty state — the in-flight result is discarded.
6. **Given** the Resume Import flow on the Profile / ProfileEdit page, **Then** the same vocabulary applies (existing rotating messages and `aria-busy` are preserved; failure surfaces use the same retry pattern as the Smart Parser).

---

### User Story 4 — Calendar renders without a "Loading…" string (Priority: P2)

A user navigates to the Calendar page. While the month grid and Action Panel data is being fetched the screen renders skeleton placeholders that resemble the eventual layout — a 7-column grid of empty cells with shimmering chips for the month grid, and stacked shimmer rows for the Action Panel's Today / Suggested / Upcoming sections. The bare `"Loading…"` strings currently shown ([src/pages/Calendar.js:159-160](../../src/pages/Calendar.js#L159-L160)) are removed.

**Why this priority**: The Calendar is the most data-dense surface and the one whose current loading UX most visibly degrades the product. But it is also a P2 because the bare string is not a *functional* defect — the page does work, it just looks unfinished.

**Independent Test**: Throttle the network. Navigate to `/calendar`. The grid skeleton renders within one frame; no `"Loading…"` string appears. When the data arrives the skeleton is replaced atomically with the real grid + Action Panel.

**Acceptance Scenarios**:

1. **Given** a cold load of the Calendar page, **When** the page paints, **Then** the month grid skeleton and Action Panel skeleton render within the first frame; no bare `"Loading…"` text appears in either slot.
2. **Given** a failed data fetch, **When** the failure is observed, **Then** an inline error block replaces both skeletons with a single `Try again` action that re-issues the fetch for both slots together.
3. **Given** the user changes the month or year while data is already rendered, **When** the new month fetch is in flight, **Then** the grid carries `aria-busy="true"` and the prior month's cells remain visible (no flicker) until the new data lands; if the fetch fails, an error toast surfaces and the prior month's view stays.

---

### User Story 5 — ProfileEdit + Profile applications block use the shared vocabulary (Priority: P2)

A user opens ProfileEdit. The bare `"Loading profile..."` string ([src/pages/ProfileEdit.js:1278](../../src/pages/ProfileEdit.js#L1278)) is replaced by a section-card skeleton aligned with the existing Profile-page skeleton vocabulary. The Profile page's applications block (currently a `"Loading applications..."` string at [src/pages/Profile.js:153](../../src/pages/Profile.js#L153)) is replaced with an application-row skeleton. Save buttons throughout ProfileEdit enter the same busy state defined in User Story 2.

**Why this priority**: Closes the last two surfaces that diverge from the established skeleton convention. Smaller scope than the Calendar — these are existing skeletons being extended, not new visual designs.

**Independent Test**: Open ProfileEdit on a slow connection: the section skeleton renders during the load, no bare `"Loading profile..."` text. Open Profile and scroll to the applications block: a row skeleton renders during the applications fetch, no bare `"Loading applications..."` text.

**Acceptance Scenarios**:

1. **Given** ProfileEdit cold load, **When** the page paints, **Then** a section-card skeleton renders; no `"Loading profile..."` text appears.
2. **Given** the Profile applications block is fetching, **When** the block paints, **Then** an application-row skeleton renders; no `"Loading applications..."` text appears.
3. **Given** ProfileEdit Save in flight, **When** the user clicks `Save changes`, **Then** the same busy-state guarantees from User Story 2 apply (single request, label change, disabled siblings, idle restoration on error).

---

### User Story 6 — Recoverable error surfaces are accessible (Priority: P3)

Every recoverable failure introduced by this feature — list-load failures, save failures, parse failures — is announced to assistive technology. Inline error blocks use the existing toast `role="status"` / `role="alert"` conventions or live-region equivalents already wired in the codebase; new inline error blocks render their message in a region announced on appearance. Reduced-motion users see no shimmer animation (the existing `prefers-reduced-motion` rule is preserved for new skeleton surfaces). Keyboard focus moves into the `Try again` button on inline error blocks so the recovery path is reachable without mouse.

**Why this priority**: Accessibility is constitutional (project constitution §UX requires labeled forms, keyboard navigation, non-color-only signals). It is P3 only because the inline error pattern is *new* — the existing toast pattern already meets these requirements and is unchanged.

**Independent Test**: With a screen reader running, force a list-fetch failure on the Tracker. The error message is announced. Tab into the page — the `Try again` button receives focus. With `prefers-reduced-motion` enabled, the new skeleton surfaces (Calendar, ProfileEdit) render without the shimmer animation.

**Acceptance Scenarios**:

1. **Given** an inline error block is rendered (Tracker, Calendar, ProfileEdit, Profile applications block, Smart Parser), **When** the surface is rendered, **Then** its message is in an `aria-live="polite"` (or stronger) region so it is announced.
2. **Given** an inline error block is rendered, **When** the user tabs into the surface, **Then** the `Try again` button is keyboard-focusable and visually focused.
3. **Given** `prefers-reduced-motion: reduce`, **When** any new skeleton (Calendar grid, Calendar Action Panel, ProfileEdit) renders, **Then** the shimmer animation does not run.
4. **Given** a busy button (Save, Archive, Process, etc.), **When** the busy state is active, **Then** `aria-busy="true"` is set on the button and the label change is in the accessible name (not only a visual change).

---

### Edge Cases

- **Demo mode latency**: demo operations resolve synchronously. The loading channels are still traversed (busy state set, then cleared on the next tick) so the channel infrastructure is exercised in tests and visual artifacts do not flash. Demo mode MUST NOT short-circuit the busy-state machinery.
- **Demo-mode parsing surfaces (Smart Parser + Resume Import)**: in demo mode the AI-backed parser is **not** reachable from the UI. The Resume Import widget is hidden (`VISIBLE_STATUSES` set excludes `demo` — see [src/components/ResumeImport.js:9](../../src/components/ResumeImport.js#L9)); the Smart Parser entry in CreationPicker MUST be similarly disabled so only Manual Entry is clickable. The user never sees an in-flight parse, a failure inline-error, or a `DEMO_FEATURE_UNAVAILABLE` toast — the entry UI is gated upstream of the action. This is a small additive behaviour change to CreationPicker introduced by this feature (Task 05.1).
- **Very fast hosted responses (<150 ms)**: the busy state is brief but real. The feature does **not** introduce a minimum-display-time shimmer hold — premature optimisation. If flashing becomes a problem in QA, defer to a follow-up.
- **Tab/window blur during in-flight save**: the request continues; the busy state is preserved; on resolution the modal closes (or surfaces error) as normal.
- **Server returns 401 mid-session** (token expired): existing auth flow handles redirect; the busy surface clears as part of the page transition triggered by the auth store.
- **Server returns 429 (rate limit)**: surfaces the standard error toast with the rate-limit message; `Try again` allows immediate retry. The `Retry-After` countdown UI (`Try again in N s`) is **deferred** to a follow-up feature — no current server path returns `Retry-After`, so building speculative countdown UI is out of scope here (per [Clarifications § Session 2026-05-27 Q2](#session-2026-05-27)).
- **Network offline during list load**: the inline error surfaces "Couldn't load. Check your connection." with `Try again`. No special offline-mode flow.
- **In-flight request when the user navigates away** (e.g., clicks Calendar nav while Tracker is mid-load): the page-transition cancels the local listener; the in-flight request is allowed to complete server-side and its result is discarded. The destination page's own loading flow takes over.
- **Skeleton size mismatch**: if the eventual data is dramatically shorter (e.g., 0 archived rows when the skeleton showed 3 rows), the skeleton is replaced atomically with the empty state — no transitional "shrinking" animation.
- **Multiple simultaneous fetches on the same page** (e.g., Profile fires both `getProfile()` and `getAll()`): each surface has its own busy-state lifecycle; the page reveals each section's skeleton independently. No global "wait until everything is done" gating.
- **`prefers-reduced-motion` toggled mid-session**: the existing CSS media query handles new skeleton surfaces by reusing `.skeleton-line`'s existing rule. No JS reactivity needed.
- **Calendar month switch while a prior month fetch is in-flight**: only the most recent month switch's result is rendered; earlier in-flight requests' results are discarded. The grid `aria-busy` remains `true` until the most recent request resolves.
- **Smart Parser dialog re-opened after closing mid-parse**: the picker re-mounts to its empty state. The prior in-flight request completes server-side and is discarded by the closed view. No stale-result race.

---

## Requirements

### Functional Requirements

#### Shared vocabulary

- **FR-001**: The system MUST expose a documented vocabulary of loading channels: `initial-load`, `refresh`, `save`, `parse`, `mutation`, `transition`. Each channel MUST have a single canonical visual convention applied across surfaces.
- **FR-002**: The visual convention for `initial-load` MUST be a skeleton placeholder (existing `.loading-skeleton` / `.skeleton-card` / `.skeleton-section` / `.skeleton-line` classes) with `aria-busy="true"` on the container; this is already used on Tracker + Profile and MUST be extended to Calendar, ProfileEdit, and the Profile applications block.
- **FR-003**: The visual convention for `save`, `mutation`, and `parse` action buttons MUST be a busy-state pattern: the button's accessible name changes to the channel verb (`Saving…`, `Archiving…`, `Unarchiving…`, `Processing…`, etc.), `aria-busy="true"` is set on the button, and the button is non-interactive for the duration of the request.
- **FR-004**: The visual convention for `refresh` (the same data is being re-fetched after it was previously rendered) MUST set `aria-busy="true"` on the container while leaving the prior data visible (no skeleton; no flash). The Calendar month/year switch flow is the canonical example.
- **FR-005**: The visual convention for `transition` (one view being replaced by another — view switcher, page nav with a non-trivial load) MUST show the destination's skeleton, not the source's stale data. The view-switcher chip MUST itself carry `aria-busy="true"` for the duration.
- **FR-006**: The system MUST NOT introduce any visual style outside the existing skeleton-line/skeleton-section vocabulary. No new spinner glyphs, no new shimmer hues, no new animations.

#### Duplicate-submit prevention

- **FR-007**: Every action button that issues a write (Application Overlay Save, Tracker card Archive / Unarchive / Status Dropdown, Application Overlay 🗄 Archive / ↺ Unarchive / ★ Favorite, ProfileEdit `Save changes`, CreationPicker `Process`, Resume import upload, view-switcher chip during transition) MUST become non-interactive while its request is in flight. Discard is **not** in this list — it issues no network request; it appears here only as a *peer* of Save (see FR-008), locked while Save is in flight.
- **FR-008**: While an action is non-interactive, peer actions that operate on the same record (e.g., Discard while Save is in flight) MUST also be non-interactive. Modal close paths (Esc, backdrop, ✕) during a Save or other commit MUST NOT commit a different action (open a different row, switch modes, mutate other fields) — but they MUST continue to invoke the existing abort path (`_saveController.abort()`), preserving the user's escape hatch for a hung request. The Save's `aria-busy` is cleared in the abort branch. Close paths during a parse remain a deliberate cancellation per US-3 (the picker closes; the in-flight request completes server-side and is discarded by the closed view).
- **FR-009**: Clicking the same action twice within the same in-flight window MUST issue exactly one network request. This MUST be guaranteed at the UI layer (button disabled / `aria-busy`) and MUST NOT rely on server-side idempotency alone.

#### Inline error recovery

- **FR-010**: A failed list fetch on Tracker, Calendar (grid + Action Panel together), Profile applications block, and Archived list MUST replace the skeleton with an inline error block containing a short user-facing message and a `Try again` button. No toast is required for these surfaces (the inline block is the recovery surface).
- **FR-011**: Clicking `Try again` MUST re-issue exactly one fetch and re-enter the skeleton state for the duration.
- **FR-012**: A failed parse (Smart Parser, Resume import) MUST convert the inline pending message into an inline error with `Try again`; the user's input (textarea content, uploaded file reference) MUST be preserved so retry uses the same input.
- **FR-013**: A failed mutation (Save, Archive, Unarchive, Status Change, Profile Save) MUST surface a toast with a short error message; the originating button MUST return to its idle state; the modal / form MUST stay open with the user's edits intact.

#### Accessibility

- **FR-014**: Every busy container MUST set `aria-busy="true"` while pending and remove it on resolution (success or error).
- **FR-015**: Every inline error block MUST render its message in an `aria-live` region (polite by default; assertive only for security-relevant failures) so screen readers announce it without focus change.
- **FR-016**: Every `Try again` button MUST be reachable by keyboard within the natural tab order of the surface it replaces.
- **FR-017**: The existing `prefers-reduced-motion` rule for `.skeleton-line` ([src/styles/main.css:5403-5411](../../src/styles/main.css#L5403-L5411)) MUST be honoured by every new skeleton surface introduced by this feature (Calendar grid, Calendar Action Panel, ProfileEdit, Profile applications block).

#### Mode parity

- **FR-018**: Local mode (SQLite), hosted mode (Supabase), and demo mode (in-memory) MUST traverse the same loading channels for every covered surface. Demo-mode operations resolve synchronously but MUST set and clear the busy state through the same code path.
- **FR-019**: No surface MUST short-circuit the busy lifecycle on the assumption that a given mode is "fast enough" — the busy state is a contract, not an optimisation.

#### Existing-surface preservation

- **FR-020**: The Tracker list skeleton ([src/pages/Tracker.js:370-388](../../src/pages/Tracker.js#L370-L388)) and Profile section skeleton ([src/pages/Profile.js:36-54](../../src/pages/Profile.js#L36-L54)) MUST be preserved structurally; this feature standardises around them, not against them.
- **FR-021**: The existing post-save toast on the Application Overlay MUST be preserved; this feature adds the busy state during the save, not a new success toast.
- **FR-022**: The existing Resume Import rotating processing messages ([src/components/ResumeImport.js:22-26](../../src/components/ResumeImport.js#L22-L26)) MUST be preserved; the channel is formalised so future parsers reuse the same convention.
- **FR-023**: The existing auth-form `aria-busy` toggling on submit buttons ([src/pages/welcome/LoginForm.js:65-74](../../src/pages/welcome/LoginForm.js#L65-L74), [src/pages/welcome/SignupForm.js:92-101](../../src/pages/welcome/SignupForm.js#L92-L101)) MUST be preserved; this feature treats them as conformant.

#### Constitutional requirements

- **FR-024**: System MUST preserve required job application fields: company name, job title, status, lastStatusUpdate, responsibilities (Constitution Amendment 1.2.0) — the loading-state changes do not alter the data model.
- **FR-025**: System MUST NOT introduce external analytics, tracking, or data sharing as part of loading-state instrumentation.
- **FR-026**: System MUST support desktop and mobile browsers, labeled forms, keyboard navigation, and non-color-only status communication for every new loading / error surface introduced (skeletons, busy buttons, inline error blocks, `Try again` actions).
- **FR-027**: System MUST provide automated tests for the new behaviour: button-busy state during save / archive / unarchive / parse; duplicate-submit prevention (single-request guarantee); inline error rendering on list-fetch failure; `Try again` re-issuing the fetch; `aria-busy` set and cleared on each channel; reduced-motion respected; mode parity (busy lifecycle traversed in demo mode despite synchronous resolution).

---

### Key Entities

- **Loading Channel** *(client concept, no persistence)*: a named category of async work — one of `initial-load`, `refresh`, `save`, `parse`, `mutation`, `transition`. Each channel binds to a canonical visual convention (FR-001 through FR-005).
- **Busy State** *(client concept, no persistence)*: per-surface boolean lifecycle: idle → pending → idle (success) | error (transient). Reflected as `aria-busy` plus the visual convention of the channel.
- **Inline Error Block** *(new visual artifact, no persistence)*: a replacement for a skeleton / inline pending message when the underlying request fails. Contains: a short message, a `Try again` button, accessible live-region announcement. Defined per surface but follows a single shape.
- **Action Button** *(existing UI element — extended)*: every button that issues a write gains the busy-state contract (FR-003, FR-007–FR-009). No data-model change.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: On every covered surface (Tracker list, Calendar grid + Action Panel, Profile sections, Profile applications block, ProfileEdit, Archived list, Application Overlay Save, Smart Parser, Resume Import, view-switcher chip), a busy state is visibly active within **one paint frame** of the originating user action or page load.
- **SC-002**: Duplicate-submit prevention: an automated test suite asserts that for every action covered by FR-007, clicking the action **N times** within the in-flight window issues exactly **1** network request.
- **SC-003**: Zero bare `"Loading…"` / `"Loading applications..."` / `"Loading profile..."` strings remain in the rendered UI for the surfaces covered by FR-002. (The Calendar page, ProfileEdit, and Profile applications block specifically.)
- **SC-004**: Every busy surface exposes `aria-busy="true"` while pending and removes it on resolution; automated tests assert this for each surface.
- **SC-005**: Every covered list-fetch surface (FR-010) replaces its skeleton with an inline error block on failure and recovers via `Try again` — verified by automated tests that force a failed fetch and assert the `Try again` flow re-issues the fetch.
- **SC-006**: Browser smoke test (constitution-required final phase): on desktop + mobile viewports, with the network throttled, a user can: cold-load the Tracker (skeleton → cards), switch to Archived (skeleton → archived cards), open an application and save (button busy → close), force a parse and observe `Try again` recovery, navigate to Calendar (skeleton → grid), open Profile (skeleton → sections), open ProfileEdit (skeleton → form). No surface flashes "Loading…" text and no double-submit produces a duplicate row in the database.
- **SC-007**: Zero regressions to the existing skeleton vocabulary on Tracker and Profile — those surfaces' visual output is byte-identical before and after this feature lands (verified by snapshot test or equivalent).
- **SC-008**: `prefers-reduced-motion: reduce` disables shimmer on every new skeleton introduced by this feature; verified by automated CSS / DOM test.

---

## Assumptions

- **Pessimistic save model is preserved.** The feature does not introduce optimistic UI; the commit happens on the server response. (A future feature can layer optimistic flows on the channel vocabulary defined here.)
- **No minimum-display-time hold for skeletons / busy states.** A 50 ms response shows a 50 ms busy state. If flashing becomes a QA finding, a hold is addressed in a follow-up — not in this feature.
- **No request cancellation.** Closing a dialog mid-parse does not abort the request server-side; the result is silently discarded by the closed view. Adding `AbortController` wiring is deferred.
- **Existing toast component is sufficient** for mutation error surfaces (FR-013). No new toast variants are introduced.
- **`prefers-reduced-motion` plumbing is already adequate** — the existing CSS rule ([src/styles/main.css:5403-5411](../../src/styles/main.css#L5403-L5411)) covers `.skeleton-line` and naturally extends to new skeletons reusing the class.
- **The view-switcher chip's `aria-busy` is a new addition.** The existing chip ([src/components/QuickFiltersToolbar.js](../../src/components/QuickFiltersToolbar.js)) does not signal in-flight transitions; this feature adds that signalling.
- **Demo mode operations remain synchronous.** The busy lifecycle is traversed in one tick — set busy, complete, clear busy — which is enough to exercise the contract in tests but invisible at human timescales.
- **No new dependency is introduced.** The feature uses existing DOM helpers, existing toast infrastructure, existing CSS classes, and existing fetch patterns. No state library, no animation library, no observability sink.
- **Hosted-mode latency is the primary motivator.** Local mode and demo mode are not pain points; they benefit incidentally from the consistency this feature creates.
- **The Application Overlay's Save button currently has no documented busy state.** This is treated as a gap to close, not a regression to preserve. (Confirmed by code inspection at the time of writing — no `aria-busy` toggling found in [src/components/Modal.js](../../src/components/Modal.js).)
