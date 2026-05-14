import {
  archive,
  create,
  getAll,
  getById,
  update,
} from '../db/applications.js';

/**
 * @typedef {Object} ApplicationsRepository
 * @property {() => object[]} getAll
 * @property {(id: number) => object | null} getById
 * @property {(fields: object) => object} create
 * @property {(id: number, fields: object) => object | null} update
 * @property {(id: number) => object | null} archive
 */

/**
 * @param {import('better-sqlite3').Database} db
 * @returns {ApplicationsRepository}
 */
export function createSqliteApplicationsRepository(db) {
  return {
    getAll: () => getAll(db),
    getById: (id) => getById(id, db),
    create: (fields) => create(fields, db),
    update: (id, fields) => update(id, fields, db),
    archive: (id) => archive(id, db),
  };
}
