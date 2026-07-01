import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { computeCompatibility } from '../src/models/compatibility.js';
import { toRecord } from './db/columns.js';
import { pendingMigrationIds, runMigrations } from './db/migration.js';
import initMigration from './db/migrations/001-init.js';

const DATA_DIR = path.resolve('data');
const DB_PATH = process.env.ALICE_DB_PATH || path.join(DATA_DIR, 'alice.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
const MIGRATIONS = [initMigration];
const ADDITIVE_COLUMNS = [
  { table: 'applications', name: 'archived', def: 'INTEGER NOT NULL DEFAULT 0' },
  { table: 'applications', name: 'archived_date', def: 'TEXT' },
  { table: 'applications', name: 'location', def: 'TEXT' },
  { table: 'applications', name: 'shift', def: 'TEXT' },
  { table: 'applications', name: 'work_setup', def: 'TEXT' },
  { table: 'applications', name: 'compat_notes', def: 'TEXT' },
  { table: 'applications', name: 'compat_analysis', def: 'TEXT' },
  { table: 'applications', name: 'compat_scored_at', def: 'TEXT', flag: 'compatScoredAt' },
  { table: 'applications', name: 'general_notes', def: 'TEXT' },
  { table: 'applications', name: 'preferred_skills', def: 'TEXT' },
  { table: 'applications', name: 'timeline', def: "TEXT NOT NULL DEFAULT '[]'" },
  { table: 'applications', name: 'min_years_experience', def: 'INTEGER', flag: 'minYearsExperience' },
];

function ensureColumn(targetDb, table, column, definition) {
  const columns = targetDb.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((entry) => entry.name === column)) {
    targetDb.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    return true;
  }
  return false;
}

function hasColumn(targetDb, table, column) {
  return targetDb.prepare(`PRAGMA table_info(${table})`).all().some((entry) => entry.name === column);
}

function currentDate() {
  return new Date().toISOString().slice(0, 10);
}

function readProfileForCompatibility(targetDb) {
  const tables = targetDb
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('profile', 'profile_skill')")
    .all()
    .map((row) => row.name);
  if (!tables.includes('profile')) {
    return null;
  }

  const row = targetDb.prepare('SELECT data FROM profile WHERE id = 1').get();

  if (!row?.data) {
    return null;
  }

  try {
    const document = JSON.parse(row.data);
    const skills = tables.includes('profile_skill')
      ? targetDb.prepare(`
          SELECT skill_name, proficiency
          FROM profile_skill
          WHERE profile_id = 1
          ORDER BY id ASC
        `).all().map((skill) => ({
          name: skill.skill_name,
          level: skill.proficiency,
        }))
      : [];

    return {
      ...document,
      skills: skills.length > 0 ? skills : (document.skills ?? []),
    };
  } catch {
    return null;
  }
}

export function backfillCompatibility(targetDb, asOf) {
  const profile = readProfileForCompatibility(targetDb);

  if (!profile) {
    return 0;
  }

  const rows = targetDb.prepare('SELECT * FROM applications').all();
  if (rows.length === 0) {
    return 0;
  }

  const updateCompat = targetDb.prepare('UPDATE applications SET compat = @compat WHERE id = @id');
  let updated = 0;

  targetDb.transaction(() => {
    for (const row of rows) {
      const application = toRecord(row);
      const compat = computeCompatibility(profile, application, { asOf }).score;

      if (compat !== application.compat) {
        updateCompat.run({ id: application.id, compat });
        updated += 1;
      }
    }
  })();

  return updated;
}

export function initSchema(
  targetDb = db,
  {
    compatBackfillAsOf = currentDate(),
    migrations = MIGRATIONS,
    backfillCompatibilityFn = backfillCompatibility,
  } = {},
) {
  runWithBackup(targetDb, () => {
    runMigrations(targetDb, { migrations });

    const addedColumns = new Set();
    for (const column of ADDITIVE_COLUMNS) {
      if (ensureColumn(targetDb, column.table, column.name, column.def) && column.flag) {
        addedColumns.add(column.flag);
      }
    }

    targetDb.prepare(`
      UPDATE applications
      SET compat_scored_at = created_at
      WHERE compat_scored_at IS NULL
    `).run();
    if (addedColumns.has('compatScoredAt')) {
      targetDb.prepare(`
        UPDATE applications
        SET compat_notes = NULL
        WHERE compat_notes IS NOT NULL
      `).run();
    }

    // One-time legacy backfill: run ONLY on the boot that first adds the
    // min_years_experience column (the 036 migration). Re-running it on every
    // startup would rewrite **archived** scores that must stay frozen (FR-009)
    // and let currentWork tenure drift recompute them. Once the column exists,
    // active rows are kept fresh by the route recompute paths instead.
    if (addedColumns.has('minYearsExperience')) {
      backfillCompatibilityFn(targetDb, compatBackfillAsOf);
    }
  }, { migrations });
}

function dbFilePath(targetDb) {
  if (!targetDb?.name || targetDb.name === ':memory:') {
    return null;
  }
  return targetDb.name;
}

function hasSchemaWorkPending(targetDb, { migrations = MIGRATIONS } = {}) {
  try {
    if (pendingMigrationIds(targetDb, { migrations }).length > 0) {
      return true;
    }

    return ADDITIVE_COLUMNS.some((column) => !hasColumn(targetDb, column.table, column.name));
  } catch {
    return true;
  }
}

function runWithBackup(targetDb, callback, { migrations = MIGRATIONS } = {}) {
  const runtime = process.env.APP_RUNTIME ?? 'local';
  const targetPath = dbFilePath(targetDb);
  const backupPath = targetPath ? `${targetPath}.migration-backup` : null;
  const shouldBackup = runtime === 'local'
    && targetPath
    && fs.existsSync(targetPath)
    && hasSchemaWorkPending(targetDb, { migrations });

  if (!shouldBackup) {
    return callback();
  }

  fs.copyFileSync(targetPath, backupPath);

  try {
    const result = callback();
    fs.rmSync(backupPath, { force: true });
    return result;
  } catch (error) {
    if (fs.existsSync(backupPath)) {
      try {
        fs.copyFileSync(backupPath, targetPath);
        fs.rmSync(backupPath, { force: true });
      } catch (restoreError) {
        if (error && typeof error === 'object') {
          Object.defineProperty(error, 'migrationRestoreError', {
            value: restoreError,
            enumerable: false,
          });
        }
        throw error;
      }
    }
    throw error;
  }
}
