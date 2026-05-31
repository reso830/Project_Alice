# Tasks: Skill Proficiency System (031)

**Spec**: [spec.md](spec.md)
**Plan**: [plan.md](plan.md)
**Data model**: [data-model.md](data-model.md)
**Research**: [research.md](research.md)
**Quickstart**: [quickstart.md](quickstart.md)
**Plan review**: [checklists/plan-review.md](checklists/plan-review.md)
**Branch**: `031-skill-proficiency-system`

---

## Phase Map

| Phase | Theme | Blocks |
|---|---|---|
| 01 | **Model** — `SKILL_LEVELS` scale, `normaliseSkillEntry` (migration/coercion), `validateProfile` skill rules (level/blank/duplicate/max-50), `mergeResumeData` unrated import, unit tests | 02, 03, 04 |
| 02 | **Display** — `renderSkills` on the Profile page (meter rows, hover/tap reveal, "?" popover, sort, collapse-past-10) + CSS | 06 |
| 03 | **Editor** — inline level-picker rows replacing the overlay pill flow, Save gating + footer messaging, "?" popover, import wiring + CSS | 06 |
| 04 | **Demo seed + persistence** — convert the profile skills array to `{name, level}`; round-trip tests (local + Supabase adapter) | 05 |
| 05 | **Release Prep (REQUIRED)** — version bump, CHANGELOG, README, REPO_MAP, docs sanity | 06 |
| 06 | **Browser Smoke Test (REQUIRED — UI feature)** — walk US-1/US-2/US-3 Independent Tests against the merge state, desktop + mobile | merge |

**Sequencing notes:**
- Phase 01 (model) blocks 02, 03, 04 — display, editor, and seed all depend on `SKILL_LEVELS`, `normaliseProfile`, and `validateProfile`.
- Phases 02 and 03 are independent of each other (both depend only on Phase 01); do 02 first so the display can be exercised against the Phase 04 demo seed.
- Release Prep (05) is second-to-last; Browser Smoke Test (06) is last — constitution Amendment 1.3.0.

**FR coverage**: FR-001/006 → 01.2; FR-003/004/005/009/013 → 01.3; FR-010/014 → 01.4; FR-007/008 → 02.1; FR-002/003/008/009 → 03.1–03.2; FR-011 → 04.2; FR-012 → negative (no task — asserted out of scope in 01.4 test).

---

## Phase 01 — Model

### [ ] Task 01.1 — `SKILL_LEVELS` scale constant

**Target file**: [src/models/profile.js](../../src/models/profile.js)

**What to do**:
1. Export `SKILL_LEVELS` — an ordered array of `{ level: 1..5, label }` (Beginner, Basic, Intermediate, Strong, Expert), placed next to the existing `PROFICIENCY_LEVELS` (language) export.
2. Export a `SKILL_MAX = 50` constant for the count cap.
3. Optionally export a `getSkillLabel(level)` helper for accessible text.

**Expected behavior**: a single model-owned source for the valid 1–5 range + labels, importable by display and editor.

**Constraints**: model layer only — **no colours or flavor text here** (those are UI-side per [data-model.md](data-model.md)). Keep distinct from the language `PROFICIENCY_LEVELS`.

**Validation**: exercised by 01.5 tests (label/range used by normalise + validate).

**Out of scope**: CSS/segment colours, flavor copy (Phase 02/03 UI).

---

### [ ] Task 01.2 — `normaliseSkillEntry` + wire into `normaliseProfile`

**Target file**: [src/models/profile.js](../../src/models/profile.js)

**What to do**:
1. Add `normaliseSkillEntry(entry)` implementing the [data-model.md](data-model.md) matrix: bare **string** → `{ name, level: 2 }`; object with valid `level` 1–5 → kept; object with `level === null` → preserved unrated; object with out-of-range/non-integer level → coerced to nearest valid 1–5; blank/missing name → dropped; non-object/non-string → dropped.
2. Replace `profile.skills = normaliseStringArray(safe.skills)` (line ~225) with `normaliseObjectArray`-style mapping over `normaliseSkillEntry` that also drops blank-name entries.

**Expected behavior**: legacy `string[]` profiles render immediately at Basic; intentional `null` survives; malformed levels never persist.

