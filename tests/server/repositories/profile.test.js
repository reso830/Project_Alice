import { describe, expect, it } from 'vitest';
import { createSqliteRepositories } from '../../../server/repositories/index.js';
import { makeMemoryDb } from '../helpers.js';

async function withProfileRepository(test) {
  const db = makeMemoryDb();
  const repositories = await createSqliteRepositories(db);

  try {
    await test(repositories.profile);
  } finally {
    db.close();
  }
}

describe('SQLite profile repository', () => {
  it('returns null when no profile exists', async () => {
    await withProfileRepository((repo) => {
      expect(repo.get()).toBeNull();
    });
  });

  it('upserts and reads profile data', async () => {
    await withProfileRepository((repo) => {
      const saved = repo.upsert({
        firstName: ' Ana ',
        lastName: ' Rivera ',
        email: 'ana@example.com',
        skills: [' JavaScript ', ' CSS '],
      });

      expect(saved).toMatchObject({
        firstName: 'Ana',
        lastName: 'Rivera',
        email: 'ana@example.com',
        skills: ['JavaScript', 'CSS'],
      });
      expect(repo.get()).toEqual(saved);
    });
  });
});
