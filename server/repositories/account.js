/**
 * SQLite (local mode) account adapter.
 *
 * Local mode is single-user with no auth and no account to delete — the
 * "account" operation is a full data clear. The uniform `delete(body)`
 * method name matches the hosted adapter so the route handler stays
 * runtime-agnostic.
 *
 * The `confirm` token gates the destructive clear at the API boundary
 * (not UI-only): a stray or empty request cannot wipe local data
 * (FR-005 / research.md R-6).
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {{
 *   delete: (body: { confirm?: string }) => { cleared: true },
 *   changePassword: () => never,
 * }}
 */
export function createSqliteAccountRepository(db) {
  function deleteAccount(body) {
    if (body?.confirm !== 'DELETE') {
      throw Object.assign(new Error('Confirmation required.'), {
        code: 'VALIDATION_ERROR',
        status: 400,
      });
    }

    const clear = db.transaction(() => {
      db.prepare('DELETE FROM applications').run();
      db.prepare('DELETE FROM profile').run();
    });
    clear();

    return { cleared: true };
  }

  // Feature 045: Local Mode has no hosted account, so there is no password
  // to change. The Settings UI never renders the control here (gated on
  // `resolveAccountMode()`), so this is defense-in-depth for a stray/direct
  // request on a local or portable deployment, not a real user path — see
  // specs/045-auth-password-reset/contracts/api.md §1.
  function changePassword() {
    throw Object.assign(new Error('Password change is not available in this mode.'), {
      code: 'NOT_SUPPORTED',
      status: 501,
    });
  }

  return { delete: deleteAccount, changePassword };
}
