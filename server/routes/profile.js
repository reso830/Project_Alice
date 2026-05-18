import { Router } from 'express';
import { validateProfile } from '../../src/models/profile.js';

export function createProfileRouter({ repo, requireAuth } = {}) {
  const router = Router();

  if (requireAuth) {
    router.use(requireAuth);
  }

  router.get('/', (_req, res, next) => {
    try {
      return res.status(200).json({ data: repo.get() });
    } catch (error) {
      return next(error);
    }
  });

  router.put('/', (req, res, next) => {
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

      return res.status(200).json({ data: repo.upsert(req.body) });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
