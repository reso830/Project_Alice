# Feature Specification: LLM Resume / CV Parser

**Feature Branch**: `033-llm-resume-cv-parser`
**Created**: 2026-06-02
**Status**: Draft
**Input**: Feature brief: `docs/features/033-llm-resume-cv-parser.md`

---

## Problem Statement

Today Alice extracts profile data from an uploaded resume using a **rule-based**
text parser (`POST /api/resume/parse` → `extractText()` + `parseResumeText()`,
features 014/021). Rule-based extraction is brittle: it misreads multi-column
layouts, inconsistent date formats, and non-standard section headings, and it
struggles to distinguish responsibilities, achievements, and technologies. The
result is incomplete or noisy pre-fill that users must heavily correct,
undermining the "reduce setup friction" goal and weakening downstream
compatibility calculations that depend on clean skill/experience data.

This feature adds an **AI-assisted** parsing path: the user can paste resume
text or upload a file, the raw text is sent to an LLM (via OpenRouter), and the
LLM returns structured JSON matching Alice's profile schema. The parsed draft is
validated, then used to pre-fill the Edit Profile form for manual review and
edit. Nothing is saved automatically and no resume file is stored permanently.

Because sending resume text to an external provider is a network call involving
**personally identifiable information (PII)**, the feature is gated behind a
user-supplied API key (BYOK) and explicit one-time consent, and degrades
gracefully to the existing rule-based parser when the LLM is unavailable —
preserving the constitution's local-first principle (the app remains fully
runnable, and resume import keeps working, from a plain GitHub checkout with no
key configured).

---

## Scope

- Add an LLM-assisted parsing path that accepts **pasted text** and **uploaded
  files** (PDF, DOCX, TXT — reusing the existing extractor and 5 MB cap).
- Send extracted raw text to an LLM (OpenRouter, targeting open/free models) in a
  **single** request and receive structured JSON matching the profile schema.
- **Validate** the LLM output against the profile schema before it is allowed to
  pre-fill the form; reject malformed output.
- Pre-fill the Edit Profile form using the existing merge rules (singular fields
  fill empty slots only; collection sections append with duplicate detection;
  imported skills arrive **unrated**). No automatic save.
- Mark AI-populated fields with a subtle "AI-generated" indicator; all fields
  remain fully editable.
- **Bring-your-own-key (BYOK)** configuration: a Settings field where the user
  pastes an OpenRouter API key, stored **in their own browser only**, with a
  clear notice that the key lives in their browser and safeguarding it is their
  responsibility.
- **One-time consent**: before resume content is first sent to the external
  provider, the user must opt in via an explicit notice.
- **Graceful degradation / failure handling**: when no key is configured, no
  consent is given, or the LLM call fails/returns invalid data, automatically
  fall back to the existing rule-based parser; on a hard failure, allow retry and
  manual continuation without losing existing form data.
- Both runtimes (local and hosted) support the LLM path when a key is configured.

## Out of Scope (Non-Goals)

- Resume rewriting, beautification, or redesign.
- Auto-saving parsed data (review-before-save is mandatory).
- Conversational / chat-based AI editing of the profile.
- Permanent resume storage (files and extracted text are processed transiently).
- Operator-funded API keys or a shared server-side provider key (BYOK only).
- Multi-step or chained AI calls / agentic pipelines (single request per parse).
- Changing the profile schema itself (consumes the existing schema as-is).
- Server-side persistence of the user's API key or of resume content.

---

## Clarifications

### Session 2026-06-02

- Q: Which profile fields should the LLM extract — the brief's 7 areas only, or the full schema? → A: The **full profile schema** — the 7 areas (summary, **skills**, experience, certifications, education, awards, languages) **plus** the singular contact fields (firstName, lastName, email, phone, city) **and** links. The LLM must not extract fewer fields than the rule-based fallback.
- Q: How should over-length input (beyond the provider/context limit) be handled? → A: **Truncate with notice** — send up to a safe length, parse what fits, and warn the user the resume was long so some tail content may not have been parsed; a draft is still produced.
- Q: What happens to a field's "AI-generated" indicator when the user edits that field? → A: **Clears on edit** — modifying an AI-populated field immediately removes its indicator (the value is now user-authored).
- Q: How long should Alice wait for the LLM before timing out and falling back? → A: **~30 seconds**, defined as a **single easily-adjustable constant** (default 30s) so the threshold can be tuned without code restructuring. Exceeding it triggers the rule-based fallback.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — AI-Assisted Parse and Review (Priority: P1)

A user who has configured an OpenRouter key and granted consent goes to the Edit
Profile page, pastes their resume text (or uploads a PDF/DOCX/TXT), and clicks
the process action. Alice extracts the raw text, sends it to the LLM, validates
the returned JSON, and pre-fills the Edit Profile form. The user reviews the
AI-populated fields, corrects anything wrong, and saves manually. No automatic
save occurs.

