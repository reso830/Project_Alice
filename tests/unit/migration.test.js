import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

import { initSchema } from '../../server/db.js';
import { runMigrations } from '../../server/db/migration.js';

const roots = [];

function makeFileDb() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'alice-migration-'));
  roots.push(root);
  const dbPath = path.join(root, 'alice.db');
  return { db: new Database(dbPath), dbPath };
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('SQLite migration runner', () => {
  test('applies unapplied migrations sequentially and logs the ledger', () => {
    const db = new Database(':memory:');
    const calls = [];

    runMigrations(db, {
      now: () => new Date('2026-06-28T00:00:00.000Z'),
      migrations: [
        {
          id: '002-second',
          up(targetDb) {
            calls.push('second');
            targetDb.exec('CREATE TABLE second_table (id INTEGER PRIMARY KEY)');
          },
        },
        {
          id: '001-first',
          up(targetDb) {
            calls.push('first');
            targetDb.exec('CREATE TABLE first_table (id INTEGER PRIMARY KEY)');
          },
        },
      ],
    });

    expect(calls).toEqual(['first', 'second']);
    expect(db.prepare('SELECT id, applied_at FROM schema_migrations ORDER BY id').all()).toEqual([
      { id: '001-first', applied_at: '2026-06-28T00:00:00.000Z' },
      { id: '002-second', applied_at: '2026-06-28T00:00:00.000Z' },
    ]);

    calls.length = 0;
    runMigrations(db, {
      migrations: [
        { id: '001-first', up: () => calls.push('first') },
        { id: '002-second', up: () => calls.push('second') },
      ],
    });
    expect(calls).toEqual([]);
  });

  test('rolls back a failed migration transaction and does not log it', () => {
    const db = new Database(':memory:');

    expect(() =>
      runMigrations(db, {
        migrations: [
          {
            id: '001-fails',
            up(targetDb) {
              targetDb.exec('CREATE TABLE transient_table (id INTEGER PRIMARY KEY)');
              throw new Error('boom');
            },
          },
        ],
      }),
    ).toThrow(/boom/);

    expect(
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'transient_table'").get(),
    ).toBeUndefined();
    expect(db.prepare('SELECT id FROM schema_migrations').all()).toEqual([]);
  });

  test('blocks startup when the database contains an unknown future migration', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
      INSERT INTO schema_migrations (id, applied_at) VALUES ('999-future', '2026-06-28T00:00:00.000Z');
    `);

    expect(() =>
      runMigrations(db, {
        migrations: [{ id: '001-init', up: () => {} }],
      }),
    ).toThrow(/newer than this Alice build.*999-future/);
  });

  test('baselines legacy databases with existing app tables before running later migrations', () => {
    const db = new Database(':memory:');
    db.exec('CREATE TABLE applications (id INTEGER PRIMARY KEY)');

    runMigrations(db, {
      now: () => new Date('2026-06-28T00:00:00.000Z'),
      migrations: [
        {
          id: '001-init',
          up() {
            throw new Error('legacy DB should skip init');
          },
        },
        {
          id: '002-next',
          up(targetDb) {
            targetDb.exec('CREATE TABLE next_table (id INTEGER PRIMARY KEY)');
          },
        },
      ],
    });

    expect(db.prepare('SELECT id FROM schema_migrations ORDER BY id').all()).toEqual([
      { id: '001-init' },
      { id: '002-next' },
    ]);
    expect(
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'next_table'").get(),
    ).toBeTruthy();
  });

  test('initSchema restores the exact pre-migration database file when initialization fails', () => {
    const { db, dbPath } = makeFileDb();
    db.exec(`
      CREATE TABLE profile (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
      INSERT INTO profile (id, name) VALUES (1, 'Alice');
    `);
    const originalBytes = fs.readFileSync(dbPath);

    expect(() =>
      initSchema(db, {
        migrations: [
          {
            id: '001-init',
            up() {
              throw new Error('legacy database should baseline the init migration');
            },
          },
          {
            id: '002-bad-syntax',
            up(targetDb) {
              targetDb.exec('CREATE TABLE transient_migration_table (id INTEGER PRIMARY KEY)');
              targetDb.exec('CREAT TABLE invalid_migration_sql (id INTEGER PRIMARY KEY)');
            },
          },
        ],
      }),
    ).toThrow(/syntax error|near "CREAT"/);
    db.close();

    expect(fs.readFileSync(dbPath)).toEqual(originalBytes);
    const reopened = new Database(dbPath);
    expect(reopened.prepare('SELECT id, name FROM profile').all()).toEqual([{ id: 1, name: 'Alice' }]);
    expect(
      reopened
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
        .get(),
    ).toBeUndefined();
    expect(
      reopened
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'transient_migration_table'",
        )
        .get(),
    ).toBeUndefined();
    reopened.close();
    expect(fs.existsSync(`${dbPath}.migration-backup`)).toBe(false);
  });
});
