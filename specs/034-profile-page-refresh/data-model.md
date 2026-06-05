# Data Model: Profile Page Refresh (034)

**No database schema changes. No server API changes.** This feature touches one
**browser-local** settings store and reuses the existing in-memory Profile model.
This document maps the settings-store change, its migration, and the transient
edit-page state.

---

## 1. AI settings (browser-local) — the only persisted change

### Current (shipped, 033)
`src/data/aiSettings.js` persists two `localStorage` keys:

| Storage key | Meaning |
|-------------|---------|
| `alice.ai.openrouterKey` | OpenRouter API key (string) |
| `alice.ai.consent` | `"granted"` when the user accepted sending data |

Exports: `getKey/setKey/clearKey/hasKey`, `getConsent/setConsent/clearConsent/hasConsent`.

### Target (034)
Persisted shape (per `profile_page.md` §7):

```ts
interface AiSettings {
  enabled:  boolean;          // master "AI features" toggle
  apiKey:   string | null;    // OpenRouter key; presence = consent
  model:    string;           // free-text slug, default DEFAULT_MODEL
  features: { cv: boolean; jd: boolean; compat: boolean };
}

// Derived at runtime, NEVER persisted (R-2):
type AiConnectionStatus = 'connected' | 'none' | 'testing' | 'error';
```

Storage mapping:

| Field | Storage key | Notes |
|-------|-------------|-------|
| `apiKey` | `alice.ai.openrouterKey` | **reused** (unchanged) |
| `enabled` | `alice.ai.enabled` | new; `'1'`/absent |
| `model` | `alice.ai.model` | new; defaults to `DEFAULT_MODEL` when absent/blank |
| `features` | `alice.ai.features` | new; JSON `{cv,jd,compat}` |
| ~~consent~~ | `alice.ai.consent` | **retired**; read once during migration only |

New/changed exports (illustrative — finalised in implementation):
`isEnabled/setEnabled`, `getModel/setModel`, `getFeature(key)/setFeature(key,val)`,
`getConnectionStatus()` (derived), `validateKey()` delegate (calls `llmParser`).
`hasConsent` is removed or re-expressed as `hasKey()`.

### Defaults (per Clarifications)
- Brand-new browser (no key): `enabled=false`, `apiKey=null`, `model=DEFAULT_MODEL`,
  `features={cv:true, jd:false, compat:false}` (CV default-on takes effect once a
  key is saved and master is on; JD/Compat disabled in UI regardless).
- JD/Compat persist `false` and their toggles render disabled until 035/036.

### Migration (one-way, browser-local) — R-1
On first 034 read, if the new keys are absent:

| Prior state (033) | Result |
|-------------------|--------|
| key present **and** consent granted | `enabled=true`, `apiKey` kept, `model=DEFAULT_MODEL`, `features={cv:true,jd:false,compat:false}` |
| key present, no consent | key kept; `enabled=false` (user re-enables); other defaults |
| no key | brand-new defaults (master off) |

After migration the `alice.ai.consent` key may be removed. Migration writes the
new keys so it runs once. **No server data is involved.**

---

## 2. Profile model (reused, unchanged)

Canonical model lives in `src/models/profile.js` (rendered read-only by
`Profile.js`, edited by `ProfileEdit.js`). Reference: `profile_page.md` §7.

- `firstName, lastName, city, phone, email, summary` (strings)
- `experience[], education[], skills[], certifications[], awards[], languages[], links[]`
- `skills[]`: `{ name, level: 1|2|3|4|5|null }` — Feature 031 owns the scale;
  legacy `string[]` → `{name, level:2}` on load (`normaliseSkillEntry`); imported
  skills arrive **unrated** (`level:null`) via `mergeResumeData`.

034 introduces **no new fields** and no changes to `normaliseProfile`,
`validateProfile`, `mergeResumeData`, `dedupeSkillsForStorage`, or
`splitProfileForStorage`/`joinProfileWithSkills`.

---

## 3. Transient edit-page state (in-memory, not persisted)

Drives the proposed flow; lives in `ProfileEdit.js` module state during a session:

| State | Purpose | Lifecycle |
|-------|---------|-----------|
| entry mode (`gate` / `manual` / `smart`) | which entry path | first-time only; gate suppressed when a profile exists |
| pre-import snapshot | deep clone of form state before applying a parse | captured pre-apply; consumed by Undo; dropped after save/next import |
| provenance map | per-section tag: `ai` / `basic` / none | set on import; cleared per section on edit/save |
| import-bar expanded | existing-profile import affordance | UI only |
| parse outcome / reason | success / `ParsedProfile` / failure reason code | transient; drives dialogs |

```ts
// Parser output — same shape as Profile, all fields optional (033, reused)
type ParsedProfile = Partial<Profile>;
// first-time → fill all; existing → append lists, Summary as new paragraph,
//   singular Basic Info filled only if empty (mergeResumeData)
```

---

## 4. Reason codes (UI enum) — R-6 / `edit_profile_page.md` §11

A static table consumed by the Test flow and the import failure dialog. **Not
persisted.** Provider-agnostic copy.

| Key | Code chip | `fix` | Recovery |
|-----|-----------|-------|----------|
| `rate_limit` | `HTTP 429` | wait | Try AI again |
| `timeout` | `TIMEOUT` | wait | Try AI again |
| `server` | `HTTP 503` | wait | Try AI again |
| `network` | `NETWORK` | wait | Try AI again |
| `invalid_key` | `HTTP 401` | settings | Update key in Settings |
| `quota` | `HTTP 402` | settings | Update key in Settings |
| `NO_TEXT` | `NO_TEXT` | dead-end | Use a different file / paste |

Unknown failures default to `rate_limit`-style **wait** (retryable).

---

## 5. Application counts (read-only, reused)

`Profile.js` reads counts via `getAll()` (active) + `getAll({view:'archived'})`
(archived count for the link). Derived stats via `computeAppCounts`/`computeStats`
(`models/profile.js`). **Unchanged** by 034.