**Constraints**: `name` trimmed via existing `cleanString`. Preserve insertion order (Custom sort relies on it). Do not coerce `null` to a number.

**Validation**: [tests/models/profile.test.js](../../tests/models/profile.test.js) — see 01.5.

**Out of scope**: `validateProfile` rules (01.3); editor/display.

---

### [ ] Task 01.3 — Skill validation rules + duplicate key

**Target file**: [src/models/profile.js](../../src/models/profile.js)

**What to do**:
1. In `validateProfile`, add a `profile.skills.forEach` block producing keyed errors for: blank name (`skills[i].name`), unrated level (`skills[i].level` when `null`), and level out of 1–5.
2. Add a profile-level duplicate check (case-insensitive, whitespace-collapsed) using the existing `DUPLICATE_KEYS.skills` — update it to read `entry.name` (it currently keys a bare string) and emit a `skills.duplicate` error.
3. Add a count-cap error when `skills.length > SKILL_MAX` (key `skills.max`).

**Expected behavior**: `validateProfile` returns `valid: false` with specific keys/messages for unrated, blank, duplicate, and over-cap skills.

**Constraints**: messages match [data-model.md](data-model.md) intent. Centralized in the model (FR-013) — the editor reads these errors, does not re-implement them.

**Validation**: [tests/models/profile.test.js](../../tests/models/profile.test.js) — see 01.5.

**Out of scope**: editor rendering of the errors (03.2).

---

### [ ] Task 01.4 — `mergeResumeData` imports skills unrated

**Target file**: [src/models/profile.js](../../src/models/profile.js)

**What to do**:
1. Ensure parsed resume skills merge as `{ name, level: null }` (unrated — FR-014), not as auto-rated objects.
2. Keep the existing dedupe (by `DUPLICATE_KEYS.skills` / name): a duplicate of an existing skill is **dropped**, the existing skill's level **preserved**.

**Expected behavior**: importing a resume never assigns a level; imported skills gate Save until rated; existing rated skills are unchanged by a duplicate import.

**Constraints**: no auto-estimation (FR-010). Coordinate with the parser output shape — if the parser still emits strings, map them to `{ name, level: null }` at the merge boundary.

**Validation**: [tests/models/profile.test.js](../../tests/models/profile.test.js) — assert imported skills are `level: null`, duplicates dropped with existing level intact, and **no** skill is auto-rated (FR-012/FR-010 negative).

**Out of scope**: the resume parser internals; the import UI button (existing).

---

### [ ] Task 01.5 — Model unit tests

**Target file**: [tests/models/profile.test.js](../../tests/models/profile.test.js)

**What to do**: add cases covering — string→`{name,2}` migration; `null` preserved; out-of-range/non-integer coercion; mixed-shape array; blank-name drop; validate rejects unrated/blank/duplicate/over-50; validate passes a fully-rated ≤50 list; `mergeResumeData` yields unrated imports and preserves existing levels on duplicates.

**Expected behavior**: `npm run test:run` green; rules locked by tests (constitution: core validation must have automated tests).

**Constraints**: pure model tests — no DOM.

**Validation**: `npm run test:run`, `npm run lint`.

**Out of scope**: persistence (04.2), UI.

---

## Phase 02 — Display (Profile page)

### [ ] Task 02.1 — `renderSkills` on the Profile page

**Target file**: [src/pages/Profile.js](../../src/pages/Profile.js)

**What to do**:
1. Add `renderSkills(profile, container)` per design doc §4.4: each skill a row with name (truncating ellipsis, full text in `title`) + a 5-segment graded meter filled to `level`.
2. Each row is a real `<button>` with `aria-label="{name}: {Label}, level {n} of 5"`; hover (desktop) / tap (mobile) cross-fades the meter to `"{level} · {Label}"` in place (no reflow), auto-reverting 2.5s after tap.
3. Header controls: a "?" scale popover (swatch + label + flavor for all five levels; closes on outside-click/Esc) and a sort toggle (Custom / By level, repeat-click toggles high→low / low→high).
4. Collapse past 10 with a **Show all {N} skills** / **Show less** toggle.
5. Replace `renderPills('SKILLS', profile.skills, content)` (line ~565) with `renderSkills(profile, content)`. Leave `renderPills` in place for any other caller.

**Expected behavior**: P2 acceptance scenarios 1–5 render correctly; level is conveyed by meter **and** text (non-colour-only, FR-007/FR-008).

