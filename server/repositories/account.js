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
 * @returns {{ delete: (body: { confirm?: string }) => { cleared: true } }}
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

  return { delete: deleteAccount };
}
