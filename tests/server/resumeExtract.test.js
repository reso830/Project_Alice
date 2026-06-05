import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../server/index.js';
import { createSqliteRepositories } from '../../server/repositories/index.js';
import { makeMemoryDb, wrapAsDispatcher } from './helpers.js';

async function withServer(test, options = {}) {
  const db = makeMemoryDb();
  const repositories = await createSqliteRepositories(db);
  const app = createApp({
    repositories: wrapAsDispatcher(repositories),
    ...options,
  });
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await test(baseUrl, db);
  } finally {
    server.close();
    db.close();
  }
}

async function extractResume(baseUrl, {
  content = 'Jane Smith',
  type = 'text/plain',
  filename = 'resume.txt',
  field = 'resume',
} = {}) {
  const body = new globalThis.FormData();
  if (field) {
    body.append(field, new globalThis.Blob([content], { type }), filename);
  }

  const response = await globalThis.fetch(`${baseUrl}/api/resume/extract`, {
    method: 'POST',
    body,
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/resume/extract', () => {
  it('returns extracted text for a TXT upload', async () => {
    await withServer(async (baseUrl) => {
      const response = await extractResume(baseUrl, {
        content: 'Jane Smith\nEngineer',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        data: { text: 'Jane Smith\nEngineer' },
      });
    });
  });

  it('returns validation error when no file is provided', async () => {
    await withServer(async (baseUrl) => {
      const response = await extractResume(baseUrl, { field: null });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  it('returns unsupported file type for unsupported MIME uploads', async () => {
    await withServer(async (baseUrl) => {
      const response = await extractResume(baseUrl, {
        content: 'png',
        type: 'image/png',
        filename: 'resume.png',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    });
  });

  it('returns file too large for uploads over 5 MB', async () => {
    await withServer(async (baseUrl) => {
      const response = await extractResume(baseUrl, {
        content: 'a'.repeat(5_242_881),
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('FILE_TOO_LARGE');
    });
  });

  it('returns parse failed for unreadable content without leaking internals', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await withServer(async (baseUrl) => {
      const response = await extractResume(baseUrl, {
        content: 'NOT A REAL PDF',
        type: 'application/pdf',
        filename: 'bad.pdf',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('PARSE_FAILED');
      expect(JSON.stringify(response.body)).not.toMatch(/pdf-parse|pdfjs|node_modules/i);
    });
  });

  it('returns 401 in hosted mode without a JWT', async () => {
    const requireAuth = (_req, res) =>
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });

    await withServer(async (baseUrl) => {
      const response = await extractResume(baseUrl);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    }, { requireAuth });
  });
});
