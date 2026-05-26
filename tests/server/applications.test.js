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
    await test(baseUrl, db);
  } finally {
    server.close();
    db.close();
  }
}

async function request(baseUrl, path, options = {}) {
  const response = await globalThis.fetch(`${baseUrl}${path}`, {
    ...options,
    // Headers must come after the options spread; otherwise `...options`
    // would clobber the merged Content-Type when a caller passes a
    // custom `headers` map (e.g. X-Client-Date tests).
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
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

describe('applications API', () => {
  it('returns health status with runtime field', async () => {
    await withServer(async (baseUrl) => {
      const response = await request(baseUrl, '/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok', runtime: 'local' });
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
        body: JSON.stringify(validApplicationPayload()),
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
        location: null,
        shift: null,
        workSetup: null,
        compatNotes: null,
        generalNotes: null,
        preferredSkills: [],
        metadata: null,
        timeline: [],
      });
      expect(Number.isInteger(response.body.data.id)).toBe(true);
      expect(response.body.data.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(response.body.data.updatedAt).toBe(response.body.data.createdAt);
      expect(response.body.data.lastStatusUpdate).toBe(response.body.data.createdAt);
    });
  });

  it('creates applications with accepted status', async () => {
    await withServer(async (baseUrl) => {
      const response = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload({ status: 'accepted' })),
      });

      expect(response.status).toBe(201);
      expect(response.body.data.status).toBe('accepted');
    });
  });

  it('lists a created application', async () => {
    await withServer(async (baseUrl) => {
      const created = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload()),
      });
      const response = await request(baseUrl, '/api/applications');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject(created.body.data);
    });
  });

  it('creates applications with extended metadata fields', async () => {
    await withServer(async (baseUrl) => {
      const response = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload({
          location: 'Manila',
          shift: 'Day',
          workSetup: 'Remote',
          compatNotes: 'Strong frontend match.',
          generalNotes: 'Applied via referral.',
          preferredSkills: ['GraphQL', 'Figma'],
        })),
      });

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        location: 'Manila',
        shift: 'Day',
        workSetup: 'Remote',
        compatNotes: 'Strong frontend match.',
        generalNotes: 'Applied via referral.',
        preferredSkills: ['GraphQL', 'Figma'],
      });
    });
  });

  it('returns extended metadata in camelCase when fetched by id', async () => {
    await withServer(async (baseUrl) => {
      const created = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload({
          location: 'Manila',
          shift: 'Mid',
          workSetup: 'Hybrid',
          compatNotes: 'Compatibility detail',
          generalNotes: 'General detail',
          preferredSkills: ['GraphQL'],
        })),
      });

      const response = await request(baseUrl, `/api/applications/${created.body.data.id}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        location: 'Manila',
        shift: 'Mid',
        workSetup: 'Hybrid',
        compatNotes: 'Compatibility detail',
        generalNotes: 'General detail',
        preferredSkills: ['GraphQL'],
      });
    });
  });

  it('returns one application by id', async () => {
    await withServer(async (baseUrl) => {
      const created = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload()),
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
          responsibilities: expect.any(String),
          status: expect.any(String),
        },
      });
    });
  });

  it('returns validation fields for an invalid job posting URL', async () => {
    await withServer(async (baseUrl) => {
      const response = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload({
          jobPostingUrl: 'not-a-url',
        })),
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

  it('returns validation error for a non-object create request body', async () => {
    await withServer(async (baseUrl) => {
      const response = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify('not-an-object'),
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
      });
    });
  });

  it('updates status and lastStatusUpdate while preserving other fields', async () => {
    await withServer(async (baseUrl, db) => {
      const created = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload({
          notes: 'Original note',
        })),
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
        body: JSON.stringify(validApplicationPayload()),
      });
      const response = await request(baseUrl, `/api/applications/${created.body.data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'applied' }),
      });

      expect(response.status).toBe(200);
      expect(response.body.data.lastStatusUpdate).toBe(created.body.data.lastStatusUpdate);
    });
  });

  describe('status transition gate', () => {
    it('returns validation error for invalid transitions', async () => {
      await withServer(async (baseUrl) => {
        const created = await request(baseUrl, '/api/applications', {
          method: 'POST',
          body: JSON.stringify(validApplicationPayload({ status: 'applied' })),
        });
        const response = await request(baseUrl, `/api/applications/${created.body.data.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'wishlisted' }),
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatchObject({
          code: 'VALIDATION_ERROR',
          fields: {
            status: expect.any(String),
          },
        });
      });
    });

    it('returns validation error for status changes from terminal states', async () => {
      await withServer(async (baseUrl) => {
        const created = await request(baseUrl, '/api/applications', {
          method: 'POST',
          body: JSON.stringify(validApplicationPayload({ status: 'rejected' })),
        });
        const response = await request(baseUrl, `/api/applications/${created.body.data.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'applied' }),
        });

        expect(response.status).toBe(400);
        expect(response.body.error.fields.status)
          .toBe('Cannot change status of a completed application');
      });
    });

    it('allows valid transitions', async () => {
      await withServer(async (baseUrl) => {
        const created = await request(baseUrl, '/api/applications', {
          method: 'POST',
          body: JSON.stringify(validApplicationPayload({ status: 'applied' })),
        });
        const response = await request(baseUrl, `/api/applications/${created.body.data.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'phone_screen' }),
        });

        expect(response.status).toBe(200);
        expect(response.body.data.status).toBe('phone_screen');
      });
    });

    it('leaves patches without status fields unaffected', async () => {
      await withServer(async (baseUrl) => {
        const created = await request(baseUrl, '/api/applications', {
          method: 'POST',
          body: JSON.stringify(validApplicationPayload()),
        });
        const response = await request(baseUrl, `/api/applications/${created.body.data.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ fav: true }),
        });

        expect(response.status).toBe(200);
        expect(response.body.data.fav).toBe(true);
      });
    });

    it('allows unchanged status updates, including terminal records', async () => {
      await withServer(async (baseUrl) => {
        const created = await request(baseUrl, '/api/applications', {
          method: 'POST',
          body: JSON.stringify(validApplicationPayload({ status: 'rejected' })),
        });
        const response = await request(baseUrl, `/api/applications/${created.body.data.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ notes: 'follow up', status: 'rejected' }),
        });

        expect(response.status).toBe(200);
        expect(response.body.data).toMatchObject({
          status: 'rejected',
          notes: 'follow up',
        });
      });
    });

    it('allows offer to accepted and refreshes lastStatusUpdate', async () => {
      await withServer(async (baseUrl, db) => {
        const created = await request(baseUrl, '/api/applications', {
          method: 'POST',
          body: JSON.stringify(validApplicationPayload({ status: 'offer' })),
        });
        db.prepare(`
          UPDATE applications
          SET last_status_update = '2026-04-20', updated_at = '2026-04-20'
          WHERE id = ?
        `).run(created.body.data.id);

        const response = await request(baseUrl, `/api/applications/${created.body.data.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'accepted' }),
        });

        expect(response.status).toBe(200);
        expect(response.body.data.status).toBe('accepted');
        expect(response.body.data.lastStatusUpdate).toBeTruthy();
        expect(response.body.data.lastStatusUpdate).not.toBe('2026-04-20');
      });
    });
  });

  it('leaves the record fully unchanged for an empty update body', async () => {
    await withServer(async (baseUrl) => {
      const created = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload({
          notes: 'Original note',
        })),
      });
      const response = await request(baseUrl, `/api/applications/${created.body.data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(created.body.data);
    });
  });

  it('never changes createdAt from update payloads', async () => {
    await withServer(async (baseUrl) => {
      const created = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload()),
      });
      const response = await request(baseUrl, `/api/applications/${created.body.data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          createdAt: '1999-01-01',
          status: 'interview',
        }),
      });

      expect(response.status).toBe(200);
      expect(response.body.data.createdAt).toBe(created.body.data.createdAt);
      expect(response.body.data.status).toBe('interview');
    });
  });

  it('updates archived state and resets fav to false through the update endpoint', async () => {
    await withServer(async (baseUrl) => {
      const created = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload({
          fav: true,
        })),
      });
      const response = await request(baseUrl, `/api/applications/${created.body.data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ archived: true }),
      });

      expect(response.status).toBe(200);
      expect(response.body.data.archived).toBe(true);
      expect(response.body.data.fav).toBe(false);
    });
  });

  it('clears optional URL and date fields with empty strings', async () => {
    await withServer(async (baseUrl) => {
      const created = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload({
          applicationDate: '2026-04-26',
          followUpDate: '2026-04-30',
          jobPostingUrl: 'https://example.com/job',
        })),
      });
      const response = await request(baseUrl, `/api/applications/${created.body.data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          applicationDate: '',
          followUpDate: '',
          jobPostingUrl: '',
        }),
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        applicationDate: null,
        followUpDate: null,
        jobPostingUrl: '',
      });
    });
  });

  it('updates and clears extended metadata fields', async () => {
    await withServer(async (baseUrl) => {
      const created = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload({
          location: 'Manila',
          shift: 'Day',
          workSetup: 'Remote',
          compatNotes: 'Initial notes',
          generalNotes: 'General notes',
          preferredSkills: ['GraphQL'],
        })),
      });

      const updated = await request(baseUrl, `/api/applications/${created.body.data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          location: '',
          shift: '',
          workSetup: '',
          compatNotes: '',
          generalNotes: '',
          preferredSkills: [],
        }),
      });

      expect(updated.status).toBe(200);
      expect(updated.body.data).toMatchObject({
        location: '',
        shift: '',
        workSetup: '',
        compatNotes: '',
        generalNotes: '',
        preferredSkills: [],
      });
    });
  });

  it('returns validation fields for invalid update URLs', async () => {
    await withServer(async (baseUrl) => {
      const created = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload()),
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

  it('returns bad request for invalid ids', async () => {
    await withServer(async (baseUrl) => {
      const getResponse = await request(baseUrl, '/api/applications/abc');
      const patchResponse = await request(baseUrl, '/api/applications/abc', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'interview' }),
      });
      const archiveResponse = await request(baseUrl, '/api/applications/abc/archive', {
        method: 'POST',
      });

      for (const response of [getResponse, patchResponse, archiveResponse]) {
        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          error: {
            code: 'BAD_REQUEST',
            message: 'Invalid id',
          },
        });
      }
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

  it('lists only non-archived applications', async () => {
    await withServer(async (baseUrl, db) => {
      const active = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload()),
      });
      const archived = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload({
          companyName: 'Beta Inc',
          jobTitle: 'Backend Engineer',
          status: 'wishlisted',
          responsibilities: 'Build backend services',
        })),
      });
      db.prepare('UPDATE applications SET archived = 1 WHERE id = ?').run(archived.body.data.id);

      const response = await request(baseUrl, '/api/applications');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(active.body.data.id);
    });
  });

  it('returns an archived application by id', async () => {
    await withServer(async (baseUrl, db) => {
      const archived = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload({
          companyName: 'Beta Inc',
          jobTitle: 'Backend Engineer',
          status: 'wishlisted',
          responsibilities: 'Build backend services',
        })),
      });
      db.prepare('UPDATE applications SET archived = 1 WHERE id = ?').run(archived.body.data.id);

      const response = await request(baseUrl, `/api/applications/${archived.body.data.id}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        id: archived.body.data.id,
        archived: true,
      });
    });
  });

  it('archives an application', async () => {
    await withServer(async (baseUrl) => {
      const created = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload()),
      });

      const response = await request(baseUrl, `/api/applications/${created.body.data.id}/archive`, {
        method: 'POST',
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        id: created.body.data.id,
        archived: true,
      });
    });
  });

  it('archives an already archived application idempotently', async () => {
    await withServer(async (baseUrl) => {
      const created = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload()),
      });

      await request(baseUrl, `/api/applications/${created.body.data.id}/archive`, {
        method: 'POST',
      });
      const response = await request(baseUrl, `/api/applications/${created.body.data.id}/archive`, {
        method: 'POST',
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        id: created.body.data.id,
        archived: true,
      });
    });
  });

  it('excludes archived applications from the active list', async () => {
    await withServer(async (baseUrl) => {
      const active = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload()),
      });
      const archived = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload({
          companyName: 'Beta Inc',
          jobTitle: 'Backend Engineer',
          status: 'wishlisted',
          responsibilities: 'Build backend services',
        })),
      });

      await request(baseUrl, `/api/applications/${archived.body.data.id}/archive`, {
        method: 'POST',
      });
      const response = await request(baseUrl, '/api/applications');

      expect(response.status).toBe(200);
      expect(response.body.data.map((record) => record.id)).toEqual([active.body.data.id]);
    });
  });

  it('returns archived applications by id after archive', async () => {
    await withServer(async (baseUrl) => {
      const created = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload()),
      });

      await request(baseUrl, `/api/applications/${created.body.data.id}/archive`, {
        method: 'POST',
      });
      const response = await request(baseUrl, `/api/applications/${created.body.data.id}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        id: created.body.data.id,
        archived: true,
      });
    });
  });

  it('returns not found when archiving an unknown id', async () => {
    await withServer(async (baseUrl) => {
      const response = await request(baseUrl, '/api/applications/9999/archive', {
        method: 'POST',
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

  it('persists starred state through the update endpoint', async () => {
    await withServer(async (baseUrl) => {
      const created = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload()),
      });

      await request(baseUrl, `/api/applications/${created.body.data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ fav: true }),
      });
      const response = await request(baseUrl, `/api/applications/${created.body.data.id}`);

      expect(response.status).toBe(200);
      expect(response.body.data.fav).toBe(true);
    });
  });

  it('coerces null favorite updates to false through the update endpoint', async () => {
    await withServer(async (baseUrl) => {
      const created = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload({ fav: true })),
      });

      const response = await request(baseUrl, `/api/applications/${created.body.data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ fav: null }),
      });

      expect(response.status).toBe(200);
      expect(response.body.data.fav).toBe(false);
    });
  });

  it('rejects string salary updates through the update endpoint', async () => {
    await withServer(async (baseUrl) => {
      const created = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload()),
      });

      const response = await request(baseUrl, `/api/applications/${created.body.data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ salary: '$120k' }),
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        fields: {
          salary: expect.any(String),
        },
      });
    });
  });

  it('round-trips future-dated timeline entries through PATCH and GET', async () => {
    await withServer(async (baseUrl) => {
      const created = await request(baseUrl, '/api/applications', {
        method: 'POST',
        body: JSON.stringify(validApplicationPayload()),
      });
      const timeline = [
        { id: 1, date: '2026-06-20', status: 'phone_screen', text: 'Recruiter callback.' },
      ];

      const patched = await request(baseUrl, `/api/applications/${created.body.data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ timeline }),
      });
      const fetched = await request(baseUrl, `/api/applications/${created.body.data.id}`);

      expect(patched.status).toBe(200);
      expect(patched.body.data.timeline).toEqual(timeline);
      expect(fetched.body.data.timeline).toEqual(timeline);
    });
  });

  // Issue #43 — the client's local "today" (X-Client-Date header) must be
  // threaded all the way through routes → repo wrapper → SQLite repo, and
  // persisted into the audit columns. Without the wrapper-layer
  // forwarding fix, the SQLite path would silently ignore the header and
  // fall back to UTC currentDate().
  describe('X-Client-Date header (#43)', () => {
    it('POST stamps createdAt/updatedAt/lastStatusUpdate with the supplied X-Client-Date', async () => {
      await withServer(async (baseUrl) => {
        const response = await request(baseUrl, '/api/applications', {
          method: 'POST',
          headers: { 'X-Client-Date': '2030-01-15' },
          body: JSON.stringify(validApplicationPayload()),
        });

        expect(response.status).toBe(201);
        expect(response.body.data.createdAt).toBe('2030-01-15');
        expect(response.body.data.updatedAt).toBe('2030-01-15');
        expect(response.body.data.lastStatusUpdate).toBe('2030-01-15');
      });
    });

    it('PATCH stamps updatedAt with the supplied X-Client-Date', async () => {
      await withServer(async (baseUrl) => {
        const created = await request(baseUrl, '/api/applications', {
          method: 'POST',
          headers: { 'X-Client-Date': '2030-01-15' },
          body: JSON.stringify(validApplicationPayload()),
        });
        const response = await request(baseUrl, `/api/applications/${created.body.data.id}`, {
          method: 'PATCH',
          headers: { 'X-Client-Date': '2030-02-20' },
          body: JSON.stringify({ notes: 'updated' }),
        });

        expect(response.status).toBe(200);
        expect(response.body.data.updatedAt).toBe('2030-02-20');
        // createdAt and lastStatusUpdate stay at the create-time stamp.
        expect(response.body.data.createdAt).toBe('2030-01-15');
        expect(response.body.data.lastStatusUpdate).toBe('2030-01-15');
      });
    });

    it('PATCH with a status change stamps lastStatusUpdate with the supplied X-Client-Date', async () => {
      await withServer(async (baseUrl) => {
        const created = await request(baseUrl, '/api/applications', {
          method: 'POST',
          headers: { 'X-Client-Date': '2030-01-15' },
          body: JSON.stringify(validApplicationPayload({ status: 'applied' })),
        });
        const response = await request(baseUrl, `/api/applications/${created.body.data.id}`, {
          method: 'PATCH',
          headers: { 'X-Client-Date': '2030-02-20' },
          body: JSON.stringify({ status: 'interview' }),
        });

        expect(response.status).toBe(200);
        expect(response.body.data.updatedAt).toBe('2030-02-20');
        expect(response.body.data.lastStatusUpdate).toBe('2030-02-20');
      });
    });

    it('POST /:id/archive stamps updatedAt with the supplied X-Client-Date', async () => {
      await withServer(async (baseUrl) => {
        const created = await request(baseUrl, '/api/applications', {
          method: 'POST',
          headers: { 'X-Client-Date': '2030-01-15' },
          body: JSON.stringify(validApplicationPayload()),
        });
        const response = await request(baseUrl, `/api/applications/${created.body.data.id}/archive`, {
          method: 'POST',
          headers: { 'X-Client-Date': '2030-03-10' },
        });

        expect(response.status).toBe(200);
        expect(response.body.data.updatedAt).toBe('2030-03-10');
      });
    });

    it('falls back to UTC currentDate() when X-Client-Date is missing', async () => {
      await withServer(async (baseUrl) => {
        const response = await request(baseUrl, '/api/applications', {
          method: 'POST',
          body: JSON.stringify(validApplicationPayload()),
        });

        expect(response.status).toBe(201);
        // UTC fallback always matches today's UTC date prefix.
        const expected = new Date().toISOString().slice(0, 10);
        expect(response.body.data.createdAt).toBe(expected);
      });
    });

    it('rejects a malformed X-Client-Date by falling back to UTC currentDate()', async () => {
      await withServer(async (baseUrl) => {
        const response = await request(baseUrl, '/api/applications', {
          method: 'POST',
          headers: { 'X-Client-Date': 'not-a-date' },
          body: JSON.stringify(validApplicationPayload()),
        });

        expect(response.status).toBe(201);
        const expected = new Date().toISOString().slice(0, 10);
        expect(response.body.data.createdAt).toBe(expected);
      });
    });
  });
});
