# Data Model: Profile Page Refinements

**Branch**: `009-profile-page-refinement` | **Date**: 2026-04-29

---

## No Schema Changes

This feature introduces no changes to the database schema, the Profile root object, or any entry type. The SQLite `profile` table and the JSON shape stored in `data` are identical to those defined in `008-edit-profile-full`.

For the full data model reference (field names, types, required/optional status, validation rules, sort orders, normaliser behaviour), see [`specs/008-edit-profile-full/data-model.md`](../008-edit-profile-full/data-model.md).

---

## Display-Layer Changes

The following changes affect how existing data is *rendered* — not its structure.

### Certifications (View Profile)

**Before**: Each `CertificationEntry` was flattened into a single `<li>` string (`name | issuingBody | issuanceDate`).

**After**: Each entry is rendered as a `profile-entry` block:

| DOM class | Content |
|---|---|
| `profile-entry__title` | `entry.name` |
| `profile-entry__meta` | `entry.issuingBody` (omitted if absent) |
| `profile-entry__meta` | `entry.issuanceDate` and/or `entry.expiryDate` joined with ` – ` (omitted if both absent) |
| `profile-entry__meta profile-entry__meta--secondary` | `ID: entry.certificateId` (omitted if absent) |

### Awards (View Profile)

**Before**: Each `AwardEntry` was flattened into a single `<li>` string (`awardName | issuingBody | date`).

**After**: Each entry is rendered as a `profile-entry` block:

| DOM class | Content |
|---|---|
| `profile-entry__title` | `entry.awardName` |
| `profile-entry__meta` | `entry.issuingBody` and `entry.date` joined with ` \| ` (omitted if both absent) |
| `profile-entry__desc` (`<p>`) | `entry.details` (omitted if absent or empty) |

### Edit Profile — Structured Entry Rows

All seven structured sections (Experience, Education, Certifications, Awards, Languages, Links) replace the flat `createEntryRow(parts, onRemove)` helper with `createStructuredEntryRow(display, { onEdit, onRemove })`.

The `display` object shape passed to `createStructuredEntryRow`:

| Field | Type | Content |
|---|---|---|
| `title` | `string` | Primary line — role, degree, cert name, award name, language, or link label |
| `meta` | `string \| null` | Supporting line — company/dates, university/year, issuing body/dates, proficiency, URL |
| `desc` | `string \| null` | Body text — responsibilities (Experience), details (Awards); omitted for other sections |

---

## Overlay Form State

The `createEntryOverlay` function creates an ephemeral, closure-scoped form state for each overlay instance. It is not persisted and does not affect `_formState` until the overlay's Save is clicked.

The Skills overlay additionally maintains a `staged[]` array (closure-scoped, modal-local) that accumulates new skills before they are merged into `_formState.skills` on Save.

---

## iPad Mini Stat Chip Layout

A scoped CSS override changes the `stat-chip-row` inside `.apps-desktop-vis__stats` from `repeat(4, minmax(0, 1fr))` to `repeat(2, minmax(0, 1fr))`. This is a display-only change; no data or DOM structure changes.