**Why this priority**: This is the core value proposition — higher-quality,
lower-effort profile extraction. Every other story supports or guards this one.

**Independent Test**: With a key configured and consent granted, open Edit
Profile, paste a resume containing a summary, several experience entries with
varied date formats, skills, education, and a certification. Process it. Confirm
the form pre-fills with cleanly separated fields (summary, experience roles/
companies/dates/responsibilities, skills, education, certification), that
AI-populated fields show an indicator, that no save has occurred, and that an
edit + Save persists the reviewed values.

**Acceptance Scenarios**:

1. **Given** a configured key and granted consent, **When** the user pastes
   resume text and processes it, **Then** the raw text is sent to the LLM and the
   returned structured data pre-fills the Edit Profile form.
2. **Given** the same preconditions, **When** the user uploads a supported file
   (PDF/DOCX/TXT ≤ 5 MB) and processes it, **Then** text is extracted and the
   same LLM path runs.
3. **Given** parsing is in progress, **When** the user waits, **Then** loading
   feedback is shown and the process action is disabled for the duration.
4. **Given** the LLM returns valid JSON, **When** results are ready, **Then**
   fields are pre-filled per the merge rules (singular fields fill empty slots
   only; collections append with duplicate detection; skills arrive unrated).
5. **Given** the form is pre-filled, **When** the user edits any field, **Then**
   it behaves identically to normal manual editing.
6. **Given** pre-filled (unsaved) data, **When** the user clicks Save, **Then**
   the profile is saved exactly as if entered manually, and only then.
7. **Given** the full profile schema, **When** parsing succeeds, **Then** Alice
   attempts to populate: contact fields (firstName, lastName, email, phone,
   city), summary, skills, experience, certifications, education, awards,
   languages, and links.

---

### User Story 2 — BYOK Key Setup and Consent (Priority: P1)

A user enables AI parsing by pasting their own OpenRouter API key into a Settings
field and granting consent for resume content to be sent to the external
provider. The UI makes clear that the key is stored only in their browser and
that safeguarding it is their responsibility.

**Why this priority**: Without a key and consent, the LLM path in Story 1 cannot
run. It is a distinct, independently testable enabling slice.

**Independent Test**: Open Settings with no key configured. Confirm a clear
notice that the key is stored in the browser and is the user's responsibility.
Paste a key and save; reload the page and confirm the key persists (browser-only)
and is not transmitted to or stored by the app's server. Trigger the first parse
and confirm an explicit consent notice appears before any content is sent;
decline and confirm nothing is sent; accept and confirm the choice is remembered
for subsequent parses.

**Acceptance Scenarios**:

1. **Given** no key is configured, **When** the user opens the key Settings
   field, **Then** a clear notice explains the key is stored only in their
   browser and safeguarding it is their responsibility.
2. **Given** the user enters and saves a key, **When** the page is reloaded,
   **Then** the key persists in the browser and the LLM path becomes available.
3. **Given** the user has a key but has never consented, **When** they trigger a
   parse, **Then** an explicit one-time consent notice is shown before any
   content leaves the browser.
4. **Given** the consent notice, **When** the user declines, **Then** no resume
   content is sent to the provider and the user can still continue manually or
   via the rule-based fallback.
5. **Given** the user accepts consent once, **When** they parse again later,
   **Then** they are not re-prompted (consent is remembered) until they clear it.
6. **Given** a key is configured, **When** any request is made, **Then** the key
   and resume content are never persisted by the application's server.
7. **Given** demo mode, **When** the user views the import/Settings area, **Then**
   the AI parsing affordance is unavailable (the existing demo gating is
   preserved).

---

### User Story 3 — Graceful Degradation and Failure Handling (Priority: P2)

A user without a configured key, or whose LLM call fails or returns unusable
data, still gets a working import: Alice falls back to the existing rule-based
parser, and on a hard failure offers retry and manual continuation without losing
any data already in the form.

**Why this priority**: Protects the local-first principle and the brief's
"failures degrade gracefully" success criterion. Trust requirement: the feature
must never strand the user or destroy in-progress data.

**Independent Test**: (a) With no key configured, process a resume and confirm
the rule-based parser runs and pre-fills the form. (b) With a key configured,
simulate an LLM failure (provider down / timeout / invalid JSON) and confirm
Alice falls back to rule-based parsing and surfaces a non-technical message.
(c) Confirm that when everything fails, the user sees retry + "continue
manually", and any fields already entered are preserved.

**Acceptance Scenarios**:

