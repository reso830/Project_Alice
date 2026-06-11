import { Router } from 'express';
import { attachRepos } from '../repositories/middleware.js';
import { resolveRequestDate } from '../middleware/requestDate.js';
import { recomputeActive } from '../services/compatibility.js';
import { validateProfile } from '../../src/models/profile.js';

/**
 * @param {{
 *   repos: { forRequest: (req: any) => any },
 *   requireAuth?: import('express').Handler,
 *   seedHostedUserIfNeeded?: import('express').Handler,
 * }} deps
 */
export function createProfileRouter({
  repos,
  requireAuth,
  seedHostedUserIfNeeded,
} = {}) {
  if (!repos) {
    throw new Error(
      'createProfileRouter: `repos` (dispatcher with forRequest(req)) is required',
    );
  }

  const router = Router();

  if (requireAuth) {
    router.use(requireAuth);
  }
  router.use(attachRepos(repos));
  if (seedHostedUserIfNeeded) {
    router.use(seedHostedUserIfNeeded);
  }

  router.get('/', async (req, res, next) => {
    try {
      return res.status(200).json({ data: await req.repos.profile.get() });
    } catch (error) {
      return next(error);
    }
  });

  router.put('/', async (req, res, next) => {
    try {
      const result = validateProfile(req.body);
      if (!result.valid) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            fields: result.errors,
          },
        });
      }

      const saved = await req.repos.profile.upsert(req.body);
      await recomputeActive(req.repos, saved, resolveRequestDate(req));

      return res.status(200).json({ data: saved });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
