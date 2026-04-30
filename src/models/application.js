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
    badgeBg: '#FCE7F3',
    badgeText: '#9D174D',
    borderAccent: '#EC4899',
  },
  applied: {
    label: 'Applied',
    badgeBg: '#DBEAFE',
    badgeText: '#1E40AF',
    borderAccent: '#3B82F6',
  },
  phone_screen: {
    label: 'Phone Screen',
    badgeBg: '#FFEDD5',
    badgeText: '#9A3412',
    borderAccent: '#F97316',
  },
  interview: {
    label: 'Interview',
    badgeBg: '#FEF9C3',
    badgeText: '#854D0E',
    borderAccent: '#EAB308',
  },
  assessment: {
    label: 'Technical Assessment',
    badgeBg: '#EDE9FE',
    badgeText: '#5B21B6',
    borderAccent: '#8B5CF6',
  },
  offer: {
    label: 'Offer',
    badgeBg: '#DCFCE7',
    badgeText: '#166534',
    borderAccent: '#22C55E',
  },
  rejected: {
    label: 'Rejected',
    badgeBg: '#FEE2E2',
    badgeText: '#991B1B',
    borderAccent: '#EF4444',
  },
  withdrawn: {
    label: 'Withdrawn',
    badgeBg: '#F1F5F9',
    badgeText: '#475569',
    borderAccent: '#64748B',
  },
  ghosted: {
    label: 'Ghosted',
    badgeBg: '#F8FAFC',
    badgeText: '#64748B',
    borderAccent: '#94A3B8',
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
