import { Router } from 'express';
import multer from 'multer';
import { createHash } from 'node:crypto';
import { extractText, UnsupportedFileTypeError } from '../resume/extractor.js';
import { parseResumeText } from '../resume/parser.js';

const ERROR_RESPONSES = {
  FILE_TOO_LARGE: {
    code: 'FILE_TOO_LARGE',
    message: 'File exceeds the 5 MB size limit.',
  },
  UNSUPPORTED_FILE_TYPE: {
    code: 'UNSUPPORTED_FILE_TYPE',
    message: 'Unsupported file type. Please upload a PDF, DOCX, or TXT file.',
  },
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    message: 'No resume file provided.',
  },
  TEXT_VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    message: 'Resume text is required.',
  },
  PAYLOAD_TOO_LARGE: {
    code: 'PAYLOAD_TOO_LARGE',
    message: 'Resume text exceeds the size limit.',
  },
  PARSE_FAILED: {
    code: 'PARSE_FAILED',
    message: 'Could not read this resume. Try a different file.',
  },
};

const TEXT_MAX = 50_000;

function sendError(res, status, error) {
  return res.status(status).json({ error });
}

function isUnsupportedFileType(error) {
  return error instanceof UnsupportedFileTypeError;
}

function hashFilename(originalname = '') {
  return createHash('sha256').update(originalname).digest('hex').slice(0, 8);
}

export function createResumeRouter({ requireAuth, seedHostedUserIfNeeded } = {}) {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5_242_880 },
  });

  if (requireAuth) {
    router.use(requireAuth);
  }
  if (seedHostedUserIfNeeded) {
    router.use(seedHostedUserIfNeeded);
  }

  async function handleExtract(req, res, next) {
    upload.single('resume')(req, res, async (uploadError) => {
      if (uploadError instanceof multer.MulterError) {
        if (uploadError.code === 'LIMIT_FILE_SIZE') {
          return sendError(res, 400, ERROR_RESPONSES.FILE_TOO_LARGE);
        }
        console.error('[resume.parse]', {
          error: uploadError.message,
          code: uploadError.code,
          path: req.originalUrl?.split('?')[0] ?? req.path,
        });
        return sendError(res, 400, ERROR_RESPONSES.VALIDATION_ERROR);
      }

      if (uploadError) {
        return next(uploadError);
      }

      if (!req.file) {
        return sendError(res, 400, ERROR_RESPONSES.VALIDATION_ERROR);
      }

      try {
        const text = await extractText(req.file.buffer, req.file.mimetype, req.file.originalname);
        return res.status(200).json({ data: { text } });
      } catch (error) {
        if (isUnsupportedFileType(error)) {
          return sendError(res, 400, ERROR_RESPONSES.UNSUPPORTED_FILE_TYPE);
        }

        console.error('[resume.extract]', {
          error: error?.message ?? 'unknown',
          stack: error?.stack,
          nameSha8: hashFilename(req.file?.originalname),
          mimetype: req.file?.mimetype,
          path: req.originalUrl?.split('?')[0] ?? req.path,
        });
        return sendError(res, 400, ERROR_RESPONSES.PARSE_FAILED);
      }
    });
  }

  router.post('/extract', handleExtract);

  router.post('/parse', (req, res, next) => {
    if (req.is('application/json')) {
      const text = typeof req.body?.text === 'string' ? req.body.text : '';

      if (!text.trim()) {
        return sendError(res, 400, ERROR_RESPONSES.TEXT_VALIDATION_ERROR);
      }

      if (text.length > TEXT_MAX) {
        return sendError(res, 400, ERROR_RESPONSES.PAYLOAD_TOO_LARGE);
      }

      return res.status(200).json({ data: parseResumeText(text) });
    }

    upload.single('resume')(req, res, async (uploadError) => {
      if (uploadError instanceof multer.MulterError) {
        if (uploadError.code === 'LIMIT_FILE_SIZE') {
          return sendError(res, 400, ERROR_RESPONSES.FILE_TOO_LARGE);
        }
        console.error('[resume.parse]', {
          error: uploadError.message,
          code: uploadError.code,
          path: req.originalUrl?.split('?')[0] ?? req.path,
        });
        return sendError(res, 400, ERROR_RESPONSES.VALIDATION_ERROR);
      }

      if (uploadError) {
        return next(uploadError);
      }

      if (!req.file) {
        return sendError(res, 400, ERROR_RESPONSES.VALIDATION_ERROR);
      }

      try {
        const text = await extractText(req.file.buffer, req.file.mimetype, req.file.originalname);
        return res.status(200).json({ data: parseResumeText(text) });
      } catch (error) {
        if (isUnsupportedFileType(error)) {
          return sendError(res, 400, ERROR_RESPONSES.UNSUPPORTED_FILE_TYPE);
        }

        console.error('[resume.parse]', {
          error: error?.message ?? 'unknown',
          stack: error?.stack,
          nameSha8: hashFilename(req.file?.originalname),
          mimetype: req.file?.mimetype,
          path: req.originalUrl?.split('?')[0] ?? req.path,
        });
        return sendError(res, 400, ERROR_RESPONSES.PARSE_FAILED);
      }
    });
  });

  return router;
}
