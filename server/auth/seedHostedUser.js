import { createSupabaseClientForRequest } from '../repositories/supabase/client.js';

/**
 * First-call seeding middleware for hosted mode.
 *
 * Calls one Supabase RPC — `claim_and_seed_starter()` — which atomically
 * claims the per-user seed marker and (on first claim) inserts the starter
 * applications inside a single Postgres transaction. The RPC body is
 * defined in `specs/019-supabase-persistence/data-model.md §5` and runs as
 * `SECURITY INVOKER`, so RLS enforces that the seeded rows are scoped to
 * `auth.uid()` regardless of any input.
 *
 * Returns boolean:
 *   - `true`  on first call — marker inserted, rows inserted.
 *   - `false` on subsequent calls — marker already existed, no-op.
 *
 * Failure semantics (FR-013, FR-014): the RPC's PL/pgSQL body is one
 * transaction. A failure mid-body rolls back the marker INSERT and any
 * partial row INSERTs together. The next request from the same user
 * re-enters `claim_and_seed_starter()` cleanly because no marker was
 * committed.
 *
 * Mounted **conditionally** by `server/index.js` — only when
 * `config.isHosted === true`. This middleware does NOT branch on config
 * itself; local + demo modes simply skip mounting it.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} _res
 * @param {(err?: unknown) => void} next
 */
export async function seedHostedUserIfNeeded(req, _res, next) {
  try {
    const client = req.supabase ?? createSupabaseClientForRequest(req);
    const { error } = await client.rpc('claim_and_seed_starter');
    if (error) {
      return next(error);
    }
    // `data` is true on first call, false thereafter. We don't branch on
    // it — the middleware's job is to ensure seeding happens at-most-once
    // per user before route handlers run.
    return next();
  } catch (err) {
    return next(err);
  }
}
