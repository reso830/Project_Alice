import { Router } from 'express';
import { isValidTransition, TERMINAL_STATES } from '../../shared/constants.js';
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

function sendStatusValidationError(res, message) {
  return res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      fields: {
        status: message,
      },
    },
  });
}

function sendNotFound(res) {
  return res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Application not found',
    },
  });
}

export function createApplicationsRouter({ repo } = {}) {
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

      const record = repo.create(result.data);
      return res.status(201).json({ data: record });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/', (_req, res, next) => {
    try {
      return res.status(200).json({ data: repo.getAll() });
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

      const record = repo.getById(id);
      if (!record) {
        return sendNotFound(res);
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

      if (result.data.status !== undefined) {
        const currentRecord = repo.getById(id);
        if (!currentRecord) {
          return sendNotFound(res);
        }

        if (result.data.status !== currentRecord.status) {
          if (TERMINAL_STATES.has(currentRecord.status)) {
            return sendStatusValidationError(
              res,
              'Cannot change status of a completed application',
            );
          }

          if (!isValidTransition(currentRecord.status, result.data.status)) {
            return sendStatusValidationError(
              res,
              `Invalid transition from ${currentRecord.status} to ${result.data.status}`,
            );
          }
        }
      }

      const record = repo.update(id, result.data);
      if (!record) {
        return sendNotFound(res);
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

      const record = repo.archive(id);
      if (!record) {
        return sendNotFound(res);
      }

      return res.status(200).json({ data: record });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
