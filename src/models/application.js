import { isValidISODate, toISODate } from '../utils/date.js';
export const STATUS_VALUES = [
  'wishlisted',
  'applied',
  'phone_screen',
  'interview',
  'assessment',
  'offer',
  'rejected',
  'withdrawn',
  'ghosted',
];

export const STATUS_CONFIG = {
  wishlisted: {
    label: 'Wishlisted',
    badgeBg: '#ffafcc',
    badgeText: '#212529',
    borderAccent: '#ffafcc',
  },
  applied: {
    label: 'Applied',
    badgeBg: '#003049',
    badgeText: '#ffffff',
    borderAccent: '#003049',
  },
  phone_screen: {
    label: 'Phone Screen',
    badgeBg: '#f4a259',
    badgeText: '#212529',
    borderAccent: '#f4a259',
  },
  interview: {
    label: 'Interview',
    badgeBg: '#f9c74f',
    badgeText: '#212529',
    borderAccent: '#f9c74f',
  },
  assessment: {
    label: 'Technical Assessment',
    badgeBg: '#e0aaff',
    badgeText: '#212529',
    borderAccent: '#e0aaff',
  },
  offer: {
    label: 'Offer',
    badgeBg: '#09bc8a',
    badgeText: '#212529',
    borderAccent: '#09bc8a',
  },
  rejected: {
    label: 'Rejected',
    badgeBg: '#9d0208',
    badgeText: '#ffffff',
    borderAccent: '#9d0208',
  },
  withdrawn: {
    label: 'Withdrawn',
    badgeBg: '#343a40',
    badgeText: '#ffffff',
    borderAccent: '#343a40',
  },
  ghosted: {
    label: 'Ghosted',
    badgeBg: '#ced4da',
    badgeText: '#212529',
    borderAccent: '#ced4da',
  },
};

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isValidUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return true;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function clampCompat(value) {
  const number = Number(value);
  if (Number.isNaN(number)) {
    return 0;
  }

  return Math.max(0, Math.min(100, number));
}

export function normalizeApplication(record) {
  const normalized = { ...record };

  for (const field of ['responsibilities', 'recruiter', 'jobPostingUrl']) {
    if (typeof normalized[field] !== 'string') {
      normalized[field] = '';
    }
  }

  if (!Number.isInteger(normalized.salary) || normalized.salary <= 0) {
    normalized.salary = null;
  }

  return normalized;
}

export function validateApplication(record) {
  const validated = { ...record };

  if (!isPositiveInteger(validated.id)) {
    validated._corrupt = true;
  }

  if (typeof validated.jobTitle !== 'string' || validated.jobTitle.trim() === '') {
    validated._corrupt = true;
  }

  if (typeof validated.companyName !== 'string' || validated.companyName.trim() === '') {
    validated._corrupt = true;
  }

  if (!STATUS_VALUES.includes(validated.status)) {
    validated.status = 'wishlisted';
  }

  if (!isValidISODate(validated.lastStatusUpdate)) {
    validated.lastStatusUpdate = toISODate();
  }

  validated.compat = clampCompat(validated.compat);

  if (!Array.isArray(validated.skills)) {
    validated.skills = [];
  }

  if (typeof validated.fav !== 'boolean') {
    validated.fav = false;
  }

  if (!isValidUrl(validated.jobPostingUrl)) {
    validated.jobPostingUrl = '';
  }

  return validated;
}
