# Quickstart — Portfolio Demo Mode (020)

This walkthrough verifies the demo end-to-end. It runs in two modes:

- **Local dev** (`npm run dev`) — exercises the demo's client-side code
  paths against the local server. Use this for fast iteration.
- **Hosted** (the deployed Vercel preview / production) — exercises the
  full path including the production bundle and 018's `requireAuth` as
  defense in depth.

The demo is purely client-side, so behavior is identical in both modes
except where noted.

---

## 0. Prerequisites

- Node ≥ 20.19.0, npm.
- The repo is on branch `020-portfolio-demo-mode` (or a build that
  includes 020).
- For hosted verification: a Vercel preview URL or the production URL,
  plus a second browser window where you can sign in as a real hosted
  user (post-019).

---

## 1. Boot the app

### Local dev

```bash
npm install
npm run dev
```

Vite serves the app at the configured port (default `5173`). The local
Express API runs separately via `npm run dev:server` or the combined
script per `package.json`; the demo does not require the API to be up
(zero requests are made from inside the demo), but signing in or
exiting demo to authenticate would need it.

### Hosted

Open the deploy URL in a private/incognito window so no Supabase
session is restored.

---

## 2. Verify welcome → demo entry (US1)

1. The welcome page renders. Three CTAs are visible: **Sign In**,
   **Create Account**, **Try the demo**.
2. Click **Try the demo**.
3. Verify:
   - The welcome page unmounts.
   - The Tracker mounts with **23 sample applications** visible —
     the same set as the SQLite dev seed (`server/db-seed.js`), in the
     same order, with dates shifted so the most recent record reads as
     "today."
   - The seeded set spans the distinct status values present in the
     SQLite seed (applied, interview, etc.).
   - No "create account" or "sign in" prompt is required to enter.

✅ Pass criteria: SC-001.

---

## 3. Verify demo interactivity (US2)

Inside the demo:

1. Add a new application via the **+** FAB. Fill in the required
   fields (company, title, status, last status update, responsibilities).
   Submit. Verify:
   - It appears in the tracker immediately.
   - It can be edited and the edits stick within the session.
2. Click a card to edit. Change the status. Verify:
   - The change is reflected on the tracker.
   - Any status-based filter behaves correctly.
3. Archive a card. Verify it leaves the active list.
4. Go to **Profile**. Verify the seeded profile is populated.
5. Click **Edit profile**. Change a field. Save. Verify the change
   reflects on the Profile page after returning to it.

✅ Pass criteria: SC-002.

---

## 4. Verify zero-persistence (US3)

This is the central security/privacy check.

1. With the demo open, open DevTools → **Network**. Filter to `fetch`/
   `xhr`.
2. Repeat the actions from §3 (create, edit, archive, profile save).
3. Verify the network panel shows:
   - **Zero requests** to `/api/applications`, `/api/applications/:id`,
     `/api/profile`, or `/api/resume/parse`.
   - **Zero requests** to any Supabase host.
   - Requests to assets (HTML, JS, CSS, images) and `/api/health` may
     occur — these are not demo content.
4. Open DevTools → **Application** → **Storage**. Inspect:
   - `localStorage`: may contain `apptracker_filters` (filter
     preferences — OK) and `apptracker_applications` (legacy local-mode
     data — OK if pre-existing). MUST NOT contain any new key with
     demo application or profile content.
   - `sessionStorage`: should be empty for this app.
   - `IndexedDB`: should be empty for this app.
   - `Cookies`: may contain a Supabase auth cookie *if* the visitor
     was previously signed in on this device; otherwise empty. MUST
     NOT contain a new cookie introduced by the demo.

✅ Pass criteria: SC-003, SC-010.

---

## 5. Verify reset on refresh (US4)

1. Inside the demo, make a few clearly distinct edits (rename a
   company, archive one, save a different name in the profile).
2. Hard-refresh the page (Ctrl+R / Cmd+Shift+R).
3. Verify:
   - The welcome page renders (not the tracker).
   - Clicking **Try the demo** re-enters the demo with the original
     seeded data — none of the prior edits visible.

✅ Pass criteria: SC-004.

---

## 6. Verify auth surfaces are hidden inside demo (US1 / FR-006)

Inside the demo:

1. Verify the Navbar identity cluster shows **Exit demo** (and, if
   implemented per plan review, a "Demo mode" badge). It does **not**
   show **Sign in**, **Create account**, or an email.
2. Navigate to every primary tab (Tracker, Profile, Calendar). Verify
   no sign-in/sign-up surface appears anywhere inside the app shell.
