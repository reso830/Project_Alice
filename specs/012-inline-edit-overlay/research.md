# Research & Decisions: 012-inline-edit-overlay

Documents non-obvious decisions made during planning, with the reasoning and the alternatives considered.

---

## 1. Salary input parsing: client-side vs server-side

**Problem**: The design specifies flexible salary input ("50k", "₱80,000"). The server's Zod schema accepts only `number | null` for `salary`. The server-side `parseSalaryLower()` function exists in `server/db/applications.js` but is only called _after_ validation passes — it is used to normalize values coming out of the DB (stored as TEXT), not as a pre-validation transform.

**Decision**: Parse salary strings **client-side** before sending the API request. Add a `parseSalaryInput(value: string): number | null` utility in the frontend that mirrors the server's `parseSalaryLower` logic. The API always receives a number or null; no server schema change needed.

Range input is in scope for this feature. Because the existing application record has a single `salary` value, range inputs such as `50000-80000` and `50k-80k` are parsed to their lower bound before the API request.

**Alternatives considered**:
- Add a Zod `.preprocess()` transform to accept strings — rejected because it changes the server contract and creates an implicit string-to-number coercion that is harder to trace.
- Extend the Zod schema to accept strings with a regex — rejected for the same reason; makes the contract looser than necessary.

**Where to add**: `src/utils/currency.js` already has `formatPeso()`. Add `parseSalaryInput()` there.

---

## 2. Status change routing: immediate vs through draft

**Problem**: The current Modal saves status changes immediately via `api.update()`. The new design requires status to be a draft change (consistent with all other field edits). This is a behavioral change for users who expect status to be saved instantly.

**Decision**: Route status changes through `_draft`. The header background and badge update immediately to reflect the draft value, but nothing is written to storage until Save is clicked.

**Rationale**: The design spec (§8) is explicit: "⇄ Change Status — opens StatusDropdown; counts as dirty change". Consistency with all other fields reduces cognitive load — users learn one rule: "Save saves everything."

**Exception**: Favorite (★) and Archive (🗄) remain immediate. The spec rationale is that these are "meta-state, not field edits — the user expects them to take effect instantly the way they do on the card."

**Risk**: Users accustomed to the old behavior (status saves immediately) may be surprised. This is an intentional UX change and the spec accepts it.

---

## 3. Chip editor: inline vs extracted component

**Problem**: Required Skills and Preferred Skills need a chip editor (add/remove tags). No chip editor component exists in the project.

**Decision**: Build the chip editor **inline within Modal.js** as a private helper function, not as an extracted component. The project constitution favors "simple, readable code over clever abstractions" and "three similar lines is better than a premature abstraction." Only one caller exists (Modal.js); extracting it would add a file without a second use case.

**If a second chip editor need arises** in a future feature, extract it then.

---

## 4. Location filter: distinct values vs free-text search

**Problem**: Location is free-text input, so it has no fixed set of values. Two filter approaches are possible: (a) a checkbox list of distinct values present in the loaded applications (like Company filter), or (b) a text search input.

**Decision**: Use the **distinct values checkbox list** pattern (option a), identical to the existing Company filter. Rationale: consistent with existing filter UX; simpler to implement (reuses `FilterPanel.render()`); avoids building a new search input widget.

**Tradeoff**: If a user has many unique location values, the list becomes unwieldy. Acceptable for now given the personal job tracker context (unlikely to have 50+ distinct locations). A future phase could add search-within-filter if needed.

---

## 5. `skills` field rename: data vs UI label

**Problem**: The design shows "Required Skills" and "Preferred Skills" as two separate fields. The existing `skills` DB column maps naturally to Required Skills. Options: (a) rename the DB column to `required_skills` and migrate data, or (b) keep `skills` as-is and only change the UI label.

**Decision**: **Keep the `skills` column** as-is (option b). Only the UI label changes to "Required Skills". Add a new `preferred_skills` column for the second field.

**Rationale**: Renaming the column requires a data migration and touches every reference to `skills` across the codebase (model, validation, DB layer, API contract, tests). The benefit — a more accurate column name — does not outweigh that cost for a personal tracker that has no external consumers.

**Impact**: The `skills` JS field in `toRecord()` / `toRow()` / validation remains unchanged. No breaking API change.

---

## 6. Preferred Skills initial value for existing records

**Problem**: Existing records have no `preferred_skills` column. After the schema migration, what does the client receive?

**Answer**: SQLite sets NULL for new columns on existing rows. `toRecord()` calls `parseJson(row.preferred_skills, [])`, which returns `[]` when the value is NULL. `normalizeApplication()` also defaults `preferredSkills` to `[]`. So existing records always produce `preferredSkills: []` on the client. No special handling needed.

---

## 7. `compat_notes` vs `compatNotes` — naming consistency

The existing naming pattern in this codebase is camelCase for JS fields (`companyName`, `jobTitle`) and snake_case for DB columns (`company_name`, `job_title`). The new fields follow the same convention:

- `compatNotes` (JS) → `compat_notes` (DB)
- `generalNotes` (JS) → `general_notes` (DB)
- `workSetup` (JS) → `work_setup` (DB)
- `preferredSkills` (JS) → `preferred_skills` (DB)

No deviation from the existing pattern.
