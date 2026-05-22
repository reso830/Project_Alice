import { isValidISODate, toISODate } from '../utils/date.js';
export const STATUS_VALUES = [
  'wishlisted',
  'applied',
  'phone_screen',
  'interview',
  'assessment',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
  'ghosted',
];

export const STATUS_DISPLAY_PRIORITY = Object.freeze([
  'accepted',
  'offer',
  'interview',
  'assessment',
  'phone_screen',
  'wishlisted',
  'applied',
  'rejected',
  'withdrawn',
  'ghosted',
]);

export const SHIFT_VALUES = ['Day', 'Mid', 'Night', 'Flexible'];
export const WORK_SETUP_VALUES = ['Remote', 'Hybrid', 'On-site', 'Field'];

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
  accepted: {
    label: 'Accepted',
    badgeBg: '#2EC4B6',
    badgeText: '#212529',
    borderAccent: '#2EC4B6',
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

export const TRANSITIONS = {
  wishlisted: ['applied'],
  applied: ['phone_screen', 'interview', 'assessment', 'offer', 'rejected', 'withdrawn', 'ghosted'],
  phone_screen: ['interview', 'assessment', 'offer', 'rejected', 'withdrawn', 'ghosted'],
  interview: ['assessment', 'offer', 'rejected', 'withdrawn', 'ghosted'],
  assessment: ['interview', 'offer', 'rejected', 'withdrawn', 'ghosted'],
  offer: ['accepted', 'rejected', 'withdrawn', 'ghosted'],
  accepted: [],
  rejected: [],
  withdrawn: [],
  ghosted: [],
};

export const TERMINAL_STATES = new Set(['accepted', 'rejected', 'withdrawn', 'ghosted']);

const TIMELINE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @typedef {Object} TimelineEntry
 * @property {number} id
 * @property {string} date
 * @property {string} status
 * @property {string} text
 */

export function getValidTransitions(status) {
  return [...(TRANSITIONS[status] ?? [])];
}

export function isValidTransition(current, next) {
  return (TRANSITIONS[current] ?? []).includes(next);
}

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

export function allocateTimelineEntryId(timeline) {
  if (!Array.isArray(timeline) || timeline.length === 0) {
    return 1;
  }

  return Math.max(0, ...timeline.map((entry) => entry.id)) + 1;
}

export function sortTimelineEntries(timeline) {
  return [...(Array.isArray(timeline) ? timeline : [])].sort((a, b) => {
    if (a.date !== b.date) {
      return a.date < b.date ? 1 : -1;
    }
    return b.id - a.id;
  });
}

export function applyStatusChange(application, newStatus, options = {}) {
  const date = options.date ?? toISODate();
  const text = options.text ?? '';
  const timeline = [...(application.timeline ?? [])];
  const id = allocateTimelineEntryId(timeline);
  timeline.push({ id, date, status: newStatus, text });

  return {
    ...application,
    status: newStatus,
    lastStatusUpdate: date,
    timeline,
  };
}

export function synthesizeTimelineFromDates(record) {
  if (!STATUS_VALUES.includes(record.status) || !isValidISODate(record.lastStatusUpdate)) {
    return [];
  }

  if (isValidISODate(record.applicationDate)) {
    if (record.status === 'applied') {
      return [
        { id: 1, date: record.applicationDate, status: 'applied', text: 'Submitted application.' },
      ];
    }

    if (record.lastStatusUpdate !== record.applicationDate) {
      return [
        { id: 1, date: record.applicationDate, status: 'applied', text: 'Submitted application.' },
        { id: 2, date: record.lastStatusUpdate, status: record.status, text: '' },
      ];
    }

    return [
      { id: 1, date: record.applicationDate, status: record.status, text: '' },
    ];
  }

  return [
    { id: 1, date: record.lastStatusUpdate, status: record.status, text: '' },
  ];
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

  for (const field of [
    'responsibilities',
    'sourcePlatform',
    'recruiter',
    'jobPostingUrl',
    'notes',
    'applicationDate',
    'followUpAction',
    'followUpDate',
    'location',
    'shift',
    'workSetup',
    'compatNotes',
    'generalNotes',
  ]) {
    if (typeof normalized[field] !== 'string') {
      normalized[field] = '';
    }
  }

  if (!Array.isArray(normalized.preferredSkills)) {
    normalized.preferredSkills = [];
  }

  if (Array.isArray(record.timeline)) {
    // Preserve the persisted array as-is (including an explicit empty
    // array). Synthesis runs only when the field is absent so that a
    // user who deletes every entry and saves keeps an empty timeline.
    normalized.timeline = record.timeline.map((entry) => ({ ...entry }));
  } else {
    normalized.timeline = synthesizeTimelineFromDates(normalized);
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

  if (typeof validated.responsibilities !== 'string' || validated.responsibilities.trim() === '') {
    validated._corrupt = true;
  }

  if (!STATUS_VALUES.includes(validated.status)) {
    validated.status = 'wishlisted';
  }

  if (!SHIFT_VALUES.includes(validated.shift) && validated.shift !== '') {
    validated.shift = '';
  }

  if (!WORK_SETUP_VALUES.includes(validated.workSetup) && validated.workSetup !== '') {
    validated.workSetup = '';
  }

  if (!isValidISODate(validated.lastStatusUpdate)) {
    validated.lastStatusUpdate = toISODate();
  }

  validated.compat = clampCompat(validated.compat);

  if (!Array.isArray(validated.skills)) {
    validated.skills = [];
  }

  if (!Array.isArray(validated.timeline)) {
    validated.timeline = [];
  } else if (validated.timeline.some((entry) => (
    !isPositiveInteger(entry.id)
      || typeof entry.date !== 'string'
      || !TIMELINE_DATE_PATTERN.test(entry.date)
      || !STATUS_VALUES.includes(entry.status)
      || typeof entry.text !== 'string'
  ))) {
    validated._corrupt = true;
  }

  if (typeof validated.fav !== 'boolean') {
    validated.fav = false;
  }

  if (!isValidUrl(validated.jobPostingUrl)) {
    validated.jobPostingUrl = '';
  }

  return validated;
}
