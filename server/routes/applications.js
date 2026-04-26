import { Router } from 'express';
import { archive, create, getAll, getById, update } from '../db/applications.js';
import { createSchema, toApiError, updateSchema } from '../validation/application.js';

function parseIdParam(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function sendInvalidId(res) {
  return res.status(400).json({
    error: {
      code: 'BAD_REQUEST',
      message: 'Invalid id',
    },
  });
}

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
      const id = parseIdParam(req.params.id);
      if (id === null) {
        return sendInvalidId(res);
      }

      const record = getById(id, db);
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

  router.patch('/:id', (req, res, next) => {
    try {
      const id = parseIdParam(req.params.id);
      if (id === null) {
        return sendInvalidId(res);
      }

      const result = updateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            fields: toApiError(result.error),
          },
        });
      }

      const record = update(id, result.data, db);
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

  router.post('/:id/archive', (req, res, next) => {
    try {
      const id = parseIdParam(req.params.id);
      if (id === null) {
        return sendInvalidId(res);
      }

      const record = archive(id, db);
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
