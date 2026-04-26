import { Router } from 'express';
import { create, getAll, getById } from '../db/applications.js';
import { createSchema, toApiError } from '../validation/application.js';

export function createApplicationsRouter({ db } = {}) {
  const router = Router();

  router.post('/', (req, res, next) => {
    try {
      const result = createSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            fields: toApiError(result.error),
          },
        });
      }

      const record = create(result.data, db);
      return res.status(201).json({ data: record });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/', (_req, res, next) => {
    try {
      return res.status(200).json({ data: getAll(db) });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/:id', (req, res, next) => {
    try {
      const record = getById(parseInt(req.params.id, 10), db);
      if (!record) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Application not found',
          },
        });
      }

      return res.status(200).json({ data: record });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

const router = createApplicationsRouter();

export default router;
