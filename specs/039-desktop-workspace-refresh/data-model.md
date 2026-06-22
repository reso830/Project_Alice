# Data Model: Desktop Workspace Refresh

## Persisted data — no changes

This feature is **UI/interaction only**. It introduces **no** new persisted entities, **no** new or changed columns, **no** migration, and **no** change to `createRepositories(config)` or either runtime:

- **Local (SQLite)** — no `ensureColumn`, no schema change.
- **Hosted (Supabase)** — no `ALTER TABLE`, no `assertHostedSchema` probe change.
- **Demo** — runs the same frontend on the local path; unaffected.

The application record shape is unchanged. The constitution's required fields remain exactly as today and continue to be validated before save by the existing `validateDraft()` path in `Modal.js`:

| Required field | Source | Status in this feature |
| --- | --- | --- |
| company name (`companyName`) | existing | unchanged — Overview panel |
| job title (`jobTitle`) | existing | unchanged — header title |
| status (`status`) | existing | unchanged — header badge/dropdown |
| last status update (`lastStatusUpdate`) | existing | unchanged — set by status change/save |
| responsibilities (`responsibilities`) | existing | unchanged — Overview panel |

Optional fields (recruiter, location, salary, shift, work setup, min years, URL, general notes, skills, preferred skills, compat fields, timeline) are regrouped into panels but neither added nor altered.

---

## Transient UI state (in-memory only, not persisted)

These are the only "model" additions — runtime state held in module variables, reset on navigation/open, never written to storage.

### `Tracker.js`

| State | Type | Default | Lifetime | Notes |
| --- | --- | --- | --- | --- |
| `_selectedId` | `number \| null` | `null` | page mount → unmount | The application shown in the docked pane. Independent of the modal draft. Reset to `null` on `unmount`; not restored on reload (initial load = empty pane, FR-009). |
| `_isDesktop` | `boolean` | from `matchMedia('(min-width:1100px)')` | page mount → unmount | Drives pane-vs-modal routing and layout. Updated by a `change` listener removed on `unmount`. |

### `Modal.js`

| State | Type | Default | Lifetime | Notes |
| --- | --- | --- | --- | --- |
| `_variant` | `'modal' \| 'pane'` | `'modal'` | open → close | Selects mount point + window-level behaviors. |
| `_target` | `HTMLElement \| null` | `null` | open → close | Pane container (Tracker's `.tracker-detail`) for the `pane` variant. |
| `_panelOpen` | `{ overview, skills, compat, timeline, notes: boolean }` | `{ overview:true, skills:false, compat:false, timeline:false, notes:false }` | open → close | Per-panel collapse flags. Local UI state; never marks the draft dirty (FR-026); reset every `open()`. |

No change to the existing draft model (`_draft`, `_original`, `_mode`, `isDirty`) — collapse and selection live entirely outside it.

---

## Derived state (computed, not stored)

- **Render variant** — `pane` at ≥ 1100px, `modal`/`sheet` below — derived from `_isDesktop` at click time.
- **Selected-card flag** — `application.id === _selectedId`, computed per card in `renderPage()` and passed to `Card.render(app, cbs, { selected })`.
- **Panel previews** — Overview/Skills/Compatibility/Timeline/Notes one-line summaries computed from the current draft at render time (no storage).

---

## Validation

No new validation rules. Saves from the pane variant run the **same** `validateDraft()` (Job Title, Company, Responsibilities required; URL validated when present; Min Years integer-or-blank) and the same centralized `validateUrl()` as the modal. There is no separate persistence or validation path for the pane.