3. Confirm there is no keyboard-reachable affordance that triggers
   sign-in from inside the demo. Tab through the Navbar and the
   tracker; the Exit demo button is the only auth-state-changing
   control.

✅ Pass criteria: SC-005.

---

## 7. Verify Resume Import gating (US5)

1. Inside the demo, navigate to Profile → **Edit profile**.
2. Verify:
   - The resume-import upload widget is **not** rendered.
   - In its place, a small inline note appears (e.g. "Sign in to use
     resume import").
3. Open DevTools → Network. Confirm no request is attempted to
   `/api/resume/parse`.
4. Exit the demo (Navbar **Exit demo**). Sign in as a real hosted user
   (post-019 setup). Navigate to Profile → Edit profile. Verify:
   - The resume-import widget renders normally.
   - Uploading a small test PDF triggers `POST /api/resume/parse` and
     receives a parsed profile in response.

✅ Pass criteria: SC-006.

---

## 8. Verify authenticated isolation (US6)

Requires two browsers (or one regular + one private window):

1. **Browser A**: sign in as a hosted user. Verify their existing
   applications and profile load (post-019 behavior). Note the
   contents.
2. **Browser B** (private/incognito): open the deploy. Click **Try the
   demo**. Inside the demo, perform every operation from §3.
3. **Browser A**: refresh the tracker and reload the profile. Verify:
   - The same applications and profile are present, **byte-equivalent**
     to step 1. Nothing the demo did affects them.
4. Sign out in Browser A. Sign back in. Verify the data is still
   intact.

✅ Pass criteria: SC-007, SC-008.

---

## 9. Verify exit + re-entry semantics

1. Inside the demo, make distinct edits. Click **Exit demo**.
2. Verify:
   - The welcome page renders.
   - The Navbar is gone.
3. Click **Try the demo** again.
4. Verify the seeded starting state is present — no leftovers from
   the prior session.

✅ Pass criteria: spec edge case "browser back/forward" (handled by
`exitDemo` clearing `demoStore`).

---

## 10. Verify the authenticated regression suite

Run the existing automated test suite:

```bash
npm test
```

Verify:

- All post-019 server-side tests pass without modification.
- All authenticated-path component tests pass without modification.
- New 020 tests (`authStore.demo.test.js`, `demoStore.test.js`,
  `api.demo.test.js`, `resumeApi.demo.test.js`,
  `ResumeImport.demo.test.js`, `Navbar.demo.test.js`,
  `ProfileEdit.demo.test.js`, updated `demoStub.test.js`) pass.

✅ Pass criteria: SC-009 (validation reuse — verified by the absence of
test failures in the shared `models/application.js` tests).

---

## 11. Failure modes to recognize

- **A new service function bypasses the demo branch**. Symptom:
  inside the demo, an action triggers a `fetch` to `/api/...` (visible
  in Network) and either fails with a 401 from `requireAuth` (showing
  a generic error toast) or, worse, succeeds silently. *Fix*: add the
  demo branch to the new service function; update the network-
  discipline test to include it.
- **`localStorage` shows demo content**. Symptom: an entry under a new
  key in localStorage contains demo applications or profile data.
  *Fix*: the new write site needs to be gated on demo status, or
  removed.
- **Refresh restores prior demo edits**. Symptom: after refresh,
  re-entering the demo shows edits from the prior session. *Fix*: a
  module is persisting demo state (likely a misconfigured store).
- **Exit demo doesn't return to welcome**. Symptom: clicking Exit
  demo leaves the app shell mounted. *Fix*: `authStore.exitDemo()` is
  not flipping status or `main.js#render` is not handling the new
  state correctly.

---

## 12. Operator notes

- **No deploy-time configuration changes**. Demo lives inside the
  existing `APP_RUNTIME=hosted` deploy. No new env vars.
- **`APP_RUNTIME=demo` is no longer recognized.** 019 reserved this
  value for a server-side demo backend, but with 020's client-only
  design that slot was deleted. Setting `APP_RUNTIME=demo` on any
  deploy now produces the standard "Invalid APP_RUNTIME" startup error
  naming the two valid values (`local`, `hosted`). Operators should
  set `APP_RUNTIME=hosted` on hosted deploys and leave it unset (or
  `local`) for local development.
- **Demo is always on**. There is no admin-side feature flag to
  disable the demo CTA. Removing the demo would require code changes
  (revert this feature). Document in plan review if a kill-switch is
  desired; the spec does not require one.
