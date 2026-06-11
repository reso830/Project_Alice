// Pure data-layer helpers shared between SQLite (`server/db/applications.js`)
// and Supabase (`server/repositories/supabase/applications.js`) adapters.
//
// This module MUST NOT import `server/db.js` — that import triggers
// `better-sqlite3` initialization which is forbidden in hosted/Vercel cold
// starts. See `tests/server/repositories/stubs.test.js` for the invariant.

import { STATUS_VALUES } from '../../shared/constants.js';

// camelCase field name → snake_case DB column name.
// Source of truth for both SQLite row-building and Supabase response shaping.
export const FIELD_TO_COLUMN = {
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
  location: 'location',
  shift: 'shift',
  workSetup: 'work_setup',
  compatNotes: 'compat_notes',
  generalNotes: 'general_notes',
  preferredSkills: 'preferred_skills',
  minYearsExperience: 'min_years_experience',
  metadata: 'metadata',
  timeline: 'timeline',
  archived: 'archived',
};

export const DEFAULT_STATUS = STATUS_VALUES[0];

export const INSERTABLE_COLUMNS = [
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
  'location',
  'shift',
  'work_setup',
  'compat_notes',
  'general_notes',
  'preferred_skills',
  'min_years_experience',
  'last_status_update',
  'created_at',
  'updated_at',
  'archived',
  'metadata',
  'timeline',
];

export const UPDATABLE_COLUMNS = new Set(Object.values(FIELD_TO_COLUMN));

// Snake_case column projection for Supabase `profile.select(...)`.
// EXCLUDES `user_id` (019 invariant — never expose ownership column in API
// responses). Only `data` is needed at the adapter boundary: the SQLite
// profile repository returns `JSON.parse(row.data)` directly with no
// other column surfaced to route handlers, and Supabase must match
// (FR-017). `id` and `updated_at` exist on the Supabase profile row
// but are not part of the API response shape.
export const PROFILE_COLUMNS_WITHOUT_USER_ID = ['data'];

// Snake_case column projection for Supabase `.select(...)`. EXCLUDES
// `user_id` (019's invariant — never expose ownership column in API
// responses). Order chosen to be readable; PostgREST does not care.
export const APPLICATION_COLUMNS_WITHOUT_USER_ID = [
  'id',
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
  'location',
  'shift',
  'work_setup',
  'compat_notes',
  'general_notes',
  'preferred_skills',
  'min_years_experience',
  'metadata',
  'timeline',
  'last_status_update',
  'created_at',
  'updated_at',
  'archived',
  'archived_date',
];

export function parseJson(value, fallback) {
  if (value == null) {
    return fallback;
  }

  // Postgres JSONB returns pre-parsed objects/arrays; SQLite returns
  // strings. Accept both shapes so the adapter is backend-agnostic.
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
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

export function normalizeSalary(value) {
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
    location: row.location,
    shift: row.shift,
    workSetup: row.work_setup,
    compatNotes: row.compat_notes,
    generalNotes: row.general_notes,
    preferredSkills: parseJson(row.preferred_skills, []),
    minYearsExperience: row.min_years_experience ?? null,
    timeline: parseJson(row.timeline, []),
    lastStatusUpdate: row.last_status_update,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archived: Boolean(row.archived ?? false),
    archivedDate: row.archived_date ?? null,
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
    } else if (field === 'skills') {
      row[column] = JSON.stringify(Array.isArray(value) ? value : []);
    } else if (field === 'preferredSkills') {
      row[column] = JSON.stringify(Array.isArray(value) ? value : []);
    } else if (field === 'metadata') {
      row[column] = value != null ? JSON.stringify(value) : null;
    } else if (field === 'timeline') {
      row[column] = JSON.stringify(Array.isArray(value) ? value : []);
    } else if (field === 'status') {
      row[column] = value || DEFAULT_STATUS;
    } else {
      row[column] = value;
    }

    return row;
  }, {});
}

// Server-side fallback for "today" when the client did not send
// `X-Client-Date` (e.g. direct curl/test/script callers, or the seed RPC).
// UTC is the canonical fallback so SQLite and hosted modes agree on the
// fallback value regardless of the function's deploy region. Routes
// override this per-request with the user's local date via
// `resolveRequestDate(req)`. See issue #43.
export function currentDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}
