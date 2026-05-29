# Data Model: Loading & Async States

**Feature**: 029 · **Date**: 2026-05-27 · **Status**: Final (Phase 1)

This feature introduces **no persistent state**. There is no schema change, no migration, no new column, no new table, no new RPC. Wire-level API contracts are untouched.

The "data" in this feature is **client-only ephemeral state**, owned by the new `src/utils/asyncUI.js` helper. This document describes those shapes for completeness and for tests to assert against.

---

## 1. Persistence summary

| Layer | Change |
|-------|--------|
| SQLite schema (`server/db.js`) | **None** |
| Supabase Postgres schema | **None** |
| Demo in-memory store (`src/data/demoStore.js`) | **None** — already async-compatible; no shape change |
| Wire-level API request/response | **None** |
| `shared/constants.js` | **None** |
| `src/models/application.js` | **None** |
| `src/models/profile.js` | **None** |
| `server/validation/application.js` | **None** |

If a future amendment changes any of these, this section is the audit trail confirming the original feature did not.

---

## 2. Client-only ephemeral state

### 2.1 — Loading Channel *(spec § Key Entities)*

A named category of async work. **Not persisted, not networked, not exported.** It exists as a documentation concept (in [docs/design/loading.md](../../docs/design/loading.md)) and as an implicit identity in tests.

```text
LoadingChannel ::= 'initial-load' | 'refresh' | 'save' | 'parse' | 'mutation' | 'transition'
```

| Channel | Canonical visual | Used by |
|---------|------------------|---------|
| `initial-load` | Skeleton placeholder + container `aria-busy="true"` | Tracker / Profile / Calendar / ProfileEdit / Archived list cold loads |
| `refresh` | Container `aria-busy="true"`; prior data stays visible | Calendar month/year switch |
| `save` | Button busy (label change + `aria-busy="true"` + disabled); peer actions locked | Application Overlay Save, ProfileEdit Save |
| `parse` | Button busy + inline pending message + input read-only | CreationPicker, Resume Import |
| `mutation` | Button busy; no peer lockout beyond the action's own surface | Card Archive / Unarchive, Modal ★ / 🗄 / ↺, Status Dropdown |
| `transition` | Destination skeleton replaces source; chip / nav `aria-busy="true"` | Tracker view-switcher chip |

There is no runtime enum, no string-set validation. The channel name is documentation; the *behaviour* of each channel is enforced by the helper functions and the call-site test assertions.

### 2.2 — Busy State *(spec § Key Entities)*

Per-surface lifecycle reflected entirely as `aria-busy` on the DOM node.

```text
BusyState ::= 'idle' | 'pending' | 'idle-after-success' | 'idle-after-error'

State transitions (single-bind):
  idle ──run()──▶ pending ──resolve──▶ idle-after-success
                          └──reject───▶ idle-after-error
                          └──abort────▶ idle-after-success (silent; preserved Modal save behaviour)
```

`idle-after-success` and `idle-after-error` are observable distinctions for tests (e.g. "does the modal close on success?", "does the error toast fire on error?") but they are not separate values on the DOM — the attribute is just `aria-busy="true"` or absent.

**Where the state lives:**

