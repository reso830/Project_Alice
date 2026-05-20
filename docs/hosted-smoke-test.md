# Hosted Smoke-Test Checklist

Run this checklist against a hosted preview deploy before promoting
to production, or against a production deploy after a docs-only
merge that needs no rollout verification. Each step is a
**Given / When / Then** triplet — complete every step before
considering the deploy verified. The format mirrors
[`specs/018-auth-user-access/quickstart.md`](../specs/018-auth-user-access/quickstart.md)
§10 and the acceptance scenarios in feature specs.

> **Audience**: future operators (portfolio reviewers, contributors,
> returning maintainers) who want pre-promotion verification without
> spelunking into per-feature `specs/0##-…/` directories. The
> checklist references those specs for deep-dive context but every
> step is executable from this file alone.

---

## Prerequisites

Before starting the walk-through, have the following on hand:

- A deployed URL — a Vercel preview URL is sufficient, or the
  production URL if you are smoke-testing a docs-only / no-rollout
  change.
- Browser with DevTools available (Chrome, Firefox, or equivalent).
  Several steps inspect Network and Console panels.
- **Two allowlisted email addresses**: user A and user B. Both must
  exist in the `allowed_emails` table on the target Supabase project
  before this checklist starts — the signup trigger rejects
  non-allowlisted emails. See
  [`specs/018-auth-user-access/quickstart.md`](../specs/018-auth-user-access/quickstart.md)
  for allowlist install + population steps.
- One small valid PDF or DOCX resume file under 5 MB, for the
  resume-import step (Section 6).

---

## Expected mid-run behaviors

Free-tier hosting introduces a couple of behaviors that look like
failures but are not. Pause and resume the run if you hit either;
both resolve without intervention beyond a short wait.

- **Supabase Free inactivity pause.** The Supabase project may
  pause if it has not been hit recently; the first request returns
  an error. Wake the project from the Supabase dashboard and wait
  1–2 minutes for warmup, then re-run from the failing step. Not a
  defect; expected free-tier behavior. See
  [`docs/deployment.md` — Demo & Free-Tier Notes](deployment.md#demo--free-tier-notes).
- **Vercel Hobby cold start.** The first request after a quiet
  period may take several seconds while the function instance
  boots. Subsequent requests in the same session are fast. Not a
  defect; expected free-tier behavior.

---

## Capture

Record pass / fail / notes per step in the PR description. Any
failure stops the run — fix or defer with documented rationale; do
not promote a partial pass. Pauses / cold-starts that resolve after
a wait are **not** failures; note them but continue.

A minimal capture template, one row per section:

```
1. Login flow:                 [ ] pass  [ ] fail   notes:
2. Demo flow:                  [ ] pass  [ ] fail   notes:
3. Application CRUD:           [ ] pass  [ ] fail   notes:
4. Profile editing:            [ ] pass  [ ] fail   notes:
5. Authorization:              [ ] pass  [ ] fail   notes:
6. Resume import restrictions: [ ] pass  [ ] fail   notes:
7. Mobile layout sanity:       [ ] pass  [ ] fail   notes:
```

---

## 1. Login flow

### 1.1 Sign up

- **Given** the deployed URL and an allowlisted email (user A) that
  is not yet registered in `auth.users`.
- **When** I click **Sign up**, enter the email and a password
  (≥ 6 characters), submit, and complete the confirmation email
  link Supabase sends.
- **Then** I land on the welcome page signed in; my email appears
  in the navbar; navigating to the tracker shows the **2 seeded
  starter applications** inserted by the `claim_and_seed_starter()`
  RPC (feature 019, FR-012); the Profile page shows an empty
  profile.

### 1.2 Sign in

- **Given** the now-registered user A account and an in-progress
  session that has been signed out.
- **When** I click **Sign in**, enter the same email and password,
  and submit.
- **Then** I land back on the welcome page signed in; the tracker
  still shows the 2 starter applications (plus any I have created
  since signup); the profile state persists from my last edit.

---

## 2. Demo flow

### 2.1 Enter the demo

- **Given** the deployed URL, signed out (or a fresh incognito
  window).
- **When** I click **Try the demo** on the welcome page.
- **Then** the tracker loads with **23 seeded sample applications**
  covering every status (Wishlist through Ghosted plus one
  archived); the Profile page shows a fully populated persona
  (Alex Rivera or equivalent) with Experience, Education, Skills,
  Languages, Certifications, Awards, and Links populated; no
  sign-in prompt appears.

### 2.2 Demo CRUD feels real

- **Given** the demo session from 2.1.
- **When** I create a new application, edit one existing
  application's status, and archive a third.
- **Then** all three changes appear immediately in the list and
  filters work over the modified set; the DevTools Network panel
  shows **no `/api/*` requests** for these operations (demo runs
  client-side only).

### 2.3 Demo resets on refresh

- **Given** the demo session with the three CRUD changes from 2.2.
- **When** I hard-refresh the browser.
- **Then** the tracker returns to the original 23 seeded
  applications; my three changes are gone. This is intentional per
  feature 020 — the demo is a preview, not a sandbox account.

---

## 3. Application CRUD

Performed signed in as user A from Section 1.

### 3.1 Create

- **Given** the tracker showing user A's applications.
- **When** I click **+ New application**, fill in the required
  fields (company, job title, status, responsibilities), and save.
- **Then** the new application appears in the list at the chosen
  status; the DevTools Network panel shows a `POST /api/applications`
  request with a `2xx` response; a hard refresh confirms the new
  row persists.

### 3.2 Edit

- **Given** the application created in 3.1.
- **When** I open it, change the status to **Interview**, edit a
  notes field, and save.
- **Then** the card updates immediately; the Network panel shows a
  `PATCH /api/applications/<id>` (or equivalent) with a `2xx`
  response; a hard refresh confirms the new status and notes
  persist.

### 3.3 Archive

- **Given** the application from 3.2.
- **When** I archive it from the card or detail view.
- **Then** the application disappears from the active list; a hard
  refresh confirms it remains archived; the Network panel shows the
  archive request returned `2xx`.

---

## 4. Profile editing

Performed signed in as user A.

### 4.1 Sticky save/cancel + dirty state

- **Given** the Profile page showing user A's (empty or partially
  populated) profile.
