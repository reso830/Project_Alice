import { db } from '../db.js';
import {
  DEFAULT_STATUS,
  INSERTABLE_COLUMNS,
  UPDATABLE_COLUMNS,
  currentDate,
  toRecord,
  toRow,
} from './columns.js';

// Re-export pure helpers for backward compatibility with callers that still
// import from this module (e.g. tests/server/foundation.test.js). New
// consumers should import directly from `server/db/columns.js`.
export { toRecord, toRow };

export function getById(id, targetDb = db) {
  const row = targetDb.prepare('SELECT * FROM applications WHERE id = ?').get(id);
  return row ? toRecord(row) : null;
}

export function getAll(targetDb = db) {
  return targetDb
    .prepare('SELECT * FROM applications WHERE archived = 0 ORDER BY created_at DESC')
    .all()
    .map(toRecord);
}

export function create(fields, targetDb = db) {
  const row = {
    status: DEFAULT_STATUS,
    compat: 0,
    fav: 0,
    skills: JSON.stringify([]),
    timeline: '[]',
    archived: 0,
    metadata: null,
    ...toRow(fields),
  };
  const now = currentDate();
  row.created_at = now;
  row.updated_at = now;
  row.last_status_update = now;

  const columns = INSERTABLE_COLUMNS.filter((column) => row[column] !== undefined);
  const placeholders = columns.map((column) => `@${column}`);
  const statement = targetDb.prepare(`
    INSERT INTO applications (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
  `);
  const info = statement.run(row);

  return getById(Number(info.lastInsertRowid), targetDb);
}

export function update(id, fields, targetDb = db) {
  const current = getById(id, targetDb);
  if (!current) {
    return null;
  }

  const row = toRow(fields);
  if (Object.keys(row).length === 0) {
    return current;
  }

  const now = currentDate();
  row.updated_at = now;

  if (Object.hasOwn(fields, 'status') && fields.status !== current.status) {
    row.last_status_update = now;
  }

  const columns = Object.keys(row).filter((column) => UPDATABLE_COLUMNS.has(column)
    || column === 'updated_at'
    || column === 'last_status_update');
  const assignments = columns.map((column) => `${column} = @${column}`);

  targetDb.prepare(`
    UPDATE applications
    SET ${assignments.join(', ')}
    WHERE id = @id
  `).run({ ...row, id });

  return getById(id, targetDb);
}

export function archive(id, targetDb = db) {
  const current = getById(id, targetDb);
  if (!current) {
    return null;
  }

  targetDb.prepare(`
    UPDATE applications
    SET archived = 1, fav = 0, updated_at = @updated_at
    WHERE id = @id
  `).run({ id, updated_at: currentDate() });

  return getById(id, targetDb);
}
