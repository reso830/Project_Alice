# Implementation Plan: Profile Page Refresh

**Branch**: `034-profile-page-refresh` | **Date**: 2026-06-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/034-profile-page-refresh/spec.md`
**Design references**: `docs/design/profile_page.md`, `docs/design/edit_profile_page.md`

## Summary

A UX/presentation refresh of the Profile and Edit/Setup Profile experiences. A
code audit (see [research.md](./research.md)) found the **read-only Profile page is
essentially already shipped** (skills proficiency rows + sort/collapse/popover,
mobile collapse, archived link, empty state — features 031/028). The real work is
two net-new areas plus polish:

1. **Settings §4.5 redesign** — replace the two separate AI/Account cards with one
   unified **Settings** card holding an **Artificial Intelligence** sub-group
   (master toggle, connection panel with a single derived status pill, key
   save/show-hide/test/replace/delete, free-text model slug + datalist, per-feature
   toggles — CV functional/default-on, JD & Compat shown-disabled) and an
   **Account** sub-group (the relocated feature-030 control). Backed by a rewritten
   browser-local `aiSettings` store with a one-way migration from 033's key/consent.
2. **Edit-page proposed flow (net-new)** — split-card mode gate (first-time only),
   smart input (upload/paste), processing spinner, **ask-first** AI-unavailable
   dialog with reason codes, **unreadable-file** dead-end dialog, basic-vs-AI
   **provenance markers**, **Import Bar** for existing profiles, append merge +
   **Undo** toast, and AI-off gating with an "Enable AI in Settings →" deep-link.
3. **Polish** — reduced-motion coverage for new animations; consent folded into the
   key flow (remove the separate consent dialog); pass the model slug to the parser.

**No DB schema changes, no server API changes, no new dependencies.** The only
external call remains the user's browser → OpenRouter (BYOK), reusing the 033
parser engine. Local-first preserved (no key ⇒ behaves exactly as today).

## Technical Context

**Language/Version**: JavaScript (ES modules), Node ≥ 20.19; Vite 8 frontend, Express 4 backend
**Primary Dependencies**: existing only — browser `fetch`/`AbortController` (OpenRouter), existing extractor (`/api/resume/extract`), `normaliseProfile`/`mergeResumeData`/`validateProfile`. **No new dependency.**
**Storage**: `localStorage` only (AI settings); no DB changes; no server-side persistence of key/resume content
**Testing**: vitest + jsdom; eslint
**Target Platform**: desktop, tablet, mobile browsers; Vercel (hosted) + local SQLite/Express; demo mode
**Performance Goals**: reviewable form within the existing ~30s parse ceiling; continuous loading/processing feedback; archived-count fetch degrades to 0 without blocking render
**Constraints**: local-first (runs with no key); browser-only settings; single LLM request per parse/test; BYOK only; no analytics
**Scale/Scope**: single-user profile flow; one external call per parse or key test

## Constitution Check

*GATE: re-checked after Phase 0/1 design — PASS.*

- **Local-first / privacy**: AI settings + key are browser-local; the only external
  call is BYOK browser→OpenRouter (key never touches Alice's server; uploaded
  content stays transient/memory-only via the existing `/extract`). With no key the
  app is unchanged. No analytics added. This continues the explicit allowance
  established by feature 033's spec. ✅
- **Simple, maintainable architecture**: business logic stays in small modules
  (`aiSettings.js`, `llmParser.js`, `models/profile.js`); UI in `Profile.js` /
  `ProfileEdit.js` / `ResumeImport.js`. No new abstractions. ✅
- **Centralized validation**: reuses `validateProfile` / `normaliseProfile` /
  `mergeResumeData` — no duplicate schema; one reason-code table drives all error UX. ✅
- **Data integrity**: imports never auto-save; no partial writes (apply only on full
  parse success); existing-profile import is append-only with Undo; imported skills
  unrated; `validateProfile` applies at save. ✅
- **UX**: explicit empty/loading/error states; non-color-only status (text labels +
  glyphs on status pill, provenance pills, reason chips); labeled, keyboard-navigable
  controls; reduced-motion honored; desktop + mobile + demo. ✅
- **Testing & gates**: unit/data/component/page tests planned; Release Prep +
  Browser Smoke Test reserved as the final two phases (in that order). ✅
- **New dependency justification**: none introduced. ✅

No violations → Complexity Tracking left empty.

## Project Structure

### Documentation (this feature)
```text
specs/034-profile-page-refresh/
├── plan.md              # This file
├── research.md          # Phase 0 decisions (R-1…R-11) + current-state audit
├── data-model.md        # AI settings shape + migration; reused Profile model
├── quickstart.md        # How to run + exercise every state (URL params)
├── contracts/
│   └── api.md           # No server changes; OpenRouter + key-test + reason codes
└── checklists/
    └── plan-review.md    # Pre-implementation quality gates
