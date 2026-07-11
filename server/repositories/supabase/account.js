const PASSWORD_MIN = 8;

/**
 * Per-request Supabase adapter for hosted account deletion and password
 * changes (feature 045).
 *
 * Unlike the `applications` / `profile` adapters, this one does NOT use the
 * caller's per-request JWT client. Both operations need two privileged
 * steps the JWT client cannot perform on its own:
 *   1. Re-verify the caller's password (anon client + `signInWithPassword`).
 *   2. Mutate the auth user (service-role admin client — delete or update).
 *
 * Both `@supabase/supabase-js` and the service-role `adminClient.js` are
 * imported **lazily inside each method** so that merely constructing this
 * adapter (which happens per request via the dispatcher) never loads the
 * service-role client until a mutation actually runs (FR-009).
 *
 * @param {{ userId: string, email: string }} identity — from `req.user`.
 * @returns {{
 *   delete: (body: { password?: string }) => Promise<{ deleted: true }>,
 *   changePassword: (body: { currentPassword?: string, newPassword?: string }) => Promise<{ updated: true }>,
 * }}
 */
export function createSupabaseAccountRepository({ userId, email } = {}) {
  async function verifyPassword(password) {
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
      // treating it as an expired session (FR-005 / feature 045 FR-4).
      throw Object.assign(new Error('Incorrect password.'), {
        code: 'INVALID_PASSWORD',
        status: 401,
      });
    }
  }

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
    await verifyPassword(password);

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

  // Feature 045 (Change Password, FR-4/FR-5). Mirrors deleteAccount's
  // two-step shape exactly (anon-client re-verify, then a privileged
  // service-role mutation) rather than introducing a second privilege
  // model — see specs/045-auth-password-reset/research.md D2.
  async function changePassword(body) {
    const currentPassword = body?.currentPassword;
    const newPassword = body?.newPassword;
    if (!currentPassword || !newPassword) {
      throw Object.assign(new Error('Current and new password are required.'), {
        code: 'VALIDATION_ERROR',
        status: 400,
      });
    }
    // Code-review finding (2026-07-11): the presence check above passes for
    // any truthy value, not just strings — an array or object body (e.g.
    // `{ newPassword: { length: 20 } }`) would sail through it and the
    // `.length` check below, then reach the Supabase admin call in an
    // inconsistent shape, turning what should be a deterministic 400 here
    // into provider-defined behavior. This is public API surface (the
    // change-password route); reject malformed types itself rather than
    // deferring to whatever Supabase happens to do with them.
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      throw Object.assign(new Error('Current and new password must be strings.'), {
        code: 'VALIDATION_ERROR',
        status: 400,
      });
    }
    if (newPassword.length < PASSWORD_MIN) {
      throw Object.assign(
        new Error(`Password must be at least ${PASSWORD_MIN} characters.`),
        { code: 'VALIDATION_ERROR', status: 400 },
      );
    }

    // 1. Re-verify the current password against the caller's own credentials.
    await verifyPassword(currentPassword);

    // 2. Update the password with the service-role admin client.
    const { createSupabaseAdminClient } = await import('./adminClient.js');
    const admin = createSupabaseAdminClient();
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (updateError) {
      throw updateError; // route maps to 500 INTERNAL_ERROR
    }

    return { updated: true };
  }

  return { delete: deleteAccount, changePassword };
}
