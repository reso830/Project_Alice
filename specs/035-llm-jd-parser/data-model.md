# Data Model: LLM JD Parser

**No schema change.** This feature consumes the existing application schema
(`src/models/application.js`) and produces a transient draft + provenance metadata.
Nothing new is persisted.

---

## Parsed Application Draft (transient)

The fields the JD parsers populate, with the normalization applied before pre-fill.
(`status` is **never** parsed; `compat` is assigned, not extracted.)

| Field | Type | Normalization / rule |
| --- | --- | --- |
| `companyName` | string | Trimmed; required at save (`validateApplication` flags `_corrupt` if empty). |
| `jobTitle` | string | Trimmed; required at save. |
| `responsibilities` | string | Multi-line; required at save. |
| `location` | string \| '' | Free text; '' when not stated. |
| `salary` | integer \| null | Annual PHP, **lower bound** of any range; `null`/coerced when ≤ 0 or absent. |
| `workSetup` | enum \| '' | One of `Remote · Hybrid · On-site · Field`; '' otherwise (whitelisted by `validateApplication`). |
| `shift` | enum \| '' | One of `Day · Mid · Night · Flexible`; '' otherwise (whitelisted). |
| `skills` | string[] | Required skills; **deduped**; empty array when none. |
| `preferredSkills` | string[] | "Nice to have" skills; deduped; empty array when none. |
| `recruiter` | string \| '' | Free text; '' when absent. |
| `jobPostingUrl` | string (URL) \| '' | Validated `http(s)`; cleared to '' if invalid. |
| `status` | enum | **Always `wishlisted`** — not parsed. |
| `compat` | integer 0–100 | **Random** on creation (basic-parser parity); clamped by `validateApplication`. |

All other application fields (timeline, fav, notes, applicationDate, follow-up, …) are
left at their normalized create-mode defaults (empty/false/null); the parsers do not
populate them.

**Not extracted — "years of experience".** Listed in the brief but has no schema home;
it is an explicit non-goal (no output field, not requested in the contract). A
dedicated field is deferred to the compatibility engine (036/037). If a posting states
it, it remains within the extracted `responsibilities` prose — no special handling.

### Validation pipeline (applied before the draft pre-fills the Modal)

```
LLM JSON ──► normalizeApplication() ──► validateApplication() ──► draft
              (string coercion,           (enum whitelist, URL validity,
               salary positivity,          status fallback→wishlisted,
               array defaults)             compat clamp, _corrupt flags)
```

Three outcomes after the pipeline: **≥1 usable field** → pre-fill as-is;
**unparseable / non-object** → recoverable dialog (offers Use basic parser);
**valid object but zero usable fields** → terminal NO_TEXT dead-end (no basic option).
A blank "AI-filled" form is never shown.

---

## Provenance Metadata (transient, Modal-local)

Mirrors `application_overlay.md` §10/§13.8 and the ProfileEdit implementation.

| Key | Type | Meaning |
| --- | --- | --- |
| `aiFields` | `Set<string>` | Field paths the machine populated (e.g. `companyName`, `skills[0]`); drives the per-field ✦ AI / ⚙ Auto tag and one-time flash. |
| `fillSource` | `'ai' \| 'basic'` | Selects ✦ AI (indigo) vs ⚙ Auto (neutral) styling and the fill-banner copy. |

Lifecycle:
- Set when the Modal opens from a parse; **cleared per field** when the user edits that
  field (value becomes user-authored).
- Never persisted — provenance is review-time UI state only.

---

## Settings State (existing, reused — `src/data/aiSettings.js`)

| Key | Storage | Role here |
| --- | --- | --- |
| OpenRouter key | browser only (`alice.ai.openrouterKey`) | Authorizes the LLM call; gates the AI path. |
| `enabled` (master) | browser (`alice.ai.enabled`) | Master "AI features" switch. |
| `features.jd` | browser (`alice.ai.features`) | Per-feature toggle — **made live** by this feature (was "coming soon"). |
| `model` | browser (`alice.ai.model`) | Shared model slug for all AI calls. |

No new keys or storage are introduced.
