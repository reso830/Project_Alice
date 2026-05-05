import { db } from '../db.js';
import { STATUS_VALUES } from '../../shared/constants.js';

const FIELD_TO_COLUMN = {
  companyName: 'company_name',
  jobTitle: 'job_title',
  status: 'status',
  compat: 'compat',
  fav: 'fav',
  sourcePlatform: 'source_platform',
  applicationDate: 'application_date',
  jobPostingUrl: 'job_posting_url',
  recruiter: 'recruiter',
  notes: 'notes',
  salary: 'salary',
  responsibilities: 'responsibilities',
  skills: 'skills',
  followUpAction: 'follow_up_action',
  followUpDate: 'follow_up_date',
  metadata: 'metadata',
  archived: 'archived',
};

const DEFAULT_STATUS = STATUS_VALUES[0];
const INSERTABLE_COLUMNS = [
  'company_name',
  'job_title',
  'status',
  'compat',
  'fav',
  'source_platform',
  'application_date',
  'job_posting_url',
  'recruiter',
  'notes',
  'salary',
  'responsibilities',
  'skills',
  'follow_up_action',
  'follow_up_date',
  'last_status_update',
  'created_at',
  'updated_at',
  'archived',
  'metadata',
];
const UPDATABLE_COLUMNS = new Set(Object.values(FIELD_TO_COLUMN));

function parseJson(value, fallback) {
  if (value == null) {
    return fallback;
  }

  return JSON.parse(value);
}

function parseSalaryLower(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  const numericValue = Number(value);

  if (Number.isInteger(numericValue) && numericValue > 0) {
    return numericValue;
  }

  const match = value.match(/\$\s*([\d,.]+)\s*([kK])?/);

  if (!match) {
    return null;
  }

  const amount = Number(match[1].replace(/,/g, ''));

  if (!Number.isFinite(amount)) {
    return null;
  }

  return Math.round(match[2] ? amount * 1000 : amount);
}

function normalizeSalary(value) {
  if (Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string') {
    return parseSalaryLower(value);
  }

  return null;
}

export function toRecord(row) {
  return {
    id: row.id,
    companyName: row.company_name,
    jobTitle: row.job_title,
    status: row.status,
    compat: row.compat,
    fav: Boolean(row.fav),
    sourcePlatform: row.source_platform,
    applicationDate: row.application_date,
    jobPostingUrl: row.job_posting_url,
    recruiter: row.recruiter,
    notes: row.notes,
    salary: normalizeSalary(row.salary),
    responsibilities: row.responsibilities,
    skills: parseJson(row.skills, []),
    followUpAction: row.follow_up_action,
    followUpDate: row.follow_up_date,
    lastStatusUpdate: row.last_status_update,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archived: Boolean(row.archived ?? false),
    metadata: parseJson(row.metadata, null),
  };
}

export function toRow(fields) {
  return Object.entries(fields).reduce((row, [field, value]) => {
    const column = FIELD_TO_COLUMN[field];
    if (!column) {
      return row;
    }

    if (field === 'fav') {
      row[column] = value ? 1 : 0;
    } else if (field === 'archived') {
      row[column] = value ? 1 : 0;
      if (value) {
        row.fav = 0;
      }
    } else if (field === 'skills') {
      row[column] = JSON.stringify(Array.isArray(value) ? value : []);
    } else if (field === 'metadata') {
      row[column] = value != null ? JSON.stringify(value) : null;
    } else if (field === 'status') {
      row[column] = value || DEFAULT_STATUS;
    } else {
      row[column] = value;
    }

    return row;
  }, {});
}

function currentDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
