# Implementation Plan: LLM JD Parser

**Feature**: `035-llm-jd-parser`
**Spec**: [`spec.md`](spec.md)
**Design refs**: [`docs/design/application_overlay.md`](../../docs/design/application_overlay.md) §13, [`docs/design/tracker.md`](../../docs/design/tracker.md)
**Supporting artifacts**: [`research.md`](research.md) · [`data-model.md`](data-model.md) · [`contracts/api.md`](contracts/api.md) · [`quickstart.md`](quickstart.md) · [`checklists/plan-review.md`](checklists/plan-review.md)

---

## Summary

Add an AI-assisted job-description parsing path that mirrors the feature-033 resume
parser, but targets the **application** schema and is **paste-only**. When AI is on
(key configured + master AI toggle + `jd` feature toggle), pasted job text is sent to
OpenRouter in a single client-side request, validated against the application schema,
and used to pre-fill the Create-mode Detail Modal with **✦ AI** provenance. When AI
is off the Smart card is locked ("Enable AI in Settings →") and the user takes Manual
entry; when an AI parse fails, a reason-code dialog offers the rule-based **basic
parser** (⚙ Auto), retry, or manual continuation. Nothing is saved automatically; no
key or job text is persisted server-side.

The work reuses three existing, proven pieces and adds one genuinely new capability:

| Reuse | New |
| --- | --- |
| `services/llmParser.js` transport (timeout, truncation, `REASON_CODES`, `mapErrorToReason`) | A JD-specific prompt + `parseJobWithLlm()` returning an application draft |
| `utils/jobPostParser.js` `parseJobPost()` as the basic-parser fallback | The §13.1 Add-application **gate** redesign + JD smart-input flow |
| `pages/ProfileEdit.js` provenance pattern (`_aiFields`, section markers, clear-on-edit) | **Provenance support ported into `components/Modal.js`** (Create mode) |

**No backend changes** — paste-only means no file extraction, so no `/api` endpoint
is involved (the call runs in the browser, like the resume LLM path).

---

## Architecture

### Layers touched

```
Gate / entry        CreationPicker.js  ──►  §13.1 gate (Smart vs Manual, locked state)
Smart-input flow    JobPostingImport.js (NEW)  ──►  paste → processing → success/failure
AI parse            services/llmParser.js  ──►  parseJobWithLlm(text, key, model)
Basic parser        utils/jobPostParser.js  ──►  parseJobPost(text)   (unchanged)
Validation          models/application.js  ──►  normalizeApplication + validateApplication
Review / save       components/Modal.js  ──►  Create mode + provenance markers (NEW)
Settings gate        data/aiSettings.js + pages/Profile.js  ──►  live `jd` toggle
```

### Gating (single source of truth)

Mirror `ResumeImport.canUseAiParser()` with the `jd` feature key:

```
aiOn = aiSettings.isEnabled()           // master "AI features" switch
     && aiSettings.getFeature('jd')      // per-feature toggle (currently "coming soon")
     && aiSettings.hasKey()              // BYOK key present
```

- `aiOn === true` → Smart card shows the *Fastest* affordance; Parse posting runs the LLM.
- `aiOn === false` → Smart card **locked** (dimmed sparkle, "Enable AI in Settings →"
  replacing its CTA); Manual entry always available. **No parse is attempted; the basic
  parser is not offered here** — it is only the post-AI-failure fallback.

### AI parse function (`parseJobWithLlm`)

Add to `services/llmParser.js` alongside the resume `parseWithLlm`. Refactor the shared
OpenRouter transport (fetch + `AbortController` timeout + JSON/fence extraction + error
mapping) into a private helper used by both, so the resume path's behavior is unchanged:

- **Input**: raw pasted text, key, model. Truncate at `MAX_INPUT_CHARS` (24k) with a
  `truncated` flag (JDs are usually far shorter; truncation is an edge case).
- **System prompt**: instruct the model to return ONLY a JSON object shaped to the
  application schema (see [`contracts/api.md`](contracts/api.md)) — constrained enums,
  salary as an annual PHP integer (lower bound of a range), deduped skills, **status
  omitted**, and **no "years of experience"** field (non-goal — no schema home).
- **Output handling (three outcomes)**: parse JSON → `normalizeApplication()` +
  `validateApplication()` (enum whitelist, URL validity, salary positivity). Then:
  unparseable/non-object → `LLM_INVALID_RESPONSE` (recoverable, offers basic parser);
  valid object with zero usable fields → `LLM_EMPTY_RESPONSE` → `NO_TEXT` dead-end;
  ≥1 usable field → return `{ draft, truncated }`.
- **Errors**: surfaced via `mapErrorToReason()` → existing `REASON_CODES`.

### Provenance in the Modal (the main new UI capability)

Port the ProfileEdit pattern into `components/Modal.js` Create mode:

- `open()` gains `aiFields` (Set of field paths) and `fillSource` (`'ai' | 'basic'`).
- Per-filled-field tag: **✦ AI** (indigo) or **⚙ Auto** (neutral) beside the label;
  non-color-only (glyph + text) per the constitution.
- Dismissible **fill banner**: "Filled from the job posting" (ai) / "Filled by the
  basic parser" (basic).
- One-time **flash** on filled fields/values; the Job Title editor does **not**
  auto-open when prefilled (so the flash is visible).
- **Clear-on-edit**: editing a field removes its marker (value is now user-authored),
  reusing the ProfileEdit `clearAiIndicator` approach adapted to the Modal's field model.
- Compat is a random 0–100 (basic-parser parity); status stays `wishlisted`.

---

## Data flow

```
+ New application / FAB
        │
        ▼
CreationPicker gate ──"Manual"──► Modal.open(null, { mode:'create' })           (empty draft)
        │
     "Smart"
        │
   aiOn? ──no──► Smart card LOCKED ("Enable AI in Settings →") → user takes Manual
        │yes
        ▼
JobPostingImport: paste (≥~40 chars) → "Parse posting"
        │
        ▼  processing scrim ("Reading the job posting…")
parseJobWithLlm(text, key, model)
        │
   success ──► Modal.open(null, { mode:'create', prefill, aiFields, fillSource:'ai' })
        │
   failure (reason) ──► failure dialog:
        │     • Use basic parser ─► parseJobPost(text) ─► Modal { prefill, fillSource:'basic' }
        │     • Try AI again (wait reasons) / Update key in Settings (key/credit reasons)
        │     • Enter manually ─► Modal.open(null, { mode:'create' })
        │
   NO_TEXT / unreadable ──► dead-end dialog: Try again / Enter manually (no basic parser)
        │
        ▼
Modal (Create): provenance markers + banner + flash; clear-on-edit; Create → save
```

Pasted text is preserved across retries/fallback (held in the flow's local state, as
`ResumeImport` does with `pendingBasicText`). The key and job text never touch the
server or any repository.

---

## Affected components

| Component | Change | Notes |
| --- | --- | --- |
| `src/services/llmParser.js` | **Modify** | Extract shared transport; add `parseJobWithLlm()` + JD system prompt + application normalize/validate. Keep resume path behavior identical. |
| `src/components/JobPostingImport.js` | **New** | Paste-only smart-input flow (idle → processing → success/failure/dead-end), mirroring `ResumeImport` structure with `'jd'` gating and the application schema. |
| `src/components/CreationPicker.js` | **Modify** | Upgrade to the §13.1 gate: Smart vs Manual cards, locked Smart state when `aiOn` is false, route Smart → `JobPostingImport`, Manual → Modal create. |
| `src/components/Modal.js` | **Modify** | Add `aiFields` + `fillSource` to `open()`; render ✦ AI / ⚙ Auto markers, fill banner, one-time flash, clear-on-edit in Create mode. |
| `src/pages/Profile.js` | **Modify** | Make the `jd` feature toggle live (`isComingSoon = key === 'compat'`); refresh copy so it no longer reads "Coming soon." |
| `src/utils/jobPostParser.js` | **Inspect only** | Reused unchanged as the basic parser; confirm import surface. |
| `src/data/aiSettings.js` | **Inspect only** | Already exposes `getFeature('jd')`, `isEnabled`, `hasKey`, `getModel`; no change expected. |
| CSS (gate/provenance styles) | **Modify** | Gate cards, locked state, processing scrim, failure dialog, and ✦/⚙ markers/banner styling per the design tokens. |

---

## Risks & tradeoffs

- **Modal provenance is new and central to the create flow.** Highest-risk change —
  a regression here affects all application creation, not just AI parses. *Mitigation*:
  mirror the already-shipped ProfileEdit implementation closely; gate all provenance
  behind the presence of `aiFields`/`fillSource` so the plain Manual create path is
  byte-for-byte unchanged; cover with component tests.
- **`llmParser.js` refactor risk.** Extracting the shared transport could perturb the
  resume path. *Mitigation*: keep `parseWithLlm`'s public signature and behavior
  identical; rely on the existing `tests/services/llmParser.test.js` as a regression net.
- **Duplication vs. premature abstraction.** `JobPostingImport` repeats much of
  `ResumeImport`'s failure-dialog/reason-routing structure. *Tradeoff*: duplicate now
  (paste-only + different schema make a clean shared abstraction non-trivial), and
  extract a shared "smart-parse failure surface" later only if a third consumer appears.
- **Free-model reliability/latency.** Open/free OpenRouter models can be slow or flaky.
  *Mitigation*: existing 30s timeout → reason-code fallback; basic parser + manual always
  available.
- **Random compat may mislead** until the real compat engine (036/037) lands. *Accepted*
  per the clarified decision (matches the basic parser; documented in spec).
- **Behavior change for keyless users.** 013's standalone keyless rule-based parse is
  superseded (AI off → Manual only). *Accepted/confirmed* by the product owner; local-
  first preserved via Manual entry.

