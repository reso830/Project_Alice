# Feature Specification: Profile Page Refresh

**Feature Branch**: `034-profile-page-refresh`
**Created**: 2026-06-05
**Status**: Draft
**Input**: Feature brief: `docs/features/034-profile-page-refresh.md`
**Design references**: `docs/design/profile_page.md` (read-only Profile page), `docs/design/edit_profile_page.md` (Edit / Setup Profile page)

---

## Problem Statement

The Profile experience was designed early in Project Alice and no longer matches
the platform's current capabilities. Profiles are hard to scan as they grow,
skills render as flat tags with no sense of proficiency, AI and account controls
are scattered across separate cards, and viewing vs. editing feel
indistinguishable. Long sections force excessive scrolling, especially on mobile,
and the layout offers no natural home for the AI-assisted workflows Alice is
moving toward.

This feature restructures the **read-only Profile page** and the **Edit / Setup
Profile page** to improve readability, information hierarchy, and mobile
usability; surfaces skills with a 1–5 proficiency model; consolidates AI
configuration and account lifecycle into a single **Settings** section; and gives
the Edit experience a distinct, intentional chrome with unsaved-changes
protection. It is primarily a UX / presentation refresh: existing profile data,
schema, and APIs are preserved, and no data migration is required.

Feature **033** shipped only a **basic** résumé import (upload/paste, a separate
consent dialog, rule-based fallback, field-level AI badges) plus the underlying
LLM **parser engine** and OpenRouter call. The richer smart-import flow on the
Edit page — the split-card **mode gate**, **ask-first** reason-code failure
dialogs, basic-vs-AI **provenance markers**, the existing-profile **Import Bar**,
and the post-import **Undo** toast — is **net-new in 034**. 034 builds that flow on
top of the 033 engine (no net-new LLM provider integration) and reconciles the
basic import (consent folded into the key, model slug, master/feature gating) into it.

---

## Scope

**Read-only Profile page** (`docs/design/profile_page.md`)
- Refresh the page layout and visual hierarchy: Welcome heading, Applications
  section, Profile section, and Settings section, single-column, centred.
- Render the Profile section sub-sections (Basic Info, Summary, Experience,
  Education, Skills, Certifications, Awards, Languages, Links) with reduced
  visual clutter and clear separation.
- **Skills proficiency display**: each skill renders as its own row with a
  5-segment graded meter (level 1–5), a hover/tap reveal of `{level} · {Label}`,
  a keyboard-operable row, a "?" scale popover, a sort control (Custom / By
  level, toggling highest- / lowest-first), and a "Show all / Show less" collapse
  past 10 skills.
- **Mobile section collapse**: profile sub-sections collapse/expand on mobile
  (< 640px); desktop stays fully expanded.
