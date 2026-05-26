import { describe, expect, it } from 'vitest';
import { createSqliteRepositories } from '../../../server/repositories/index.js';
import { makeMemoryDb } from '../helpers.js';

function validApplication(overrides = {}) {
  return {
    companyName: 'Acme Corp',
    jobTitle: 'Frontend Engineer',
    status: 'applied',
    responsibilities: 'Build product UI',
    ...overrides,
  };
}

async function withApplicationsRepository(test) {
  const db = makeMemoryDb();
  const repositories = await createSqliteRepositories(db);

  try {
    await test(repositories.applications);
  } finally {
    db.close();
  }
}

describe('SQLite applications repository', () => {
  it('returns an empty list for a fresh database', async () => {
    await withApplicationsRepository((repo) => {
      expect(repo.getAll()).toEqual([]);
    });
  });

  it('creates and reads an application record', async () => {
    await withApplicationsRepository((repo) => {
      const record = repo.create(validApplication());

      expect(record).toMatchObject({
        id: expect.any(Number),
        companyName: 'Acme Corp',
        jobTitle: 'Frontend Engineer',
        status: 'applied',
        responsibilities: 'Build product UI',
        lastStatusUpdate: expect.any(String),
        createdAt: expect.any(String),
        timeline: [],
      });
      expect(repo.getById(record.id)).toEqual(record);
      expect(repo.getById(99999)).toBeNull();
    });
  });

  it('updates an application record and returns null for an unknown id', async () => {
    await withApplicationsRepository((repo) => {
      const record = repo.create(validApplication());
      const updated = repo.update(record.id, { companyName: 'Globex' });

      expect(updated).toMatchObject({
        id: record.id,
        companyName: 'Globex',
      });
      expect(repo.update(99999, {})).toBeNull();
    });
  });

  it('round-trips timeline through create and update', async () => {
    await withApplicationsRepository((repo) => {
      const initialTimeline = [
        { id: 1, date: '2026-05-21', status: 'applied', text: 'Submitted.' },
      ];
      const record = repo.create(validApplication({ timeline: initialTimeline }));

      expect(repo.getById(record.id).timeline).toEqual(initialTimeline);

      const nextTimeline = [
        ...initialTimeline,
        { id: 2, date: '2026-06-20', status: 'phone_screen', text: 'Callback scheduled.' },
      ];
      const updated = repo.update(record.id, { timeline: nextTimeline });

      expect(updated.timeline).toEqual(nextTimeline);
      expect(repo.getAll()[0].timeline).toEqual(nextTimeline);
    });
  });

  it('archives an application record and returns null for an unknown id', async () => {
    await withApplicationsRepository((repo) => {
      const record = repo.create(validApplication({ fav: true }));
      const archived = repo.archive(record.id, '2026-05-26');

      expect(archived).toMatchObject({
        id: record.id,
        archived: true,
        archivedDate: '2026-05-26',
        fav: true,
      });
      expect(repo.archive(99999)).toBeNull();
    });
  });

  it('creates the archived_date column during schema init', async () => {
    const db = makeMemoryDb();
    try {
      const columns = db.prepare('PRAGMA table_info(applications)').all();
      expect(columns.map((column) => column.name)).toContain('archived_date');
    } finally {
      db.close();
    }
  });

  it('unarchives an application without changing status, fav, or lastStatusUpdate', async () => {
    await withApplicationsRepository((repo) => {
      const record = repo.create(
        validApplication({ fav: true, status: 'rejected' }),
        '2026-05-01',
      );
      const archived = repo.archive(record.id, '2026-05-26');
      const restored = repo.unarchive(record.id, '2026-05-27');

      expect(restored).toMatchObject({
        id: record.id,
        archived: false,
        archivedDate: null,
        fav: true,
        status: 'rejected',
        lastStatusUpdate: archived.lastStatusUpdate,
        updatedAt: '2026-05-27',
      });
      expect(repo.unarchive(99999)).toBeNull();
    });
  });

  it('preserves archivedDate and updatedAt on repeated archive calls', async () => {
    await withApplicationsRepository((repo) => {
      const record = repo.create(validApplication(), '2026-05-01');
      const first = repo.archive(record.id, '2026-05-26');
      const second = repo.archive(record.id, '2026-06-01');

      expect(second.archivedDate).toBe(first.archivedDate);
      expect(second.updatedAt).toBe(first.updatedAt);
    });
  });

  it('preserves updatedAt on repeated unarchive calls', async () => {
    await withApplicationsRepository((repo) => {
      const record = repo.create(validApplication(), '2026-05-01');
      repo.archive(record.id, '2026-05-26');
      const first = repo.unarchive(record.id, '2026-05-27');
      const second = repo.unarchive(record.id, '2026-05-28');

      expect(second.updatedAt).toBe(first.updatedAt);
      expect(second.archived).toBe(false);
      expect(second.archivedDate).toBeNull();
    });
  });

  it('lists archived applications separately in createdAt descending order', async () => {
    await withApplicationsRepository((repo) => {
      const first = repo.create(validApplication({ companyName: 'First' }), '2026-05-01');
      const second = repo.create(validApplication({ companyName: 'Second' }), '2026-05-02');
      const active = repo.create(validApplication({ companyName: 'Active' }), '2026-05-03');
      repo.archive(first.id, '2026-05-20');
      repo.archive(second.id, '2026-05-21');

      expect(repo.getAllArchived().map((record) => record.companyName)).toEqual([
        'Second',
        'First',
      ]);
      expect(repo.getAll().map((record) => record.id)).toEqual([active.id]);
    });
  });

  // Issue #43 — wrapper must forward the caller-supplied `now` so audit
  // timestamps reflect the request's local timezone, not the server's UTC
  // fallback.

  it('create() persists the supplied `now` into createdAt/updatedAt/lastStatusUpdate', async () => {
    await withApplicationsRepository((repo) => {
      const record = repo.create(validApplication(), '2030-01-15');
      expect(record.createdAt).toBe('2030-01-15');
      expect(record.updatedAt).toBe('2030-01-15');
      expect(record.lastStatusUpdate).toBe('2030-01-15');
    });
  });

  it('update() persists the supplied `now` into updatedAt (and lastStatusUpdate on status change)', async () => {
    await withApplicationsRepository((repo) => {
      const record = repo.create(validApplication(), '2030-01-15');
      const updated = repo.update(record.id, { status: 'interview' }, '2030-02-20');
      expect(updated.updatedAt).toBe('2030-02-20');
      expect(updated.lastStatusUpdate).toBe('2030-02-20');
      // createdAt is immutable.
      expect(updated.createdAt).toBe('2030-01-15');
    });
  });

  it('update() preserves the no-op contract: no fields → no updatedAt write', async () => {
    await withApplicationsRepository((repo) => {
      const record = repo.create(validApplication(), '2030-01-15');
      const result = repo.update(record.id, {}, '2030-02-20');
      // Returns the current record unchanged; updatedAt stays at create time.
      expect(result.updatedAt).toBe('2030-01-15');
    });
  });

  it('archive() persists the supplied `now` into updatedAt', async () => {
    await withApplicationsRepository((repo) => {
      const record = repo.create(validApplication(), '2030-01-15');
      const archived = repo.archive(record.id, '2030-03-10');
      expect(archived.updatedAt).toBe('2030-03-10');
    });
  });
});