```

### Source (affected) — see Affected Areas for the precise list
```text
src/
├── data/aiSettings.js                 # MODIFY — new shape + migration + derived status
├── services/llmParser.js              # MODIFY — model param, validateKey, reason map
├── pages/Profile.js                   # MODIFY — unified Settings card (§4.5)
├── pages/ProfileEdit.js               # MODIFY — mode gate, provenance, import bar, undo, gating
├── components/ResumeImport.js         # MODIFY — drop separate consent; smart input states; reason dialogs
└── styles/main.css                    # MODIFY — Settings card, gate, dialogs, provenance, reduced-motion
```

## Architecture

### Layers & responsibilities
- **`aiSettings.js` (state/business)** — single source of truth for AI config:
  persisted `enabled/apiKey/model/features`, derived `connectionStatus`, the 033→034
  migration, and `validateKey` delegation. No DOM.
- **`llmParser.js` (service)** — OpenRouter calls: `parseWithLlm(text,key,model)`,
  new `validateKey(key,model?)`, and the error→reason-code map (R-6). No DOM.
- **`models/profile.js` (domain)** — unchanged; reused for normalise/validate/merge.
- **`Profile.js` (read-only UI)** — renders the page; **new** unified Settings card
  composing the AI + Account sub-groups; existing skills/archived/empty render reused.
- **`ProfileEdit.js` (edit UI / flow controller)** — owns the proposed-flow state
  machine (gate → smart → processing → fill/append → provenance/undo), discard
  protection, and AI-off gating.
- **`ResumeImport.js` (edit UI / smart input)** — upload/paste + processing +
  failure dialogs (reason codes); consent dialog removed.

### Data flow — Settings (AI sub-group)
```
render → aiSettings.get* → draw master toggle / status pill / key panel / model / features
toggle master  → setEnabled → re-gate body
save key       → setKey (= consent) → status derives → 'connected' (after optional Test)
Test           → llmParser.validateKey → 'testing' → 'connected' | 'error'+reason
edit model     → setModel (datalist suggestions)
toggle CV      → setFeature('cv', …)   (JD/Compat disabled)
delete key     → clearKey → status 'none'
```

### Data flow — Edit page import (proposed flow)
```
mount(profile) ─ empty? ─yes→ [mode gate] ─Manual/dismiss→ blank form
                           └─Smart→ [smart input]
              ─ exists? ─→ populated form + collapsed [Import Bar]
[smart input]/[Import Bar] ─Process→ extract text (paste|/extract) →
   enabled && features.cv && key ?  parseWithLlm(text,key,model) : (AI off → "Enable AI in Settings")
        success → first-time: fill all + ✦ provenance ; existing: mergeResumeData append + ✦ on touched + Undo toast
        AI-unavailable → ask-first dialog (reason code): Use basic parser | Try AI again / Update key in Settings | manual/cancel
            Use basic parser → rule-based fill/append + ⚙ provenance (no sparkle)
        unreadable (NO_TEXT) → dead-end dialog: Try again / different file / manual(first-time)|cancel(existing)
   (no partial writes; existing-profile Cancel leaves form byte-for-byte unchanged)
