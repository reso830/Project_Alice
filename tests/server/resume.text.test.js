import { describe, expect, it } from 'vitest';
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

async function parseText(baseUrl, text) {
  const response = await globalThis.fetch(`${baseUrl}/api/resume/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(text === undefined ? {} : { text }),
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

async function parseFile(baseUrl) {
  const form = new globalThis.FormData();
  form.append('resume', new globalThis.Blob(['Jane Smith'], { type: 'text/plain' }), 'resume.txt');
  const response = await globalThis.fetch(`${baseUrl}/api/resume/parse`, {
    method: 'POST',
    body: form,
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

describe('POST /api/resume/parse text mode', () => {
  it('parses JSON text input with the rule-based parser', async () => {
    await withServer(async (baseUrl) => {
      const response = await parseText(baseUrl, `
        Jane Smith
        jane@example.com
        Skills
        JavaScript, Node.js
      `);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        skills: ['JavaScript', 'Node.js'],
      });
    });
  });

  it('returns validation error for missing text', async () => {
    await withServer(async (baseUrl) => {
      const response = await parseText(baseUrl, undefined);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  it('returns validation error for empty text', async () => {
    await withServer(async (baseUrl) => {
      const response = await parseText(baseUrl, '   ');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  it('returns payload too large for text over the cap', async () => {
    await withServer(async (baseUrl) => {
      const response = await parseText(baseUrl, 'a'.repeat(50_001));

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });
  });

  it('preserves existing multipart file mode', async () => {
    await withServer(async (baseUrl) => {
      const response = await parseFile(baseUrl);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        firstName: 'Jane',
        lastName: 'Smith',
      });
    });
  });

  it('returns 401 in hosted mode without a JWT', async () => {
    const requireAuth = (_req, res) =>
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });

    await withServer(async (baseUrl) => {
      const response = await parseText(baseUrl, 'Jane Smith');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    }, { requireAuth });
  });
});
