# Data Model: Compatibility Engine

Builds on the existing application schema ([server/db/columns.js](../../server/db/columns.js), [server/db.js](../../server/db.js)) and the profile + `profile_skill` stores (031/032). **One additive column**; `compat` semantics change from random to computed.

---

## 1. New field — `minYearsExperience` / `min_years_experience`

The job's stated minimum years of experience; the comparison target for the experience category. **Never extracted by the parser** — manual entry only.

| Aspect | Value |
| --- | --- |
| App-model key | `minYearsExperience` |
| DB column | `min_years_experience` |
| Type | integer ≥ 0, or `null` (not stated) |
| Default | `null` |
| Persisted | local SQLite, hosted Supabase, demo (in-memory) — at parity |
| Validation | non-negative integer or empty/null; **rejected, never coerced** when invalid |
| Renormalization | `null`/`0` → experience category omitted, weights renormalize (FR-006) |

### Wiring (mirror every place an application field is declared)

- `server/db/columns.js`:
  - `FIELD_TO_COLUMN`: `minYearsExperience: 'min_years_experience'`
  - `INSERTABLE_COLUMNS`: add `'min_years_experience'`
  - `APPLICATION_COLUMNS_WITHOUT_USER_ID`: add `'min_years_experience'`
  - `toRecord`: `minYearsExperience: row.min_years_experience ?? null`
  - `toRow`: pass through as integer or `null` (no JSON/boolean special-casing)
- `src/models/application.js`:
  - `normalizeApplication` — **parse, do not coerce away bad values**: accept a non-negative integer, or a digit-only string like `"3"` (parsed to the integer `3`); empty string / `null` / absent → `null`. Any other value (negative, decimal such as `3.7`, non-numeric string, `NaN`) is **preserved as-is** (not floored, truncated, or zeroed) so validation can see and reject it.
  - `validateApplication` — flag as invalid (no silent coercion) anything that is not a non-negative integer or `null`: negative, non-integer/decimal, or non-numeric. `3.7` is **rejected**, never floored to `3`.
- `server/validation/application.js` — `minYearsExperience: z.union([z.number().int().nonnegative(), z.null()]).optional()` (accept empty→null).

### SQLite migration (idempotent, in `initSchema`)

```js
ensureColumn(targetDb, 'applications', 'min_years_experience', 'INTEGER');
```

### Supabase migration (additive)

```sql
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS min_years_experience integer;
```

Add a probe to `assertHostedSchema` ([server/health.js](../../server/health.js)):

```js
{
  table: 'applications',
  column: 'min_years_experience',
  failOn: [UNDEFINED_COLUMN],
  docPath: 'specs/036-compatibility-engine/data-model.md §1',
}
```

---

## 2. `compat` — semantics change (no schema change)

| Aspect | Before (≤035) | After (036) |
| --- | --- | --- |
| Column | `applications.compat INTEGER NOT NULL DEFAULT 0` | **unchanged** |
| Source | random `Math.floor(Math.random()*101)` in parsers | **deterministic** `computeCompatibility(profile, application)` |
| Writer | client (sent in payload) | **server** (local/hosted) or shared module (demo); client value **ignored** |
| Range | 0–100 (clamped by `validateApplication`) | 0–100 (clamped by the module **and** `validateApplication`) |
| Recompute | never | on app create/update; on profile save for all **active** apps; archived **frozen** |

`compat` is **removed** from the client-writable Zod schema (`writableFields`). `validateApplication`'s existing `clampCompat` stays as a defensive backstop.

---

## 3. One-time legacy backfill

Existing rows may contain parser-generated random `compat` values from pre-036 behavior. The 036 migration converges those rows once:

- **Local SQLite**: `initSchema()` runs an idempotent backfill after additive columns exist. It reads the current profile, scores every application row with `computeCompatibility(profile, application, { asOf })`, and updates only `applications.compat`.
- **Hosted Supabase**: after applying the `min_years_experience` migration, run an admin/maintenance pass over **all** applications for the user, including archived rows. Do not use profile-save recompute for this backfill; ongoing profile recompute intentionally excludes archived applications.

