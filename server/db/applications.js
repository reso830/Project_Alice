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
};

const DEFAULT_STATUS = STATUS_VALUES[0];

function parseJson(value, fallback) {
  if (value == null) {
    return fallback;
  }

  return JSON.parse(value);
}

function clampCompat(value) {
  const number = Number(value);
  if (Number.isNaN(number)) {
    return 0;
  }

  return Math.max(0, Math.min(100, number));
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
    salary: row.salary,
    responsibilities: row.responsibilities,
    skills: parseJson(row.skills, []),
    followUpAction: row.follow_up_action,
    followUpDate: row.follow_up_date,
    lastStatusUpdate: row.last_status_update,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archived: Boolean(row.archived),
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
    } else if (field === 'compat') {
      row[column] = clampCompat(value);
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

export { db };
