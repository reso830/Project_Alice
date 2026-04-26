/**
 * @deprecated Tracker persistence now goes through `src/services/api.js`.
 * This legacy localStorage store remains only for reference during migration.
 */
import { normalizeApplication, STATUS_VALUES, validateApplication } from '../models/application.js';
import { toISODate } from '../utils/date.js';

export const STORAGE_KEY = 'apptracker_applications';

let _applications = [];

function sortApplications(records) {
  return [...records].sort((a, b) => {
    if (a._corrupt && !b._corrupt) {
      return 1;
    }

    if (!a._corrupt && b._corrupt) {
      return -1;
    }

    return Number(a.id) - Number(b.id);
  });
}

function sanitizeForSave(record) {
  const persisted = { ...record };
  delete persisted._corrupt;

  return persisted;
}

function cloneApplication(record) {
  if (!record) {
    return undefined;
  }

  return {
    ...record,
    skills: [...record.skills],
  };
}

function findById(id) {
  return _applications.find((application) => application.id === id);
}

export function hasStoredApplications() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return true;
  }
}

export function load() {
  let parsed = [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    parsed = stored ? JSON.parse(stored) : [];
  } catch {
    parsed = [];
  }

  if (!Array.isArray(parsed)) {
    parsed = [];
  }

  _applications = sortApplications(
    parsed.map((record) => validateApplication(normalizeApplication(record))),
  );

  return getAll();
}

export function save(applications = _applications) {
  _applications = sortApplications(
    applications.map((record) => validateApplication(normalizeApplication(record))),
  );

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_applications.map(sanitizeForSave)));
  } catch {
    // Keep in-memory changes for the session when browser storage is unavailable.
  }
}

export function getAll() {
  return _applications.map(cloneApplication);
}

export function getById(id) {
  return cloneApplication(findById(id));
}

export function updateStatus(id, newStatus) {
  const application = findById(id);
  if (!application) {
    return false;
  }

  const normalized = STATUS_VALUES.includes(newStatus) ? newStatus : 'wishlisted';
  if (normalized === application.status) {
    return false;
  }

  application.status = normalized;
  application.lastStatusUpdate = toISODate();
  save();

  return true;
}

export function toggleFav(id) {
  const application = findById(id);
  if (!application) {
    return;
  }

  application.fav = !application.fav;
  save();
}

export const store = {
  load,
  save,
  hasStoredApplications,
  getAll,
  getById,
  updateStatus,
  toggleFav,
};