1. **Given** no key is configured, **When** the user processes a resume, **Then**
   the existing rule-based parser runs and pre-fills the form (current behavior
   preserved).
2. **Given** a key is configured but the LLM call fails (timeout, provider error,
   network error), **When** the failure is detected, **Then** Alice automatically
   falls back to the rule-based parser and informs the user without leaking
   provider/library internals.
3. **Given** the LLM returns output that fails schema validation, **When**
   validation rejects it, **Then** Alice falls back to the rule-based parser
   rather than populating malformed data.
4. **Given** both LLM and rule-based parsing fail, **When** the error is shown,
   **Then** the user is offered retry and manual continuation.
5. **Given** the user already has data in the form, **When** any parsing attempt
   fails, **Then** existing form data is not lost.

---

### User Story 4 — AI-Generated Field Indicators (Priority: P3)

After an AI-assisted parse, fields that were populated by the LLM carry a subtle
"AI-generated" indicator so the user knows which values to scrutinize, while the
fields remain fully editable.

**Why this priority**: Improves trust and review efficiency but is not required
for the core extract-and-review loop to deliver value.

**Independent Test**: Run an AI-assisted parse, confirm populated fields show a
subtle AI indicator, edit one such field, and confirm the indicator clears on
edit and the field saves normally.

**Acceptance Scenarios**:

1. **Given** an AI-assisted parse succeeds, **When** the form pre-fills, **Then**
   AI-populated fields display a subtle, non-color-only indicator.
2. **Given** a field has an AI indicator, **When** the user edits it, **Then** the
   indicator clears and the field behaves identically to a manually entered field.
3. **Given** parsing fell back to rule-based, **When** the form pre-fills, **Then**
   fields are not falsely labeled as AI-generated.

---

### Edge Cases

- **Poorly formatted / multi-column resumes**: LLM should normalize; if output
  fails validation, fall back to rule-based.
- **Incomplete resumes**: missing sections produce empty fields, not fabricated
  values; the user can fill gaps manually.
- **Extremely long resumes**: input exceeding provider/context limits is
  truncated to a safe length and parsed with a visible notice (FR-020), never a
  raw error.
- **Unsupported file formats**: rejected with the existing actionable message;
  the paste path remains available.
- **Hallucinated extractions**: the review-before-save flow and AI indicators are
  the primary mitigation; schema validation drops structurally invalid data.
- **Missing experience dates**: parse without dates; the existing required-date
  validation surfaces at review/save time (no silent fabrication of dates).
- **Empty paste / empty file**: blocked before any LLM call with a clear message.
- **Invalid or revoked API key**: surfaced as a user-actionable message; falls
  back to rule-based; never echoes provider auth internals.
- **Consent declined**: no content is sent; manual / rule-based paths remain.
- **Key present in one browser but not another**: expected — key is browser-only;
  the user re-enters it per device.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept resume input by both **pasting text** and
  **uploading a file** (PDF, DOCX, TXT) within the existing 5 MB upload cap, from
  the profile setup/edit flow.
- **FR-002**: System MUST extract raw text from uploaded files (reusing the
  existing extractor) and use pasted text directly as the raw input.
- **FR-003**: When a user-supplied API key is configured AND consent has been
  granted, System MUST send the raw text to the LLM (OpenRouter) in a **single**
  request and receive structured JSON.
- **FR-004**: System MUST request/expect LLM output matching the **full** existing
  profile schema, covering: the singular contact fields (firstName, lastName,
  email, phone, city), summary, skills, experience, certifications, education,
  awards, languages, and links. The LLM MUST NOT extract fewer fields than the
  rule-based fallback produces.
- **FR-005**: System MUST validate the LLM output against the profile schema
  before it is used to pre-fill the form; structurally invalid output MUST NOT
  populate the form.
- **FR-006**: System MUST pre-fill the Edit Profile form using the existing merge
  rules — singular fields fill only empty slots; collection sections append with
  duplicate detection; imported skills arrive **unrated**.
- **FR-007**: System MUST NOT auto-save; the user MUST review and explicitly save.
- **FR-008**: System MUST allow the user to configure their own OpenRouter API
  key (BYOK) via a Settings field; System MUST NOT provide or require an
  operator/server-side key.
- **FR-009**: System MUST store the user's API key **only in the user's browser**
  and MUST display a clear notice that the key is stored in their browser and that
  safeguarding it is their responsibility.
- **FR-010**: System MUST NOT persist the user's API key or resume content on the
  application server (no server-side storage of key or extracted text).
- **FR-011**: System MUST obtain explicit **one-time consent** before resume
  content is first sent to the external provider, and MUST remember that consent
  for subsequent parses until the user clears it.
- **FR-012**: When no key is configured or consent is not granted, System MUST
  fall back to the existing rule-based parser (current behavior preserved).
