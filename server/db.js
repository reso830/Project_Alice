import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { computeCompatibility } from '../src/models/compatibility.js';
import { toRecord } from './db/columns.js';

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

function currentDate() {
  return new Date().toISOString().slice(0, 10);
}

function readProfileForCompatibility(targetDb) {
  const row = targetDb.prepare('SELECT data FROM profile WHERE id = 1').get();

  if (!row?.data) {
    return null;
  }

  try {
    const document = JSON.parse(row.data);
    const skills = targetDb.prepare(`
      SELECT skill_name, proficiency
      FROM profile_skill
      WHERE profile_id = 1
      ORDER BY id ASC
    `).all().map((skill) => ({
      name: skill.skill_name,
      level: skill.proficiency,
    }));

    return {
      ...document,
      skills: skills.length > 0 ? skills : (document.skills ?? []),
    };
  } catch {
    return null;
  }
}

function backfillCompatibility(targetDb, asOf) {
  const profile = readProfileForCompatibility(targetDb);

  if (!profile) {
    return;
  }

  const rows = targetDb.prepare('SELECT * FROM applications').all();
  if (rows.length === 0) {
    return;
  }

  const updateCompat = targetDb.prepare('UPDATE applications SET compat = @compat WHERE id = @id');

  targetDb.transaction(() => {
    for (const row of rows) {
      const application = toRecord(row);
      const compat = computeCompatibility(profile, application, { asOf }).score;

      if (compat !== application.compat) {
        updateCompat.run({ id: application.id, compat });
      }
    }
  })();
}

export function initSchema(targetDb = db, { compatBackfillAsOf = currentDate() } = {}) {
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

    CREATE TABLE IF NOT EXISTS profile_skill (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id  INTEGER NOT NULL DEFAULT 1 REFERENCES profile(id) ON DELETE CASCADE,
      skill_name  TEXT    NOT NULL,
      proficiency INTEGER NOT NULL CHECK (proficiency BETWEEN 1 AND 5)
    );

    CREATE INDEX IF NOT EXISTS idx_profile_skill_profile
      ON profile_skill(profile_id);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_skill_unique
      ON profile_skill(profile_id, lower(skill_name));
  `);

  ensureColumn(targetDb, 'applications', 'archived', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(targetDb, 'applications', 'archived_date', 'TEXT');
  ensureColumn(targetDb, 'applications', 'location', 'TEXT');
  ensureColumn(targetDb, 'applications', 'shift', 'TEXT');
  ensureColumn(targetDb, 'applications', 'work_setup', 'TEXT');
  ensureColumn(targetDb, 'applications', 'compat_notes', 'TEXT');
  ensureColumn(targetDb, 'applications', 'general_notes', 'TEXT');
  ensureColumn(targetDb, 'applications', 'preferred_skills', 'TEXT');
  ensureColumn(targetDb, 'applications', 'timeline', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(targetDb, 'applications', 'min_years_experience', 'INTEGER');
  backfillCompatibility(targetDb, compatBackfillAsOf);
}
