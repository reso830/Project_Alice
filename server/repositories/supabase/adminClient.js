import { createClient } from '@supabase/supabase-js';

/**
 * Construct a Supabase client authenticated with the **service-role** key.
 *
 * Unlike `client.js` (which carries the caller's JWT and runs under RLS),
 * this client bypasses RLS by design and can call the GoTrue Admin API
 * (`auth.admin.deleteUser`). It is therefore **server-only** and MUST NEVER
 * be imported into any module that reaches the Vite client bundle.
 *
 * Constraints:
 * - Lazy-imported only on the account-deletion path (see
 *   `./account.js`); never loaded on local-mode boot.
 * - Per call, no module-level state. `SUPABASE_SERVICE_ROLE_KEY` is already
 *   required in hosted mode by `server/config.js`, so it is not re-validated
 *   here.
 *
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
