import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DATA_DIR = path.resolve('data');
const DB_PATH = process.env.ALICE_DB_PATH || path.join(DATA_DIR, 'alice.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);

function ensureColumn(targetDb, table, column, definition) {
  const columns = targetDb.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((entry) => entry.name === column)) {
    targetDb.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function initSchema(targetDb = db) {
  targetDb.exec(`
    CREATE TABLE IF NOT EXISTS applications (
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
      metadata            TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_applications_status
      ON applications(status);
    CREATE INDEX IF NOT EXISTS idx_applications_archived
      ON applications(archived);
    CREATE INDEX IF NOT EXISTS idx_applications_created
      ON applications(created_at);

    CREATE TABLE IF NOT EXISTS profile (
      id          INTEGER PRIMARY KEY CHECK (id = 1),
      data        TEXT    NOT NULL,
      updated_at  TEXT    NOT NULL
    );
  `);

  ensureColumn(targetDb, 'applications', 'archived', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(targetDb, 'applications', 'location', 'TEXT');
  ensureColumn(targetDb, 'applications', 'shift', 'TEXT');
  ensureColumn(targetDb, 'applications', 'work_setup', 'TEXT');
  ensureColumn(targetDb, 'applications', 'compat_notes', 'TEXT');
  ensureColumn(targetDb, 'applications', 'general_notes', 'TEXT');
  ensureColumn(targetDb, 'applications', 'preferred_skills', 'TEXT');
}
