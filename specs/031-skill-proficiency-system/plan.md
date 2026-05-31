# Implementation Plan: Skill Proficiency System

**Feature Branch**: `031-skill-proficiency-system`  
**Created**: 2026-05-31  
**Spec**: [spec.md](./spec.md) · **Design**: `docs/design/profile_page.md` (§4.4 Skills, §5 Skills editor, §7 Data Model)  
**Status**: Draft

## Summary

Evolve the profile `skills` field from `string[]` to `SkillEntry[]` (`{ name, level }`, level 1–5) and rework its capture and display:

- **Model** ([src/models/profile.js](../../src/models/profile.js)) — normalise skills into objects, migrate legacy strings to level 2, validate level/blank/duplicate/max-count, and import resume skills as **unrated**.
- **Editor** ([src/pages/ProfileEdit.js](../../src/pages/ProfileEdit.js)) — replace the overlay-based pill editor with **inline rows** (name + 1–5 level picker + remove), gate Save until every skill is rated.
- **Display** ([src/pages/Profile.js](../../src/pages/Profile.js)) — replace the generic `renderPills('SKILLS', …)` with a dedicated renderer: graded meter rows, hover/tap reveal, "?" scale popover, sort, collapse-past-10.

No database schema change: skills live inside the profile JSON blob (`data` column) in both SQLite and Supabase, so migration is a normalise-on-load concern at a single chokepoint (`normaliseProfile`).

## Architecture

The change is concentrated in the **model layer** and the **two profile pages**; the persistence and transport layers are untouched.

```
                    ┌──────────────────────────────────────────┐
                    │  src/models/profile.js  (single chokepoint)│
                    │  • SKILL_LEVELS scale (new export)        │
                    │  • normaliseSkillEntry (string→{name,2};  │
                    │    null preserved; bad level coerced)     │
                    │  • validateProfile skill rules            │
                    │  • DUPLICATE_KEYS.skills (already name-kw) │
                    │  • mergeResumeData → imported skills null  │
                    └───────────────┬───────────────────────────┘
                 imports scale +    │   normalise/validate used by
                 normalise/validate │   client save AND supabase upsert
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
 ProfileEdit.js              Profile.js                server/repositories/
 inline level-picker rows    meter rows + reveal       supabase/profile.js
 (capture)                   + popover/sort/collapse   (already calls
                             (display)                  normaliseProfile)
```

**Scale as single source of truth.** Add `SKILL_LEVELS` to `src/models/profile.js` (next to the existing language `PROFICIENCY_LEVELS`): an ordered list of `{ level, label }` for levels 1–5. The model uses it for range validation; the editor and display import it for labels. Per-level **colours and flavor text** are display-only — keep them in the UI (CSS custom properties / a small client map), not in the model, so the server bundle stays free of presentation data.

## Data Flow

1. **Load** → repository returns the profile JSON → `normaliseProfile` converts each `skills` element: a bare string → `{ name, level: 2 }`; an object with valid level → kept; an object with `null` level → preserved unrated; an object with an out-of-range/non-integer level → coerced to nearest 1–5. Display and editor both receive `SkillEntry[]`.
2. **Edit** → editor holds `_formState.skills` as `SkillEntry[]`. Adding a skill appends `{ name: '', level: null }`. The level picker sets/clears `level`. Save runs `validateProfile`; if any named skill is unrated / blank / duplicate, or count > 50, Save is blocked with a specific message.
3. **Resume import** → `mergeResumeData` maps parsed skill names to `{ name, level: null }`, dedupes against existing names (existing level preserved), and appends — leaving imported skills unrated so the user must rate before the next save.
4. **Save** → `validateProfile` + `normaliseProfile` → repository upsert (unchanged). The Supabase adapter already calls `normaliseProfile`, so the same rules apply server-side.

## Affected Components

| Component | Change |
|---|---|
| `src/models/profile.js` | New `SKILL_LEVELS`; `normaliseSkillEntry` replaces `normaliseStringArray(safe.skills)`; skill rules in `validateProfile` (level required, blank, duplicate, max 50); `mergeResumeData` imports unrated. `DUPLICATE_KEYS.skills` already keys on the name — adjust to read `entry.name`. |
| `src/pages/ProfileEdit.js` | Rework `renderSkillsCard` + `openSkillsOverlay`/`buildSkillsForm`/`mergeSkills` from string pills to inline `{name, level}` rows with a level picker; fix the `.toLowerCase()` string assumptions (lines ~529, 565, 591–599); wire Save gating + "?" popover. |
| `src/pages/Profile.js` | Replace `renderPills('SKILLS', …)` (line 565) with `renderSkills` (meter rows, reveal, popover, sort, collapse-past-10). `renderPills` stays for any other caller (verify none remain for skills). |
| `src/data/demoSeed.js` | Convert **only** the profile skills array (line ~754) to `SkillEntry[]` with representative levels. Leave per-application `skills` arrays unchanged. |
| `src/styles/main.css` | New meter/segment, level-picker, reveal, popover, and sort styles; update/retire `.skill-pill` rules. |

## Key Decisions & Tradeoffs

