# Research: LLM Resume / CV Parser (033)

Phase 0 research resolving the open technical decisions for the AI-assisted
resume parser. All decisions below are consistent with the spec, the five
clarifications, and the two plan-stage architecture answers (browser-direct call
site; Profile-page settings section).

---

## R-1 — LLM call site: browser-direct vs server-proxy

**Decision**: **Browser-direct to OpenRouter.** The browser calls OpenRouter's
chat-completions endpoint directly using the user's own key. Alice's server never
receives the key or the resume text on the AI path.

- **Paste path**: text is already in the browser → sent straight to OpenRouter.
- **Upload path**: the browser first POSTs the file to a new server endpoint
  `POST /api/resume/extract` that returns **only the extracted raw text** (no key,
  no LLM, memory-only) — because PDF/DOCX extraction depends on Node-only
  libraries (`pdf-parse`, `mammoth`, `@napi-rs/canvas`) that cannot run in the
  browser. The browser then sends that text to OpenRouter.

**Rationale**: Best honors the user's intent — key stored in their browser only,
"their responsibility", server never stores it. Browser-direct means the key and
the resume content never transit Alice's backend at all on the AI path; the only
server involvement is stateless text extraction (which already happens today on
the rule-based path with the same security model).

**Alternatives considered**:
- *Server-proxy* (browser → Alice server → OpenRouter): rejected as the default
  because the key would transit our backend, weakening the privacy story the user
  explicitly chose. Kept as a documented fallback if R-2 (CORS) proves
  unworkable.

**Risk / open dependency**: browser-direct relies on OpenRouter accepting
cross-origin requests from the browser (see R-2).

---

## R-2 — OpenRouter browser (CORS) support

**Decision**: Target OpenRouter's `POST https://openrouter.ai/api/v1/chat/completions`
directly from the browser with an `Authorization: Bearer <user-key>` header,
requesting JSON output.

**Rationale**: OpenRouter documents client-side usage and returns permissive CORS
headers for the chat-completions endpoint, so a browser `fetch` with the user's
key is supported. This is the linchpin enabling R-1.

**Validation required during implementation**: an early spike confirming a real
browser `fetch` to OpenRouter succeeds from both `localhost` (local mode) and the
deployed Vercel origin (hosted). If CORS is blocked on either origin, fall back to
the **server-proxy** variant (R-1 alternative) without changing the spec — the
spec only constrains the outcome (no server-side persistence of key/content).

**Hosted CSP note**: confirm the production deployment sends no `Content-Security-Policy`
`connect-src` that would block `https://openrouter.ai`. Today the app sets no
restrictive CSP; if one is added later it must allow the OpenRouter origin.

---

## R-3 — Model strategy

**Decision**: Use a single chat-completion request to a **configurable default
model** targeting OpenRouter's free/open tier. The model id is a single
easily-editable constant (e.g. `DEFAULT_MODEL` in the browser LLM service), with
an example default of a free instruct model such as
`meta-llama/llama-3.3-70b-instruct:free`. Request structured JSON via a strict
system prompt and (where supported) `response_format: { type: 'json_object' }`.

**Rationale**: The brief requires OpenRouter + open/free models and "avoid
excessive multi-step prompting or chained AI calls." A single request keeps cost,
latency, and complexity low. Free-tier model ids change over time, so the id is a
constant the operator/user can edit without restructuring code.

**Alternatives considered**:
- *Multi-step extraction* (separate calls per section): rejected — violates the
  brief's "no chained AI calls" and multiplies latency/cost.
- *Per-user model picker UI*: out of scope for v1; the constant is sufficient and
  adjustable.

---

## R-4 — Timeout & fallback control

**Decision**: Wrap the OpenRouter `fetch` in an `AbortController` with a single
adjustable timeout constant, default **30 000 ms** (`LLM_TIMEOUT_MS`). On
timeout, network error, non-2xx response, unparseable/invalid JSON, or empty
extraction → automatically fall back to the rule-based parser.

**Rationale**: Matches clarification Q4 (30s, single adjustable constant). The
rule-based fallback already exists server-side; the browser routes to it on any
AI failure so the user always gets a result.

**Fallback mechanics**:
- Upload + no key/consent/AI-failure → `POST /api/resume/parse` (multipart, as
  today).
- Paste + no key/consent/AI-failure → `POST /api/resume/parse` with a JSON body
  `{ text }` (new text mode; see R-6).

---

## R-5 — LLM output validation

**Decision**: Validate and sanitize the LLM JSON in the browser by **reusing the
existing model logic** in `src/models/profile.js`:
1. `JSON.parse` the model's content; if it isn't a plain object → invalid →
   fallback.
