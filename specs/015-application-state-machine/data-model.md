# Data Model: Application Workflow State Machine (015)

No schema changes. All additions are to the application model constants.

---

## STATUS_VALUES (after change)

```js
export const STATUS_VALUES = [
  'wishlisted',
  'applied',
  'phone_screen',
  'interview',
  'assessment',
  'offer',
  'accepted',   // new — inserted here, before terminal states
  'rejected',
  'withdrawn',
  'ghosted',
];
```

---

## STATUS_CONFIG — new entry

```js
accepted: {
  label: 'Accepted',
  badgeBg: '#2EC4B6',
  badgeText: '#212529',
  borderAccent: '#2EC4B6',
},
```

---

## TRANSITIONS (new export)

```js
export const TRANSITIONS = {
  wishlisted:   ['applied'],
  applied:      ['phone_screen', 'interview', 'assessment', 'offer', 'rejected', 'withdrawn', 'ghosted'],
  phone_screen: ['interview', 'assessment', 'offer', 'rejected', 'withdrawn', 'ghosted'],
  interview:    ['assessment', 'offer', 'rejected', 'withdrawn', 'ghosted'],
  assessment:   ['interview', 'offer', 'rejected', 'withdrawn', 'ghosted'],
  offer:        ['accepted', 'rejected', 'withdrawn', 'ghosted'],
  accepted:     [],
  rejected:     [],
  withdrawn:    [],
  ghosted:      [],
};
```

---

## New helper exports

```js
export const TERMINAL_STATES = new Set(['accepted', 'rejected', 'withdrawn', 'ghosted']);

export function getValidTransitions(status) {
  return TRANSITIONS[status] ?? [];
}

export function isValidTransition(current, next) {
  return (TRANSITIONS[current] ?? []).includes(next);
}
```

---

## Layer propagation

| Layer | File | Impact |
|-------|------|--------|
| Model (source of truth) | `src/models/application.js` | Add `accepted`, `TRANSITIONS`, helpers |
| Shared constants | `shared/constants.js` | Re-exports `STATUS_VALUES` (auto-picks up `accepted`); also re-exports `isValidTransition`, `getValidTransitions`, `TERMINAL_STATES` for server use. **Modified.** |
| Server validation | `server/validation/application.js` | `status` refine checks `STATUS_VALUES.includes(value)` — auto-picks up `accepted`. No change needed. |
| Server PATCH route | `server/routes/applications.js` | Import and call `isValidTransition` / `TERMINAL_STATES` from `shared/constants.js` |
| UI dropdown | `src/components/StatusDropdown.js` | Import and call `getValidTransitions` |
| UI card | `src/components/Card.js` | Import and check `TERMINAL_STATES` |
| UI modal | `src/components/Modal.js` | Import and check `TERMINAL_STATES` |

---

## DB schema

No change. The `status` column is unconstrained `TEXT`. Adding `'accepted'` to
`STATUS_VALUES` is sufficient for validation. No migration needed; no existing record
uses `'accepted'`.
