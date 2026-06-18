import { describe, expect, it } from 'vitest';
import { createApp } from '../../server/index.js';
import { createSqliteRepositories } from '../../server/repositories/index.js';
import { makeMemoryDb, wrapAsDispatcher } from './helpers.js';

async function withServer(test) {
  const db = makeMemoryDb();
  const repositories = await createSqliteRepositories(db);
  const app = createApp({ repositories: wrapAsDispatcher(repositories) });
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await test(baseUrl, db, repositories);
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

function validApplicationPayload(overrides = {}) {
  return {
    companyName: 'Acme Corp',
    jobTitle: 'Frontend Engineer',
    status: 'applied',
    responsibilities: 'Build product UI',
    ...overrides,
  };
}

describe('compatibility notes API', () => {
  it('persists generated notes with a server timestamp', async () => {
    await withServer(async (baseUrl) => {
      const created = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload()),
      });

      const response = await request(baseUrl, `/api/applications/${created.body.data.id}/compat-notes`, {
        method: 'POST',
        body: JSON.stringify({
          summary: 'Strong React fit',
          body: 'The score reflects strong overlap with the frontend role.',
        }),
      });
      const fetched = await request(baseUrl, `/api/applications/${created.body.data.id}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        summary: 'Strong React fit',
        body: 'The score reflects strong overlap with the frontend role.',
      });
      expect(response.body.data.generatedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
      expect(fetched.body.data.compatAnalysis).toEqual(response.body.data);
    });
  });

  it('rejects summaries over 34 characters', async () => {
    await withServer(async (baseUrl) => {
      const created = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload()),
      });

      const response = await request(baseUrl, `/api/applications/${created.body.data.id}/compat-notes`, {
        method: 'POST',
        body: JSON.stringify({
          summary: 'This summary is much too long for the compact headline',
          body: 'Body text.',
        }),
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        fields: {
          summary: expect.any(String),
        },
      });
    });
  });

  it('rejects empty note bodies', async () => {
    await withServer(async (baseUrl) => {
      const created = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload()),
      });

      const response = await request(baseUrl, `/api/applications/${created.body.data.id}/compat-notes`, {
        method: 'POST',
        body: JSON.stringify({
          summary: 'Good fit',
          body: '   ',
        }),
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        fields: {
          body: expect.any(String),
        },
      });
    });
  });

  it('returns not found for missing applications', async () => {
    await withServer(async (baseUrl) => {
      const response = await request(baseUrl, '/api/applications/9999/compat-notes', {
        method: 'POST',
        body: JSON.stringify({
          summary: 'Good fit',
          body: 'Body text.',
        }),
      });

      expect(response.status).toBe(404);
      expect(response.body.error).toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  it('returns not found if the notes update cannot persist', async () => {
    await withServer(async (baseUrl, _db, repositories) => {
      const created = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload()),
      });
      const update = repositories.applications.update;
      repositories.applications.update = () => null;

      try {
        const response = await request(baseUrl, `/api/applications/${created.body.data.id}/compat-notes`, {
          method: 'POST',
          body: JSON.stringify({
            summary: 'Good fit',
            body: 'Body text.',
          }),
        });

        expect(response.status).toBe(404);
        expect(response.body.error).toMatchObject({
          code: 'NOT_FOUND',
        });
      } finally {
        repositories.applications.update = update;
      }
    });
  });

  it('does not touch compatNotes or compatScoredAt when saving analysis', async () => {
    await withServer(async (baseUrl, db) => {
      const compatScoredAt = '2026-01-01T00:00:00.000Z';
      const created = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload()),
      });
      db.prepare(`
        UPDATE applications
        SET compat_notes = 'legacy text', compat_scored_at = ?
        WHERE id = ?
      `).run(compatScoredAt, created.body.data.id);

      const response = await request(baseUrl, `/api/applications/${created.body.data.id}/compat-notes`, {
        method: 'POST',
        body: JSON.stringify({
          summary: 'Good fit',
          body: 'Analysis body.',
        }),
      });
      const row = db.prepare(`
        SELECT compat_notes, compat_scored_at
        FROM applications
        WHERE id = ?
      `).get(created.body.data.id);
      const fetched = await request(baseUrl, `/api/applications/${created.body.data.id}`);

      expect(response.status).toBe(200);
      expect(row.compat_notes).toBe('legacy text');
      expect(row.compat_scored_at).toBe(compatScoredAt);
      expect(fetched.body.data.compatNotes).toBe('legacy text');
      expect(fetched.body.data.compatScoredAt).toBe(compatScoredAt);
    });
  });
});
