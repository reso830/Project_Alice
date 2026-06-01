# Data Model: Skill Proficiency System

**Feature**: `031-skill-proficiency-system` · **Spec**: [spec.md](./spec.md)

Skills are stored inside the existing profile JSON blob (`data` column) in both SQLite and Supabase. **No schema migration** — only the shape of `Profile.skills[]` elements changes, and the change is applied at load/save time by `normaliseProfile` in [src/models/profile.js](../../src/models/profile.js).

## Entity: `SkillEntry`

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | Trimmed, non-blank. Unique within the profile (case-insensitive, whitespace-collapsed). |
| `level` | integer 1–5, or `null` | persisted: yes | Proficiency. `null` only transiently (new/imported skill before rating); a profile with any `null`-level named skill cannot be saved. |

```jsonc
// Profile.skills
[
  { "name": "Jira",  "level": 4 },
  { "name": "Scrum", "level": 2 },
  { "name": "Figma", "level": null }   // unrated — blocks save until rated
]
```

Replaces the previous element type `string`.

## Proficiency scale (`SKILL_LEVELS`, new export in the model)

| level | label        | colour (display-only) | flavor (display-only) |
|-------|--------------|-----------------------|-----------------------|
| 1 | Beginner     | `#E07B39` | Aware of the basics; needs guidance. |
| 2 | Basic        | `#B5830C` | Can handle simple tasks independently. |
| 3 | Intermediate | `#1E9D57` | Productive day-to-day without help. |
| 4 | Strong       | `#3076E8` | Deep, reliable command of the skill. |
| 5 | Expert       | `#4F46E5` | Sets direction; mentors others. |

- The model exports `{ level, label }` for the valid range + labels (validation + accessible text).
- Colours/flavor are display-only (CSS / client map), not in the model.
- Distinct from `LanguageEntry.proficiency` (`Beginner | Intermediate | Professional | Fluent`) — unchanged.

## Normalisation rules (`normaliseSkillEntry`)

Applied per element of `skills[]` on every load and save:

| Input element | Output | Rationale |
|---|---|---|
| `"Jira"` (bare string) | `{ name: "Jira", level: 2 }` | Legacy migration → Basic; never lock an existing user out of saving. |
| `""` / whitespace string | **dropped** | Empty legacy string = migration junk (predates the feature; carries no name). |
| `{ name: "Jira", level: 1..5 }` | kept as-is | Already valid. |
| `{ name, level: null }` | `{ name, level: null }` | Intentional unrated (editor/import); preserved, gates save. |
| `{ name }` (level missing/`undefined`/unparseable) | `{ name, level: null }` | Treated as unrated, not guessed — only legacy **strings** get the level-2 default. |
| `{ name, level: 0 \| 6 \| 3.7 \| "4" }` | `{ name, level: <nearest valid int 1–5> }` | Malformed numeric level coerced to nearest 1–5 (load-time): `0→1`, `6→5`, `3.7→4`, `"4"→4`. **Not** forced to 2. Never persisted as-is. |
| `{ name: "" , level }` (blank-name object) | **kept** as `{ name: "", level }` | **Preserved, NOT dropped** — `validateProfile` normalizes before validating ([profile.js:316](../../src/models/profile.js#L316)), so the row must survive normalization for the blank-name save-gate (FR-004) to fire. Mirrors `normaliseExperienceEntry`, which keeps empty-field entries. Display skips blank-name rows defensively. |
| non-object, non-string | dropped | Defensive. |

> **Load vs save.** Normalization (load) is *lenient*: it coerces malformed levels and drops only structural junk, so existing/imported data always renders. Validation (save) is *strict*: it rejects unrated/blank/duplicate/over-cap rows. Because validation runs on the normalized profile, normalization must **not** drop a row the user needs to see flagged.

## Validation rules (`validateProfile`, skills section)

Centralised in the model; covered by unit tests (constitution).

| Rule | Error condition | Message intent |
|---|---|---|
| Level required | a named skill has `level === null` | "Set a level for every skill to save · {n} missing" |
| Non-blank name | a skill row has blank `name` | "Skill name is required." |
| No duplicates | two **non-blank** names match (case-insensitive, collapsed whitespace) | "Duplicate skill: {name}." |
| Max count | `skills.length > 50` | "Remove some skills — max 50." |

- **There is no "level out of 1–5" save error.** Out-of-range levels are coerced at load (see the normalization matrix), so by the time validation runs a level is always a valid 1–5 or `null`; the level check is therefore only the `null` (unrated) case. This keeps load and save tests from encoding opposite outcomes for the same input.
- Duplicate comparison reuses the existing `DUPLICATE_KEYS.skills` key (now reading `entry.name`). Blank names produce a falsy key and are **not** treated as duplicates of each other (each blank row raises its own non-blank-name error instead). Two blank rows therefore yield two blank-name errors, not a duplicate error.

## Resume import (`mergeResumeData`)

- Parsed skill names become `{ name, level: null }` (**unrated** — FR-014).
- Deduped against existing skills by name; a duplicate is **dropped**, the existing skill's level **preserved**.
- The merged result is subject to the same validation (unrated imports gate save; an import that would exceed 50 is blocked).

## Persistence

No change to storage or transport. Both repositories already round-trip the blob:
- Local (SQLite): `data` TEXT column, `JSON.parse`/`JSON.stringify`.
- Hosted (Supabase): `data` JSONB; the adapter calls `normaliseProfile` on upsert, so the same skill rules apply server-side.
