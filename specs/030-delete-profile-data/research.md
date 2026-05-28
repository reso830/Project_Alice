# Research: Delete Profile & User Data (030)

**Branch**: `030-delete-profile-data` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Non-obvious decisions and the alternatives considered. Each entry records what was chosen, why, and what was rejected, so the reasoning is not re-derived during implementation.

---

## R-1 — Delete the auth user and rely on cascade (not manual per-table deletes)

**Decision**: Hosted deletion calls `supabase.auth.admin.deleteUser(userId)` (service role). The existing `ON DELETE CASCADE` foreign keys on `applications.user_id`, `profile.user_id`, and `user_seed_state.user_id` (all `REFERENCES auth.users(id) ON DELETE CASCADE`, per [019 data-model §5](../019-supabase-persistence/data-model.md)) remove every owned row automatically, in one atomic database operation.

**Why**: One operation, no ordering bugs, no risk of leaving orphans (FR-008, SC-002). It also removes the account itself, freeing the email for re-signup, which a data-only delete would not.

**Rejected alternatives**:
- *Manual `DELETE FROM applications/profile/user_seed_state WHERE user_id = …` then `deleteUser`*: more code, more failure surface, and the cascade already does it. Only needed if cascade were absent — it is not.
- *Data-only delete (keep the auth account)*: rejected at `/speckit.clarify` — leaves the user signed in to an empty app, does not free the email, contradicts "permanent / lifecycle complete".

---

## R-2 — Verify the password server-side via `signInWithPassword`

**Decision**: The delete endpoint re-verifies the submitted password by constructing a throwaway anon Supabase client and calling `auth.signInWithPassword({ email, password })`, where `email` is the `req.user.email` JWT claim. Success → proceed to admin delete; failure → `401 INVALID_PASSWORD`, nothing deleted.

**Why**: GoTrue has no dedicated "verify password" endpoint; `signInWithPassword` is the standard way to confirm a password. Server-side verification means a stolen/leaked JWT alone cannot delete the account (clarify decision; FR-004, FR-007a). Auth is **email+password only** ([`src/pages/welcome/LoginForm.js`](../../src/pages/welcome/LoginForm.js)), so every account has a password and this is universally applicable.

**Notes / constraints**:
- Use `auth: { persistSession: false, autoRefreshToken: false }` on the verification client so the transient sign-in session is never stored.
- The password MUST NOT be logged (FR-007a).
- The error returned MUST be distinguishable from an expired-session 401 so the client does not misroute (FR-005) — use a distinct `INVALID_PASSWORD` code.

**Rejected alternatives**:
- *Client-only verification* (call `signInWithPassword` in the browser, then call a JWT-only delete endpoint): the password becomes pure UX friction — anyone with the JWT could call the endpoint directly. Rejected at `/speckit.clarify`.
- *Both client + server*: server check is sufficient and authoritative; a client pre-check is optional polish, not required.

---

## R-3 — Do NOT mount `seedHostedUserIfNeeded` on the delete route

**Decision**: The `account` router mounts `requireAuth` + `attachRepos` but **not** `seedHostedUserIfNeeded`.

**Why**: That middleware runs `claim_and_seed_starter()` before the handler on the applications/profile/resume routers. On the delete path it is at best wasteful (re-seeding a user about to be deleted) and conceptually wrong. Omitting it keeps deletion clean.

**Related finding** (drives R-4): on *other* routes, after an account is deleted, this middleware is exactly what makes a stale-token request fail — its insert hits the `auth.users` FK constraint (the row is gone) and returns **500**, not a clean 401. This is why cross-device detection cannot rely on a 401 alone.

---

## R-4 — Cross-device reroute: eventual + on-failure revalidation, not per-request checks

**Decision**: For non-acting sessions (FR-011a/b):
1. **On failure** — when an authenticated request fails, the client calls `supabase.auth.getUser()` once; if it reports the account is gone, clear the session and route to Welcome with a message.
2. **Eventually (idle device)** — when the stale access token expires and refresh fails (Supabase revokes refresh tokens on `deleteUser`), the existing `authStore.onAuthStateChange` fires `SIGNED_OUT` and routes to Welcome.

**Why**: Supabase access tokens (JWTs) are stateless and pass `requireAuth` (signature + expiry only — no user-existence check) until they expire (~1h default). An immediate, guaranteed cross-device logout would require checking user existence on **every** authenticated request — a DB/Admin lookup per request across the whole app. That cost was judged overkill at `/speckit.clarify`. The chosen approach gives a clean reroute the moment a stale device actually does anything, plus an eventual catch-all for idle devices, at the cost of one extra `getUser()` call only on failed requests.

