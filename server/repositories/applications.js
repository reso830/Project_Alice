import {
  archive,
  create,
  getAll,
  getAllArchived,
  getById,
  unarchive,
  update,
} from '../db/applications.js';

/**
 * @typedef {Object} ApplicationsRepository
 * @property {() => object[]} getAll
 * @property {() => object[]} getAllArchived
 * @property {(id: number) => object | null} getById
 * @property {(fields: object, now?: string) => object} create
 * @property {(id: number, fields: object, now?: string) => object | null} update
 * @property {(id: number, now?: string) => object | null} archive
 * @property {(id: number, now?: string) => object | null} unarchive
 *
 * The optional `now` arg is a YYYY-MM-DD string the route handler derives
 * from `X-Client-Date` (see server/middleware/requestDate.js, issue #43).
 * Omitting it falls back to UTC `currentDate()` inside the underlying
 * db/applications.js helpers.
 */

/**
 * @param {import('better-sqlite3').Database} db
 * @returns {ApplicationsRepository}
 */
export function createSqliteApplicationsRepository(db) {
  return {
    getAll: () => getAll(db),
    getAllArchived: () => getAllArchived(db),
    getById: (id) => getById(id, db),
    create: (fields, now) => create(fields, db, now),
    update: (id, fields, now) => update(id, fields, db, now),
    archive: (id, now) => archive(id, db, now),
    unarchive: (id, now) => unarchive(id, db, now),
  };
}