The maintenance pass must preserve all fields except `compat`. Archived applications are rescored once to replace legacy random values, then remain frozen unless edited directly.

---

## 4. Scoring inputs (read-only; consumed by the module)

**Profile** (via `req.repos.profile.get()` → reassembled `skills` from `profile_skill`, 032):
- `skills: [{ name, level: 1–5 }]` — skills category (proficiency weighting)
- `experience: [{ role, responsibilities, dateStarted, dateEnded, currentWork }]` — role titles (role alignment), responsibilities (keywords), date ranges (derived years)
- `summary` — role alignment + keywords
- `certifications: [{ name, … }]` — certifications category

**Application (JD)**:
- `skills: string[]` (required), `preferredSkills: string[]` — skills + keywords
- `jobTitle` — role alignment + keywords
- `responsibilities` — keywords (+ certification text matching)
- `minYearsExperience` — experience target

No profile or JD field is mutated by scoring.

---

## 5. Scoring output

```js
computeCompatibility(profile, application, { weights, asOf }) // →
{ score: <integer 0–100>, label: 'Low' | 'Medium' | 'High' | 'Great' }
```

Only `score` is persisted (into `compat`). `label` is **derived** at display time via `getCompatLabel(score)` and never stored (so the two cannot disagree). **No per-category breakdown is produced or stored** (037).

### Bands (`COMPAT_BANDS`)

| Score | Label |
| --- | --- |
| 0–39 | Low |
| 40–64 | Medium |
| 65–84 | High |
| 85–100 | Great |

### Default weights (`COMPAT_WEIGHTS`, configurable)

| Category | Weight |
| --- | --- |
| skills | **43** |
| roleAlignment | 25 |
| experience | **12** |
| keywords | 10 |
| certifications | 10 |

Absent categories (no usable input on either side) are dropped and the remaining weights renormalized to sum to 1 before aggregation. Zero active categories → score `0`.

> **Revised 2026-06-16 (Group B).** Originally `skills 35 · experience 20`; experience dropped to 12 with the freed 8 moved into skills (see §7). The **skills sub-score formula** also changed — see §7 and [research.md](research.md) D10.

---

## 6. Entities touched

- **Application** — gains `minYearsExperience`; `compat` repurposed as the computed score. All other fields unchanged.
- **Compatibility result** (transient) — `{ score, label }`; not a stored entity beyond `compat`.
- **Weights config** (`COMPAT_WEIGHTS`) — module constant, not persisted, not user-editable in v1.
- **Profile / profile_skill** — read-only inputs; unchanged.

---

## 7. Revision history

### 2026-06-16 — Group B (scoring v2, post-smoke-test)

No schema or persistence change — this revision only adjusts the **scoring computation** (still `compat` ∈ 0–100, same field, same recompute architecture). Reader-facing explainer: [`docs/compatibility_scoring.md`](../../docs/compatibility_scoring.md); decisions: [research.md](research.md) D10/D11.

- **Skills sub-score** — replaced "required mean + capped additive preferred bonus" with **pooled weighted coverage**: required weight 1, preferred weight 0.69, matched skill contributes `proficiency/5`, unmatched required remain in the denominator; cap of 0.35 when zero required matched; preferred-only postings reduce to preferred coverage. Fixes the required-vs-preferred inversion and keeps partial coverage honest.
- **Default weights** — `experience 20 → 12`, `skills 35 → 43` (table above). Reduces the sway of the coarse, usually-blank Min Years field.
- **Experience activation** — when Min Years is stated but the profile has no experience entries: score **0** if the profile has other substantive content (fresh-grad shortfall), **omit + renormalize** if the profile is essentially empty (don't penalize an unfilled profile). Curve and `derivedYears` unchanged.

These changes ship within the **unreleased** v1.6.0 (036 has not merged), so they refine — rather than supersede — the 1.6.0 behavior; the v1.6.0 CHANGELOG/REPO_MAP weight references are updated as part of the Group B implementation phase.
