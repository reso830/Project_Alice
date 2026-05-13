# Research & Decisions: Application Workflow State Machine (015)

---

## D-001 — Where does transition validation live?

**Options considered:**

| Location | Pros | Cons |
|----------|------|------|
| `server/db/applications.js` (`update()`) | Single enforcement point; no double fetch | Mixes business logic with data layer; harder to test in isolation |
| `server/routes/applications.js` (PATCH handler) | Consistent with existing validation pattern; route already handles all other 400 cases | Requires one extra `getById` call per status-change PATCH |
| `server/validation/application.js` (Zod schema) | Validation consolidated | Cannot access current DB state from a stateless Zod schema |
| A new `server/services/` layer | Clean separation | Over-engineered for one guard check |

**Decision**: Route handler. This keeps the data layer free of business logic, is
consistent with how the route already handles `NOT_FOUND` (by calling `getById`), and
makes the validation path easy to test directly.

---

## D-002 — Should the status-change control be hidden or disabled for terminal states?

**Options considered:**

- **Hidden**: Cleaner UI; but the user gets no feedback about why the action is gone.
- **Disabled (visible, non-interactive)**: Communicates that the workflow is complete,
  not just absent. Matches the spec requirement: "remain visible but disabled to clearly
  communicate that the application workflow is already completed."

**Decision**: Disabled. The spec is explicit. A disabled button with a tooltip or
contextual cue can communicate finality without surprising the user.

---

## D-003 — What happens with an unknown/corrupted status in the DB?

A record could hold a status string not in `STATUS_VALUES` (e.g. from a direct DB
edit, an older migration, or a bug).

**Options considered:**

- Crash / error state
- Fallback to `wishlisted` (existing behavior in `validateApplication`)
- Treat as terminal (lock control, show status value as-is)

**Decision**: `getValidTransitions` returns `[]` for any status not in `TRANSITIONS`.
This makes unknown statuses behave like terminal states at the UI layer — the control is
disabled. The record remains fully editable for all non-status fields. This is safer than
silently coercing the status. The existing `validateApplication` coercion on the client
still applies and would reset the display value to `wishlisted`; the net effect is the
button is disabled on an app showing `wishlisted` status, which is unexpected but not
data-corrupting. The edge case is documented; a follow-on cleanup could detect and
surface it.

---

## D-004 — Should TRANSITIONS be a `const` object or a `Map`?

A plain object (`Record<string, string[]>`) is more readable, JSON-serializable, and
consistent with the existing `STATUS_CONFIG` pattern in the same file. A `Map` offers no
practical advantage here (keys are always strings, lookup is not a hot path).

**Decision**: Plain object.

---

## D-005 — Where to insert `accepted` in STATUS_VALUES?

Current order groups active states first, then terminal states at the end
(`rejected`, `withdrawn`, `ghosted`). `accepted` is a terminal state and should be
grouped with the others. Placing it immediately after `offer` (the state that
transitions to it) is the most readable ordering.

**Decision**: Insert after `offer`, before `rejected`:
```
..., 'offer', 'accepted', 'rejected', 'withdrawn', 'ghosted'
```

---

## D-006 — Should the current status appear in the dropdown?

The existing `StatusDropdown` shows all statuses and marks the current one with a `✓`.
After this change, the dropdown iterates `getValidTransitions(currentStatus)` instead.
The current status will never be in that list (a status cannot transition to itself).

**Options considered:**

- Keep current status visible for reference
- Omit it (show only next states)

The spec states: "users should only see statuses that are valid **next transitions**."
This implies the current status is not shown.

**Decision**: Current status is not included in the filtered list. The `✓` check-mark
logic in `createOption` becomes inactive but is left as-is — removing it is cleanup
and not a correctness concern.
