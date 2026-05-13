# Quickstart: Application Workflow State Machine (015)

---

## Dev Setup

```bash
# Install dependencies (if not already done)
npm install

# Start dev server (frontend + backend)
npm run dev
```

Server runs on `http://localhost:3000` (or as configured).

---

## Run Tests

```bash
# All tests
npm test

# Model tests only
npm test -- tests/models/application.test.js

# Server integration tests
npm test -- tests/server/applications.test.js

# Component tests
npm test -- tests/components/StatusDropdown.test.js tests/components/Card.test.js
```

---

## Manual Test Script

### Path 1 — Full pipeline progression

1. Create a new application at `Wishlisted`
2. Open the status control → verify **only `Applied`** appears
3. Select `Applied` → confirm status updates
4. Open status control → verify valid options: `Phone Screen`, `Interview`, `Assessment`, `Offer`, `Rejected`, `Withdrawn`, `Ghosted` (no `Wishlisted`, no `Accepted`)
5. Select `Offer`
6. Open status control → verify **only `Accepted`, `Rejected`, `Withdrawn`, `Ghosted`** appear
7. Select `Accepted`
8. Verify badge shows teal color (`#2EC4B6`)
9. Verify status control is **disabled** (visible but non-interactive)

### Path 2 — Terminal state lock (all four)

For each of `Accepted`, `Rejected`, `Withdrawn`, `Ghosted`:

1. Find or create an application at that status
2. Verify the status change button/badge is **visible but disabled**
3. Attempt to click it — confirm no dropdown opens and no error is thrown

### Path 3 — Assessment ↔ Interview loop

1. Advance an application to `Interview`
2. Open status control → verify `Assessment` is present
3. Select `Assessment`
4. Open status control → verify `Interview` is present
5. Select `Interview`

### Path 4 — Wishlisted single option

1. Create or find a `Wishlisted` application
2. Open status control → verify **only `Applied`** is shown (not a long list)

### Path 5 — Modal status control

Repeat Path 1 steps 2–9 using the **detail modal** (open an application) instead of the
card quick-action button.

### Path 6 — Existing records unaffected

1. Locate applications at each pipeline status created before this feature shipped
2. Verify each displays its existing status badge correctly
3. Verify the status control shows the correct valid next transitions for each

---

## Common Issues

**Dropdown shows all statuses (no filtering)**
→ Check that `StatusDropdown.js` is importing `getValidTransitions` from the model
and passing the result instead of `STATUS_VALUES`.

**Terminal state button is still clickable**
→ Check that `Card.js` and `Modal.js` are checking `TERMINAL_STATES.has(status)` and
setting the `disabled` attribute before attaching click handlers.

**PATCH returns 400 for a valid transition**
→ Check that the PATCH handler is importing `isValidTransition` from
`src/models/application.js` (not a stale import path).

**`accepted` badge shows wrong color**
→ Check that `STATUS_CONFIG.accepted.badgeBg` is `'#2EC4B6'` in `src/models/application.js`.

**Existing tests fail after adding `accepted`**
→ Tests that assert `STATUS_VALUES.length` or enumerate all statuses will need updating.
Check `tests/models/application.test.js` and `tests/server/validation.test.js`.
