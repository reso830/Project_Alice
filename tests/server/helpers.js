import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { initSchema } from '../../server/db.js';

export function makeTestDb() {
  const dbPath = path.join(
    os.tmpdir(),
    `project-alice-test-${process.pid}-${Date.now()}.db`,
  );
  const db = new Database(dbPath);
  initSchema(db);
  let closed = false;

  function close() {
    if (!closed) {
      db.close();
      closed = true;
    }
  }

  return {
    db,
    path: dbPath,
    close,
    cleanup() {
      close();
      fs.rmSync(dbPath, { force: true });
    },
  };
}

export function makeMemoryDb() {
  const db = new Database(':memory:');
  initSchema(db);
  return db;
}

/**
 * Wrap a flat `{ applications, profile }` repository bundle (typically the
 * return of `createSqliteRepositories(db)`) in the dispatcher shape expected
 * by `createApp({ repositories })`. After Phase 05, `createApp` consumes
 * the uniform `{ forRequest(req) }` contract; this helper bridges legacy
 * test fixtures without forcing every test to refactor.
 *
 * @template T
 * @param {T} repos
 * @returns {{ forRequest: () => T }}
 */
export function wrapAsDispatcher(repos) {
  return { forRequest: () => repos };
}
