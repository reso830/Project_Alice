/**
 * Per-request Supabase adapter for hosted account deletion.
 *
 * Unlike the `applications` / `profile` adapters, this one does NOT use the
 * caller's per-request JWT client. Account deletion needs two privileged
 * operations the JWT client cannot perform:
 *   1. Re-verify the caller's password (anon client + `signInWithPassword`).
 *   2. Delete the auth user (service-role admin client).
 *
 * Both `@supabase/supabase-js` and the service-role `adminClient.js` are
 * imported **lazily inside `delete()`** so that merely constructing this
 * adapter (which happens per request via the dispatcher) never loads the
 * service-role client until a deletion actually runs (FR-009).
 *
 * @param {{ userId: string, email: string }} identity — from `req.user`.
 * @returns {{ delete: (body: { password?: string }) => Promise<{ deleted: true }> }}
 */
export function createSupabaseAccountRepository({ userId, email } = {}) {
  async function deleteAccount(body) {
    const password = body?.password;
    if (!password) {
      throw Object.assign(new Error('Password is required.'), {
        code: 'VALIDATION_ERROR',
        status: 400,
      });
    }

    // 1. Re-verify the password against the caller's own credentials. A
    //    valid JWT alone is not enough to delete the account (FR-007a).
    const { createClient } = await import('@supabase/supabase-js');
    const anon = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error: signInError } = await anon.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      // Distinct code so the client shows a password error rather than
      // treating it as an expired session (FR-005).
      throw Object.assign(new Error('Incorrect password.'), {
        code: 'INVALID_PASSWORD',
        status: 401,
      });
    }

    // 2. Delete the auth user with the service-role admin client. The
    //    ON DELETE CASCADE FKs remove applications, profile, and the seed
    //    marker (data-model.md §1).
    const { createSupabaseAdminClient } = await import('./adminClient.js');
    const admin = createSupabaseAdminClient();
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      throw deleteError; // route maps to 500 INTERNAL_ERROR
    }

    return { deleted: true };
  }

  return { delete: deleteAccount };
}