**Concurrent-edit example** (the scenario raised during planning): device 1 deletes; device 2 edits an application. Device 2's PATCH carries a valid JWT → `requireAuth` passes → `seedHostedUserIfNeeded` re-seed attempt hits the FK constraint → **500**; even without the seed middleware the `UPDATE … WHERE user_id = auth.uid()` matches 0 rows → 404. Either way the edit does not save, and `handleAuthFailure()` revalidates and reroutes device 2 cleanly.

**Known limitation**: an idle non-acting device that issues no request stays on a stale view until its token lifetime elapses. Accepted (FR-011b).

**Rejected alternatives**:
- *Per-request user-existence check in `requireAuth`*: guarantees instant logout but adds latency + an Admin/DB call to every authenticated request. Rejected.
- *Acting-device-only (best effort)*: leaves other devices showing a stale UI with raw errors; the user explicitly chose to build proactive handling.

---

## R-5 — Endpoint shape: `DELETE /api/account`

**Decision**: A single `DELETE /api/account` endpoint, runtime-polymorphic via the `account` repository's uniform `delete(body)` method (hosted: verify password + admin-delete; local: verify `confirm` token + clear all data).

**Why**: REST-semantically a deletion; `/account` reads as "the current user's account" (scoped by JWT in hosted, single-user in local) and needs no `:id` (a user can only delete *their own* account — FR-006). Mirrors the existing pattern where the route handler stays runtime-agnostic and the dispatcher supplies the right adapter.

**Notes**: `DELETE` with a request body (`{ password }`) is unusual but well-supported by `express.json()` and `fetch`. If body-on-DELETE proves awkward in testing, `POST /api/account/delete` is an acceptable fallback (same handler logic) — decided at implementation, does not change the spec.

**Rejected alternatives**:
- *`DELETE /api/profile`*: misleading — this deletes the whole account, not just the profile row.
- *Reusing a generic resource route*: there is no existing "account" resource; a dedicated route is clearest.

---

## R-6 — Local "Clear all data" needs a new endpoint path, not the CLI script

**Decision**: Local mode clears data through the same `DELETE /api/account` endpoint → the local adapter's uniform `delete(body)` method → a single SQLite transaction deleting all `applications` and `profile` rows. The method name is `delete(body)` (not `clearAll()`) so the route can call one runtime-agnostic method across both adapters; "clear all" describes the local behavior, not the method name.

**Why**: The existing `server/db-clear.js` is a one-shot CLI script (top-level execution + `process.exit`), not a reusable function, and there is no runtime "clear" repository method today. A repository method keeps the logic testable and consistent with the adapter contract.

**Server-side confirmation gate**: the local `delete(body)` MUST require `body.confirm === 'DELETE'` (else `400 VALIDATION_ERROR`) before clearing. The typed-`DELETE` gate is therefore enforced at the API boundary, not by the UI alone — a stray or empty `DELETE /api/account` cannot silently wipe local data. Local mode has no auth, so this is the only server-side guard on an irreversible op; the small cost is justified by the data-integrity principle (Constitution III). It is not a security control (local is single-user, localhost) but an accidental-destruction guard symmetric with the hosted password gate.

**Scope notes**:
- Local profile is a single-row table ([`server/db/profile.js`](../../server/db/profile.js)); clearing deletes that row.
- No auto re-seed after clear (spec D2) — the user lands on the existing empty states.
- The deprecated `localStorage` legacy store (`src/data/store.js`, used only as a warm-up in `main.js`) is **not** the data source in any supported mode; whether to also clear it is an implementation nicety, not a requirement.

---

## R-7 — Demo mode: visible-but-disabled, satisfy the no-fetch invariant

**Decision**: In demo mode the Account control renders disabled with explanatory copy; `api.deleteAccount` still gets a demo branch that performs **no** `fetch` (it rejects with a "not available in demo" error) to satisfy the canonical `tests/services/api.demo.test.js` invariant, even though the disabled control means the path is not user-reachable.

**Why**: Feature 020's seam requires every `api.js` export to have a demo branch with a no-fetch assertion. Showing the control communicates the capability to portfolio visitors without acting on the auth-less in-memory session (FR-018, FR-019).
