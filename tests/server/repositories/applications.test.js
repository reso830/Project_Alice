import { describe, expect, it } from 'vitest';
import { createTestRepositories } from '../../../server/repositories/index.js';
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
  const repositories = await createTestRepositories(db);

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

  it('archives an application record and returns null for an unknown id', async () => {
    await withApplicationsRepository((repo) => {
      const record = repo.create(validApplication({ fav: true }));
      const archived = repo.archive(record.id);

      expect(archived).toMatchObject({
        id: record.id,
        archived: true,
        fav: false,
      });
      expect(repo.archive(99999)).toBeNull();
    });
  });
});
