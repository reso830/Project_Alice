export { STATUS_COLORS, STATUS_LABELS } from '../../shared/constants.js';

const ARRAY_FIELDS = [
  'experience',
  'education',
  'skills',
  'certifications',
  'awards',
  'languages',
  'links',
];
const STRING_FIELDS = ['firstName', 'lastName', 'city', 'phone', 'email', 'summary'];
const EMAIL_PATTERN = /^[^@]+@[^@]+\.[^@]+$/;

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normaliseStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(cleanString)
    .filter(Boolean);
}

function normaliseEntryArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))
    .map((entry) => Object.fromEntries(
      Object.entries(entry).map(([key, entryValue]) => [key, cleanString(entryValue)]),
    ));
}

export function normaliseProfile(data = {}) {
  const safe = data !== null && typeof data === 'object' && !Array.isArray(data) ? data : {};
  const profile = {};

  for (const field of STRING_FIELDS) {
    profile[field] = cleanString(safe[field]);
  }

  for (const field of ARRAY_FIELDS) {
    if (['skills', 'certifications', 'awards', 'languages'].includes(field)) {
      profile[field] = normaliseStringArray(safe[field]);
    } else {
      profile[field] = normaliseEntryArray(safe[field]);
    }
  }

  return profile;
}

export function validateProfile(data = {}) {
  const profile = normaliseProfile(data);
  const errors = {};

  if (!profile.firstName) {
    errors.firstName = 'First Name is required.';
  }

  if (!profile.lastName) {
    errors.lastName = 'Last Name is required.';
  }

  if (profile.email && !EMAIL_PATTERN.test(profile.email)) {
    errors.email = 'Email must be a valid email address.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function computeAppCounts(applications = []) {
  return applications.reduce((counts, application) => {
    const status = application?.status;
    if (typeof status !== 'string' || status === '') {
      return counts;
    }

    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
}

export function computeStats(counts = {}) {
  const total = Object.values(counts).reduce((sum, count) => sum + Number(count || 0), 0);

  return {
    total,
    active: (counts.phone_screen ?? 0) + (counts.interview ?? 0) + (counts.assessment ?? 0),
    pending: counts.applied ?? 0,
    offer: counts.offer ?? 0,
  };
}
