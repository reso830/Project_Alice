import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { getProfile, saveProfile } from '../../server/db/profile.js';
import { createApp } from '../../server/index.js';
import { createTestRepositories } from '../../server/repositories/index.js';
import { makeMemoryDb, makeTestDb } from './helpers.js';

async function withServer(test) {
  const db = makeMemoryDb();
  const app = createApp({ repositories: createTestRepositories(db) });
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
        skills: ['JavaScript', 'CSS'],
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
});