- **When** I click **Edit**, scroll past the first structured
  section, add one entry to **Experience** (company, role, dates),
  and continue scrolling.
- **Then** the **Save** and **Cancel** controls remain visible
  while scrolling (sticky); the page indicates dirty state; the
  controls become enabled when there are unsaved changes.

### 4.2 Discard guard

- **Given** the unsaved Experience entry from 4.1.
- **When** I attempt to navigate away (click another navbar link,
  or close the modal/page).
- **Then** a discard-confirmation prompt appears; clicking
  **Cancel** keeps me on the edit page with the unsaved entry
  intact.

### 4.3 Save persists

- **Given** the unsaved Experience entry from 4.1.
- **When** I click **Save**.
- **Then** the entry appears in the read-only profile view; the
  Network panel shows a `PATCH /api/profile` (or equivalent) with a
  `2xx` response; a hard refresh confirms the new Experience entry
  persists.

---

## 5. Authorization (cross-user denial)

Confirms that hosted RLS plus server-side filters refuse
cross-user reads (feature 019 defense in depth).

### 5.1 User A creates a record

- **Given** a fresh tab signed in as user A.
- **When** I create one application with a recognizable title
  (e.g. `"USER-A-PRIVATE"`); inspect the Network panel for the
  `POST /api/applications` response and copy the `id` field.
- **Then** the application persists in user A's list and the `id`
  is available for the next step.

### 5.2 User B cannot read it

- **Given** a second browser window or incognito tab signed in as
  user B (a different allowlisted email).
- **When** in DevTools Console (on the user B tab) I extract user
  B's Supabase access token from the session stored in
  localStorage by `@supabase/supabase-js`, then issue a fetch with
  the proper `Authorization: Bearer <jwt>` header — the server's
  `requireAuth` middleware reads that header and rejects requests
  without it (returning **401**) before RLS is ever exercised, so
  the token MUST be attached for this check to be meaningful:

  ```js
  // Step 1 — locate the Supabase session key (pattern:
  // sb-<project-ref>-auth-token) and pull user B's access token.
  const tokenKey = Object.keys(localStorage)
    .find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
  const session = JSON.parse(localStorage.getItem(tokenKey));
  console.assert(
    typeof session?.access_token === 'string' && session.access_token.length > 0,
    'access_token missing — sign in as user B first',
  );

  // Step 2 — fetch user A's application id with user B's token.
  // Substitute the id captured in 5.1 for <USER_A_ID>.
  fetch('/api/applications/<USER_A_ID>', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  }).then(r => r.status);
  ```

