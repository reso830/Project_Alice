import { getProfile, saveProfile } from '../db/profile.js';

/**
 * @typedef {Object} ProfileRepository
 * @property {() => object | null} get
 * @property {(data: object) => object} upsert
 */

/**
 * @param {import('better-sqlite3').Database} db
 * @returns {ProfileRepository}
 */
export function createSqliteProfileRepository(db) {
  return {
    get: () => getProfile(db),
    upsert: (data) => saveProfile(data, db),
  };
}
