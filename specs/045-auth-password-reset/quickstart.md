# Quickstart: Hosted Password Management

**Feature**: [plan.md](./plan.md) · **Date**: 2026-07-10

How to build and verify 045. All three workflows are **hosted-only**; a plain local checkout has no Welcome page and no Change Password control to exercise (US-5).

---

## Prerequisites

- A hosted (Vercel + Supabase) deployment, or a local `npm run dev` pointed at a real Supabase test project via `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `VITE_AUTH_EMAIL_REDIRECT_URL` — Forgot/Reset Password cannot be exercised against a mocked client alone; a real recovery email round-trip is needed at least once (see research.md D1's verification note).
- A Supabase project with email delivery configured (or access to the Supabase dashboard's "view email" / magic-link log for a project that doesn't send real email in dev).
- Node deps installed (`npm install`).

## Commands

```bash
npm run test:run     # Vitest unit/integration (authStore, AuthOverlay, forms, server routes)
npm run lint         # eslint (no `npm run format` exists in this repo)
npm run dev          # local dev against a real or mocked Supabase project
```

## Per-phase verification walkthrough

- **WS1 (authStore foundation)**: unit-test the recovery-URL guard directly (simulate a `type=recovery` URL + an `INITIAL_SESSION` then `PASSWORD_RECOVERY` event pair — the real auth-js sequence per research.md D1's source-verified finding; confirm `authStore` never transiently resolves `authenticated`). The event-ordering logic itself has been checked against the installed `@supabase/auth-js` source (Phase 01, 2026-07-10) — what's still needed is a real recovery-link click against a test Supabase project to confirm the live end-to-end path (email delivery, redirect URL, browser) before WS4 is built on top of it.
- **WS2 (Change Password)**: signed in on a hosted deploy, Settings → Account → "Change password". Submit with the correct current password + a valid new password → success toast, overlay closes, sign out, sign back in with the new password → succeeds. Submit with the wrong current password → inline error, overlay stays open. Enter Demo Mode → confirm no active Change Password control.
- **WS3 (Forgot Password)**: Welcome → sign-in form → "Forgot password?" → enter a registered email → generic confirmation. Repeat with an unregistered (but valid-format) email → identical confirmation copy. Enter a malformed email → inline validation error, no request sent.
- **WS4 (Reset Password + expired link)**: open the real recovery email's link → Reset Password overlay (not the login form) → submit a new password + confirmation → success toast → lands on standard logged-out Welcome/login → sign in with the new password succeeds. Separately, open an already-used or manually-expired link → dedicated "This reset link has expired" state on load, with a path back to Forgot Password.

## Definition of done (feature)

- All Independent Tests (US-1 through US-6 in [spec.md](./spec.md)) pass in a real browser against the to-be-merged state, including the one real recovery-link round-trip.
- `npm run test:run` and `npm run lint` clean.
- Local Mode: confirmed no Welcome page, no Forgot Password link, no Change Password control anywhere.
- Demo Mode: confirmed no active Change Password control.
- Release Prep done (version bump, CHANGELOG, README, roadmap tick, REPO_MAP for new files, `docs/deployment.md` only if a new env var was actually introduced per research.md D4).