- **Then** the response status is **`404`** — RLS-scoped: the row
  does not exist from user B's perspective. Other outcomes and
  what they mean:
  - **`401`** — the token was not attached correctly (likely
    `tokenKey` was wrong or the session expired). Re-confirm
    `session.access_token` is a non-empty JWT string and re-run.
    This is a checklist-setup issue, not a defect.
  - **`200`** — RLS is misconfigured. Cross-user reads are
    leaking. **Stop the run and remediate before promoting.**
  - **`403`** — a server-side filter is rejecting after the row
    was visible at the database level. Still a defense-in-depth
    pass (no data leaked), but worth flagging because the
    contract is 404. Note in the capture and continue.

---

## 6. Resume import restrictions

Confirms feature 020's demo gates and feature 021's hosted security
both behave as documented.

### 6.1 Demo mode hides resume import

- **Given** the demo session (Section 2), open the Profile page,
  click **Edit**.
- **When** I scroll through the edit surface looking for the
  Resume Import controls.
- **Then** the Resume Import UI is **hidden** — the
  `VISIBLE_STATUSES` gate in `src/components/ResumeImport.js`
  excludes the demo status; the inline note branch in
  `src/pages/ProfileEdit.js` may surface an "available after sign
  in" message, but no upload control is rendered (feature 020).

### 6.2 Hosted authenticated mode allows resume import

- **Given** the user A session (signed in via Section 1), open the
  Profile page, click **Edit**.
- **When** I locate the Resume Import control and upload the small
  PDF/DOCX prepared in Prerequisites.
- **Then** the upload completes; parsed fields populate the form
  (name, contact info, structured sections per feature 014); the
  Network panel shows a `POST /api/resume/parse` with a `2xx`
  response and no parser-library internal text in the response
  body (feature 021).

### 6.3 Corrupted upload returns sanitized error

- **Given** the same Edit surface with user A.
- **When** I attempt to upload a `.pdf` file whose bytes are random
  garbage (or a `.docx` with a corrupted ZIP container).
- **Then** the UI surfaces a generic actionable message (e.g.
  *"Could not read this resume. Try a different file."*); the
  Network panel shows a `400 PARSE_FAILED` response with no raw
  library name, file offset, or stack trace in the body (feature
  021).

---

## 7. Mobile layout sanity (375px)

Confirms the constitution Amendment 1.1.0 mobile-viewport
requirement against the deployed runtime.

### 7.1 Navbar + tracker at 375px

- **Given** Chrome DevTools open at the **375px** iPhone preset (or
  equivalent narrow mobile width).
- **When** I navigate welcome → tracker → application detail modal.
- **Then** the navbar adapts to the narrow viewport (no horizontal
  scroll, hamburger or collapsed layout as designed); the card list
  stacks single-column; the application detail modal is full-screen
  or near-full and remains usable; all interactions work with
  touch/click.

### 7.2 Profile chart fallback

- **Given** the 375px viewport from 7.1, signed in.
- **When** I open the Profile page (with at least one application
  on record so the stats render — sign in as the demo user or as a
  hosted user with starter data).
- **Then** the **stacked bar** chart renders (mobile fallback) in
  place of the desktop donut chart; the section is readable and
  scrollable without horizontal overflow.

### 7.3 Profile edit overlays

- **Given** the 375px viewport, signed in.
- **When** I open Profile → Edit, open one structured section's
  Add overlay (e.g. **Add Experience**).
- **Then** the overlay renders as a bottom-sheet or full-screen
  modal; the focus trap works; the discard guard from 4.2 still
  fires when I attempt to dismiss with unsaved changes.

---

## After the walk-through

If every section passes, capture the result in the PR description
and proceed with promotion. If any step fails:

1. Stop the walk.
2. Diagnose: is the failure runtime (file a bug or revert), docs
   (file a doc patch), or a free-tier pause/cold-start (wait and
   re-run from the failing step)?
3. Do not promote a partial pass — fix or defer with documented
   rationale.

See [`docs/deployment.md`](deployment.md) for the full operator
deployment guide, including the
[Supabase Setup Checklist](deployment.md#supabase-setup-checklist)
this smoke test pairs with for pre-promotion verification.
