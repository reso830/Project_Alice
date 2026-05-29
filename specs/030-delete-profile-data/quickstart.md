# Quickstart: Delete Profile & User Data (030)

**Branch**: `030-delete-profile-data` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Dev setup and manual test steps for the deletion feature, plus the gotchas specific to this work.

---

## Prerequisites

- Node + npm installed; `npm install` done.
- **Hosted testing** requires a Supabase project with the 019 schema applied (cascade FKs present) and these env vars set:
  - `APP_RUNTIME=hosted`
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (the service-role key is now used at **runtime** for the admin delete — first feature to do so).
  - Vite client env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **Local testing** needs no Supabase — `APP_RUNTIME` unset/`local` uses SQLite.

> ⚠ Use a **disposable test account** for hosted deletion — it is permanent and irreversible. After a successful delete the account is gone; re-signup with the same email starts fresh.

---

## Run

```bash
# Local mode (SQLite) — no Supabase needed
npm run dev            # or the project's combined client+server dev script

# Hosted mode — set the env vars above first
APP_RUNTIME=hosted npm run dev:server    # confirm boot passes the hosted schema check
```

---

## Manual test steps

### A. Hosted — delete account (US1/US2)
1. Sign in with a disposable account; create a couple of applications and a profile.
2. Profile page → scroll to the new **Account** section → **Delete account**.
3. In the modal, leave the password blank → destructive button stays disabled / submit blocked.
4. Enter a **wrong** password → confirm → error shown, nothing deleted (verify your apps/profile still there).
5. Enter the **correct** password → confirm → you are signed out and land on the **Welcome** page; toast `Account deleted.`.
6. Verify in Supabase (SQL editor): `SELECT count(*) FROM applications WHERE user_id = '<old id>'` → 0; same for `profile` and `user_seed_state`; the `auth.users` row is gone.
7. Sign up again with the same email → succeeds, fresh empty account (re-seeds the 019 starter rows on first request).

### B. Local — clear all data (US3)
1. In local mode, ensure some seeded applications + a profile exist.
2. Profile → **Account** → **Clear all data**.
3. Type something other than `DELETE` → button stays disabled. Type `DELETE` → button enables.
4. Confirm → toast `All data cleared.`; Tracker shows the empty state; Profile shows "No profile set up yet."; you remain in the app (no Welcome redirect).

### C. Demo — disabled control (US4)
1. From Welcome, enter the demo.
2. Profile → **Account** → the delete control is visible but **disabled**, with copy explaining it applies to a real hosted account.
3. Activating it does nothing and issues no network request (check the Network tab).

### D. Cross-device reroute (US5)
1. Sign in to the same hosted account in two browsers (A and B).
2. Delete the account from A (steps in §A).
3. In B, do something authenticated (e.g. edit an application). The action fails and B reroutes to **Welcome** with a "your account no longer exists" message (FR-011a revalidation).
4. (Idle path) Alternatively leave B idle; when its access token expires and refresh fails, B reroutes to Welcome (FR-011b) — bounded by token lifetime (~1h).

---

## Tests

```bash
npm test                     # full suite
npm test -- account          # the new endpoint/adapter tests (filter by name)
npm run lint && npm run format
```

Expect new tests under `tests/server/routes/`, `tests/server/repositories/`, `tests/services/`, `tests/data/`, `tests/pages/` (see plan.md § Tests likely to be added).

---

## Common issues / gotchas

- **Hosted boot fails**: `SUPABASE_SERVICE_ROLE_KEY` missing → `server/config.js` already requires it in hosted mode; the server refuses to start. Set it.
- **Delete returns 500 instead of deleting**: check the admin client uses the **service-role** key (not the anon/JWT client) — only the service role can call `auth.admin.deleteUser`.
- **Password always rejected**: confirm the verification client uses the account's real email (`req.user.email` from the JWT) and `persistSession: false`; confirm the account is password-based (it always is — auth is password-only).
- **Other device shows a raw 500 instead of rerouting**: confirm the `api.js` auth-failure hook is wired and `authStore.handleAuthFailure()` calls `getUser()` and signs out on a deleted account. Remember the stale device's JWT stays valid until expiry — instant logout for an *idle* device is out of scope (documented limitation FR-011b).
- **Re-seed during delete**: if you see the seed RPC running on the delete request, the `account` router has `seedHostedUserIfNeeded` mounted by mistake — remove it (research.md R-3).
- **Service-role key leaking client-side**: never import the admin client from anything that ends up in the Vite bundle; it is server-only and lazy-imported on the delete path (SC-008).
