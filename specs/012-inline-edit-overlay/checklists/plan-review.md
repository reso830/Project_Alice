# Plan Review Checklist: 012-inline-edit-overlay

**Purpose**: Verify the plan is complete and safe before generating tasks and starting implementation.  
**Created**: 2026-05-08  
**Spec**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

---

## Constitution Compliance

- [x] Required fields (company name, job title, status, last_status_update) preserved in all save paths
- [x] All new fields are optional; no required field added
- [x] URL validation applied to `jobPostingUrl` on save
- [x] No external analytics or tracking introduced
- [x] Desktop and mobile browser support addressed (modal bottom sheet at <640px)
- [x] Labeled form fields and keyboard navigation covered
- [x] Non-color-only status indicators maintained (existing badge text labels unchanged)

---

## Layer Coverage

- [x] All 6 new fields covered in DB schema (`server/db.js` ensureColumn)
- [x] All 6 new fields in `FIELD_TO_COLUMN`, `INSERTABLE_COLUMNS`, `toRecord()`, `toRow()` (`server/db/applications.js`)
- [x] All 6 new fields in Zod validation (`server/validation/application.js`)
- [x] All 6 new fields in `normalizeApplication()` and `validateApplication()` (`src/models/application.js`)
- [x] All 6 new fields rendered in Modal body
- [x] All 6 new fields included in API contract doc (`contracts/api.md`)
- [x] All 6 new fields in data model mapping (`data-model.md`)

---

## Modal Completeness

- [x] Edit mode: fields pre-populated from record
- [x] Create mode: fields empty, status defaults to `wishlisted`, Archive hidden, footer always visible
- [x] Inline edit: click-to-edit per field, outside-click commits to draft
- [x] Esc inside field: reverts field only (not modal close)
- [x] Esc at modal level: triggers discard guard
- [x] Cmd/Ctrl+S: saves when dirty, no-op when clean
- [x] Cmd/Ctrl+Enter: commits multi-line field
- [x] Dirty detection: `_isDirty()` covers all fields including arrays
- [x] Footer shown when dirty, hidden when clean (always shown in Create mode)
- [x] Footer Discard: resets draft to original, stays open
- [x] Close triggers (✕, backdrop, Esc) all call `_attemptClose()` with dirty guard
- [x] Favorite action: immediate, bypasses draft
- [x] Archive action: immediate, bypasses draft, hidden in Create mode
- [x] Status change: routed through draft (not immediate)
- [x] Save success: toast "Saved.", modal stays open, `_original` refreshed
- [x] Create success: toast "Application created.", modal switches to Edit mode
- [x] Save/Create failure: error toast, draft retained
- [x] Tab/Shift+Tab: focus trapped within panel

---

## Filter Completeness

- [x] `filterByShift`, `filterByWorkSetup`, `filterByLocation` added to `filterSort.js`
- [x] `DEFAULT_FILTER_STATE` includes `shifts`, `workSetups`, `locations`
- [x] `applyFilters()` chains new filter functions
- [x] `isAnyFilterActive()` checks new filter arrays
- [x] `getAvailableLocations()` computes distinct values (like `getAvailableCompanies`)
- [x] `syncDynamicSelections()` handles Location dynamic sync
- [x] `normalizeStoredFilterState()` in Tracker validates new filter arrays from localStorage
- [x] Three new filter buttons added to QuickFiltersToolbar
- [x] `getActiveFilterCount()` updated

---

## Backward Compatibility

- [x] Existing records safe after schema migration (NULL for new columns)
- [x] `preferredSkills` defaults to `[]` for existing records (parseJson with fallback)
- [x] Existing `skills` data intact (column not renamed)
- [x] Old localStorage filter state loads without error (missing new keys filled from defaults)
- [x] Existing Modal behaviors (favorite, archive, status, focus trap) verified unchanged

---

## Test Coverage

- [x] Server validation tests cover enum constraints for shift and workSetup
- [x] Persistence tests verify new columns added without data loss
- [x] Model tests cover `normalizeApplication` with new fields and new constants
- [x] filterSort tests cover new filter functions and updated state shape
- [x] Modal tests cover: inline edit, draft state, dirty detection, save, create, discard, failure cases
- [x] Tracker tests cover: `onAddApplication` wiring, `normalizeStoredFilterState` with new fields

---

## Risks Acknowledged

- [x] Salary parsing: `parseSalaryInput()` planned client-side in `src/utils/currency.js`
- [x] Outside-click event ordering (blur before backdrop): documented in research.md, accepted
- [x] Chip editor built inline in Modal.js (not extracted): accepted per constitution guidance
- [x] Status-as-draft behavioral change: intentional, aligned with design spec §8

---

## Notes

Items marked incomplete must be resolved in the plan or tracked as implementation tasks before `/speckit.tasks` is run.
