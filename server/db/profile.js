import { db } from '../db.js';
import { normaliseProfile } from '../../src/models/profile.js';

const PROFILE_ID = 1;

export function toRecord(row) {
  if (!row) {
    return null;
  }

  return JSON.parse(row.data);
}

export function getProfile(targetDb = db) {
  const row = targetDb.prepare('SELECT data FROM profile WHERE id = ?').get(PROFILE_ID);
  return toRecord(row);
}

export function saveProfile(profile, targetDb = db) {
  const normalised = normaliseProfile(profile);
  const data = JSON.stringify(normalised);

  targetDb.prepare(`
    INSERT INTO profile (id, data, updated_at)
    VALUES (@id, @data, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      data = excluded.data,
      updated_at = excluded.updated_at
  `).run({
    id: PROFILE_ID,
    data,
  });

  return getProfile(targetDb);
}
