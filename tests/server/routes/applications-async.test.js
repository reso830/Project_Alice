import express from 'express';
import { describe, expect, it, vi } from 'vitest';
import { createApplicationsRouter } from '../../../server/routes/applications.js';

// Async-discipline regression guard for Phase 05 Task 05.1 + the Codex MAJOR
// finding. The Supabase adapters return Promises. If a route handler forgets
// to `await` (most dangerously, the `getById` inside the PATCH /:id status-
// transition check), `currentRecord` would be a Promise object,
// `currentRecord.status` would be undefined, and `TERMINAL_STATES.has(undefined)`
// would return false — silently allowing forbidden status transitions through
// validation. This file's tests fail loudly if that regression returns.

function makePromiseReturningApplicationsAdapter(recordsById) {
  // Every method returns a Promise (matching Supabase adapter behavior).
  // If route handlers forget to `await`, they receive Promise objects which
  // are truthy but expose no expected fields.
  return {
    getAll: vi.fn(async () => Object.values(recordsById)),
    getById: vi.fn(async (id) => recordsById[id] ?? null),
    create: vi.fn(async (fields) => ({
      id: 999,
      ...fields,
      status: fields.status ?? 'wishlisted',
    })),
    update: vi.fn(async (id, fields) => {
      const current = recordsById[id];
      if (!current) return null;
      return { ...current, ...fields };
    }),
    archive: vi.fn(async (id) => {
      const current = recordsById[id];
      if (!current) return null;
      return { ...current, archived: true };
    }),
  };
}

function makeApp(applicationsAdapter) {
  const app = express();
  app.use(express.json());
  const profileAdapter = { get: vi.fn(async () => null) };
  app.use(
    '/api/applications',
    createApplicationsRouter({
      repos: {
        forRequest: () => ({
          applications: applicationsAdapter,
          profile: profileAdapter,
        }),
      },
    }),
  );
  return app;
}

async function request(app, path, options = {}) {
  const server = app.listen(0);
  const { port } = server.address();
  try {
    const response = await globalThis.fetch(`http://127.0.0.1:${port}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
      ...options,
    });
    const text = await response.text();
    return {
      status: response.status,
      body: text ? JSON.parse(text) : null,
    };
  } finally {
    server.close();
  }
}

describe('applications router — async discipline (Promise-returning adapters)', () => {
  it('GET / awaits getAll() before serializing', async () => {
    const repo = makePromiseReturningApplicationsAdapter({
      1: { id: 1, companyName: 'Acme', status: 'applied' },
      2: { id: 2, companyName: 'Beta', status: 'interview' },
    });
    const app = makeApp(repo);

    const res = await request(app, '/api/applications');

    expect(res.status).toBe(200);
    // If getAll() result wasn't awaited, body.data would be a serialized
    // Promise (`{}`) — not an array.
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  it('GET /:id awaits getById() and reads fields from the resolved record', async () => {
    const repo = makePromiseReturningApplicationsAdapter({
      7: { id: 7, companyName: 'Acme', status: 'applied' },
    });
    const app = makeApp(repo);

    const res = await request(app, '/api/applications/7');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 7, companyName: 'Acme' });
  });

  it('PATCH /:id awaits getById() in the status-transition check (BLOCKS forbidden transitions from terminal states)', async () => {
    // This is the highest-impact regression guard. The current record has
    // status='accepted' (a terminal state). The handler must:
    //   1. await getById(id) — resolves to a record with status='accepted'
    //   2. check TERMINAL_STATES.has(currentRecord.status) — should be true
    //   3. return 400 with "Cannot change status of a completed application"
    //
    // If the await is missing, currentRecord is a Promise object,
    // currentRecord.status is undefined, TERMINAL_STATES.has(undefined) is
    // false, and the update goes through with a 200 — the silent bypass.
    const repo = makePromiseReturningApplicationsAdapter({
      5: { id: 5, companyName: 'Acme', status: 'accepted' },
    });
    const app = makeApp(repo);

    const res = await request(app, '/api/applications/5', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'rejected' }),
    });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.status).toMatch(/completed/i);
    // update() must NOT have been called — the status-transition check
    // should have short-circuited.
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('PATCH /:id awaits getById() in the status-transition check (BLOCKS invalid forward transition)', async () => {
    // applied → ghosted is NOT in the valid transition set; the check must
    // catch it. Same await-discipline requirement.
    const repo = makePromiseReturningApplicationsAdapter({
      3: { id: 3, companyName: 'Acme', status: 'applied' },
    });
    const app = makeApp(repo);

    const res = await request(app, '/api/applications/3', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'accepted' }),
    });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.status).toMatch(/invalid transition/i);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('PATCH /:id awaits update() and serializes the resolved record', async () => {
    const repo = makePromiseReturningApplicationsAdapter({
      1: { id: 1, companyName: 'Acme', status: 'applied' },
    });
    const app = makeApp(repo);

    const res = await request(app, '/api/applications/1', {
      method: 'PATCH',
      body: JSON.stringify({ notes: 'updated' }),
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 1, notes: 'updated' });
  });

  it('POST / awaits create() and returns 201 with the resolved record', async () => {
    const repo = makePromiseReturningApplicationsAdapter({});
    const app = makeApp(repo);

    const res = await request(app, '/api/applications', {
      method: 'POST',
      body: JSON.stringify({
        companyName: 'Acme',
        jobTitle: 'FE',
        status: 'applied',
        responsibilities: 'Build UI',
      }),
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      id: 999,
      companyName: 'Acme',
    });
  });

  it('POST /:id/archive awaits archive() and returns 200 with the archived record', async () => {
    const repo = makePromiseReturningApplicationsAdapter({
      4: { id: 4, companyName: 'Acme', status: 'applied' },
    });
    const app = makeApp(repo);

    const res = await request(app, '/api/applications/4/archive', {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 4, archived: true });
  });

  it('PATCH /:id with same status does NOT trigger transition check (no fetch needed beyond update)', async () => {
    const repo = makePromiseReturningApplicationsAdapter({
      9: { id: 9, companyName: 'Acme', status: 'applied' },
    });
    const app = makeApp(repo);

    const res = await request(app, '/api/applications/9', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'applied', notes: 'still applied' }),
    });

    expect(res.status).toBe(200);
    // getById is called once for the status check (status was provided),
    // then update is called once.
    expect(repo.getById).toHaveBeenCalledTimes(1);
    expect(repo.update).toHaveBeenCalledTimes(1);
  });
});
