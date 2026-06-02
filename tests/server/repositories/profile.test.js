import { describe, expect, it } from 'vitest';
import { createSqliteRepositories } from '../../../server/repositories/index.js';
import { makeMemoryDb } from '../helpers.js';

async function withProfileRepository(test) {
  const db = makeMemoryDb();
  const repositories = await createSqliteRepositories(db);

  try {
    await test(repositories.profile, db);
  } finally {
    db.close();
  }
}

function getStoredProfileData(db) {
  const row = db.prepare('SELECT data FROM profile WHERE id = 1').get();
  return row ? JSON.parse(row.data) : null;
}

function getSkillRows(db) {
  return db
    .prepare('SELECT profile_id, skill_name, proficiency FROM profile_skill WHERE profile_id = 1 ORDER BY id ASC')
    .all();
}

describe('SQLite profile repository', () => {
  it('returns null when no profile exists', async () => {
    await withProfileRepository((repo) => {
      expect(repo.get()).toBeNull();
    });
  });

  it('upserts and reads profile data with skills stored as rows', async () => {
    await withProfileRepository((repo, db) => {
      const saved = repo.upsert({
        firstName: ' Ana ',
        lastName: ' Rivera ',
        email: 'ana@example.com',
        skills: [
          { name: ' JavaScript ', level: 4 },
          { name: ' CSS ', level: 3 },
        ],
      });

      expect(saved).toMatchObject({
        firstName: 'Ana',
        lastName: 'Rivera',
        email: 'ana@example.com',
        skills: [
          { name: 'JavaScript', level: 4 },
          { name: 'CSS', level: 3 },
        ],
      });
      expect(repo.get()).toEqual(saved);
      expect(getStoredProfileData(db)).not.toHaveProperty('skills');
      expect(getSkillRows(db)).toEqual([
        { profile_id: 1, skill_name: 'JavaScript', proficiency: 4 },
        { profile_id: 1, skill_name: 'CSS', proficiency: 3 },
      ]);
    });
  });

  it('migrates legacy string skills to Basic during upsert and get', async () => {
    await withProfileRepository((repo) => {
      const saved = repo.upsert({
        firstName: 'Ana',
        lastName: 'Rivera',
        skills: [' JavaScript ', ' CSS '],
      });

      expect(saved.skills).toEqual([
        { name: 'JavaScript', level: 2 },
        { name: 'CSS', level: 2 },
      ]);
      expect(repo.get().skills).toEqual(saved.skills);
    });
  });

  it('preserves skill order across a re-save that reorders skills', async () => {
    await withProfileRepository((repo, db) => {
      repo.upsert({
        firstName: 'Ana',
        lastName: 'Rivera',
        skills: [
          { name: 'JavaScript', level: 4 },
          { name: 'CSS', level: 3 },
          { name: 'SQLite', level: 2 },
        ],
      });

      const saved = repo.upsert({
        firstName: 'Ana',
        lastName: 'Rivera',
        skills: [
          { name: 'SQLite', level: 2 },
          { name: 'JavaScript', level: 4 },
          { name: 'CSS', level: 3 },
        ],
      });

      expect(saved.skills).toEqual([
        { name: 'SQLite', level: 2 },
        { name: 'JavaScript', level: 4 },
        { name: 'CSS', level: 3 },
      ]);
      expect(getSkillRows(db).map((row) => row.skill_name)).toEqual(['SQLite', 'JavaScript', 'CSS']);
    });
  });

  it('stores empty skills as zero rows and returns an empty skills array', async () => {
    await withProfileRepository((repo, db) => {
      const saved = repo.upsert({
        firstName: 'Ana',
        lastName: 'Rivera',
        skills: [],
      });

      expect(saved.skills).toEqual([]);
      expect(repo.get().skills).toEqual([]);
      expect(getSkillRows(db)).toEqual([]);
      expect(getStoredProfileData(db)).not.toHaveProperty('skills');
    });
  });

  it('lazily migrates an embedded skills document on first read and is idempotent', async () => {
    await withProfileRepository((repo, db) => {
      const legacyDocument = {
        firstName: 'Ana',
        lastName: 'Rivera',
        summary: ' Legacy summary with spacing  ',
        skills: [
          { name: 'Jira', level: 3 },
          ' CSS ',
          42,
        ],
      };

      db.prepare(`
        INSERT INTO profile (id, data, updated_at)
        VALUES (1, @data, datetime('now'))
      `).run({ data: JSON.stringify(legacyDocument) });

      const migrated = repo.get();
      const rowsAfterFirstRead = getSkillRows(db);
      const documentAfterFirstRead = getStoredProfileData(db);
      const migratedAgain = repo.get();

      expect(migrated).toEqual({
        firstName: 'Ana',
        lastName: 'Rivera',
        summary: ' Legacy summary with spacing  ',
        skills: [
          { name: 'Jira', level: 3 },
          { name: 'CSS', level: 2 },
        ],
      });
      expect(documentAfterFirstRead).toEqual({
        firstName: 'Ana',
        lastName: 'Rivera',
        summary: ' Legacy summary with spacing  ',
      });
      expect(rowsAfterFirstRead).toEqual([
        { profile_id: 1, skill_name: 'Jira', proficiency: 3 },
        { profile_id: 1, skill_name: 'CSS', proficiency: 2 },
      ]);
      expect(migratedAgain).toEqual(migrated);
      expect(getSkillRows(db)).toEqual(rowsAfterFirstRead);
      expect(getStoredProfileData(db)).toEqual(documentAfterFirstRead);
    });
  });

  it('migrates distinct skills loss-free while dropping junk', async () => {
    await withProfileRepository((repo, db) => {
      db.prepare(`
        INSERT INTO profile (id, data, updated_at)
        VALUES (1, @data, datetime('now'))
      `).run({
        data: JSON.stringify({
          firstName: 'Ana',
          lastName: 'Rivera',
          skills: [
            { name: 'React', level: 5 },
            ' SQL ',
            null,
            {},
            '',
          ],
        }),
      });

      expect(repo.get().skills).toEqual([
        { name: 'React', level: 5 },
        { name: 'SQL', level: 2 },
      ]);
      expect(getSkillRows(db)).toEqual([
        { profile_id: 1, skill_name: 'React', proficiency: 5 },
        { profile_id: 1, skill_name: 'SQL', proficiency: 2 },
      ]);
    });
  });

  it('drops blank names and collapses duplicate skills before migration insert', async () => {
    await withProfileRepository((repo, db) => {
      db.prepare(`
        INSERT INTO profile (id, data, updated_at)
        VALUES (1, @data, datetime('now'))
      `).run({
        data: JSON.stringify({
          firstName: 'Ana',
          lastName: 'Rivera',
          skills: [
            { name: 'React', level: 5 },
            { name: ' react ', level: 2 },
            { name: '  ', level: 3 },
            { name: 'Node  JS', level: 4 },
            { name: 'node js', level: 1 },
          ],
        }),
      });

      expect(repo.get().skills).toEqual([
        { name: 'React', level: 5 },
        { name: 'Node  JS', level: 4 },
      ]);
      expect(getSkillRows(db)).toEqual([
        { profile_id: 1, skill_name: 'React', proficiency: 5 },
        { profile_id: 1, skill_name: 'Node  JS', proficiency: 4 },
      ]);
    });
  });
});
