import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { getProfile, saveProfile } from '../../server/db/profile.js';
import { createApp } from '../../server/index.js';
import { createSqliteRepositories } from '../../server/repositories/index.js';
import { makeMemoryDb, makeTestDb, wrapAsDispatcher } from './helpers.js';

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

describe('profile API', () => {
  it('returns null when no profile exists', async () => {
    await withServer(async (baseUrl) => {
      const response = await request(baseUrl, '/api/profile');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: null });
    });
  });

  it('saves and reads a valid profile through the API', async () => {
    await withServer(async (baseUrl) => {
      const saved = await request(baseUrl, '/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          firstName: ' Ana ',
          lastName: ' Rivera ',
          email: 'ana@example.com',
          skills: [' JavaScript ', ' CSS '],
        }),
      });
      const fetched = await request(baseUrl, '/api/profile');

      expect(saved.status).toBe(200);
      expect(saved.body.data).toMatchObject({
        firstName: 'Ana',
        lastName: 'Rivera',
        email: 'ana@example.com',
        skills: [
          { name: 'JavaScript', level: 2 },
          { name: 'CSS', level: 2 },
        ],
      });
      expect(fetched.body).toEqual(saved.body);
    });
  });

  it('round-trips structured profile entries through the API', async () => {
    await withServer(async (baseUrl) => {
      const payload = {
        firstName: 'Ana',
        lastName: 'Rivera',
        experience: [{
          role: 'Engineer',
          company: 'Acme',
          responsibilities: 'Build apps',
          dateStarted: '01/2022',
          currentWork: true,
        }],
        education: [{
          degreeMajor: 'BS Computer Science',
          university: 'State University',
          yearCompleted: '2020',
        }],
        certifications: [{
          name: 'AWS Developer',
          issuingBody: 'Amazon',
          certificateId: 'ABC',
          issuanceDate: '02/2023',
          expiryDate: '02/2026',
        }],
        awards: [{
          awardName: 'Top Performer',
          issuingBody: 'Acme',
          details: 'Quarterly award',
          date: '03/2024',
        }],
        languages: [{
          language: 'English',
          proficiency: 'Fluent',
        }],
        links: [{
          url: 'https://example.com',
          friendlyName: 'Portfolio',
        }],
      };

      const saved = await request(baseUrl, '/api/profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const fetched = await request(baseUrl, '/api/profile');

      expect(saved.status).toBe(200);
      expect(saved.body.data).toMatchObject(payload);
      expect(fetched.body).toEqual(saved.body);
    });
  });

  it('rejects invalid profiles without writing', async () => {
    await withServer(async (baseUrl, db) => {
      const response = await request(baseUrl, '/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ lastName: 'Rivera' }),
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          fields: { firstName: 'First Name is required.' },
        },
      });
      expect(getProfile(db)).toBeNull();
    });
  });

  it('rejects invalid structured entries without writing', async () => {
    await withServer(async (baseUrl, db) => {
      const missingRole = await request(baseUrl, '/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          firstName: 'Ana',
          lastName: 'Rivera',
          experience: [{
            company: 'Acme',
            responsibilities: 'Build apps',
            dateStarted: '01/2022',
            currentWork: true,
          }],
        }),
      });
      const missingUrl = await request(baseUrl, '/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          firstName: 'Ana',
          lastName: 'Rivera',
          links: [{ friendlyName: 'Portfolio' }],
        }),
      });
      const invalidEducationYear = await request(baseUrl, '/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          firstName: 'Ana',
          lastName: 'Rivera',
          education: [{
            degreeMajor: 'BS Computer Science',
            university: 'State University',
            yearCompleted: '20-20',
          }],
        }),
      });

      expect(missingRole.status).toBe(400);
      expect(missingRole.body.error.code).toBe('VALIDATION_ERROR');
      expect(missingRole.body.error.fields).toMatchObject({
        'experience[0].role': 'Role is required.',
      });
      expect(missingUrl.status).toBe(400);
      expect(missingUrl.body.error.code).toBe('VALIDATION_ERROR');
      expect(missingUrl.body.error.fields).toMatchObject({
        'links[0].url': 'URL is required.',
      });
      expect(invalidEducationYear.status).toBe(400);
      expect(invalidEducationYear.body.error.code).toBe('VALIDATION_ERROR');
      expect(invalidEducationYear.body.error.fields).toMatchObject({
        'education[0].yearCompleted': 'Year Completed must be a valid four-digit year.',
      });
      expect(getProfile(db)).toBeNull();
    });
  });

  it('normalises backward-compatible profile shapes in storage', () => {
    const testDb = makeTestDb();

    const saved = saveProfile({
      firstName: 'Ana',
      lastName: 'Rivera',
      experience: [{
        role: 'Engineer',
        company: 'Acme',
        desc: 'Built apps',
      }],
      education: [{
        degree: 'BS Computer Science',
        school: 'State University',
        year: '2020',
      }],
      certifications: ['AWS Developer'],
      awards: ['Top Performer'],
      languages: ['English'],
      links: [{
        label: 'Portfolio',
        url: 'https://example.com',
        platform: 'Web',
      }],
    }, testDb.db);

    expect(saved).toMatchObject({
      experience: [{
        role: 'Engineer',
        company: 'Acme',
        responsibilities: 'Built apps',
        dateStarted: '',
        dateEnded: '',
        currentWork: false,
      }],
      education: [{
        degreeMajor: 'BS Computer Science',
        university: 'State University',
        yearCompleted: '2020',
      }],
      certifications: [{
        name: 'AWS Developer',
        issuanceDate: '',
      }],
      awards: [{
        awardName: 'Top Performer',
        issuingBody: '',
      }],
      languages: [{
        language: 'English',
        proficiency: '',
      }],
      links: [{
        url: 'https://example.com',
        friendlyName: 'Portfolio',
      }],
    });

    testDb.close();
    testDb.cleanup();
  });

  it('persists a profile after reopening the SQLite database', () => {
    const testDb = makeTestDb();

    const saved = saveProfile({
      firstName: 'Ana',
      lastName: 'Rivera',
      summary: 'Frontend engineer',
      languages: ['English'],
    }, testDb.db);

    testDb.close();

    const reopened = new Database(testDb.path);
    const profile = getProfile(reopened);

    expect(profile).toMatchObject(saved);
    expect(profile.languages).toEqual([{ language: 'English', proficiency: '' }]);

    reopened.close();
    testDb.cleanup();
  });

  it('embeds structured skills with their levels and order on GET (post-refactor parity)', async () => {
    await withServer(async (baseUrl) => {
      const skills = [
        { name: 'JavaScript', level: 5 },
        { name: 'CSS', level: 3 },
        { name: 'SQLite', level: 2 },
      ];

      const saved = await request(baseUrl, '/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ firstName: 'Ana', lastName: 'Rivera', skills }),
      });
      const fetched = await request(baseUrl, '/api/profile');

      expect(saved.status).toBe(200);
      // Skills are reassembled from rows into the embedded array, same order.
      expect(saved.body.data.skills).toEqual(skills);
      // A fresh GET shows persistence with the identical embedded shape.
      expect(fetched.body.data.skills).toEqual(skills);
    });
  });

  it('still enforces 031 skill validation rules through the API without writing', async () => {
    await withServer(async (baseUrl, db) => {
      const base = { firstName: 'Ana', lastName: 'Rivera' };

      const unrated = await request(baseUrl, '/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ ...base, skills: [{ name: 'React' }] }),
      });
      const blank = await request(baseUrl, '/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ ...base, skills: [{ name: '   ', level: 3 }] }),
      });
      const duplicate = await request(baseUrl, '/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          ...base,
          skills: [{ name: 'React', level: 3 }, { name: ' react ', level: 4 }],
        }),
      });
      const tooMany = await request(baseUrl, '/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          ...base,
          skills: Array.from({ length: 51 }, (_, index) => ({
            name: `Skill ${index}`,
            level: 3,
          })),
        }),
      });

      expect(unrated.status).toBe(400);
      expect(unrated.body.error.code).toBe('VALIDATION_ERROR');
      expect(unrated.body.error.fields).toHaveProperty('skills[0].level');
      expect(blank.body.error.fields).toHaveProperty('skills[0].name');
      expect(duplicate.body.error.fields).toHaveProperty('skills.duplicate');
      expect(tooMany.body.error.fields).toHaveProperty('skills.max');

      // None of the rejected payloads were persisted.
      expect(getProfile(db)).toBeNull();
    });
  });

  it('exposes only GET and PUT on /api/profile — no new skill routes (FR-012)', async () => {
    await withServer(async (baseUrl) => {
      // Raw fetch (not the JSON helper): Express's default 404 returns HTML.
      const post = await globalThis.fetch(`${baseUrl}/api/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const del = await globalThis.fetch(`${baseUrl}/api/profile`, { method: 'DELETE' });
      const skillsRoute = await globalThis.fetch(`${baseUrl}/api/profile/skills`);

      expect(post.status).toBe(404);
      expect(del.status).toBe(404);
      expect(skillsRoute.status).toBe(404);
    });
  });
});
