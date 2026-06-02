# Implementation Plan: LLM Resume / CV Parser

**Branch**: `033-llm-resume-cv-parser` | **Date**: 2026-06-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/033-llm-resume-cv-parser/spec.md`

## Summary

Add an AI-assisted resume parsing path whose **LLM call is browser-direct**: the
user pastes resume text or uploads a file, the browser obtains raw text (paste =
direct; upload = new stateless `POST /api/resume/extract`, memory-only), then calls
**OpenRouter** with the user's **own key** (BYOK, stored only in their browser)
to get structured JSON matching the existing profile schema. The JSON is
sanitized by reusing `normaliseProfile`, merged into the Edit Profile form via the
existing `mergeResumeData` rules, and shown for review — nothing saves
automatically. The path is gated by a one-time consent notice and degrades
gracefully: no key / declined consent / any LLM failure or timeout (≤30s)
automatically falls back to the existing rule-based parser; a hard failure offers
retry + manual continuation without data loss. No schema changes, no new server
env vars, local-first preserved.

## Technical Context

**Language/Version**: JavaScript (ES modules), Node ≥ 20.19; Vite 8 frontend, Express 4 backend
**Primary Dependencies**: existing only — `multer`, `pdf-parse`, `mammoth`, `@napi-rs/canvas` (extraction), browser `fetch`/`AbortController` (OpenRouter), `zod` (already present, optional). **No new dependency.**
**Storage**: none added — `localStorage` for key/consent (browser); memory-only on server; no DB changes
**Testing**: vitest + jsdom; eslint
**Target Platform**: desktop + mobile browsers; Vercel (hosted) + local SQLite/Express
**Project Type**: web application (Vanilla JS frontend + Express backend)
**Performance Goals**: reviewable form within ~30s (adjustable timeout ceiling), continuous loading feedback
**Constraints**: local-first (runs with no key); no server-side persistence of key/resume content; single LLM request (no chaining); BYOK only
**Scale/Scope**: single-user profile flow; one external call per parse

## Constitution Check

*GATE: re-checked after Phase 1 design — PASS.*

- **Local-first / privacy (the load-bearing check)**: The privacy clause forbids
  sending data to external services "unless a later specification explicitly
  requires it." **This spec is that explicit specification.** The external call is
  BYOK, one-time-consented, browser-direct (key/content never touch Alice's
  server), and fully optional — with no key the app behaves exactly as today
  (rule-based). No analytics/tracking added. ✅
- **Simple, maintainable architecture**: two small browser modules
  (`aiSettings.js`, `llmParser.js`) separate business logic from UI; one thin
  server endpoint + one route branch. ✅
- **Centralized validation**: LLM output is sanitized through the existing
  `normaliseProfile`/`mergeResumeData` — no duplicate schema. ✅
- **Data integrity**: AI output never auto-saves; existing `validateProfile`
  applies at save; merge fills empty slots / dedupes / skills unrated. ✅
- **UX**: explicit empty/loading/error states; retry + manual continuation;
  non-color-only AI indicator; labeled, keyboard-navigable paste/consent. ✅
- **Testing & gates**: unit/server/component/page tests planned; Release Prep +
  Browser Smoke Test reserved as the final two phases. ✅
- **New dependency justification**: none introduced. ✅

No violations → Complexity Tracking left empty.

## Project Structure

### Documentation (this feature)

```text
specs/033-llm-resume-cv-parser/
├── plan.md              # This file
├── research.md          # Phase 0 decisions (R-1…R-10)
├── data-model.md        # Transient/client state + LLM shapes (no DB change)
├── quickstart.md        # How to exercise the feature
├── contracts/
│   └── api.md           # /extract (new), /parse (extended), OpenRouter (external)
├── checklists/
│   ├── requirements.md  # Spec quality (from /speckit.specify)
│   └── plan-review.md    # Plan gate (this phase)
└── tasks.md             # Created by /speckit.tasks (not now)
```

### Source Code (repository root)

```text
src/
├── data/
│   └── aiSettings.js          # NEW — localStorage key + consent (get/set/clear/hasKey/hasConsent)
├── services/
│   ├── llmParser.js           # NEW — browser-direct OpenRouter call, timeout, JSON parse + sanitize, fallback orchestration
│   └── resumeApi.js           # MODIFY — add extractText() (→/extract) and parseText() (→/parse text mode)
├── components/
│   └── ResumeImport.js        # MODIFY — paste textarea, AI-vs-rule routing, consent gate, AI-field provenance, truncation notice
├── pages/
│   ├── ProfileEdit.js         # MODIFY — track _aiFields, render/clear AI indicators on fields
│   └── Profile.js             # MODIFY — new "AI Resume Parsing" settings section (key + consent UI)
├── models/
│   └── profile.js             # REUSE — normaliseProfile / mergeResumeData (no change expected)
└── styles/
    └── main.css               # MODIFY — paste input, AI badge, settings section, consent notice styles

