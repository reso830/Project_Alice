import { Router } from 'express';
import { getProfile, saveProfile } from '../db/profile.js';
import { validateProfile } from '../../src/models/profile.js';

export function createProfileRouter({ db } = {}) {
  const router = Router();

  router.get('/', (_req, res, next) => {
    try {
      return res.status(200).json({ data: getProfile(db) });
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

      return res.status(200).json({ data: saveProfile(req.body, db) });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
