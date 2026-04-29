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
const MONTH_YEAR_PATTERN = /^(\d{2})\/(\d{4})$/;
const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:']);
export const PROFICIENCY_LEVELS = ['Beginner', 'Intermediate', 'Professional', 'Fluent'];

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

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function normaliseObjectArray(value, normaliseEntry) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normaliseEntry)
    .filter(Boolean);
}

function normaliseExperienceEntry(entry) {
  if (!isPlainObject(entry)) {
    return null;
  }

  return {
    role: cleanString(entry.role),
    company: cleanString(entry.company),
    responsibilities: cleanString(entry.responsibilities ?? entry.desc),
    dateStarted: cleanString(entry.dateStarted),
    dateEnded: cleanString(entry.dateEnded),
    currentWork: entry.currentWork === true,
  };
}

function normaliseEducationEntry(entry) {
  if (!isPlainObject(entry)) {
    return null;
  }

  return {
    degreeMajor: cleanString(entry.degreeMajor ?? entry.degree),
    university: cleanString(entry.university ?? entry.school),
    yearCompleted: cleanString(entry.yearCompleted ?? entry.year),
  };
}

function normaliseCertificationEntry(entry) {
  if (typeof entry === 'string') {
    return {
      name: cleanString(entry),
      issuingBody: '',
      certificateId: '',
      issuanceDate: '',
      expiryDate: '',
    };
  }

  if (!isPlainObject(entry)) {
    return null;
  }

  return {
    name: cleanString(entry.name),
    issuingBody: cleanString(entry.issuingBody),
    certificateId: cleanString(entry.certificateId),
    issuanceDate: cleanString(entry.issuanceDate),
    expiryDate: cleanString(entry.expiryDate),
  };
}

function normaliseAwardEntry(entry) {
  if (typeof entry === 'string') {
    return {
      awardName: cleanString(entry),
      issuingBody: '',
      details: '',
      date: '',
    };
  }

  if (!isPlainObject(entry)) {
    return null;
  }

  return {
    awardName: cleanString(entry.awardName),
    issuingBody: cleanString(entry.issuingBody),
    details: cleanString(entry.details),
    date: cleanString(entry.date),
  };
}

function normaliseLanguageEntry(entry) {
  if (typeof entry === 'string') {
    return {
      language: cleanString(entry),
      proficiency: '',
    };
  }

  if (!isPlainObject(entry)) {
    return null;
  }

  return {
    language: cleanString(entry.language),
    proficiency: PROFICIENCY_LEVELS.includes(entry.proficiency) ? entry.proficiency : '',
  };
}

function normaliseLinkEntry(entry) {
  if (typeof entry === 'string') {
    return {
      url: cleanString(entry),
      friendlyName: '',
    };
  }

  if (!isPlainObject(entry)) {
    return null;
  }

  return {
    url: cleanString(entry.url),
    friendlyName: cleanString(entry.friendlyName ?? entry.label),
  };
}

function isValidMonthYear(value) {
  const match = cleanString(value).match(MONTH_YEAR_PATTERN);

  if (!match) {
    return false;
  }

  const month = Number(match[1]);
  const year = Number(match[2]);

  return month >= 1 && month <= 12 && year >= 1900;
}

function isValidUrl(value) {
  try {
    const url = new URL(cleanString(value));

    return SAFE_URL_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

function setRequiredError(errors, key, value, label) {
  if (!value) {
    errors[key] = `${label} is required.`;
  }
}

function setMonthYearError(errors, key, value, label, { required = false } = {}) {
  if (!value) {
    if (required) {
      errors[key] = `${label} is required.`;
    }
    return;
  }

  if (!isValidMonthYear(value)) {
    errors[key] = `${label} must be in MM/YYYY format.`;
  }
}

export function normaliseProfile(data = {}) {
  const safe = data !== null && typeof data === 'object' && !Array.isArray(data) ? data : {};
  const profile = {};

  for (const field of STRING_FIELDS) {
    profile[field] = cleanString(safe[field]);
  }

  for (const field of ARRAY_FIELDS) {
    profile[field] = [];
  }

  profile.experience = normaliseObjectArray(safe.experience, normaliseExperienceEntry);
  profile.education = normaliseObjectArray(safe.education, normaliseEducationEntry);
  profile.skills = normaliseStringArray(safe.skills);
  profile.certifications = normaliseObjectArray(safe.certifications, normaliseCertificationEntry);
  profile.awards = normaliseObjectArray(safe.awards, normaliseAwardEntry);
  profile.languages = normaliseObjectArray(safe.languages, normaliseLanguageEntry);
  profile.links = normaliseObjectArray(safe.links, normaliseLinkEntry);

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

  profile.experience.forEach((entry, index) => {
    setRequiredError(errors, `experience[${index}].role`, entry.role, 'Role');
    setRequiredError(errors, `experience[${index}].company`, entry.company, 'Company');
    setRequiredError(
      errors,
      `experience[${index}].responsibilities`,
      entry.responsibilities,
      'Responsibilities',
    );
    setMonthYearError(errors, `experience[${index}].dateStarted`, entry.dateStarted, 'Date Started', {
      required: true,
    });

    if (!entry.currentWork) {
      setMonthYearError(errors, `experience[${index}].dateEnded`, entry.dateEnded, 'Date Ended', {
        required: true,
      });
    }
  });

  profile.education.forEach((entry, index) => {
    setRequiredError(errors, `education[${index}].degreeMajor`, entry.degreeMajor, 'Degree & Major');
    setRequiredError(errors, `education[${index}].university`, entry.university, 'University');
    setRequiredError(errors, `education[${index}].yearCompleted`, entry.yearCompleted, 'Year Completed');
  });

  profile.certifications.forEach((entry, index) => {
    setRequiredError(errors, `certifications[${index}].name`, entry.name, 'Certification Name');
    setMonthYearError(
      errors,
      `certifications[${index}].issuanceDate`,
      entry.issuanceDate,
      'Issuance Date',
      { required: true },
    );
    setMonthYearError(
      errors,
      `certifications[${index}].expiryDate`,
      entry.expiryDate,
      'Expiry Date',
    );
  });

  profile.awards.forEach((entry, index) => {
    setRequiredError(errors, `awards[${index}].awardName`, entry.awardName, 'Award Name');
    setRequiredError(errors, `awards[${index}].issuingBody`, entry.issuingBody, 'Issuing Body');
    setMonthYearError(errors, `awards[${index}].date`, entry.date, 'Award Date');
  });

  profile.languages.forEach((entry, index) => {
    setRequiredError(errors, `languages[${index}].language`, entry.language, 'Language');

    if (!entry.proficiency) {
      errors[`languages[${index}].proficiency`] = 'Proficiency is required.';
    } else if (!PROFICIENCY_LEVELS.includes(entry.proficiency)) {
      errors[`languages[${index}].proficiency`] = 'Proficiency must be a valid level.';
    }
  });

  profile.links.forEach((entry, index) => {
    setRequiredError(errors, `links[${index}].url`, entry.url, 'URL');

    if (entry.url && !isValidUrl(entry.url)) {
      errors[`links[${index}].url`] = 'URL must be a valid http or https URL.';
    }
  });

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