server/
├── routes/
│   └── resume.js              # MODIFY — add POST /extract; extend POST /parse with JSON text mode
└── resume/
    ├── extractor.js           # REUSE — extractText() (no change)
    └── parser.js              # REUSE — parseResumeText() (no change)

tests/
├── data/aiSettings.test.js            # NEW
├── services/llmParser.test.js         # NEW
├── server/resumeExtract.test.js       # NEW (mirror resume.test.js security cases)
├── server/resume.text.test.js         # NEW (parse text mode)
├── components/ResumeImport.test.js    # MODIFY (paste, AI path, consent, fallback)
├── pages/profile.aiSettings.test.js   # NEW (settings section + demo gating)
└── pages/profileEdit.aiIndicators.test.js  # NEW (indicator render + clear-on-edit)
```

**Structure Decision**: Existing web-app layout (Vanilla JS `src/` + Express
`server/`). The feature adds two browser modules and one settings UI surface,
extends the resume component/service, and adds one server endpoint + one route
branch. No new top-level directories.

## Architecture & Data Flow

**Decision flow (browser, on Process Resume):**

1. Obtain raw text — paste: use directly; upload: `resumeApi.extractText(file)` →
   `POST /api/resume/extract` → `{ text }`.
2. If `aiSettings.hasKey()` is false → **rule-based** (`resumeApi.parseText` or
   file `parseResume`).
3. If key present but `!hasConsent()` → show one-time consent notice. Decline →
   rule-based or manual. Accept → set consent, continue.
4. `llmParser.parse(text, key)`:
   - truncate to `MAX_INPUT_CHARS` (notice if truncated),
   - `fetch` OpenRouter with `AbortController(LLM_TIMEOUT_MS=30000)`,
   - parse assistant JSON → `normaliseProfile` → require extracted data.
5. Success → `onSuccess(draft, aiFieldSet)`; ProfileEdit merges via
   `mergeResumeData`, records `_aiFields`, renders indicators.
6. Any failure/timeout/invalid → **fallback** to rule-based (empty AI-field set);
   if that also fails → retry + Continue Manually, form data preserved.

**Why browser-direct** (R-1/R-2): honors "key in your browser, your
responsibility, server never sees it." Server only does stateless text extraction
(already its job today). Load-bearing assumption: OpenRouter browser CORS — spike
first. Browser-direct is a **firm requirement** (contracts §4: server never
receives the key); if the spike fails, STOP and escalate — a server-proxy would
require an explicit spec/contracts/consent amendment and is not a silent fallback.

## Risks & Tradeoffs

| Risk | Impact | Mitigation |
|---|---|---|
| OpenRouter blocks browser CORS (local and/or Vercel origin) | Feature can't run browser-direct | **Spike first** (T001). Browser-direct is firm; if blocked, STOP and escalate — adopting a server-proxy needs an explicit spec/contracts/consent amendment + approval (not a silent fallback) |
| API key readable in `localStorage` (XSS) | Key theft | Inherent to BYOK browser storage; disclosed to user; app uses `createElement`/`textContent`, no `innerHTML`; no 3rd-party scripts beyond perf-only Speed Insights |
| Free model unavailable / slow / non-JSON | Failed parse | Configurable model constant; 30s timeout; JSON sanitize; rule-based fallback |
| LLM hallucination / wrong fields | Bad pre-fill | Review-before-save; AI indicators; `normaliseProfile` drops malformed; required-field validation at save |
| Truncated long resume loses tail | Missing data | Visible truncation notice; user can edit/add; fallback uncapped |
| AI-field provenance drift on re-render | Wrong/missing indicators | Single `_aiFields` set keyed by path; cleared on edit; covered by tests |

## Validation Approach

- **Unit**: `aiSettings` (localStorage get/set/clear/has, mocked storage);
  `llmParser` (prompt build, AbortController timeout, non-2xx/network/abort →
  throw, JSON extraction, sanitize-via-`normaliseProfile`, truncation) with mocked
  `fetch`.
- **Server**: `/extract` security parity with `resume.test.js` (no-file, too-large,
  unsupported, parse-failure generic error, hosted demo 401); `/parse` text mode
  (valid, empty, over-cap).
- **Component**: `ResumeImport` — paste input present, AI path → `onSuccess` with
  AI-field set, consent gate (accept/decline), fallback to rule-based on AI
  failure, demo hidden.
- **Page**: Profile AI settings section (save/clear key, consent display/clear,
  demo note, labels/keyboard); ProfileEdit indicators (render on AI fields, clear
  on edit, absent for rule-based).
- **Reuse**: existing `resumeMerge` / `resumeParser` suites stay green.
- **Gates**: `npm run lint`, `npm run test:run`; then Release Prep + Browser Smoke
  Test phases.

## Affected Areas

### Likely to be inspected (read; may not change)
- `src/models/profile.js` — confirm `normaliseProfile`/`mergeResumeData` cover all
  fields the LLM returns (reuse as the sanitizer).
- `server/resume/extractor.js`, `server/resume/parser.js` — reuse as-is for
  `/extract` and text-mode `/parse`.
- `src/data/authStore.js` — demo/auth status + access token reuse.
- `server/index.js` — confirm resume router wiring; no change expected.
- `tests/server/resume.test.js`, `tests/components/ResumeImport.*` — patterns to
  mirror.

### Likely to be modified
- `server/routes/resume.js` — add `POST /extract`; extend `POST /parse` (JSON text).
- `src/services/resumeApi.js` — add `extractText()` + `parseText()`.
- `src/services/llmParser.js` *(new)* and `src/data/aiSettings.js` *(new)*.
- `src/components/ResumeImport.js` — paste input, routing, consent, provenance,
  truncation notice.
- `src/pages/ProfileEdit.js` — `_aiFields` tracking + indicator render/clear.
- `src/pages/Profile.js` — AI settings section.
- `src/styles/main.css` — paste/badge/settings/consent styles.
- Release-prep docs: `package.json` (version), `package-lock.json`, `CHANGELOG.md`,
  `README.md`, `docs/REPO_MAP.md`, `docs/feature_roadmap.md`; `docs/deployment.md`
  gets a short BYOK note (no env-var change).

### Tests likely added/updated
- New: `tests/data/aiSettings.test.js`, `tests/services/llmParser.test.js`,
  `tests/server/resumeExtract.test.js`, `tests/server/resume.text.test.js`,
  `tests/pages/profile.aiSettings.test.js`,
  `tests/pages/profileEdit.aiIndicators.test.js`.
- Updated: `tests/components/ResumeImport.test.js`,
  `tests/services/resumeApi.test.js` (+ `.demo` variants as needed).

### Explicitly out of scope
- Profile schema changes; DB migrations.
- Operator/server-side API key; server-proxy LLM call (browser-direct is firm —
  a proxy is out of scope and would require an explicit spec/contracts/consent
  amendment).
- Multi-step / chained AI calls; conversational editing; resume rewriting.
- Permanent resume/text storage; auto-save.
- New server environment variables or runtime modes.
- Per-user model picker UI (model is a constant).

## Complexity Tracking

No constitution violations — no entries.
