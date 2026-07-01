import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

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
  vi.restoreAllMocks();
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

  test('initSchema preserves the backup and rethrows the original error when restore fails', () => {
    const { db, dbPath } = makeFileDb();
    const backupPath = `${dbPath}.migration-backup`;
    db.exec(`
      CREATE TABLE profile (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
      INSERT INTO profile (id, name) VALUES (1, 'Alice');
    `);

    const originalCopyFileSync = fs.copyFileSync;
    vi.spyOn(fs, 'copyFileSync').mockImplementation((source, destination) => {
      if (source === backupPath && destination === dbPath) {
        const error = new Error('restore denied');
        error.code = 'EPERM';
        throw error;
      }
      return originalCopyFileSync(source, destination);
    });

    let caught;
    try {
      initSchema(db, {
        migrations: [
          {
            id: '001-init',
            up() {
              throw new Error('legacy database should baseline the init migration');
            },
          },
          {
            id: '002-original-failure',
            up(targetDb) {
              targetDb.exec('CREATE TABLE transient_migration_table (id INTEGER PRIMARY KEY)');
              throw new Error('original migration failure');
            },
          },
        ],
      });
    } catch (error) {
      caught = error;
    }
    db.close();

    expect(caught).toBeInstanceOf(Error);
    expect(caught.message).toBe('original migration failure');
    expect(caught.migrationRestoreError).toMatchObject({ code: 'EPERM' });
    expect(fs.existsSync(backupPath)).toBe(true);
  });

  test('initSchema restores the exact database file when the additive backfill step fails', () => {
    const { db, dbPath } = makeFileDb();
    db.exec(`
      CREATE TABLE applications (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name        TEXT    NOT NULL,
        job_title           TEXT    NOT NULL,
        status              TEXT    NOT NULL DEFAULT 'wishlisted',
        compat              INTEGER NOT NULL DEFAULT 0,
        fav                 INTEGER NOT NULL DEFAULT 0,
        source_platform     TEXT,
        application_date    TEXT,
        job_posting_url     TEXT,
        recruiter           TEXT,
        notes               TEXT,
        salary              TEXT,
        responsibilities    TEXT,
        skills              TEXT,
        follow_up_action    TEXT,
        follow_up_date      TEXT,
        last_status_update  TEXT    NOT NULL,
        created_at          TEXT    NOT NULL,
        updated_at          TEXT    NOT NULL,
        archived            INTEGER NOT NULL DEFAULT 0,
        metadata            TEXT,
        archived_date       TEXT,
        location            TEXT,
        shift               TEXT,
        work_setup          TEXT,
        compat_notes        TEXT,
        compat_analysis     TEXT,
        compat_scored_at    TEXT,
        general_notes       TEXT,
        preferred_skills    TEXT,
        timeline            TEXT NOT NULL DEFAULT '[]'
      );
      INSERT INTO applications (
        company_name,
        job_title,
        status,
        responsibilities,
        last_status_update,
        created_at,
        updated_at
      ) VALUES (
        'Legacy Co',
        'Frontend Engineer',
        'applied',
        'Build UI',
        '2026-06-10',
        '2026-06-10',
        '2026-06-10'
      );
      CREATE TABLE profile (
        id          INTEGER PRIMARY KEY CHECK (id = 1),
        data        TEXT    NOT NULL,
        updated_at  TEXT    NOT NULL
      );
    `);
    const originalBytes = fs.readFileSync(dbPath);

    expect(() =>
      initSchema(db, {
        backfillCompatibilityFn() {
          throw new Error('forced additive backfill failure');
        },
      }),
    ).toThrow(/forced additive backfill failure/);
    db.close();

    expect(fs.readFileSync(dbPath)).toEqual(originalBytes);
    const reopened = new Database(dbPath);
    expect(
      reopened.prepare('PRAGMA table_info(applications)').all().map((column) => column.name),
    ).not.toContain('min_years_experience');
    expect(reopened.prepare('SELECT company_name FROM applications').all()).toEqual([
      { company_name: 'Legacy Co' },
    ]);
    reopened.close();
    expect(fs.existsSync(`${dbPath}.migration-backup`)).toBe(false);
  });

  test('initSchema skips the backup copy on an already-current database', () => {
    const { db, dbPath } = makeFileDb();
    initSchema(db);

    const copySpy = vi.spyOn(fs, 'copyFileSync');
    initSchema(db);
    db.close();

    expect(copySpy).not.toHaveBeenCalledWith(dbPath, `${dbPath}.migration-backup`);
    expect(fs.existsSync(`${dbPath}.migration-backup`)).toBe(false);
  });
});
