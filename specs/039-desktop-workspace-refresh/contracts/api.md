# API Contracts: Desktop Workspace Refresh

## No API changes

This feature adds, removes, and changes **no** HTTP routes, request/response shapes, or client API methods. It is a frontend presentation/interaction change only. The backend (`server/`), `createRepositories(config)`, and all Express routes are untouched.

The UI continues to consume the **existing**, unchanged client API surface (`src/services/api.js`):

| Method | Used by | Role in this feature |
| --- | --- | --- |
| `api.getAll(options)` | `Tracker.js` | Loads the master list (Active/Archived). Unchanged. |
| `api.getById(id)` | `Tracker.js` → pane/modal open | Loads the full application for the detail surface (pane or modal). Unchanged. |
| `api.getProfile()` | `Tracker.js` | Already fetched at page init; passed into the detail surface for skill proficiency + compatibility. Unchanged. |
| `api.update(id, payload, opts)` | `Modal.js` (save, favorite, status) | Persists edits from either variant. Unchanged. |
| `api.create(payload)` | `Modal.js` (Create mode) | Creation flow unchanged (still a centered overlay). |
| `api.archive(id)` / `api.unarchive(id)` | `Card.js`, `Modal.js` | Archive/unarchive unchanged. |

## Internal component contracts (frontend, not HTTP)

The only new "contracts" are internal JS component interfaces, documented here for the tasks/implementation phase:

### `Modal.open(application, options)` — extended (additive)
- `variant?: 'modal' | 'pane'` — default `'modal'`.
- `target?: HTMLElement` — required when `variant === 'pane'`; the container to mount into.
- `onClosed?: () => void` — invoked when the pane is cleared (host returns to empty state).
- All existing options (`mode`, `profile`, `prefill`, `aiFields`, `fillSource`, `notice`, `onApplicationUpdate`, `onApplicationCreate`, `onArchiveSuccess`, `onUnarchiveSuccess`, `onOpenSettings`, `onOpenProfile`) are unchanged.

### `Modal.requestClose(): Promise<boolean>` — new (additive)
- Wraps the existing `_attemptClose()`. Resolves `true` if the surface closed (clean, or user chose Discard), `false` if the user chose "Keep editing". Used by the Tracker dirty-switch guard.

### `Card.render(application, callbacks, options)` — extended (additive)
- `options.selected?: boolean` — default `false`. Adds `card--selected` + `aria-selected="true"` when true.

### `OPanel({ icon, title, tone, open, onToggle, preview, children })` — new
- Returns a `<section class="panel panel--elevated">`; `tone:'ai'` adds `.panel-ai`. Header is a `role="button"` toggle with `aria-expanded`.

### `CompatibilityModule.render(options)` — extended (additive)
- `options.embedded?: boolean` — default `false`. When true, suppresses the module's own section toggle (the host `OPanel` owns collapse) and exposes its collapsed content for the panel preview. Default preserves current standalone behavior.

### `Timeline.render(draft, options)` — extended (additive)
- `options.bare?: boolean` — default `false`. Headerless rendering for in-panel use (the panel header supplies the title). Default preserves current behavior.

All extensions are **additive with safe defaults**, so existing callers and tests are unaffected.
