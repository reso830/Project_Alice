import fs from 'node:fs';
import path from 'node:path';

const LEDGER_TABLE = 'schema_migrations';

function hasTable(db, tableName) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);
  return Boolean(row);
}

function createLedger(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${LEDGER_TABLE} (
      id         TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
}

function migrationId(entry) {
  if (typeof entry === 'string') {
    return path.basename(entry).replace(/\.[cm]?js$/, '');
  }
  return entry.id;
}

export function discoverMigrationScripts(migrationsDir) {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  return fs
    .readdirSync(migrationsDir)
    .filter((file) => /^\d+-.+\.js$/.test(file))
    .sort((left, right) => left.localeCompare(right))
    .map((file) => path.join(migrationsDir, file));
}

export function runMigrations(db, { migrations = [], now = () => new Date() } = {}) {
  const ordered = migrations
    .map((migration) => ({
      ...migration,
      id: migrationId(migration),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const knownIds = new Set(ordered.map((migration) => migration.id));
  const hadLedger = hasTable(db, LEDGER_TABLE);
  const hasLegacySchema = hasTable(db, 'applications') || hasTable(db, 'profile');

  createLedger(db);

  if (!hadLedger && hasLegacySchema && knownIds.has('001-init')) {
    db.prepare(`INSERT OR IGNORE INTO ${LEDGER_TABLE} (id, applied_at) VALUES (?, ?)`).run(
      '001-init',
      now().toISOString(),
    );
  }

  const applied = db
    .prepare(`SELECT id FROM ${LEDGER_TABLE} ORDER BY id ASC`)
    .all()
    .map((row) => row.id);
  const unknownApplied = applied.filter((id) => !knownIds.has(id));
  if (unknownApplied.length > 0) {
    throw new Error(
      `Database schema is newer than this Alice build. Unknown migration(s): ${unknownApplied.join(', ')}`,
    );
  }

  const appliedIds = new Set(applied);
  for (const migration of ordered) {
    if (appliedIds.has(migration.id)) {
      continue;
    }

    db.transaction(() => {
      migration.up(db);
      db.prepare(`INSERT INTO ${LEDGER_TABLE} (id, applied_at) VALUES (?, ?)`).run(
        migration.id,
        now().toISOString(),
      );
    })();
  }
}
