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
const YEAR_PATTERN = /^\d{4}$/;
const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:']);
export const PROFICIENCY_LEVELS = ['Beginner', 'Intermediate', 'Professional', 'Fluent'];

// Skill proficiency scale (feature 031). Distinct from PROFICIENCY_LEVELS above,
// which is the language enum. The model owns the valid 1-5 range + shared labels;
// segment colours stay in CSS.
export const SKILL_LEVELS = [
  { level: 1, label: 'Beginner' },
  { level: 2, label: 'Basic' },
  { level: 3, label: 'Intermediate' },
  { level: 4, label: 'Strong' },
  { level: 5, label: 'Expert' },
];
export const SKILL_FLAVOR = {
  1: 'Aware of the basics; needs guidance.',
  2: 'Can handle simple tasks independently.',
  3: 'Productive day-to-day without help.',
  4: 'Deep, reliable command of the skill.',
  5: 'Sets direction; mentors others.',
};
export const SKILL_MAX = 50;
const SKILL_MIGRATION_LEVEL = 2;

export function getSkillLabel(level) {
  return SKILL_LEVELS.find((entry) => entry.level === level)?.label ?? '';
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
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

function coerceSkillLevel(value) {
  // Only genuine numbers and non-empty numeric strings are coerced. Empty /
  // whitespace strings, booleans, arrays, objects, and non-numeric strings are
  // NOT levels — they stay unrated (null) so they gate save (FR-003/FR-010),
  // rather than silently clamping `Number('') === 0` up to Beginner.
  let numeric;

  if (typeof value === 'number') {
    numeric = value;
  } else if (typeof value === 'string' && value.trim() !== '') {
    numeric = Number(value);
  } else {
    return null;
  }

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.min(5, Math.max(1, Math.round(numeric)));
}

function normaliseSkillEntry(entry) {
  if (typeof entry === 'string') {
    const name = cleanString(entry);

    // Empty/whitespace legacy strings are migration junk → dropped.
    return name ? { name, level: SKILL_MIGRATION_LEVEL } : null;
  }

  if (!isPlainObject(entry)) {
    return null;
  }

  // Blank-name objects are KEPT (name: '') so validateProfile can reject them
  // (FR-004) — validation normalises first, so the row must survive here.
  return {
    name: cleanString(entry.name),
    level: coerceSkillLevel(entry.level),
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

function setYearError(errors, key, value, label, { required = false } = {}) {
  if (!value) {
    if (required) {
      errors[key] = `${label} is required.`;
    }
    return;
  }

  if (!YEAR_PATTERN.test(value) || Number(value) < 1900) {
    errors[key] = `${label} must be a valid four-digit year.`;
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
  profile.skills = normaliseObjectArray(safe.skills, normaliseSkillEntry);
  profile.certifications = normaliseObjectArray(safe.certifications, normaliseCertificationEntry);
  profile.awards = normaliseObjectArray(safe.awards, normaliseAwardEntry);
  profile.languages = normaliseObjectArray(safe.languages, normaliseLanguageEntry);
  profile.links = normaliseObjectArray(safe.links, normaliseLinkEntry);

  return profile;
}

export function splitProfileForStorage(profile = {}) {
  const { skills, ...document } = normaliseProfile(profile);

  return {
    document,
    skills,
  };
}

export function joinProfileWithSkills(document = {}, skills = []) {
  const safeDocument = isPlainObject(document) ? document : {};

  return {
    ...safeDocument,
    skills: Array.isArray(skills) ? skills : [],
  };
}

function cloneValue(value) {
  return typeof globalThis.structuredClone === 'function'
    ? globalThis.structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function normalizeDuplicatePart(value) {
  return cleanString(value).replace(/\s+/g, ' ').toLowerCase();
}

export function skillNameKey(value) {
  return normalizeDuplicatePart(value);
}

export function dedupeSkillsForStorage(skills = []) {
  const seen = new Set();
  const cleaned = [];

  for (const skill of Array.isArray(skills) ? skills : []) {
    const key = skillNameKey(skill?.name);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    cleaned.push(skill);
  }

  return cleaned;
}

function normalizeDuplicateUrl(value) {
  return normalizeDuplicatePart(value).replace(/\/+$/, '');
}

const DUPLICATE_KEYS = {
  experience: (entry) => [
    entry?.company,
    entry?.role,
    entry?.dateStarted,
  ].map(normalizeDuplicatePart).join('|'),
  education: (entry) => [
    entry?.university,
    entry?.degreeMajor,
    entry?.yearCompleted,
  ].map(normalizeDuplicatePart).join('|'),
  certifications: (entry) => [
    entry?.name,
    entry?.issuingBody,
  ].map(normalizeDuplicatePart).join('|'),
  skills: (entry) => skillNameKey(typeof entry === 'string' ? entry : entry?.name),
  languages: (entry) => normalizeDuplicatePart(entry?.language),
  links: (entry) => normalizeDuplicateUrl(entry?.url),
  awards: (entry) => [
    entry?.awardName,
    entry?.issuingBody,
  ].map(normalizeDuplicatePart).join('|'),
};

function hasDuplicate(existingEntries, parsedEntry, getDuplicateKey) {
  const parsedKey = getDuplicateKey(parsedEntry);

  if (!parsedKey) {
    return false;
  }

  return existingEntries.some((entry) => getDuplicateKey(entry) === parsedKey);
}

export function mergeResumeData(currentProfile, parsedData) {
  const mergedProfile = isPlainObject(currentProfile)
    ? cloneValue(currentProfile)
    : normaliseProfile(currentProfile);
  const safeParsedData = isPlainObject(parsedData) ? parsedData : {};

  for (const field of STRING_FIELDS) {
    const parsedValue = cleanString(safeParsedData[field]);

    if (!cleanString(mergedProfile[field]) && parsedValue) {
      mergedProfile[field] = parsedValue;
    }
  }

  for (const field of ARRAY_FIELDS) {
    if (!Array.isArray(mergedProfile[field])) {
      mergedProfile[field] = [];
    }

    let parsedEntries = Array.isArray(safeParsedData[field])
      ? cloneValue(safeParsedData[field])
      : [];

    if (field === 'skills') {
      // Imported skills arrive UNRATED (level: null) — never auto-estimated
      // (FR-010/FR-014). Map names to `{ name, level: null }` so they are
      // preserved as unrated (not migrated to Basic like a bare string).
      parsedEntries = parsedEntries
        .map((parsed) => {
          const name = typeof parsed === 'string' ? cleanString(parsed) : cleanString(parsed?.name);

          return name ? { name, level: null } : null;
        })
        .filter(Boolean);
    }

    const getDuplicateKey = DUPLICATE_KEYS[field];

    for (const parsedEntry of parsedEntries) {
      if (!hasDuplicate(mergedProfile[field], parsedEntry, getDuplicateKey)) {
        mergedProfile[field].push(parsedEntry);
      }
    }
  }

  return mergedProfile;
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
    setYearError(errors, `education[${index}].yearCompleted`, entry.yearCompleted, 'Year Completed', {
      required: true,
    });
  });

  profile.certifications.forEach((entry, index) => {
    setRequiredError(errors, `certifications[${index}].name`, entry.name, 'Certification Name');
    setRequiredError(errors, `certifications[${index}].issuingBody`, entry.issuingBody, 'Issuing Body');
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

  const seenSkillNames = new Set();

  profile.skills.forEach((entry, index) => {
    if (!entry.name) {
      // Blank-name rows are flagged individually (never silently dropped) and
      // never counted as duplicates of one another (falsy key).
      errors[`skills[${index}].name`] = 'Skill name is required.';
    } else {
      const key = skillNameKey(entry.name);

      if (seenSkillNames.has(key)) {
        errors['skills.duplicate'] = `Duplicate skill: ${entry.name}.`;
      } else {
        seenSkillNames.add(key);
      }
    }

    // Out-of-range levels are coerced at load, so the only level error is the
    // unrated (null) case — see data-model.md "Load vs save".
    if (entry.level === null) {
      errors[`skills[${index}].level`] = 'Set a level for this skill.';
    }
  });

  if (profile.skills.length > SKILL_MAX) {
    errors['skills.max'] = `Remove some skills — max ${SKILL_MAX}.`;
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
