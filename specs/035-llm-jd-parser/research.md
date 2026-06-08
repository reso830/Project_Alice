# Research & Decisions: LLM JD Parser

Decisions taken before planning, grounded in the spec, design §13, and existing code.
Each records the choice, rationale, and alternatives rejected.

---

## D1 — Reuse the resume LLM transport; add a JD-specific parse function

**Decision**: Extract the shared OpenRouter transport in `services/llmParser.js`
(fetch + `AbortController` timeout + fenced-JSON extraction + error→reason mapping)
into a private helper, and add `parseJobWithLlm(text, key, model)` that uses a
JD-specific system prompt and normalizes via the **application** model.

**Why**: The transport, `LLM_TIMEOUT_MS`, `MAX_INPUT_CHARS`, `REASON_CODES`, and
`mapErrorToReason` are schema-agnostic and already battle-tested by 033. Only the
prompt and the output normalizer differ.

**Rejected**:
- *New standalone module duplicating the transport* — needless duplication and drift.
- *Generalize `parseWithLlm` to take a schema param* — larger blast radius on the
  shipped resume path; a thin second wrapper is lower-risk.

---

## D2 — Paste-only; no backend endpoint

**Decision**: JD entry is pasted text only; the LLM call runs client-side in the
browser (BYOK), exactly like the resume LLM path. No `/api` route is added.

**Why**: The spec scopes out file upload for JDs. Without file extraction there is no
server work to do; a job posting is public text, so there is no PII-handling reason to
proxy it server-side. Keeps the feature local-first and serverless-free.

**Rejected**:
- *Server-side proxy for the LLM call* — would introduce server-side handling of the
  user's key/text, contradicting the BYOK browser-only model and the spec's no-server-
  persistence requirement.

---

## D3 — AI gating = master toggle AND `jd` feature AND key

**Decision**: `aiOn = aiSettings.isEnabled() && aiSettings.getFeature('jd') &&
aiSettings.hasKey()`, mirroring `ResumeImport.canUseAiParser()` (which uses `'cv'`).

**Why**: The Settings UI has a master "AI features" switch plus per-feature toggles;
the resume path already requires both master + feature + key. Consistency avoids a
confusing partial-enable state.

**Rejected**:
- *Key + `jd` only (ignore master)* — inconsistent with the resume path and the
  Settings master switch semantics.

---

## D4 — When AI is off, Smart entry is locked (no keyless basic-parse)

**Decision**: AI off → Smart card dimmed with "Enable AI in Settings →"; user takes
Manual entry. The basic parser is reachable only as the post-AI-failure fallback.

**Why**: Confirmed by the product owner and matches the resume gate
(`ResumeImport.renderSettingsAffordance`) and design §13.1. 013's standalone keyless
rule-based parse is intentionally superseded; local-first is preserved by Manual entry.

**Rejected**:
- *Keyless Smart entry runs the basic parser* — explicitly rejected during clarification.

---

## D5 — New `JobPostingImport` component (vs. extending `CreationPicker`)

**Decision**: Put the JD smart-input/processing/failure flow in a new
`components/JobPostingImport.js` mirroring `ResumeImport`'s structure (paste-only,
application schema). `CreationPicker` becomes the thin §13.1 gate that routes to it.

**Why**: Keeps the gate lean and isolates the parse flow's state machine (idle →
processing → success/failure/dead-end) the same way `ResumeImport` isolates the resume
flow. Eases targeted testing.

**Rejected**:
- *Inline everything in `CreationPicker`* — would bloat the gate and entangle two
  state machines.
- *Reuse `ResumeImport` directly* — it is file+paste and profile-schema specific;
  forcing JD through it would add conditionals to a shipped component.

---

## D6 — Provenance ported into `Modal.js` from `ProfileEdit.js`

**Decision**: Add `aiFields` + `fillSource` to `Modal.open()` and render ✦ AI / ⚙ Auto
markers, fill banner, one-time flash, and clear-on-edit in Create mode — porting the
ProfileEdit pattern (`_aiFields`, `section-provenance`, `clearAiIndicator`).

**Why**: The Modal currently supports only `prefill`; the §13.6 provenance UX does not
exist for applications yet. ProfileEdit already proves the pattern, reducing design risk.

**Rejected**:
- *Skip provenance for v1* — it is a P3 user story but explicitly in scope per the
  "full §13 realization" clarification.

---

## D7 — Output normalization & random compat

**Decision**: Run the LLM JSON through `normalizeApplication()` + `validateApplication()`
(enum whitelist, salary positivity, URL validity); assign a random 0–100 compat and a
`wishlisted` status; never parse status from the JD.

**Why**: Guarantees no malformed/`_corrupt` data pre-fills the form, reuses centralized
validation, and matches the basic parser's compat behavior (clarified decision).

**Rejected**:
- *Trust LLM output as-is* — risks invalid enums/salaries reaching the form.
- *Leave compat 0 / blank* — rejected during clarification in favor of basic-parser parity.

---

## Open items deferred to tasks/implementation (non-blocking)

- Exact JD system-prompt wording and few-shot framing (tune during implementation;
  contract in [`contracts/api.md`](contracts/api.md)).
- Placement of the over-length truncation notice (smart-input vs. Modal banner).
- Whether to later extract a shared "smart-parse failure surface" once a third consumer
  exists (explicitly deferred).