- **FR-013**: When the LLM call fails (provider/network error, or exceeds the
  request timeout) or returns output failing validation, System MUST automatically
  fall back to the rule-based parser. The timeout MUST be a single,
  easily-adjustable constant (default ~30 seconds).
- **FR-014**: When both the LLM and rule-based parsing fail, System MUST offer
  retry and manual continuation and MUST NOT lose data already in the form.
- **FR-015**: System MUST show loading feedback during processing and disable the
  process action for the duration.
- **FR-016**: System MUST mark AI-populated fields with a subtle, non-color-only
  "AI-generated" indicator; all such fields MUST remain fully editable, and the
  indicator MUST clear as soon as the user edits that field (the value is then
  user-authored).
- **FR-017**: System MUST present user-facing errors that are non-technical and
  MUST NOT leak provider or library internals (auth errors, stack traces, file
  offsets).
- **FR-018**: System MUST keep the LLM/AI parsing affordance unavailable in demo
  mode (preserving existing demo gating).
- **FR-019**: System MUST support the LLM path in both local and hosted runtimes
  when a key is configured.
- **FR-020**: When input exceeds the provider/context limit, System MUST
  **truncate to a safe length and parse what fits, showing the user a visible
  notice** that the resume was long and some tail content may not have been
  parsed — never a raw error, and still producing a reviewable draft.
- **FR-021**: System MUST validate required fields, URLs when provided, dates, and
  status transitions before saving (existing profile validation applies to
  AI-populated data identically).
- **FR-022**: System MUST support desktop and mobile browsers, labeled forms,
  keyboard navigation, and non-color-only status/indicator communication.

### Key Entities *(include if feature involves data)*

- **Resume Input**: Transient raw text, either pasted directly or extracted from
  an uploaded PDF/DOCX/TXT. Never persisted.
- **Parse Request**: A single LLM call carrying the raw text and a request for
  schema-shaped JSON. Carries the user's key only as needed to authorize the
  provider call; neither key nor text is stored by the application server.
- **Parsed Profile Draft**: Structured data matching the profile schema
  (summary, experience, education, skills, certifications, awards, languages,
  links), validated before pre-filling the form. Discarded if invalid.
- **Provider Key Setting**: The user's OpenRouter API key, stored only in the
  user's browser; accompanied by an ownership/responsibility notice.
- **Consent State**: A remembered flag indicating the user has opted in to send
  resume content to the external provider; clearable by the user.
- **Profile**: The existing profile record (unchanged schema) into which the
  draft is merged for review and manual save.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For well-formed resumes, AI-assisted parsing populates more profile
  fields correctly than the rule-based parser on the same input (measurable
  field-level accuracy improvement).
- **SC-002**: Users spend less time correcting pre-filled data after an
  AI-assisted parse than after a rule-based parse (fewer manual edits to reach a
  saveable profile).
- **SC-003**: A typical resume parse returns a populated, reviewable form within
  ~30 seconds (the adjustable timeout ceiling), with continuous loading feedback
  throughout; exceeding the timeout triggers the rule-based fallback rather than
  an indefinite wait.
- **SC-004**: 100% of LLM failures, invalid outputs, missing-key, and
  declined-consent cases result in a working fallback (rule-based or manual) with
  no data loss and no leaked provider/library internals.
- **SC-005**: The application remains fully usable for resume import from a plain
  GitHub checkout with no key configured (local-first preserved).
- **SC-006**: No resume content or API key is persisted on the application server
  in any runtime (verifiable by inspection/tests).

## Assumptions

- The existing profile schema (`src/models/profile.js`) and Edit Profile flow are
  reused unchanged; this feature does not modify the schema.
- The existing file extractor (PDF/DOCX/TXT, 5 MB cap, memory-only) and the
  feature-021 security model are reused for the upload path.
- OpenRouter is the target provider, prioritizing open/free models; model
  selection details are deferred to planning.
- A single LLM request per parse is sufficient; no chained/agentic calls.
- "Browser-only" key storage uses standard browser storage; the user accepts that
  clearing browser data removes the key and that it is their responsibility to
  protect it.
- Consent is remembered per browser alongside the key.
- The merge rules and duplicate detection from feature 014 are authoritative for
  how parsed data pre-fills the form.
- Profile data is private and local-first; the only external transmission
  introduced is the user-initiated, consented, BYOK LLM call.

## Dependencies

- Existing resume extractor and `POST /api/resume/parse` rule-based path
  (features 014, 021) — reused as the fallback.
- Existing Edit Profile form, merge rules, and demo-mode gating (features 014/020).
- Existing profile schema and validation (`src/models/profile.js`, feature 032).
- An external LLM provider (OpenRouter) reachable from the chosen call site.
