import { Router } from 'express';
import multer from 'multer';
import { extractText, UnsupportedFileTypeError } from '../resume/extractor.js';
import { parseResumeText } from '../resume/parser.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5_242_880 },
});

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
};

function sendError(res, status, error) {
  return res.status(status).json({ error });
}

function isUnsupportedFileType(error) {
  return error instanceof UnsupportedFileTypeError;
}

export function createResumeRouter() {
  const router = Router();

  router.post('/parse', (req, res, next) => {
    upload.single('resume')(req, res, async (uploadError) => {
      if (uploadError instanceof multer.MulterError && uploadError.code === 'LIMIT_FILE_SIZE') {
        return sendError(res, 400, ERROR_RESPONSES.FILE_TOO_LARGE);
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

        return next(error);
      }
    });
  });

  return router;
}