- For **button**-bound state: on the `<button>` element. `aria-busy="true"` + `disabled` + label text change.
- For **container**-bound state: on the container element. `aria-busy="true"` only (no disabled — containers don't have a disabled attribute; child clicks are handled by the children themselves).

**Concurrency rules:**

- `run()` is idempotent during pending: a second call while pending returns the *same* in-flight Promise and issues no second request. (FR-009)
- `dispose()` is idempotent: callable during pending (the in-flight request continues server-side, the button is unbound from the helper's listener but its `aria-busy` is cleared) or during idle (no-op).

### 2.3 — Inline Error Block *(spec § Key Entities)*

A DOM subtree returned by `renderInlineError({ target, message, onRetry })` and inserted into the target's slot.

```text
InlineErrorBlock = <div class="inline-error" role="alert" aria-live="polite">
  <p class="inline-error__message">{message}</p>
  <button class="inline-error__retry" type="button">Try again</button>
</div>
```

**Behaviour contract:**

- The block is mounted into the same DOM node that held the skeleton (`target`). The skeleton is removed in the same operation that mounts the block.
- Focus is moved to the `Try again` button on mount. (FR-016)
- `aria-live="polite"` ensures screen-reader announcement. (FR-015)
- Clicking `Try again` invokes `onRetry()` — the caller is expected to re-render the skeleton and re-issue the fetch.
- `dispose()` (on the handle returned by `renderInlineError`) removes the block from the DOM and is idempotent.

**Variants:**

- `message` is a plain string. No HTML, no formatting. The caller picks the wording per surface.
- The block is responsive (sized by its container's CSS); it does **not** inherit `aria-busy` from a parent — once the block is mounted, `aria-busy` is removed from the surrounding container.

---

## 3. Existing data shapes touched (read-only)

These shapes are **referenced** by this feature's call sites but **not modified**.

### 3.1 — `Application` record

Defined in [src/models/application.js](../../src/models/application.js) and [server/validation/application.js](../../server/validation/application.js). This feature does not change any field, does not change any required-field set, does not change any status value.

### 3.2 — `Profile` record

Defined in [src/models/profile.js](../../src/models/profile.js). This feature does not change any field.

### 3.3 — `AbortController` instance (Modal save)

[src/components/Modal.js:35](../../src/components/Modal.js#L35) declares `let _saveController = null;`. The instance is created at save-start, abort is called from the modal-close path, and the instance is nulled in success/error/abort branches. This feature does not change that lifecycle.

### 3.4 — Auth state

`authStore` ([src/data/authStore.js](../../src/data/authStore.js)) is read-only context. The feature respects its subscription model (no edits) — busy states are cleared by the page-transition triggered by an auth-state change, not by direct collaboration with the store.

---

## 4. Validation rules

There is no new field to validate.

The **only** internal-contract validation in this feature lives in `tests/utils/asyncUI.test.js`:

- `bindBusyButton({ button: null })` MUST throw a clear error (we do not silently no-op on bad input).
- `bindBusyButton({ button, action: undefined })` MUST throw on `run()`.
- `renderInlineError({ target: detached_node })` MUST still mount; the caller is responsible for visibility. (We do not enforce "target must be in the document" — detached-mode helps tests.)

---

## 5. State transitions

### 5.1 — Button-bound busy state (canonical save flow)

```
[idle]
   │
   │ user click → bindBusyButton.run()
   ▼
[pending]
   │  aria-busy="true" set
   │  disabled set
   │  label swapped to busyLabel (e.g. "Saving…")
   │  peers (if any) set to disabled
   │
   │ action() awaited
   ▼
   ├──resolve──▶ [idle-after-success]
   │             aria-busy removed
   │             disabled removed
   │             label restored
   │             peers re-enabled
   │             (caller's success branch runs)
   │
   ├──reject───▶ [idle-after-error]
   │             aria-busy removed
   │             disabled removed
   │             label restored
   │             peers re-enabled
   │             Toast.show('Failed to …', 'failure')   [caller-supplied message]
   │             (caller's error branch runs)
   │
   └──abort────▶ [idle-after-success]  (silent)
                 aria-busy removed
                 disabled removed
                 label restored
                 peers re-enabled
                 (no toast — AbortError is caller-handled silently)
```

The `finally` clause in the helper guarantees the cleanup runs once regardless of outcome. (Plan § Risks — Save-path regression in Modal.js.)

### 5.2 — Container-bound busy state (canonical refresh flow)

```
[idle]
   │
   │ caller → bindContainerBusy.run()
   ▼
[pending]
   │  container.aria-busy="true"
   │  (prior children remain visible — no skeleton swap)
   │
   │ action() awaited
   ▼
   ├──resolve──▶ [idle]
   │             aria-busy removed
   │             (caller's success branch swaps children to new data)
   │
   └──reject───▶ [idle]
                 aria-busy removed
                 Toast.show('Failed to …', 'failure')  [caller-supplied]
                 (caller's error branch typically keeps prior data)
```

### 5.3 — Inline error block lifecycle (canonical list-fetch failure)

```
[skeleton rendered] ──┐
                      │ action() rejects
                      ▼
[skeleton removed; inline-error mounted]
                      │
                      │ focus → Try again button
                      │
                      │ user clicks Try again → onRetry()
                      ▼
[inline-error removed; skeleton remounted by caller; action() re-issued]
                      │
                      ▼
                  [skeleton replaced by data on success
                   OR inline-error remounted on failure]
```

---

## 6. Forward-compatibility notes

The state shapes here are designed to admit:

- **Optimistic updates** (future) — by adding a `state ∈ {pending, committed, reverted}` distinction in `bindBusyButton`'s return without changing the DOM contract. Out of scope for v1.
- **Min-display-time hold** (future) — by adding a `busyMinMs?` option to `bindContainerBusy`. Out of scope for v1.
- **Parse cancellation** (future) — by accepting an `abortController?` option in `bindBusyButton`. Out of scope for v1.

None of these are wired or scaffolded in v1; they are listed as zero-cost future hooks the shape already supports.

---

## 7. Test surface

| File | What it asserts |
|------|------------------|
| `tests/utils/asyncUI.test.js` | All state transitions in § 5.1, § 5.2, § 5.3; idempotency of `run()` and `dispose()`; single-network-request guarantee for N rapid `run()` calls; `aria-busy` set + cleared on success / error / abort. |
| `tests/utils/skeletons.test.js` | Each `build…Skeleton()` returns the expected DOM tree; root carries `aria-busy="true"`; reduced-motion class is reachable; the DOM-shape parity for Tracker + Profile is byte-identical to the pre-refactor output (snapshot test). |
| Component / page tests | The state machine in § 5 is exercised end-to-end at each call site (Modal Save, Card Archive, CreationPicker Process, etc.). |

---

## 8. Glossary

- **Channel** — a named category of async work (§ 2.1).
- **Bind** — to associate a DOM element (button or container) with a busy lifecycle via `bindBusyButton` or `bindContainerBusy`.
- **Dispose** — to release a binding without committing a state change. Idempotent. Used during component teardown.
- **Run** — to start the lifecycle: set busy, await the action, clear busy. Returns the action's Promise.
- **Inline-error** — the DOM subtree returned by `renderInlineError` that replaces a skeleton or pending message on failure.
- **`aria-busy`** — the WAI-ARIA attribute used as the single source of truth for "this surface is pending" (§ 3.3 in research.md).