2. Run `normaliseProfile(parsed)` to coerce shapes, drop malformed entries, and
   produce a clean profile object (it already handles every field the schema
   defines, including dropping non-object array entries and coercing skills).
3. If the normalised result has no extracted data (`hasExtractedData`-style
   check) → treat as invalid → fallback.
4. Map skills to **unrated** (`level: null`) — already done by `mergeResumeData`.

**Rationale**: The constitution requires centralized, reusable validation. Reusing
`normaliseProfile`/`mergeResumeData` avoids a second, divergent schema definition
and guarantees the AI path and rule-based path converge on identical shapes before
the form is populated. `zod` is available as a dependency if a stricter explicit
schema is later wanted, but reuse-first keeps validation in one place.

**Alternatives considered**:
- *New zod schema mirroring the profile*: rejected for v1 — duplicates the model's
  field rules and risks drift; `normaliseProfile` is the single source of truth.

---

## R-6 — Rule-based fallback for pasted text

**Decision**: Extend `POST /api/resume/parse` to accept **either** a multipart
file (today) **or** a JSON body `{ text: string }`. When a JSON body is present,
skip multer/extraction and run `parseResumeText(text)` directly.

**Rationale**: The paste input is new; its rule-based fallback needs a text entry
point. `parseResumeText` already accepts raw text, so the change is a thin branch
in the route handler. Keeps a single fallback endpoint for both input modes.

**Security**: text mode inherits `requireAuth` (hosted) and the generic-error
model from feature 021. Add a reasonable max-length guard on the text body.

---

## R-7 — AI-generated field indicators

**Decision**: `ResumeImport.onSuccess` passes, alongside the parsed data, the set
of field paths the AI populated. `ProfileEdit` tracks these in a module-level
`_aiFields` set, renders a subtle non-color-only indicator (e.g. a small "AI"
badge + `title`/`aria-label`) on those fields, and **removes a field from the set
on first edit** (clarification Q3). Rule-based fallback passes an empty AI-field
set, so its results carry no indicator (spec US4 AC#3).

**Rationale**: The form re-renders from `_formState`; a parallel `_aiFields` set
keyed by field path is the simplest way to drive indicators without entangling AI
provenance into the profile data itself (which must save identically to manual
entry).

**Granularity**: mark singular fields by name (e.g. `summary`, `firstName`) and
collection entries by index path (e.g. `experience[0]`). Editing any input within
an entry clears that entry's flag.

---

## R-8 — Consent & key storage (browser)

**Decision**: A dedicated browser module (`src/data/aiSettings.js`) owns two
`localStorage` keys: the OpenRouter API key and a consent flag. It exposes
get/set/clear for each plus `hasKey()` / `hasConsent()`. UI reads/writes only via
this module (business logic separated from UI per constitution).

- Key + consent are **per browser** (clarification: re-enter per device).
- Consent is a one-time gate: first AI parse shows an explicit notice; on accept,
  the flag is set and not re-prompted until cleared.
- The settings UI shows a clear notice: "Your key is stored only in this browser —
  safeguarding it is your responsibility." Plus a Clear button.

**Rationale**: Centralizing storage access makes the behavior unit-testable
(mock `localStorage`) and keeps the XSS surface small (no `innerHTML`; the app
builds DOM via `createElement`/`textContent`).

**Security note**: a key in `localStorage` is readable by any script on the
origin. This is inherent to BYOK browser storage and is disclosed to the user
(their responsibility). No third-party scripts are loaded into the app origin
beyond Vercel Speed Insights (perf-only).

---

## R-9 — Demo-mode gating

**Decision**: Reuse the existing demo gating. `ResumeImport` already hides for
non-`VISIBLE_STATUSES`; the new paste input lives inside the same component so it
inherits the gate. The Profile-page AI settings section follows the Account
section's pattern: shown with a "available after signing in"-style note in demo,
not interactive. `/api/resume/extract` requires auth in hosted, so a demo visitor
(no JWT) receives 401 if client gates are bypassed (mirrors `/parse`).

**Rationale**: Consistency with features 020/021; no new demo bypass surface.

---

## R-10 — No new server env vars / deployment changes

**Decision**: BYOK + browser-direct means **no new server environment variables**
and **no runtime-mode changes**. The model id and timeout are browser-side
constants. Therefore `docs/deployment.md` needs no env-var change (only a short
note that AI parsing is BYOK/browser-side and adds no server secrets).

**Rationale**: Keeps the hosted/local config surface unchanged; preserves the
constitution's local-first guarantee (a plain checkout still runs; AI is purely
additive and opt-in).
