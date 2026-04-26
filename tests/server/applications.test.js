import { describe, expect, it } from 'vitest';
import { createApp } from '../../server/index.js';
import { makeMemoryDb } from './helpers.js';

async function withServer(test) {
  const db = makeMemoryDb();
  const app = createApp({ db });
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

async function request(baseUrl, path, options = {}) {
  const response = await globalThis.fetch(`${baseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

describe('applications API', () => {
  it('returns health status', async () => {
    await withServer(async (baseUrl) => {
      const response = await request(baseUrl, '/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  it('returns an empty list for a fresh database', async () => {
    await withServer(async (baseUrl) => {
      const response = await request(baseUrl, '/api/applications');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: [] });
    });
  });

  it('creates a minimal application with system fields', async () => {
    await withServer(async (baseUrl) => {
      const response = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify({
          companyName: 'Acme Corp',
          jobTitle: 'Frontend Engineer',
          status: 'applied',
        }),
      });

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        companyName: 'Acme Corp',
        jobTitle: 'Frontend Engineer',
        status: 'applied',
        compat: 0,
        fav: false,
        archived: false,
        skills: [],
        metadata: null,
      });
      expect(Number.isInteger(response.body.data.id)).toBe(true);
      expect(response.body.data.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(response.body.data.updatedAt).toBe(response.body.data.createdAt);
      expect(response.body.data.lastStatusUpdate).toBe(response.body.data.createdAt);
    });
  });

  it('lists a created application', async () => {
    await withServer(async (baseUrl) => {
      const created = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify({
          companyName: 'Acme Corp',
          jobTitle: 'Frontend Engineer',
          status: 'applied',
        }),
      });
      const response = await request(baseUrl, '/api/applications');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject(created.body.data);
    });
  });

  it('returns one application by id', async () => {
    await withServer(async (baseUrl) => {
      const created = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify({
          companyName: 'Acme Corp',
          jobTitle: 'Frontend Engineer',
          status: 'applied',
        }),
      });
      const response = await request(baseUrl, `/api/applications/${created.body.data.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: created.body.data });
    });
  });

  it('returns not found for an unknown id', async () => {
    await withServer(async (baseUrl) => {
      const response = await request(baseUrl, '/api/applications/9999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'Application not found',
        },
      });
    });
  });

  it('returns validation fields for an empty create request', async () => {
    await withServer(async (baseUrl) => {
      const response = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        fields: {
          companyName: expect.any(String),
          jobTitle: expect.any(String),
          status: expect.any(String),
        },
      });
    });
  });

  it('returns validation fields for an invalid job posting URL', async () => {
    await withServer(async (baseUrl) => {
      const response = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify({
          companyName: 'Acme Corp',
          jobTitle: 'Frontend Engineer',
          status: 'applied',
          jobPostingUrl: 'not-a-url',
        }),
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        fields: {
          jobPostingUrl: expect.any(String),
        },
      });
    });
  });

  it('updates status and lastStatusUpdate while preserving other fields', async () => {
    await withServer(async (baseUrl, db) => {
      const created = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify({
          companyName: 'Acme Corp',
          jobTitle: 'Frontend Engineer',
          status: 'applied',
          notes: 'Original note',
        }),
      });
      const original = created.body.data;
      db.prepare(`
        UPDATE applications
        SET last_status_update = '2026-04-20', updated_at = '2026-04-20'
        WHERE id = ?
      `).run(original.id);
      const response = await request(baseUrl, `/api/applications/${original.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'interview' }),
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        ...original,
        status: 'interview',
        lastStatusUpdate: response.body.data.updatedAt,
      });
      expect(response.body.data.lastStatusUpdate).not.toBe('2026-04-20');
      expect(response.body.data.notes).toBe('Original note');
      expect(response.body.data.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('keeps lastStatusUpdate unchanged when status does not change', async () => {
    await withServer(async (baseUrl) => {
      const created = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify({
          companyName: 'Acme Corp',
          jobTitle: 'Frontend Engineer',
          status: 'applied',
        }),
      });
      const response = await request(baseUrl, `/api/applications/${created.body.data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'applied' }),
      });

      expect(response.status).toBe(200);
      expect(response.body.data.lastStatusUpdate).toBe(created.body.data.lastStatusUpdate);
    });
  });

  it('returns validation fields for invalid update URLs', async () => {
    await withServer(async (baseUrl) => {
      const created = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify({
          companyName: 'Acme Corp',
          jobTitle: 'Frontend Engineer',
          status: 'applied',
        }),
      });
      const response = await request(baseUrl, `/api/applications/${created.body.data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ jobPostingUrl: 'bad-url' }),
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        fields: {
          jobPostingUrl: expect.any(String),
        },
      });
    });
  });

  it('returns not found when updating an unknown id', async () => {
    await withServer(async (baseUrl) => {
      const response = await request(baseUrl, '/api/applications/9999', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'interview' }),
      });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'Application not found',
        },
      });
    });
  });
});
