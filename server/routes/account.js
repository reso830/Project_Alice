import { Router } from 'express';
import { attachRepos } from '../repositories/middleware.js';

/**
 * `DELETE /api/account` — permanently delete the caller's account (hosted)
 * or clear all local data (local). Runtime-polymorphic via the `account`
 * repository; the handler does not branch on `config.runtime`.
 *
 * NOTE: `seedHostedUserIfNeeded` is intentionally NOT mounted here — the
 * delete path must never trigger a re-seed (research.md R-3).
 *
 * @param {{
 *   repos: { forRequest: (req: any) => any },
 *   requireAuth?: import('express').Handler,
 * }} deps
 */
export function createAccountRouter({ repos, requireAuth } = {}) {
  if (!repos) {
    throw new Error(
      'createAccountRouter: `repos` (dispatcher with forRequest(req)) is required',
    );
  }

  const router = Router();

  if (requireAuth) {
    router.use(requireAuth);
  }
  router.use(attachRepos(repos));

  router.delete('/', async (req, res, next) => {
    try {
      // Pass the whole body — hosted reads `password`, local reads `confirm`.
      // The password/confirm is never logged (FR-022 / FR-007a).
      const result = await req.repos.account.delete(req.body ?? {});
      return res.status(200).json({ data: result });
    } catch (err) {
      if (err && typeof err.status === 'number') {
        return res.status(err.status).json({
          error: { code: err.code, message: err.message },
        });
      }
      return next(err);
    }
  });

  // Feature 045 (Change Password). Hosted only in practice — the local
  // adapter's `changePassword()` unconditionally throws NOT_SUPPORTED — but
  // the route itself stays runtime-agnostic like `DELETE /`, dispatched
  // through `req.repos.account`. currentPassword/newPassword are never
  // logged, matching `DELETE /`'s handling of password/confirm above.
  router.patch('/password', async (req, res, next) => {
    try {
      const result = await req.repos.account.changePassword(req.body ?? {});
      return res.status(200).json({ data: result });
    } catch (err) {
      if (err && typeof err.status === 'number') {
        return res.status(err.status).json({
          error: { code: err.code, message: err.message },
        });
      }
      return next(err);
    }
  });

  return router;
}
