import { Router } from 'express';
import { isValidTransition, TERMINAL_STATES } from '../../shared/constants.js';
import { resolveRequestDate } from '../middleware/requestDate.js';
import { attachRepos } from '../repositories/middleware.js';
import { scoreApplication } from '../services/compatibility.js';
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

/**
 * @param {{
 *   repos: { forRequest: (req: any) => any },
 *   requireAuth?: import('express').Handler,
 *   seedHostedUserIfNeeded?: import('express').Handler,
 * }} deps
 */
export function createApplicationsRouter({
  repos,
  requireAuth,
  seedHostedUserIfNeeded,
} = {}) {
  if (!repos) {
    throw new Error(
      'createApplicationsRouter: `repos` (dispatcher with forRequest(req)) is required',
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

  router.post('/', async (req, res, next) => {
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

      const asOf = resolveRequestDate(req);
      const profile = await req.repos.profile.get();
      const compat = scoreApplication(result.data, profile, asOf);
      const record = await req.repos.applications.create({ ...result.data, compat }, asOf);
      return res.status(201).json({ data: record });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/', async (req, res, next) => {
    try {
      const view = req.query.view === 'archived' ? 'archived' : 'active';
      const data = view === 'archived'
        ? await req.repos.applications.getAllArchived()
        : await req.repos.applications.getAll();
      return res.status(200).json({ data });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const id = parseIdParam(req.params.id);
      if (id === null) {
        return sendInvalidId(res);
      }

      const record = await req.repos.applications.getById(id);
      if (!record) {
        return sendNotFound(res);
      }

      return res.status(200).json({ data: record });
    } catch (error) {
      return next(error);
    }
  });

  router.patch('/:id', async (req, res, next) => {
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

      const currentRecord = await req.repos.applications.getById(id);
      if (!currentRecord) {
        return sendNotFound(res);
      }

      if (result.data.status !== undefined) {
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

      if (Object.keys(result.data).length === 0) {
        return res.status(200).json({ data: currentRecord });
      }

      const asOf = resolveRequestDate(req);
      const profile = await req.repos.profile.get();
      const compat = scoreApplication({ ...currentRecord, ...result.data }, profile, asOf);
      const record = await req.repos.applications.update(id, { ...result.data, compat }, asOf);
      if (!record) {
        return sendNotFound(res);
      }

      return res.status(200).json({ data: record });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/:id/archive', async (req, res, next) => {
    try {
      const id = parseIdParam(req.params.id);
      if (id === null) {
        return sendInvalidId(res);
      }

      const record = await req.repos.applications.archive(id, resolveRequestDate(req));
      if (!record) {
        return sendNotFound(res);
      }

      return res.status(200).json({ data: record });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/:id/unarchive', async (req, res, next) => {
    try {
      const id = parseIdParam(req.params.id);
      if (id === null) {
        return sendInvalidId(res);
      }

      const asOf = resolveRequestDate(req);
      const restored = await req.repos.applications.unarchive(id, asOf);
      if (!restored) {
        return sendNotFound(res);
      }

      // The restored application re-enters the active set; its score was
      // frozen while archived (and skipped by profile-wide recompute), so
      // refresh it against the current profile now.
      const profile = await req.repos.profile.get();
      const compat = scoreApplication(restored, profile, asOf);
      if (compat === restored.compat) {
        return res.status(200).json({ data: restored });
      }

      const rescored = await req.repos.applications.update(id, { compat }, asOf);
      return res.status(200).json({ data: rescored ?? restored });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