```

## Phasing (high level — `/speckit.tasks` will expand)

1. **Phase 0 — Research** ✅ (this artifact set).
2. **Phase 1 — AI settings model + migration** (`aiSettings.js`) + unit tests.
   Foundational: everything else reads it.
3. **Phase 2 — Parser service changes** (`llmParser.js`: model param, `validateKey`,
   reason-code map) + unit tests.
4. **Phase 3 — Settings §4.5 redesign** (`Profile.js` unified card; relocate Account;
   AI sub-group controls) + CSS + page tests.
5. **Phase 4 — Edit-page proposed flow** (`ProfileEdit.js` + `ResumeImport.js`: mode
   gate, smart input states, processing, ask-first + unreadable dialogs, provenance,
   Import Bar, append + Undo, AI-off gating, consent removal) + CSS + component/page tests.
6. **Phase 5 — Reduced-motion + responsive polish** (CSS) + cross-breakpoint checks.
7. **Phase 6 — Release Prep** (version bump, CHANGELOG, README, REPO_MAP,
   feature_roadmap, package-lock version, docs sanity).
8. **Phase 7 — Browser Smoke Test** (walk each user story's Independent Test against
   the to-be-merged state, using the §0 URL params).

> Phases 6 then 7 are the mandatory final two (constitution Amendments 1.1.0/1.3.0),
> in that order.

## Risks & Tradeoffs

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Scope was under-estimated** — the proposed flow is net-new, not "minor changes" | Larger build than the brief implied | Surfaced + confirmed with user; phased plan isolates the flow (Phase 4) behind the foundational settings/parser work |
| **AI settings migration corrupts a returning user's key** | Existing users lose AI access | One-way, additive migration; never deletes the key store; explicit unit tests for each prior-state row (data-model §1) |
| **Cached connection status goes stale** | User sees "Connected" with a revoked key | Status is derived, never persisted (R-2); Test re-validates live |
| **Reason-code drift across Test vs import dialog** | Inconsistent error UX | Single shared reason-code map (R-6) in `llmParser.js`; one test suite |
| **Partial writes mutate a real profile on failed import** | Data integrity violation | Apply only after full parse success; snapshot+Undo; existing-profile Cancel restores exactly (R-8) |
| **`ProfileEdit.js` is already large (~1.65k lines)** | Added flow increases complexity | Keep smart-input UI in `ResumeImport.js`; keep parser/reason logic in services; `ProfileEdit` only orchestrates |
| **Provider-specific OpenRouter error shapes** | Mis-mapped reason codes | Default unknown → retryable `wait`; provider-agnostic copy; map by HTTP status first |
| **Removing the separate consent dialog** changes a privacy-sensitive surface | Consent semantics regress | Saving a key *is* consent (design-locked); Delete withdraws; covered by tests; helper text retained on the key panel |

## Validation Approach

- **Unit (data)** — `aiSettings`: defaults, get/set per field, derived status state
  machine, and the 033→034 migration matrix (each prior-state row).
- **Unit (service)** — `llmParser`: `parseWithLlm` passes the model; `validateKey`
  resolves connected/error; error→reason-code mapping for each HTTP/transport case.
- **Component** — `ResumeImport`: upload/paste validation, Process gating
  (file chosen or >~20 chars), ask-first dialog actions, unreadable dead-end, no
  consent dialog, AI-off "Enable AI in Settings" affordance.
- **Page** — `Profile`: unified Settings card structure (one card, two sub-groups),
  master-toggle gating, status pill states, JD/Compat disabled, Account relocated &
  mode-aware; `ProfileEdit`: mode gate (empty vs existing), provenance pills
  (AI vs basic), append-only + Undo restores snapshot, no partial writes on failure,
  dirty/discard gating intact.
- **Accessibility** — reduced-motion suppresses decorative transitions while
  functional states remain reachable; status/provenance/reason conveyed by text, not
  color alone; keyboard operability.
- **Tooling** — `npm run lint` and `npm run test:run` green before each phase close.
- **Manual** — quickstart.md drives every state via the §0 URL params on the real app.

## Affected Areas

> Precise per the plan prompt's token discipline. "Modify" = expected edits;
> "inspect only" = read to integrate, not necessarily change.

### Likely inspected
- `src/main.js` — navigation (`navigate('profile-edit')`, `confirmNavigation`,
  mount/unmount) — *inspect only* (deep-link target for "Enable AI in Settings →";
  no router change expected).
- `src/models/profile.js` — reuse normalise/validate/merge — *inspect only*.
- `src/components/DeleteAccountModal.js`, `Toast.js` — reused by Account + Undo toast — *inspect only*.
- `src/assets/AI_sparkle.png` — provenance/gate signifier (already in repo) — *inspect only*.
- `docs/design/profile_page.md`, `docs/design/edit_profile_page.md` — build contract.

### Likely modified
- `src/data/aiSettings.js` — new shape, defaults, derived status, migration.
- `src/services/llmParser.js` — `model` param, `validateKey`, reason-code map.
- `src/pages/Profile.js` — unify `renderAiSettingsSection` + `renderAccountSection`
  into one Settings card; build §4.5.1 AI sub-group.
- `src/pages/ProfileEdit.js` — mode gate, provenance markers, Import Bar, append+Undo,
  AI-off gating.
- `src/components/ResumeImport.js` — remove consent dialog; smart-input states;
  ask-first + unreadable dialogs with reason codes.
- `src/styles/main.css` — Settings card/sub-groups, status pill, gate cards, dialogs,
  provenance pills, `prefers-reduced-motion` additions.

### Tests likely added/updated
- Add/extend: `tests/data/aiSettings.test.js` (shape, defaults, migration, status).
- Add/extend: `tests/services/llmParser.test.js` (model param, validateKey, reasons).
- Add/extend: `tests/components/ResumeImport.test.js` (+ `.demo`) (states, dialogs, no consent).
- Add/extend: `tests/pages/Profile.test.js`, `tests/pages/profile.aiSettings.test.js`,
  `tests/pages/Profile.account.test.js` (unified card, gating, relocation).
- Add/extend: `tests/pages/ProfileEdit.test.js`, `tests/pages/profileEdit.aiIndicators.test.js`
  (mode gate, provenance, append/Undo, no partial writes).
- Update if assertions reference old copy: `tests/release-metadata.test.js` (Release Prep phase).

### Explicitly out of scope
- DB schema / migrations; any server endpoint or response shape.
- New LLM provider integration or a new parsing engine (033 owns it).
- JD-parsing (035) and Compatibility (036) feature logic — their toggles render
  disabled only.
- Compatibility scoring, profile-to-job matching, avatar photo upload, import
  de-duplication beyond existing `mergeResumeData`, new import formats.
- Applications stats/chart computation (only the archived link is in scope here).
- The read-only skills display mechanics (already shipped; verify, don't rebuild).