- **Editor pattern change (overlay → inline rows).** The design doc §5 specifies inline rows with a per-row level picker; the current "Add Skills" entry-overlay can't express a per-skill level cleanly. Tradeoff: this is the largest single change, but it aligns the editor with the rest of the design and removes a modal.
- **Scale lives in the model.** Mirrors the existing language `PROFICIENCY_LEVELS` and keeps validation + UI labels in sync from one export. Colours/flavor stay in the UI.
- **Migration default 2 vs imported unrated** (spec clarification). Stored legacy data defaults to Basic so existing users are never locked out of saving; freshly imported skills are unrated so the user reviews them. The normaliser distinguishes by element shape (string → 2; object-with-null → unrated).
- **No feature flag** (spec non-goal). The normalise-on-load migration is backward-compatible, so there is little to roll back; a flag would mean maintaining two skills UIs.

## Risks & Tradeoffs

| Risk | Mitigation |
|---|---|
| Mixed-shape `skills` arrays in stored data (string + object) during/after rollout | `normaliseSkillEntry` handles each element independently; covered by model tests. |
| `.toLowerCase()` / direct string use of skills elsewhere breaking on objects | Audited: only the two profile pages assume strings; application skills (`Modal.js`, `Card.js`, `store.js`) are a separate schema and untouched. Re-grep `\.skills` before merge. |
| Editor rework regresses dirty-tracking / discard-confirm flow | Reuse existing `commitListChange()` / dirty plumbing; smoke-test add/edit/remove + discard. |
| Long skill names colliding with the meter | Truncate with ellipsis, full text in `title`/`aria-label` (design doc §4.4). |
| Accessibility regression (meter is non-text) | Skill rows are real `<button>`s with `aria-label="{name}: {Label}, level {n} of 5"`; level word is text, not colour-only. |

## Validation Approach

- **Unit (model)** — extend [tests/models/profile.test.js](../../tests/models/profile.test.js): string→`{name,2}` migration; null preserved; out-of-range coercion; blank-name rejection; duplicate-name rejection (case/space-insensitive); max-50 rejection; `mergeResumeData` yields unrated imports and preserves existing levels on duplicates. (Constitution: core validation must have automated tests.)
- **Persistence round-trip** — confirm `SkillEntry[]` survives upsert→get in [tests/server/repositories/profile.test.js](../../tests/server/repositories/profile.test.js) (and the Supabase adapter test) since both call `normaliseProfile`.
- **Manual / browser smoke** — add skill + rate, save, reload (P1); view meter + reveal + popover + sort + collapse (P2); load a legacy `string[]` profile and confirm Basic default (P3); keyboard-only + screen-reader pass on a skill row (SC-003).

## Phasing (high level — detailed in tasks.md)

1. Model: scale constant, normalise, validate, mergeResumeData + unit tests.
2. Display: `renderSkills` (meter, reveal, popover, sort, collapse) + CSS.
3. Editor: inline level-picker rows, Save gating, "?" popover + CSS.
4. Demo seed conversion + persistence round-trip check.
5. **Release Prep** (version bump, CHANGELOG, README/REPO_MAP, docs sanity) — constitution mandatory.
6. **Browser Smoke Test** (P1/P2/P3 Independent Tests against merge state) — constitution mandatory, last.

## Affected Areas

**Likely to be inspected (read-only)**
- [src/models/application.js](../../src/models/application.js) — confirms application `skills` is a separate schema (do not conflate).
- [src/components/Modal.js](../../src/components/Modal.js), [src/components/Card.js](../../src/components/Card.js), [src/components/CreationPicker.js](../../src/components/CreationPicker.js), [src/data/store.js](../../src/data/store.js) — application-skills paths; verify they remain untouched.
- [server/repositories/supabase/profile.js](../../server/repositories/supabase/profile.js), [server/repositories/profile.js](../../server/repositories/profile.js) — confirm both funnel through `normaliseProfile` (no change expected).
- `shared/constants.js` — confirm the scale belongs in the model, not here (status-only file).

**Likely to be modified**
- [src/models/profile.js](../../src/models/profile.js) — scale, normalise, validate, mergeResumeData, duplicate key.
- [src/pages/ProfileEdit.js](../../src/pages/ProfileEdit.js) — inline skills editor.
- [src/pages/Profile.js](../../src/pages/Profile.js) — `renderSkills` display.
- [src/data/demoSeed.js](../../src/data/demoSeed.js) — profile skills array only.
- [src/styles/main.css](../../src/styles/main.css) — skill meter / picker / popover styles.

**Tests likely added or updated**
- [tests/models/profile.test.js](../../tests/models/profile.test.js) — skill normalise/migrate/validate/import.
- [tests/server/repositories/profile.test.js](../../tests/server/repositories/profile.test.js) and `tests/server/repositories/supabase/profile.test.js` — round-trip of object skills (light).

**Explicitly out of scope**
- Application/job-post `skills` (Tracker cards, parser, store clone, `application.js`).
- Any compatibility-scoring calculation (no engine exists; deferred).
- Database schema / migrations (skills are inside the profile JSON blob).
- Feature-flag / staged-rollout plumbing.
- Language proficiency enum (separate field, unchanged).

## Artifact notes

- [data-model.md](./data-model.md) — `SkillEntry` shape, normalisation rules, migration matrix, validation rules. **Created.**
- [research.md](./research.md) — the three design decisions (editor rework, scale placement, level coercion). **Created.**
- [quickstart.md](./quickstart.md) — local verify steps for P1/P2/P3. **Created.**
- [checklists/plan-review.md](./checklists/plan-review.md) — plan quality gate. **Created.**
- `contracts/api.md` — **omitted with reason**: this feature adds no API surface. The profile upsert/get endpoints and their request/response envelope are unchanged; the only data-shape change (the `skills` array element) is a JSON-blob field documented in data-model.md. Residual risk: low — covered by the persistence round-trip test.
