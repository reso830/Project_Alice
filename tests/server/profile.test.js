import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { getProfile, saveProfile } from '../../server/db/profile.js';
import { createApp } from '../../server/index.js';
import { makeMemoryDb, makeTestDb } from './helpers.js';

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
    expect(profile.languages).toEqual(['English']);

    reopened.close();
    testDb.cleanup();
  });
});
