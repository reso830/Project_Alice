import { createClient } from '@supabase/supabase-js';

/**
 * Construct a per-request Supabase client initialized with the caller's JWT.
 *
 * The returned client carries the caller's `Authorization: Bearer <jwt>` on
 * every PostgREST request, which makes Supabase apply Row Level Security as
 * the authenticated user. RLS is the primary ownership-enforcement layer for
 * 019; server-side `.eq('user_id', userId)` filters in the adapters layer
 * defense on top of it.
 *
 * Constraints:
 * - Per request, never cached. No module-level state.
 * - The JWT itself is NOT validated here — 018's `requireAuth` middleware
 *   (`server/auth/middleware.js`) is the verification layer and must run
 *   before this factory is invoked.
 * - `SUPABASE_SERVICE_ROLE_KEY` is NOT read here. 019 application code uses
 *   only the anon key + per-request JWT at runtime.
 *
 * @param {import('express').Request} req
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createSupabaseClientForRequest(req) {
  const authorization = req.headers?.authorization;
  if (!authorization) {
    throw new Error(
      'createSupabaseClientForRequest called without Authorization header',
    );
  }

  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