---

## Validation approach

- **Unit (`parseJobWithLlm`)**: with a mocked `fetch`, assert JSON/fence extraction,
  enum/salary/skill normalization via `validateApplication`, truncation flag, empty-result
  → reject, and error→reason mapping for 401/402/429/timeout/network/5xx.
- **Basic parser**: `parseJobPost` unchanged; existing tests stand. Add a test that the
  fallback path marks fields `⚙ Auto`.
- **`JobPostingImport` (component)**: paste min-length gating; `aiOn` true → AI path,
  false → locked affordance (no parse); processing scrim; failure dialog routes by reason
  (`Try AI again` for wait reasons, `Update key` for key/credit reasons, plus `Use basic
  parser` and `Enter manually`); NO_TEXT dead-end omits the basic option; pasted text
  preserved across retries.
- **`CreationPicker` gate**: Smart locked when `aiOn` false; Manual always available and
  opens an empty Create draft.
- **`Modal` provenance**: ✦ AI / ⚙ Auto markers render for filled fields; banner + flash
  appear; marker clears on edit; Manual create renders no markers; compat random 0–100;
  status `wishlisted`; Job Title editor not auto-opened when prefilled.
- **Settings**: `jd` toggle is enabled, persists across reload, and is read by the gate.
- **Constitution validation**: required fields (company, title, responsibilities, status,
  lastStatusUpdate), URL validity, enum whitelisting, and date handling are enforced by
  `validateApplication` on parsed data identically to manual entry.
- **Browser smoke test** (constitution final phase, after Release Prep): walk each user
  story's Independent Test against the merge state.

---

## Constitution Check

| Rule | Status |
| --- | --- |
| Local-first; no external analytics by default | **Pass** — Manual entry needs no key; only the user-initiated BYOK LLM call leaves the browser; no telemetry added. |
| New dependencies require justification | **Pass** — none added (reuses `fetch` + existing AI infra). |
| Separate business logic from UI | **Pass** — parsing in `services/`/`utils/`, gating in `data/aiSettings.js`, UI in components. |
| Centralized, reusable validation | **Pass** — reuses `validateApplication`/`normalizeApplication`. |
| Required fields validated before save; URL/date rules; no silent corruption | **Pass** — parsed data flows through the same validation as manual entry. |
| Non-color-only status/indicators; labeled forms; keyboard nav; desktop+mobile | **Pass** — ✦/⚙ use glyph+text; gate/flow keyboard-navigable; bottom-sheet on mobile. |
| Core validation has automated tests | **Pass** — see Validation approach. |
| Mandatory final phases: Release Prep → Browser Smoke Test | **Planned** — appear as the last two phases in `tasks.md`. |

No deviations to record.

---

## Affected Areas

### Files/components likely to be inspected
- `src/components/ResumeImport.js` — template for the smart-input/processing/failure flow.
- `src/pages/ProfileEdit.js` — source pattern for provenance (`_aiFields`, section markers, `clearAiIndicator`, `applyImportedResume`).
- `src/utils/jobPostParser.js` — basic-parser fallback (reused unchanged).
- `src/data/aiSettings.js` — gating API (`isEnabled`, `getFeature('jd')`, `hasKey`, `getModel`).
- `src/models/application.js` — `normalizeApplication`/`validateApplication`, enum/salary rules.
- `tests/services/llmParser.test.js`, `tests/components/ResumeImport.test.js`, `tests/pages/profileEdit.aiIndicators.test.js` — patterns to mirror.

### Files/components likely to be modified
- `src/services/llmParser.js` — shared transport extraction + `parseJobWithLlm()` + JD prompt.
- `src/components/CreationPicker.js` — §13.1 gate redesign + locked Smart state.
- `src/components/JobPostingImport.js` — **new** paste-only JD smart-input flow.
- `src/components/Modal.js` — Create-mode provenance (`aiFields`, `fillSource`, markers, banner, flash, clear-on-edit).
- `src/pages/Profile.js` — make the `jd` toggle live; update copy.
- Stylesheet(s) for the gate, processing scrim, failure dialog, and provenance markers.

### Tests likely to be added or updated
- New: `tests/services/llmParser.jd.test.js` (or extend the existing llmParser test) for `parseJobWithLlm`.
- New: `tests/components/JobPostingImport.test.js` (gating, locked state, failure routing, fallback, dead-end, text preservation).
- Updated: `CreationPicker` test (gate behavior); `Modal` test (provenance markers, compat random, status wishlisted); Profile AI-settings test (`jd` toggle live + persisted).

### Explicitly out of scope
- Backend / `api/` changes, any new server endpoint, or server-side persistence.
- File upload for job postings (paste-only).
- The compatibility engine / real compat scoring (features 036/037).
- Changes to the application schema, the resume LLM path, or the basic parser's extraction logic.
- A separate JD consent dialog (gated by the Settings toggle only).