**Constraints**: import `SKILL_LEVELS` from the model for labels; segment colours/flavor from the UI layer (02.2). No new dependencies. Empty skills array renders nothing (existing behaviour).

**Validation**: visual via [quickstart.md](quickstart.md) US-2; keyboard/aria walked in Phase 06.

**Out of scope**: editor (Phase 03); application skills.

---

### [ ] Task 02.2 — Skill display styles

**Target file**: [src/styles/main.css](../../src/styles/main.css)

**What to do**: add styles for the meter segments (17×9px / 15px mobile, radius 3px, 4px gap, per-level fill colour + `--sk-empty`), the in-place reveal cross-fade, the "?" popover, the sort control, and the collapse toggle. Define the five segment colours as CSS custom properties.

**Expected behavior**: matches design doc §4.4; no row reflow on reveal; mobile sizing applies < 640px.

**Constraints**: reuse existing tokens (`--sk-empty`, `--indigo`, radii) where present; retire/replace `.skill-pill` display rules no longer used.

**Validation**: visual (US-2), Phase 06.

**Out of scope**: editor CSS (03.4).

---

## Phase 03 — Editor (Profile edit page)

### [ ] Task 03.1 — Inline level-picker rows

**Target file**: [src/pages/ProfileEdit.js](../../src/pages/ProfileEdit.js)

**What to do**:
1. Change `_formState.skills` to hold `{ name, level }` objects.
2. Rework `renderSkillsCard` to render inline rows: a name text input, a 5-segment level picker (tap segment `n` → level `n`, fills 1…n; tap active → clears; hover previews; caption `"{n} · {Label}"` or "Tap to set a level"), and a remove (×). An **Add skill** button appends `{ name: '', level: null }`.
3. Remove the overlay skills flow (`openSkillsOverlay`, `buildSkillsForm`, the `createEntryOverlay('Add Skills', …)` path) and fix the string assumptions at the old lines ~529/565/591–599 (`.toLowerCase()` on objects).
4. On < 560px, the picker drops below the name input (design doc §5).

**Expected behavior**: P1 acceptance scenarios 1–3, 5; level set/clear works; rows are keyboard-operable.

**Constraints**: keep dirty-tracking via the existing `commitListChange()`/`_renderSkillsBody` plumbing. Import `SKILL_LEVELS` from the model.

**Validation**: [quickstart.md](quickstart.md) US-1; Phase 06.

**Out of scope**: Save-gate messaging (03.2).

---

### [ ] Task 03.2 — Save gating + inline feedback

**Target files**: [src/pages/ProfileEdit.js](../../src/pages/ProfileEdit.js)

**What to do**:
1. Drive Save-disabled and inline feedback from `validateProfile`'s skill errors (01.3): flag unrated rows (warning tint) with a footer `"Set a level for every skill to save · {n} missing"`; flag a duplicate name; flag a blank name; flag over-50 with a remove-some message.
2. Block Save while any skill error exists; re-enable when clean.

**Expected behavior**: P1 acceptance scenario 4 and the spec Edge Cases (duplicate / blank / unrated / max-50) all gate Save with a specific message.

**Constraints**: do not duplicate validation logic — read it from the model (FR-013). Reuse existing form error styling where possible.

**Validation**: [quickstart.md](quickstart.md) US-1 negative gates; Phase 06.

**Out of scope**: model rule definitions (01.3).

---

### [ ] Task 03.3 — "?" scale popover + import wiring

**Target file**: [src/pages/ProfileEdit.js](../../src/pages/ProfileEdit.js)

**What to do**:
1. Add the same "?" scale popover beside the SKILLS editor header (design doc §5).
2. Confirm the resume-import path (`mergeResumeData` at line ~1110) renders imported skills as unrated rows that gate Save (relies on 01.4); ensure `_renderSkillsBody()` reflects them.

**Expected behavior**: editor popover matches the display popover; imported skills appear unrated and block Save until rated.

**Constraints**: no new dependency; share popover markup/levels with display where practical.

**Validation**: [quickstart.md](quickstart.md) US-1/US-3 import note; Phase 06.

**Out of scope**: parser changes.

---

### [ ] Task 03.4 — Editor styles

**Target file**: [src/styles/main.css](../../src/styles/main.css)

