import { describe, expect, it } from 'vitest';
import { createApp } from '../../server/index.js';
import { createTestRepositories } from '../../server/repositories/index.js';
import { makeMemoryDb } from './helpers.js';

async function withServer(test) {
  const db = makeMemoryDb();
  const repositories = await createTestRepositories(db);
  const app = createApp({ repositories });
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

async function uploadResume(baseUrl, { content = '', type = 'text/plain', filename = 'resume.txt' } = {}) {
  const body = new globalThis.FormData();
  body.append('resume', new globalThis.Blob([content], { type }), filename);

  const response = await globalThis.fetch(`${baseUrl}/api/resume/parse`, {
    method: 'POST',
    body,
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

describe('resume API', () => {
  it('parses a valid TXT resume upload', async () => {
    await withServer(async (baseUrl) => {
      const response = await uploadResume(baseUrl, {
        content: `
          Jane Smith
          jane@example.com

          Experience
          Acme Corp
          Senior Engineer
          Jan 2022 - Dec 2023
          Led platform work

          Skills
          JavaScript, Node.js
        `,
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        firstName: 'Jane',
        skills: ['JavaScript', 'Node.js'],
      });
      expect(response.body.data.experience[0]).toMatchObject({
        company: 'Acme Corp',
        role: 'Senior Engineer',
      });
    });
  });

  it('returns validation error when no file is provided', async () => {
    await withServer(async (baseUrl) => {
      const response = await globalThis.fetch(`${baseUrl}/api/resume/parse`, {
        method: 'POST',
        body: new globalThis.FormData(),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  it('returns unsupported file type for unsupported MIME uploads', async () => {
    await withServer(async (baseUrl) => {
      const response = await uploadResume(baseUrl, {
        content: 'not an image',
        type: 'image/png',
        filename: 'resume.png',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    });
  });

  it('returns file too large for uploads over 5 MB', async () => {
    await withServer(async (baseUrl) => {
      const response = await uploadResume(baseUrl, {
        content: 'a'.repeat((5 * 1024 * 1024) + 1),
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('FILE_TOO_LARGE');
    });
  });

  it('returns an empty parsed profile for unparseable TXT content', async () => {
    await withServer(async (baseUrl) => {
      const response = await uploadResume(baseUrl, {
        content: '@@@ ### !!!',
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({
        firstName: null,
        lastName: null,
        email: null,
        phone: null,
        city: null,
        summary: null,
        experience: [],
        education: [],
        skills: [],
        certifications: [],
        awards: [],
        languages: [],
        links: [],
      });
    });
  });

  it('accepts generic MIME uploads through TXT filename fallback', async () => {
    await withServer(async (baseUrl) => {
      const response = await uploadResume(baseUrl, {
        content: 'Jane Smith',
        type: 'application/octet-stream',
        filename: 'resume.txt',
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        firstName: 'Jane',
        lastName: 'Smith',
      });
    });
  });
});
