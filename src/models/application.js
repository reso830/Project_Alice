import { isValidISODate, toISODate } from '../utils/date.js';
import { STATUS_VALUES } from '../../shared/constants.js';

export const STATUS_CONFIG = {
  wishlisted: {
    label: 'Wishlisted',
    badgeBg: '#F3E8FF',
    badgeText: '#6B21A8',
    borderAccent: '#9333EA',
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

export { STATUS_VALUES };

function isDigitString(value) {
  return (typeof value === 'string' || typeof value === 'number') && /^\d+$/.test(String(value));
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

  for (const field of ['responsibilities', 'salary', 'recruiter', 'jobPostingUrl']) {
    if (typeof normalized[field] !== 'string') {
      normalized[field] = '';
    }
  }

  return normalized;
}

export function validateApplication(record) {
  const validated = { ...record };

  if (!isDigitString(validated.id)) {
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