**What to do**: styles for the inline skill rows, the tappable level picker (fill + hover preview + cleared state), the unrated/duplicate warning tint, the footer message, and the < 560px stacked layout.

**Expected behavior**: matches design doc §5; usable on mobile.

**Constraints**: reuse tokens; retire unused `.skill-pill` editor rules.

**Validation**: visual; Phase 06.

**Out of scope**: display CSS (02.2).

---

## Phase 04 — Demo seed + persistence

### [ ] Task 04.1 — Convert demo profile skills

**Target file**: [src/data/demoSeed.js](../../src/data/demoSeed.js)

**What to do**: convert **only** the profile skills array (line ~754) from `string[]` to `{ name, level }[]` with representative, varied levels (1–5).

**Expected behavior**: demo mode shows a populated, rated skills section.

**Constraints**: **do not** change the per-application `skills` arrays (job-post skills — separate schema, out of scope).

**Validation**: demo-mode visual (US-2); Phase 06.

**Out of scope**: application skills.

---

### [ ] Task 04.2 — Persistence round-trip tests

**Target files**: [tests/server/repositories/profile.test.js](../../tests/server/repositories/profile.test.js), `tests/server/repositories/supabase/profile.test.js`

**What to do**: assert a profile with `{ name, level }` skills survives upsert→get unchanged in both adapters (both call `normaliseProfile`); include a legacy `string[]` input that comes back migrated to Basic.

**Expected behavior**: object skills persist identically across local + hosted adapters (FR-011).

**Constraints**: follow existing test harness patterns; no live DB.

**Validation**: `npm run test:run`.

**Out of scope**: UI.

---

## Phase 05 — Release Prep (REQUIRED)

### [ ] Task 05.1 — Version bump

**Target files**: [package.json](../../package.json), [src/pages/welcome/shared/appMeta.js](../../src/pages/welcome/shared/appMeta.js)

**What to do**: bump `version` `1.0.0` → `1.1.0` (minor — new user-facing feature) in `package.json`; update `APP_VERSION` to `v1.1.0` in `appMeta.js`.

**Constraints**: these two files only (per the appMeta.js comment); footer/welcome read from `APP_VERSION`.

**Validation**: footer shows `v1.1.0`; `npm run test:run`.

---

### [ ] Task 05.2 — CHANGELOG, README, REPO_MAP, docs sanity

**Target files**: [CHANGELOG.md](../../CHANGELOG.md), [README.md](../../README.md), [docs/REPO_MAP.md](../../docs/REPO_MAP.md)

**What to do**:
1. Add a `## [1.1.0]` CHANGELOG entry summarising skill proficiency (capture, display, migration, validation; under `### Added`/`### Changed`).
2. Update README where skills are described as flat tags to reflect the 1–5 proficiency model.
3. Add the new spec docs to REPO_MAP if it indexes `specs/` artifacts; note the `skills` shape change if data shapes are documented.
4. Docs sanity: no env-var/runtime-mode change → **`docs/deployment.md` not updated** (state the reason in the PR).

**Constraints**: documentation only.

**Validation**: manual docs review against [checklists/plan-review.md](checklists/plan-review.md).

---

## Phase 06 — Browser Smoke Test (REQUIRED — UI feature)

### [ ] Task 06.1 — Walk the Independent Tests against merge state

**What to do**: in a real browser against the to-be-merged build, walk:
- **US-1 (P1)**: add a skill, confirm unrated + Save blocked; set/clear a level; save; reload editor → persists; trigger blank / duplicate / 51-skill gates.
- **US-2 (P2)**: meter fills to level; hover/tap reveal in place (no reflow); "?" popover; sort Custom/By level; collapse past 10.
- **US-3 (P3)**: load a legacy `string[]` profile (`npm run db:seed:profile`) → renders at Basic, none dropped, re-ratable.
- **A11y (SC-003)**: keyboard-only reach a skill row (button) + screen-reader reads the aria-label; level conveyed by text, not colour alone.

**Coverage**: desktop + mobile widths; demo mode for the populated display.

**Constraints**: against the actual merge state (after Release Prep), per constitution ordering.

**Validation**: record pass/fail per story in the PR; file follow-ups for any gap.

**Out of scope**: application-skills surfaces; compatibility scoring.
