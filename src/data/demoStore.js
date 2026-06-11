// In-memory demo data layer for the portfolio demo (feature 020).
// Mirrors the call shape of `src/services/api.js` so the service-layer
// switch can delegate without translating arguments.
//
// State lives in module-level variables and is never persisted —
// refreshing the page reinitializes the module and discards everything.
// `loadSeed()` (called by `authStore.enterDemo()`) populates from
// `buildDemoSeed()`; `clear()` (called by `authStore.exitDemo()`)
// resets to the post-import default. No `localStorage`,
// `sessionStorage`, IndexedDB, or cookie writes.

import { normalizeApplication, validateApplication } from '../models/application.js';
import { computeCompatibility } from '../models/compatibility.js';
import { normaliseProfile, validateProfile } from '../models/profile.js';
import { toISODate } from '../utils/date.js';
import { buildDemoSeed, DEMO_COMPAT_AS_OF } from './demoSeed.js';

let _applications = [];
let _profile = null;

function deepClone(value) {
  if (value === null || value === undefined) {
    return value;
  }

  return typeof globalThis.structuredClone === 'function'
    ? globalThis.structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function nextId() {
  if (_applications.length === 0) {
    return 1;
  }

  const maxId = _applications.reduce(
    (acc, row) => (Number.isInteger(row.id) && row.id > acc ? row.id : acc),
    0,
  );
  return maxId + 1;
}

function validateApplicationOrThrow(record) {
  const validated = validateApplication(record);
  if (validated._corrupt) {
    const fields = {};
    if (typeof validated.companyName !== 'string' || validated.companyName.trim() === '') {
      fields.companyName = 'Company name is required.';
    }
    if (typeof validated.jobTitle !== 'string' || validated.jobTitle.trim() === '') {
      fields.jobTitle = 'Job title is required.';
    }
    if (typeof validated.responsibilities !== 'string' || validated.responsibilities.trim() === '') {
      fields.responsibilities = 'Responsibilities are required.';
    }
    throw {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      fields,
    };
  }
  // Strip the internal flag from the returned record.
  delete validated._corrupt;
  return validated;
}

function validateProfileOrThrow(profile) {
  const { valid, errors } = validateProfile(profile);
  if (!valid) {
    throw {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      fields: errors,
    };
  }
  // The normalized profile is the canonical persisted shape; produce it
  // here so callers don't see the un-normalized input echoed back.
  return normaliseProfile(profile);
}

function findIndexById(id) {
  return _applications.findIndex((row) => row.id === id);
}

function scoreApplication(record) {
  return computeCompatibility(_profile ?? {}, record, { asOf: DEMO_COMPAT_AS_OF }).score;
}

function withComputedCompat(record) {
  return {
    ...record,
    compat: scoreApplication(record),
  };
}

function recomputeActiveApplications() {
  _applications = _applications.map((row) => (
    row.archived === true ? row : withComputedCompat(row)
  ));
}

export function loadSeed() {
  const { applications, profile } = buildDemoSeed();
  _applications = applications;
  _profile = profile;
}

export function clear() {
  _applications = [];
  _profile = null;
}

export function getAll() {
  return _applications
    .filter((row) => row.archived !== true)
    .map((row) => deepClone(row));
}

export function getAllArchived() {
  return _applications
    .filter((row) => row.archived === true)
    .map((row) => deepClone(row));
}

export function getById(id) {
  const row = _applications.find((entry) => entry.id === id);
  return deepClone(row);
}

export function create(fields) {
  const normalized = normalizeApplication({ ...fields, id: nextId() });
  const validated = validateApplicationOrThrow(withComputedCompat(normalized));
  _applications = [deepClone(validated), ..._applications];
  return deepClone(validated);
}

export function update(id, fields) {
  const index = findIndexById(id);
  if (index === -1) {
    throw {
      code: 'NOT_FOUND',
      message: 'Application not found',
    };
  }

  const existing = _applications[index];
  // Drop any explicit `id` from `fields` so callers can't reassign the
  // primary key by accident; the id is owned by the store.
  const incoming = { ...(fields ?? {}) };
  delete incoming.id;
  const merged = { ...existing, ...incoming, id: existing.id };

  if (
    typeof incoming.status === 'string'
    && incoming.status !== existing.status
  ) {
    merged.lastStatusUpdate = toISODate();
  }

  const normalized = normalizeApplication(merged);
  const validated = validateApplicationOrThrow(normalized);
  const scored = withComputedCompat(validated);
  _applications = [
    ..._applications.slice(0, index),
    deepClone(scored),
    ..._applications.slice(index + 1),
  ];
  return deepClone(scored);
}

export function archive(id, now = toISODate()) {
  const index = findIndexById(id);
  if (index === -1) {
    throw {
      code: 'NOT_FOUND',
      message: 'Application not found',
    };
  }

  const existing = _applications[index];
  const updated = {
    ...existing,
    archived: true,
    archivedDate: existing.archivedDate ?? now,
  };
  _applications = [
    ..._applications.slice(0, index),
    updated,
    ..._applications.slice(index + 1),
  ];
  return deepClone(updated);
}

export function unarchive(id) {
  const index = findIndexById(id);
  if (index === -1) {
    throw {
      code: 'NOT_FOUND',
      message: 'Application not found',
    };
  }

  const existing = _applications[index];
  const updated = {
    ...existing,
    archived: false,
    archivedDate: null,
  };
  _applications = [
    ..._applications.slice(0, index),
    updated,
    ..._applications.slice(index + 1),
  ];
  return deepClone(updated);
}

export function getProfile() {
  return deepClone(_profile);
}

export function saveProfile(profile) {
  const validated = validateProfileOrThrow(profile);
  _profile = validated;
  recomputeActiveApplications();
  return deepClone(_profile);
}