- **Unified Settings section** (full §4.5 redesign): one Settings card with two
  labelled sub-groups — **Artificial Intelligence** and **Account** — replacing
  the previously separate AI and Account cards. Rendered in every runtime mode
  and regardless of whether a profile exists.
  - AI sub-group: a master "AI features" toggle that gates the body; a
    connection panel with a masked OpenRouter key (save / show-hide / test /
    replace / delete), a single derived connection status pill
    (Connected / Not connected / Testing… / Key invalid), a free-text
    `provider/model-slug` field with no dropdown or suggestions; and per-feature
    toggles (Resume parsing — functional, default on; Job-description parsing and
    Compatibility analysis — shown but disabled until features 035 / 036 ship).
    Consent is folded into the key flow (a saved key is consent; Delete
    withdraws it).
  - Account sub-group: the mode-aware destructive control (hosted "Delete
    account" / local "Clear all data") with the existing gated confirmation
    modal. Demo mode renders an amber warning note instead of a destructive
    control.
- **Profile empty state** with a "Set Up Profile" call-to-action when no profile
  exists.
- **Archived applications link** in the Applications section, surfacing the
  archived count independently from active stats.
- **Edit Profile navigation** from the Profile page (Edit Profile button when a
  profile exists; Set Up Profile from the empty state).

**Edit / Setup Profile page** (`docs/design/edit_profile_page.md`)
- Dedicated full-page editing experience distinct from the read-only page:
  sticky sub-header with Back, title, Cancel, and Save; Save disabled until the
  form is dirty; unsaved-changes (discard-confirmation) protection on Back /
  Cancel.
- Nine editable section cards matching the canonical Profile model, including the
  inline Skills editor (level picker, unrated-skill save gate) and the
  entry-overlay add/edit modal (desktop modal / mobile bottom-sheet) for
  structured list sections.
- **Build the net-new smart-import flow** per the current design specs (033
  shipped only a basic import): the mode gate (split-card, first-time only), smart
  input (upload PDF/DOCX/TXT ≤ 5 MB or paste), processing spinner, ask-first
  AI-unavailable dialog, unreadable-file dead-end dialog, reason-code surfacing
  (§11), append/fill merge rules (§3.6), and AI / basic-parser provenance markers
  (§5). The 033 parser engine and OpenRouter call are reused unchanged.
- **Reconcile the basic 033 import** into the new flow and settings model: fold
  consent into the key, pass the model slug to the parser, gate on the master /
  per-feature toggles, and add the AI-off "Enable AI in Settings →" deep-link.

**Cross-cutting**
- Responsive across desktop, tablet, and mobile without loss of functionality.
- Existing profile data renders without migration; existing profile APIs and
  storage structures are unchanged.

## Out of Scope (Non-Goals)

- New profile data structures or schema migrations (Feature 031 remains the
  source of truth for skill proficiency).
- Net-new LLM provider integration or a new parsing engine — the résumé parser
  (rule-based + LLM) ships in feature 033; 034 only reconciles its UI/flow.
- Compatibility-scoring logic and profile-to-job matching algorithms.
- New authentication functionality; changes to the account-deletion backend
  behavior beyond presenting it inside the Settings card.
- Changes to application-tracking workflows or the Applications stats/chart
  computation (the chart and four stat chips are unchanged; only the archived
  link is in scope on this page).
- Avatar photo upload (avatar remains initials-only).
- Import de-duplication and any new accepted import formats beyond file + paste.

---

## Clarifications

### Session 2026-06-05

- Q: Does 034 include the [PROPOSED] smart résumé-import flow from
  `edit_profile_page.md` (mode gate, smart input, failure dialogs, provenance
  markers, reason codes)? → A: **Yes — build the full proposed flow.** *(Planning
  note: a code audit found feature 033 shipped only a **basic** import — upload/
  paste, a separate consent dialog, rule-based fallback, field-level AI badges.
  The split-card mode gate, ask-first reason-code failure dialog, basic-vs-AI
  provenance markers, Import Bar, and Undo toast are **net-new** in 034. The
  underlying parser engine and OpenRouter call are reused from 033 — no net-new
  LLM provider integration.)*
- Q: How far should the Settings section go, given the shipped AI controls
  (key / consent) don't match the §4.5.1 design? → A: **Full §4.5 redesign** —
  consolidate AI + Account into one Settings card and bring the AI sub-group up
  to the §4.5.1 design (master toggle, single connection status pill, free-text
  model slug, per-feature CV/JD/Compat toggles), replacing the current fragmented
  controls.
- Q: How should the JD-parsing and Compatibility-analysis feature toggles behave,
  given those features (035 / 036) aren't built yet? → A: **Shown but disabled** —
  render the JD and Compat toggles disabled with a "coming soon" affordance for
  layout completeness; only the Resume-parsing (CV) toggle is functional in 034.
  035 / 036 enable their toggles when they ship.
- Q: Default state of the functional Resume-parsing (CV) toggle once the master
  toggle is on and a valid key is saved? → A: **ON by default** — the master
  toggle is the opt-in; smart résumé import works immediately after a key is
  saved, without a second opt-in step.
- Q: How should an existing feature-033 browser-local key + consent migrate to the
  new `enabled / model / features` shape? → A: **Auto-enable from saved key** — a
  prior key + consent maps to `enabled = true`, the key is preserved, `model`
  falls back to the 033 default, and `features` default per the CV-default answer.
  No re-entry is required.
- Q: Should the page's motion effects honor the OS "reduce motion" setting? → A:
  **Yes** — when `prefers-reduced-motion` is set, transitions (skill-meter
  cross-fade, ~2.6s import flash, bottom-sheet slide) are disabled/shortened and
  end-states shown directly; functional reveals resolve instantly. Auto-revert
  timers still fire so no state is left stuck.

---

## User Behavior (User Stories)

### Profile viewing
- **US-1** A user opens the Profile page and understands their profile at a
  glance — basic info, summary, and structured sections in a clear hierarchy.
- **US-2** A user with a large profile browses it without excessive scrolling
  (mobile section collapse; skills collapse past 10).
- **US-3** A user sees each skill's proficiency level via a graded meter and can
  reveal the level word, reorder by proficiency, and read the proficiency scale.

### Profile management
- **US-4** A user clearly distinguishes viewing from editing — editing happens on
  a dedicated page with its own sticky header.
- **US-5** A first-time user is guided into profile setup (empty-state CTA →
  Setup Profile → mode gate offering guided import or manual entry).
- **US-6** A user editing a profile is protected from losing unsaved changes by a
  discard confirmation when leaving with a dirty form.

### Settings
- **US-7** A user finds AI configuration and account controls in one Settings
  location, with AI features gated behind a single master toggle and a clear
  connection status.

### Applications
- **US-8** A user discovers and opens archived applications directly from the
  Profile page, with the archived count shown independently of active stats.

---

## Functional Requirements

Requirements trace to the brief's FR-001…FR-012 and the two design specs.

- **FR-001 Profile layout refresh** — The Profile page renders the four stacked
  sections (Welcome, Applications, Profile, Settings) per `profile_page.md` §3–4.
- **FR-002 Unified Settings section** — A single Settings card contains an
  Artificial Intelligence sub-group and an Account sub-group, replacing all
  previously separate AI / account surfaces. Rendered in all modes and whether or
  not a profile exists.
- **FR-002a AI sub-group controls** — Master toggle gates the body; connection
  panel provides key save / show-hide / test / replace / delete; a single derived
  connection status pill; a free-text `provider/model-slug` field with no
  dropdown or suggestions; per-feature toggles. A saved key is consent; Delete
  withdraws it. There is no separate consent control.
  - **Feature toggles:** Resume parsing (CV) is **functional** and defaults **on**
    once the master toggle is on and a key is saved (no second opt-in).
    Job-description parsing (JD) and Compatibility analysis (Compat) are
    **shown but disabled** with a "coming soon" affordance — their backing
    features (035 / 036) are not built in 034 and the toggles have no effect until
    those features ship.
- **FR-002b Account sub-group** — Mode-aware destructive control (hosted/local)
  and its gated confirmation modal behave as in feature 030, now hosted inside
  the Settings card. Demo mode renders an amber informational note only, with no
  destructive button, modal, or account-management request.
- **FR-003 Profile information structure** — The Profile section displays Basic
  Information, Summary, Professional Experience, Education, Skills,
  Certifications, Awards, Languages, and Links.
- **FR-004 Skills proficiency display** — Skills render as proficiency rows
  (name + 5-segment meter at the skill's level) on a 5-level scale
  (1 Beginner · 2 Basic · 3 Intermediate · 4 Strong · 5 Expert). Each row is a
  focusable, keyboard-operable control with an accessible name, and reveals
  `{level} · {Label}` on hover/tap (tap auto-reverts after 2.5s). The skill
  storage model is unchanged except as defined by Feature 031.
- **FR-005 Skills utilities** — The Skills section supports custom ordering,
  sorting by proficiency (toggle highest-/lowest-first), expand/collapse past 10
  skills, and a "?" proficiency-scale popover (closes on outside-click / Esc).
- **FR-006 Mobile section collapse** — On mobile (< 640px), profile sub-sections
  collapse/expand via a tappable label with a chevron; desktop stays expanded.
- **FR-007 Archived applications link** — The Applications section always shows an
  "Archived applications · {N} →" entry point (even when N = 0) that routes to the
  Tracker archived view; the archived count is sourced independently and degrades
  to 0 on fetch failure without blocking render. Active stats/chart exclude
  archived rows.
- **FR-008 Profile empty state** — When no profile exists, the Profile section
  shows a dedicated empty state with a "Set Up Profile" CTA.
- **FR-009 Edit Profile navigation** — Users navigate to the Edit / Setup Profile
  page via the Edit Profile button (profile exists) or the Set Up Profile button
  (empty state); both reach the same `profile-edit` page.
- **FR-010 Edit Profile experience** — The Edit page has a sticky sub-header with
  Back / title / Cancel / Save; Save is disabled until the form is dirty; Back /
  Cancel with unsaved changes trigger a discard-confirmation dialog.
- **FR-010a Skills editor save gate** — Newly added skills start unrated; Save is
  blocked until every named skill has a level (1–5) and no name is blank.
- **FR-010b Smart-import reconciliation** — The Edit page's smart-import flow
  (mode gate, smart input, processing, ask-first AI-unavailable dialog,
  unreadable-file dialog with reason codes, append/fill merge rules, AI/basic
  provenance markers) matches `edit_profile_page.md` §3/§5/§10/§11. When AI is off
  or the relevant feature toggle is off, Smart entry / Import Bar is disabled and
  shows an "Enable AI in Settings →" deep-link.
- **FR-011 No regression / no migration** — All existing profile functionality
  remains available; existing profile data renders correctly without migration.
- **FR-012 Responsive design** — The Profile and Edit Profile experiences work on
  desktop, tablet, and mobile breakpoints without loss of functionality.
- **FR-013 Reduced-motion support** — When the OS `prefers-reduced-motion` setting
  is active, decorative transitions (skill-meter cross-fade, the ~2.6s import
  flash, the entry-overlay bottom-sheet slide) are disabled or shortened and
  end-states are shown directly; functional reveals resolve instantly. Auto-revert
  timers (e.g. the 2.5s skill tap-revert) still fire so no UI is left stuck in a
  transient state.

---

## Acceptance Criteria

Each criterion is independently testable and maps to the brief's AC list plus
design specifics.

- **AC-001** The Profile page renders the Welcome, Applications, Profile, and
  Settings sections in order and matches `profile_page.md` for both page states
  (no-profile / profile-exists). *(US-1, FR-001)*
- **AC-002** A single Settings card replaces the previously separate AI and
  Account cards and contains both labelled sub-groups. *(US-7, FR-002)*
- **AC-003** Skills display 5-segment proficiency meters at the stored level
  rather than flat tags; hover/tap reveals `{level} · {Label}` in place without
  reflowing the row. *(US-3, FR-004)*
- **AC-004** Skills support sorting (Custom / By level, toggling
  highest-/lowest-first), the "?" scale popover, and the "Show all / Show less"
  collapse past 10 skills. *(US-3, FR-005)*
- **AC-005** The Applications section shows an always-visible "Archived
  applications · {N} →" link that navigates to the archived Tracker view; the
  count is independent of active stats and shows 0 when none/unavailable.
  *(US-8, FR-007)*
- **AC-006** The Profile section renders correctly in both profile-present and
  profile-empty states; the empty state offers a "Set Up Profile" CTA.
  *(US-5, FR-003, FR-008)*
- **AC-007** Viewing and editing are separate experiences: editing occurs on the
  dedicated Edit page reached from the Profile page. *(US-4, FR-009, FR-010)*
- **AC-008** The Edit page has sticky Save and Cancel actions; Save is disabled
  until the form is dirty. *(US-4, FR-010)*
- **AC-009** Leaving the Edit page (or an entry overlay) with unsaved changes
  triggers a discard-confirmation dialog. *(US-6, FR-010)*
- **AC-010** The AI sub-group master toggle gates the connection panel and the
  three feature toggles; with AI off they render disabled (dimmed, inert); the
  connection status pill reflects the derived state (Connected / Not connected /
  Testing… / Key invalid). *(US-7, FR-002a)*
- **AC-011** With AI (or the CV feature) off, the Edit page's Smart entry / Import
  Bar is disabled and shows an "Enable AI in Settings →" deep-link; manual entry
  is unaffected. *(FR-002a, FR-010b)*
- **AC-012** A résumé import never makes partial writes: nothing fills/appends
  until a parse fully succeeds; on an existing profile, Cancel leaves the form
  unchanged. Provenance follows the parser (AI → sparkle tag; basic → neutral
  "⚙ Auto-filled" tag). *(FR-010b)*
- **AC-013** All functionality remains usable on desktop, tablet, and mobile
  breakpoints; mobile sub-sections collapse/expand while desktop stays expanded.
  *(US-2, FR-006, FR-012)*
- **AC-014** Existing profile data (including legacy `string[]` skills normalised
  to `{ name, level: 2 }`) renders correctly without any migration step.
  *(FR-011)*
- **AC-015** No existing profile functionality regresses (account deletion,
  resume import, profile edit/save, archived link). *(FR-011)*
- **AC-016** In the AI sub-group, the Resume-parsing (CV) toggle is functional and
  defaults on once master is on and a key is saved; the JD and Compat toggles
  render disabled with a "coming soon" affordance and have no effect. *(FR-002a)*
- **AC-017** A browser with a feature-033 key + consent loads the redesigned
  Settings with the master toggle on, the key preserved, the 033 default model,
  and `cv` on — no re-entry or re-consent prompted. *(Data Considerations)*
- **AC-018** With `prefers-reduced-motion` active, the skill-meter reveal, import
  flash, and bottom-sheet slide present without animation (end-state shown
  directly), while reveals/auto-reverts still resolve correctly. *(FR-013)*

---

## Edge Cases

- **No profile** — Welcome shows "Welcome back." (no first name); Profile section
  shows the empty state; Settings still renders.
- **Legacy skills** — Profiles whose `skills` were stored as `string[]` normalise
  on load to `{ name, level: 2 }` and render immediately; no save is forced.
- **Unrated skill on edit** — A newly added or unrated skill blocks Save with a
  visible "Set a level for every skill to save · {n} missing" message.
- **Long skill names** — Truncate with ellipsis; full text preserved in
  `title` / `aria-label`; never collide with the meter or revealed word.
- **More than 10 skills** — Only the first 10 render until "Show all {N}" is
  toggled.
- **Archived count fetch failure** — The archived link degrades to 0 rather than
  blocking the Profile render.
- **Archived count = 0** — The archived link still renders (surface stays
  discoverable; layout stable).
- **AI master toggle off** — Connection panel + all three feature toggles render
  disabled; Edit-page Smart entry / Import Bar disabled with Settings deep-link.
- **Per-feature toggle off (CV)** — Smart résumé import is unavailable even if a
  key is connected; manual entry still works.
- **JD / Compat toggle** — Rendered disabled ("coming soon"); interacting with it
  changes nothing and surfaces no AI behavior until 035 / 036 ship.
- **Returning 033 user** — A saved 033 key + consent loads as enabled (master on,
  key preserved, default model, CV on) without re-entry; a browser with no prior
  key loads with the master toggle off and no key.
- **Reduced motion** — With `prefers-reduced-motion`, decorative transitions are
  suppressed but all functional states (skill reveal, import result, overlay
  open/close) remain reachable and correct.
- **AI parser unavailable (recoverable)** — Ask-first dialog with reason code;
  wait-type reasons offer "Try AI again", settings-type reasons offer "Update key
  in Settings"; "Use basic parser" remains available; basic fill tags the neutral
  "⚙ Auto-filled" provenance, never the AI sparkle.
- **Unreadable file (dead-end)** — Amber dialog with `NO_TEXT`; first-time offers
  Try again / different file / manual; existing offers Try again / Cancel; no
  "Use basic parser".
- **Existing-profile import** — List sections append (nothing overwritten or
  reordered); Summary appends as a new paragraph; singular Basic Info fields fill
  only if empty; only touched sections are marked; an Undo toast restores the
  pre-import state.
- **Demo mode Settings** — The AI and Account sub-groups remain visible as amber
  informational notes. Demo mode renders no OpenRouter controls, feature toggles,
  destructive account button, modal, or account-management request.
- **Narrow viewport (≤ 344px)** — Settings card has no horizontal overflow; the
  saved-key action row wraps; hit targets stay ≥ 32px.
- **Unsaved changes on navigate** — Discard-confirmation dialog appears; focus is
  trapped and returns to the prior element on close.

---

## Data Considerations

- **No new tables or schema migrations.** Existing Profile structures are
  preserved; existing application data is unchanged.
- **Canonical Profile model** (`profile_page.md` §7): `firstName`, `lastName`,
  `city`, `phone`, `email`, `summary`, `experience[]`, `education[]`, `skills[]`,
  `certifications[]`, `awards[]`, `languages[]`, `links[]`. Skills carry a 1–5
  `level` (Feature 031 is the source of truth); legacy `string[]` skills
  normalise to `{ name, level: 2 }` on load. Unrated (`level: null`) is an
  editor-only state that must be resolved before save.
- **AI sub-group settings are browser-local only** — never sent to Project Alice
  servers (preserves the constitution's local-first / no-external-tracking
  principle). Persisted shape (per `profile_page.md` §7): `enabled` (master),
  `apiKey` (presence = consent), `model` (free-text slug), and `features`
  `{ cv, jd, compat }`. The connection status is **derived at runtime, not
  persisted** (no key → none; mid-test → testing; last test failed → error;
  otherwise connected). The OpenRouter key is sent directly to OpenRouter at call
  time only. **Defaults:** when the master toggle is on and a key is saved, the
  `cv` feature defaults **on**; `jd` and `compat` are persisted but inert (their
  toggles render disabled until 035 / 036 ship). *(Note: the current shipped
  `aiSettings` exposes key/consent only; this redesign extends it to the above
  shape — a browser-local settings change, not a DB schema change.)*
- **Feature-033 settings migration** (browser-local, one-way) — an existing
  key + consent saved under 033's `aiSettings` maps to the new shape on first
  load: `enabled = true`, the key is preserved, `model` falls back to the 033
  default slug, and `features` apply the defaults above (`cv` on). No re-entry or
  re-consent is required, and no server data is involved.
- **Application counts** are read-only on this page and sourced from the Tracker:
  Total / Active / Pending / Offer derive from the active list (archived
  excluded); the archived count comes from a separate
  `getAll({ view: 'archived' })` fetch used only by the archived link.
- **Account section** has no persisted model of its own — its label, copy,
  enabled state, confirmation gate, and post-success path derive from the runtime
  mode (hosted / local / demo) resolved from `authStore`.
- **Résumé-parse payload** (Edit page, delivered by 033): a `Partial<Profile>`
  produced transiently from an uploaded file or pasted text; not persisted; not
  stored server-side. Applied per the §3.6 merge rules.

---

## Constitution Alignment

- **Local-first / no external tracking** — AI settings and the OpenRouter key are
  browser-local; the key never reaches Project Alice servers and goes only to the
  user's chosen provider. Résumé content: pasted text is sent browser-direct to the
  provider; uploaded files pass through the existing `POST /api/resume/extract`
  endpoint transiently (memory-only) for text extraction and are never persisted
  server-side. The app remains fully runnable from a plain checkout with no key.
- **State handling** — Empty (no profile), loading (async application counts),
  and error (archived-count fetch failure, parse failures) states are handled
  explicitly.
- **Accessibility** — Skill rows are real buttons with accessible names; status
  and proficiency are conveyed by text/labels, not color alone; the page supports
  keyboard navigation and desktop + mobile browsers; motion honors
  `prefers-reduced-motion` (FR-013).
- **Testing** — Core logic added/changed in this feature (skill normalisation,
  sort/collapse logic, AI-settings derived connection status, AI-off + per-feature
  gating, the 033→034 settings migration, archived-count degradation,
  dirty/discard gating) must have automated tests.
- **Separation of concerns** — Presentation changes reuse existing business logic
  and APIs; no profile schema or API changes.

---

## Dependencies

- **031-skill-proficiency-system** — source of truth for the 1–5 skill levels.
- **033-llm-resume-cv-parser** — delivers the résumé-import parser and the
  initial AI settings; 034 reconciles its UI/flow and redesigns the Settings
  surface around it.
- **030-delete-profile-data** — the Account destructive control now hosted inside
  the Settings card.
- **028-archive-applications-view** — the archived applications link and count.

---

## Open Questions

| # | Question | Status |
|---|----------|--------|
| 1 | Should "Go to Tracker" filter the Tracker to a specific status? | Open (carried from `profile_page.md` §9) |
| 2 | Is the Profile used to power Tracker compatibility scores? | Out of scope here; future feature |
| 3 | Should the avatar support a photo upload? | Open — initials-only for this refresh |
| 4 | Should résumé import de-duplicate near-identical appended entries? | Open (`edit_profile_page.md` §9); out of scope for 034 |
| 5 | Exact handling of singular Basic Info fields on existing-profile import (fill-if-empty vs. prompt)? | Resolved for now — fill-if-empty (`edit_profile_page.md` §3.6) |
