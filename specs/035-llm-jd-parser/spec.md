# Feature Specification: LLM JD Parser

**Feature Branch**: `035-llm-jd-parser`
**Created**: 2026-06-08
**Status**: Draft
**Input**: Feature brief: `docs/features/035-llm-jd-parser.md` (the brief's heading reads "034" — a typo; this is feature **035**)
**Design references**: `docs/design/application_overlay.md` §13 (Entry & smart fill), `docs/design/tracker.md` (Detail Modal / Add-application gate)

---

## Problem Statement

Today Alice turns a pasted job posting into a draft application using a
**rule-based** text parser (`src/utils/jobPostParser.js` → `parseJobPost()`,
feature 013). Rule-based extraction is brittle: it depends on conventional
section headings ("Responsibilities", "Requirements", "Skills"), trips on
multi-column or prose-heavy listings, mislabels required vs. preferred skills,
and frequently leaves company, title, salary, work setup, or shift blank. The
result is a thin, noisy pre-fill that users must heavily correct — undermining
the "reduce manual entry friction" goal and feeding weak, inconsistent data to
the downstream compatibility engine (features 036/037).

This feature adds an **AI-assisted** parsing path for job descriptions, mirroring
the LLM resume parser shipped in feature 033. When the user has configured an
OpenRouter API key and turned on the **Job-description parsing** AI toggle, the
raw pasted job text is sent to an LLM in a single request, which returns
structured JSON matching Alice's **application** schema. The parsed draft is
validated and used to pre-fill the Create-mode Detail Modal for manual review and
edit — nothing is saved automatically and no job text is persisted server-side.

The feature realizes the full **Add-application gate** UX described in
`application_overlay.md` §13: a Smart-vs-Manual entry gate, a paste/smart-input
step, a processing scrim, graceful AI-down recovery surfaces driven by reason
codes, and per-field provenance markers (**✦ AI** vs **⚙ Auto**). When an AI parse
fails, the flow degrades to the existing rule-based ("basic") parser via a "Use
basic parser" fallback, and ultimately to manual entry, never stranding the user
or discarding in-progress input. When AI is off entirely (no key or the toggle
off), the Smart card is locked and manual entry is the path forward. This
preserves the constitution's local-first principle — the app remains fully
runnable and applications can always be created by hand, from a plain GitHub
checkout with no key configured.

---

## Scope

- Add an **LLM-assisted JD parse path** that accepts pasted job-posting text,
  sends it to OpenRouter in a **single** request, and receives JSON shaped to the
  existing application schema.
- Reuse feature 033's shared AI infrastructure: `src/services/llmParser.js`
  (OpenRouter call, ~30s adjustable timeout, `MAX_INPUT_CHARS` truncate-with-
  notice, `REASON_CODES`, `mapErrorToReason`) and `src/data/aiSettings.js` (BYOK
  key, model, and the per-feature `jd` toggle). Add a JD-specific system prompt /
  parse function returning application fields (the existing `parseWithLlm` is
  resume-schema-specific and is **not** reused verbatim).
- **Validate** the LLM output against the application schema before it pre-fills
  the form; reject malformed output and fall back to the basic parser.
- Realize the full **§13 Add-application gate**: gate modal ("Let's add this
  application"), smart-input step ("Paste the job posting"), processing scrim
  ("Reading the job posting…"), AI-down recoverable dialog, unreadable dead-end
  dialog, and Create-mode **provenance markers** (fill banner, per-field ✦ AI /
  ⚙ Auto tags, one-time flash, clear-on-edit).
- **Gate** the AI JD path on a configured key **AND** the **Job-description
  parsing** toggle (`jd`) in Profile → Settings; make that existing toggle
  functional and update its Settings surface to reflect that it now governs a live
  feature. No separate per-parse consent dialog.
- **Graceful degradation / failure handling**: when AI is off (no key or the `jd`
  toggle off), the Smart card is locked and the user proceeds via **Manual entry**.
  When AI is on but the LLM call fails or its output fails validation, offer the
  basic parser (⚙ Auto), retry, and manual continuation — without losing input.
- Both runtimes (local and hosted) support the AI JD path when a key is
  configured; demo mode keeps AI unavailable.

## Out of Scope (Non-Goals)

- Auto-applying to jobs, browser-scraping extensions, live job-board syncing,
  continuous JD monitoring, recruiter-outreach automation (all per the brief).
- File **upload** for job postings — the JD entry point is **pasted text only**
  (the file extractor path belongs to the resume flow).
- Computing a real compatibility score — the compatibility engine is features
  036/037. This feature only populates the application draft.
- Auto-saving parsed data (review-before-save is mandatory).
- Conversational / chat-based AI editing; multi-step or chained/agentic calls
  (single request per parse).
- Changing the application schema itself (consumes the existing schema as-is).
- Operator-funded or shared server-side API keys (BYOK only).
- Server-side persistence of the user's key or of job-posting text.
- A separate consent dialog for JD text (a public job posting is not PII; the
  Settings toggle is the gate).
- **Extracting "years of experience" as a discrete field.** The brief lists it as a
  desired extraction area, but the application schema has no home for it and this
  feature makes no schema change. It is not an output field; a dedicated field is
  deferred to the compatibility engine (036/037), its real consumer. If a posting
  states an experience requirement it simply remains within the extracted
  responsibilities prose — no special handling.

---

## Clarifications

### Session 2026-06-08

- Q: How much of the §13 gate UX does this feature build? → A: **The full §13
  realization** — the Add-application gate, smart-input step, processing scrim,
  AI-down reason-code dialogs, and ✦ AI / ⚙ Auto provenance markers — upgrading the
  current `CreationPicker` flow to the documented target.
- Q: Does sending a pasted JD to the LLM require its own consent prompt, like the
  resume (PII) flow in 033? → A: **No separate consent prompt.** A job posting is
  public, non-personal text. The gate is the **Job-description parsing** switch in
  Profile → Settings (plus a configured key); that Settings surface is updated as
  part of this feature.
- Q: What compatibility score should an LLM-parsed application receive on
  creation? → A: **A random integer 0–100**, matching the existing basic parser's
  behavior, until the real compatibility engine (036/037) lands. Status is never
  parsed and stays `Wishlisted`.
- Q: When AI is off (no key or `jd` toggle off), is Smart entry locked? → A: **Yes
  — the Smart card is locked, exactly like the resume gate.** When AI is off the
  Smart card is dimmed (no *Fastest* badge, dimmed sparkle) and **"Enable AI in
  Settings →"** replaces its CTA; the user proceeds via **Manual entry**. The
  basic/rule-based parser (`parseJobPost`) is **not** a standalone gate option — it
  is reachable only as the **"Use basic parser"** fallback *after* an AI parse is
  attempted and fails (§13.4). Implication: feature 013's standalone keyless
  rule-based smart-parse is **superseded** — without AI the only entry is Manual.
  Local-first is preserved by Manual entry (the app stays fully functional from a
  keyless checkout).
- Q: On a successful but thin AI parse, backfill empty fields from the basic
  parser? → A: **No — AI result is the sole source (no cross-parser backfill).**
  All populated fields are ✦ AI; empty fields stay empty for the user to fill.
  FR-004's "no fewer fields than basic" is enforced at the **prompt** level, not by
  running a second parser. This keeps a single provenance source per draft
  (`fillSource: 'ai' | 'basic'`), matching the resume parser.
- Q: How is "years of experience" (a brief extraction area with no schema field)
  handled? → A: **Explicit non-goal.** Not extracted as a discrete field (no schema
  home); a dedicated field is deferred to the compatibility engine (036/037). If
  stated, it remains within the extracted responsibilities prose — no special
  handling.
- Q: What are the exact boundaries between a thin-but-valid parse, invalid output,
  and an empty result? → A: **Three outcomes.** (1) Parseable object with ≥1 usable
  field (thin or full) → pre-fill as-is (✦ AI), empty fields stay empty. (2)
  Unparseable / non-object output (or a transport error) → the **recoverable**
  AI-down dialog (Use basic parser / Try AI again / Update key / Enter manually);
  malformed data never pre-fills. (3) A valid object with **zero** usable fields →
  the **terminal NO_TEXT dead-end** (Try again / Enter manually, no basic-parser
  option), mirroring the resume flow's `LLM_INVALID_RESPONSE` vs `LLM_EMPTY_RESPONSE`
  split.

### Derived decisions (from existing code / design, not new choices)

- **Output schema** = the application fields the parsers already populate:
  `companyName`, `jobTitle`, `responsibilities`, `location`, `salary`,
  `workSetup`, `shift`, `skills[]`, `preferredSkills[]`, `recruiter`,
  `jobPostingUrl`. **Status is never parsed** — it stays `Wishlisted` (§13.6).
- **Salary** follows existing application semantics: a single integer in annual
  PHP, lower bound of any range (consistent with `parseJobPost`'s
  `extractSalary`).
- **Enums** are constrained to existing values — Work Setup: `Remote · Hybrid ·
  On-site · Field`; Shift: `Day · Mid · Night · Flexible` — and left blank when
  not stated (never defaulted).
- **Timeout / truncation** reuse the shared constants (`LLM_TIMEOUT_MS` ~30s,
  `MAX_INPUT_CHARS`); over-length input is truncated with a visible notice.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — AI-Assisted JD Parse and Review (Priority: P1)

A user with an OpenRouter key configured and the **Job-description parsing**
toggle on clicks **+ New application**, chooses **Smart entry**, pastes a job
posting, and clicks **Parse posting**. Alice sends the raw text to the LLM,
validates the returned JSON, and opens the Create-mode Detail Modal pre-filled,
with AI-populated fields marked. The user reviews, corrects anything wrong, and
clicks **Create** to save manually. No automatic save occurs.

**Why this priority**: This is the core value — higher-quality, lower-effort JD
extraction. Every other story supports or guards it.

**Independent Test**: With a key configured and the `jd` toggle on, open the
Add-application gate, choose Smart entry, paste a posting containing a company,
title, responsibilities, a skills list, a "nice to have" list, a salary range, a
location, and a work setup. Parse it. Confirm the Create modal opens pre-filled
with cleanly separated fields (title, company, responsibilities, required skills,
preferred skills, salary as annual PHP lower bound, location, work setup, shift),
that AI-populated fields show a **✦ AI** marker, that status is `Wishlisted`, that
no save has occurred, and that editing + **Create** persists the reviewed values.

**Acceptance Scenarios**:

1. **Given** a configured key and the `jd` toggle on, **When** the user pastes a
   posting and clicks Parse, **Then** the raw text is sent to the LLM and the
   returned structured data pre-fills the Create modal.
2. **Given** parsing is in progress, **When** the user waits, **Then** a
   processing scrim ("Reading the job posting…") is shown and the action is
   disabled for the duration.
3. **Given** the LLM returns valid JSON, **When** results are ready, **Then** the
   supported fields are populated: companyName, jobTitle, responsibilities,
   location, salary, workSetup, shift, skills, preferredSkills, recruiter,
   jobPostingUrl.
4. **Given** the parse populated fields, **When** the modal opens, **Then** status
   is `Wishlisted` (never parsed) and compatibility is a random 0–100.
5. **Given** the form is pre-filled, **When** the user edits any field, **Then**
   it behaves identically to normal manual editing (dirty state, validation,
   save/discard).
6. **Given** pre-filled (unsaved) data, **When** the user clicks Create, **Then**
   the application is saved exactly as if entered manually, and only then.

---

### User Story 2 — Enabling AI JD Parsing in Settings (Priority: P1)

A user enables AI job-description parsing by configuring their OpenRouter key and
turning on the **Job-description parsing** toggle in Profile → Settings. With both
in place, the Smart entry card in the Add-application gate is unlocked; without
them it is locked with an "Enable AI in Settings →" affordance.

**Why this priority**: Without a key and the `jd` toggle, the AI path in Story 1
cannot run. It is a distinct, independently testable enabling slice, and the
Settings surface for the toggle is part of this feature's scope.

**Independent Test**: Open Profile → Settings with no key configured; confirm the
AI features section explains the key is browser-only and the user's
responsibility, and that the **Job-description parsing** toggle has no effect
until a key is present. Paste a key, enable the `jd` toggle, reload, and confirm
both persist (browser-only) and are never transmitted to or stored by Alice's
server. Open the Add-application gate and confirm Smart entry shows the AI affordance.
Turn the `jd` toggle off and confirm the Smart card locks (dimmed, "Enable AI in
Settings →" in place of its CTA), with Manual entry unaffected.

**Acceptance Scenarios**:

1. **Given** a configured key and the `jd` toggle on, **When** the user opens the
   Add-application gate, **Then** the Smart entry card shows the AI affordance
   (the *Fastest* badge / sparkle) and parses with the LLM.
2. **Given** no key configured **or** the `jd` toggle off, **When** the gate
   opens, **Then** the Smart card is **locked** (dimmed sparkle, no badge) with
   "Enable AI in Settings →" in place of its CTA, and the user proceeds via Manual
   entry (unaffected).
3. **Given** the user enters a key and toggles `jd` on, **When** the page is
   reloaded, **Then** both persist in the browser and the AI JD path is available.
4. **Given** a key is configured, **When** any parse request is made, **Then** the
   key and job text are never persisted by Alice's server.
5. **Given** demo mode, **When** the user views the gate or Settings AI area,
   **Then** the AI affordance is unavailable (existing demo gating preserved).

---

### User Story 3 — Graceful Degradation and Failure Handling (Priority: P2)

A user whose AI parse fails or returns unusable data still gets a working draft:
within the AI flow Alice offers the basic (rule-based) parser, and on a hard
failure offers retry and manual continuation without losing pasted input. AI-down
states are explained via reason codes with the correct recovery action. (When AI
is wholesale off, the Smart card is locked and the user takes Manual entry — see
US2; the basic parser is a post-failure fallback, not a keyless gate option.)

**Why this priority**: Protects the brief's "failures degrade gracefully"
criterion. The feature must never strand the user or destroy in-progress input.

**Independent Test**: (a) With AI on, simulate provider failures and confirm the
recoverable AI-down dialog appears with the right reason chip and a
context-appropriate secondary action (Try AI again for wait-type reasons; Update
key for key/credit reasons), plus **Use basic parser** and **Enter manually**.
(b) Choose **Use basic parser** and confirm the Create modal pre-fills with
**⚙ Auto** provenance. (c) Paste an unreadable / structureless posting and confirm
the terminal "We couldn't read that posting" dead-end (NO_TEXT) with Try again /
Enter manually and **no** basic-parser option. (d) Confirm any pasted text is
preserved across retries.

**Acceptance Scenarios**:

1. **Given** AI is off (no key or `jd` toggle off), **When** the user opens the
   gate, **Then** the Smart card is locked and Manual entry is the path forward
   (no parse is attempted; basic parser is not offered here) — see US2.
2. **Given** AI is on but the LLM call fails (timeout, provider error, network,
   rate limit, invalid key, no credits), **When** the failure is detected,
   **Then** the recoverable AI-down dialog shows the mapped reason chip and the
   reason-appropriate secondary action, without leaking provider/library
   internals.
3. **Given** the user picks **Use basic parser** from that dialog, **When** it
   runs, **Then** the Create modal opens with ⚙ Auto provenance.
4. **Given** the LLM returns unparseable or non-object output, **When** it is
   detected, **Then** the recoverable AI-down dialog appears (Use basic parser /
   Try AI again / Enter manually) and malformed data does not populate the form.
5. **Given** the AI returns a valid object with zero usable fields (or the basic
   parser, once chosen, also yields nothing), **When** the dead-end appears,
   **Then** it shows the NO_TEXT reason with Try again / Enter manually and no
   basic-parser option.
6. **Given** a failure at any stage, **When** the user retries or switches paths,
   **Then** their pasted text is preserved and no data is lost.

---

### User Story 4 — Provenance Markers (Priority: P3)

After a parse, fields the machine populated carry a provenance marker — **✦ AI**
for the AI parser, **⚙ Auto** for the basic parser — plus a one-time flash and a
dismissible fill banner, so the user knows which values to scrutinize. Editing a
field clears its marker. All fields remain fully editable.

**Why this priority**: Improves trust and review efficiency but is not required
for the core extract-and-review loop to deliver value.

**Independent Test**: Run an AI parse; confirm populated fields show **✦ AI**, the
fill banner reads "Filled from the job posting", and a one-time flash plays. Edit
one such field and confirm the marker clears and the field saves normally. Run a
basic-parser fallback and confirm fields show **⚙ Auto** with the "Filled by the
basic parser" banner — never falsely labeled AI.

**Acceptance Scenarios**:

1. **Given** an AI parse succeeds, **When** the Create modal opens, **Then**
   AI-populated fields show a subtle, non-color-only **✦ AI** marker and a "Filled
   from the job posting" banner.
2. **Given** a basic-parser fallback, **When** the modal opens, **Then** populated
   fields show **⚙ Auto** with the "Filled by the basic parser" banner — not the
   AI marker.
3. **Given** a field has a provenance marker, **When** the user edits it, **Then**
   the marker clears and the field behaves like a manually entered field.
4. **Given** the Job Title was prefilled, **When** the modal opens, **Then** the
   title editor does not auto-open (so the flash is visible).

---

### Edge Cases

- **Extremely short JD** (below the smart-input minimum, ≈40 chars): **Parse
  posting** stays disabled, same as empty input — no LLM call.
- **Very long JD**: input beyond `MAX_INPUT_CHARS` is truncated to a safe length
  and parsed with a visible notice that the posting was long and some tail content
  may not have been parsed — never a raw error; a draft is still produced.
- **Multi-role posting**: the parser extracts the primary/topmost role; the user
  edits if a different role was intended.
- **Thin AI result**: when a successful AI parse (≥1 usable field) leaves some
  fields empty, those fields stay empty (all ✦ AI) for the user to fill — the basic
  parser is not run to backfill them.
- **Empty AI result**: a valid object with zero usable fields goes to the terminal
  NO_TEXT dead-end (no basic-parser option), distinct from unparseable output, which
  is recoverable.
- **Missing salary / location / work setup / shift**: those fields are left blank,
  not fabricated or defaulted.
- **Ambiguous skill naming**: the LLM normalizes where possible; required vs.
  preferred follows the posting's own labeling; if output fails validation, fall
  back to the basic parser.
- **Duplicate extracted skills**: de-duplicated before pre-fill (consistent with
  the basic parser's `Set`-based de-duplication).
- **Non-English posting**: parsed best-effort; if output fails validation, fall
  back to the basic parser, then manual.
- **Malformed extracted URL**: invalid URLs are dropped (field left blank);
  existing URL validation applies at review/save.
- **Empty paste**: blocked before any LLM call.
- **Invalid / revoked key**: surfaced via the `invalid_key` reason with an "Update
  key in Settings" action; never echoes provider auth internals.
- **`jd` toggle off but key present**: AI is off (the toggle, not just the key,
  governs AI) → the Smart card is locked and the user takes Manual entry; no parse
  is attempted from the gate.
- **Unreadable / structureless posting**: terminal NO_TEXT dead-end; no
  basic-parser option, only Try again / Enter manually.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Add-application gate (from + New application and the mobile FAB)
  MUST present **Smart entry** and **Manual entry** choices per `application_overlay.md`
  §13.1; Manual entry MUST open the Create modal with an empty draft and no
  behavioral change.
- **FR-002**: Smart entry MUST open a paste-only smart-input step ("Paste the job
  posting") with a live character count; **Parse posting** MUST be disabled until
  the pasted text passes a minimum length (≈40 chars). JD entry is **paste only**
  (no file upload).
- **FR-003**: When a key is configured AND the `jd` feature toggle is on, clicking
  Parse MUST send the raw pasted text to the LLM (OpenRouter) in a **single**
  request and expect JSON shaped to the application schema.
- **FR-004**: The expected LLM output MUST cover the application fields the parsers
  populate — companyName, jobTitle, responsibilities, location, salary, workSetup,
  shift, skills, preferredSkills, recruiter, jobPostingUrl — and SHOULD NOT extract
  fewer fields than the basic parser produces. This breadth is enforced at the
  **prompt** level; a successful AI parse is the **sole source** for the draft —
  the basic parser is NOT also run to backfill empty fields (single provenance
  source per draft). **Status MUST never be parsed** and remains `Wishlisted`.
  **"Years of experience" MUST NOT be an output field** (no schema home — see
  Non-Goals); it is not requested in the contract.
- **FR-005**: Parsed enum fields MUST be constrained to existing values (Work
  Setup: Remote/Hybrid/On-site/Field; Shift: Day/Mid/Night/Flexible) and left
  blank when unstated; salary MUST be a single integer in annual PHP (lower bound
  of any range); duplicate skills MUST be removed.
- **FR-006**: The system MUST normalize the LLM output through the application model
  (enum/URL/salary coercion) and then route by one of three outcomes before
  pre-filling: **(a)** a parseable object with ≥1 usable field → pre-fill as-is;
  **(b)** unparseable or non-object output → surface the recoverable AI-down dialog
  (FR-012) whose **"Use basic parser"** option does the ⚙ Auto fill — malformed data
  MUST NOT populate the form; **(c)** a valid object with zero usable fields → the
  terminal NO_TEXT dead-end (FR-013). There is no silent auto-fallback; the basic
  parser is always user-initiated from the dialog.
- **FR-007**: On a successful parse the system MUST open the Create modal
  pre-filled, with compatibility set to a random integer 0–100 (matching the basic
  parser) and status `Wishlisted`. The system MUST NOT auto-save; the user MUST
  review and explicitly click Create.
- **FR-008**: The **AI** JD path MUST be gated on BOTH a configured OpenRouter key
  AND the **Job-description parsing** (`jd`) toggle in Profile → Settings. When AI
  is enabled, the Smart card shows the AI affordance (the *Fastest* badge /
  sparkle) and Smart entry performs an AI parse (with basic-parser fallback per
  FR-011). When AI is off (no key or the `jd` toggle off), the Smart card MUST be
  **locked** — dimmed (no *Fastest* badge, dimmed sparkle) with **"Enable AI in
  Settings →"** replacing its CTA (per §13.1) — and the user proceeds via **Manual
  entry**, which MUST always remain available. The basic parser is NOT a standalone
  gate option; it is reachable only as the post-failure fallback in FR-011/FR-012.
- **FR-009**: The Profile → Settings AI section MUST expose the **Job-description
  parsing** toggle and reflect that it now governs a live feature; the key MUST be
  stored **only in the user's browser** with the existing browser-only / user-
  responsibility notice. No separate per-parse consent dialog is shown for JD text.
- **FR-010**: The system MUST NOT persist the user's key or job-posting text on the
  application server in any runtime.
- **FR-011**: When AI is on but the LLM call fails (network/provider error or
  timeout) or returns unparseable/non-object output, the system MUST offer the basic
  parser (`parseJobPost`) via the **"Use basic parser"** action (§13.4); choosing it
  pre-fills the Create modal with fields marked **⚙ Auto**. (An empty-but-valid
  result instead goes to the NO_TEXT dead-end per FR-013. When AI is off the Smart
  card is locked per FR-008, so no parse occurs from the gate.) The timeout MUST be
  the shared, easily-adjustable constant (default ~30s).
- **FR-012**: On an AI failure the system MUST show a recoverable AI-down dialog
  (per §13.4 / §13.7) with the mapped reason chip and the reason-appropriate
  secondary action (**Try AI again** for wait-type reasons; **Update key in
  Settings** for key/credit reasons), plus **Use basic parser** and **Enter
  manually**.
- **FR-013**: When the AI returns a valid object with **zero** usable fields (or the
  basic parser, once chosen, also yields nothing), the system MUST show the terminal
  NO_TEXT dead-end (§13.5) with **Try again** / **Enter manually** and **no**
  basic-parser option.
- **FR-014**: Across any failure, retry, or path switch, the system MUST preserve
  the user's pasted text and MUST NOT lose data already entered in the form.
- **FR-015**: The system MUST show a processing scrim during the LLM call and
  disable the parse action for its duration.
- **FR-016**: AI-populated fields MUST carry a subtle, non-color-only **✦ AI**
  marker and basic-parser fields a **⚙ Auto** marker, with a dismissible fill
  banner and a one-time flash; each marker MUST clear when the user edits that
  field. The Job Title editor MUST NOT auto-open when prefilled.
- **FR-017**: When input exceeds the context limit, the system MUST truncate to a
  safe length, parse what fits, and show a visible notice — never a raw error —
  still producing a reviewable draft.
- **FR-018**: User-facing errors MUST be non-technical and MUST NOT leak provider
  or library internals (auth errors, stack traces, raw status bodies).
- **FR-019**: The AI JD affordance MUST be unavailable in demo mode (existing demo
  gating preserved).
- **FR-020**: The AI JD path MUST work in both local and hosted runtimes when a key
  is configured.
- **FR-021**: Parsed values MUST pass existing application field validation before
  save (required company name + job title + responsibilities + status + last
  status update; URL validated when present; salary/date handling unchanged).
- **FR-022**: The flow MUST support desktop and mobile browsers, labeled forms,
  keyboard navigation, and non-color-only status/provenance indicators.

### Key Entities *(include if feature involves data)*

- **Job Posting Input**: Transient raw text pasted by the user. Never persisted;
  sent to the provider only when the AI path is active.
- **JD Parse Request**: A single LLM call carrying the raw job text and a request
  for application-schema-shaped JSON. Carries the user's key only to authorize the
  provider call; neither key nor text is stored by Alice's server.
- **Parsed Application Draft**: Structured data matching the application schema
  (companyName, jobTitle, responsibilities, location, salary, workSetup, shift,
  skills, preferredSkills, recruiter, jobPostingUrl), validated before pre-filling.
  Discarded if invalid. Status is not part of the parse (stays `Wishlisted`);
  compatibility is assigned a random 0–100.
- **Provenance Metadata**: Per-field source markers (`aiFields` + `fillSource:
  'ai' | 'basic'`) driving ✦ AI / ⚙ Auto tags, the fill banner, and the one-time
  flash; cleared per field on edit (mirrors `application_overlay.md` §10/§13.8).
- **Provider Key & Feature Settings**: The browser-only OpenRouter key and the
  `jd` feature toggle (and shared model), read from `src/data/aiSettings.js`.
- **AI-down Reason**: A mapped reason code (rate_limit, invalid_key, quota,
  timeout, server, network, NO_TEXT) selecting the recovery surface and secondary
  action (reuses `REASON_CODES` / `mapErrorToReason`).

### Data considerations

- **No schema change.** The feature consumes the existing application schema
  (`src/models/application.js`) and existing field validation unchanged.
- **No new persistence.** Key and JD text live only in the browser / in memory for
  the duration of the call; nothing is written to SQLite, Supabase, or the server.
- **Salary / enums** are normalized to existing representations (annual PHP
  integer lower bound; constrained enum values) so downstream filters/sort and the
  future compatibility engine receive consistent data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For well-formed job postings, the AI path populates more application
  fields correctly than the basic parser on the same input (measurable field-level
  improvement, esp. company, required vs. preferred skills, salary, work setup).
- **SC-002**: Users reach a saveable application with fewer manual edits after an
  AI parse than after a basic-parser parse.
- **SC-003**: A typical JD parse returns a populated, reviewable Create modal
  within the ~30s adjustable timeout, with continuous processing feedback;
  exceeding the timeout triggers the basic-parser fallback rather than an
  indefinite wait.
- **SC-004**: 100% of AI-off, AI-failure, invalid-output, and unreadable-posting
  cases resolve to a working fallback (basic parser or manual) with no data loss
  and no leaked provider/library internals.
- **SC-005**: The app remains fully usable from a plain GitHub checkout with no key
  configured — **Manual entry** always creates applications (local-first
  preserved). Smart parsing is an AI enhancement; without a key the Smart card is
  locked, not broken.
- **SC-006**: No job-posting text or API key is persisted on the application server
  in any runtime (verifiable by inspection/tests).

## Assumptions

- The existing application schema and Create/Edit modal, validation, dirty-state,
  and save flow are reused unchanged.
- Feature 033's `src/services/llmParser.js` and `src/data/aiSettings.js` are the
  authoritative shared AI infrastructure; this feature adds a JD-specific prompt /
  parse function and a functional `jd` toggle, without reworking the resume path.
- The basic parser `parseJobPost` (feature 013) is the authoritative rule-based
  fallback and the source of ⚙ Auto pre-fill.
- OpenRouter is the target provider (open/free models), single request per parse;
  model selection details are deferred to planning.
- "Browser-only" key storage uses standard browser storage; the user accepts that
  clearing browser data removes the key and that protecting it is their
  responsibility.
- A job posting is public, non-personal text, so no per-parse consent dialog is
  required — the Settings `jd` toggle is the gate.
- The compatibility engine (036/037) will later consume the cleaner parsed data;
  this feature only assigns the interim random compat used by the basic parser.

## Dependencies

- Feature 033 (LLM resume parser) — shared `llmParser.js` (timeout, truncation,
  reason codes, OpenRouter call) and `aiSettings.js` (BYOK key, model, `jd`
  toggle, demo gating).
- Feature 013 (rule-based JD parser) — `src/utils/jobPostParser.js` reused as the
  basic-parser fallback.
- The Add-application gate / Create modal and provenance UX documented in
  `docs/design/application_overlay.md` §13 and `docs/design/tracker.md`.
- Existing application schema and validation (`src/models/application.js`).
- An external LLM provider (OpenRouter) reachable from the call site, in both
  local and hosted runtimes.
```
