export const COMPAT_WEIGHTS = Object.freeze({
  skills: 35,
  roleAlignment: 25,
  experience: 20,
  keywords: 10,
  certifications: 10,
});

export const COMPAT_BANDS = Object.freeze([
  Object.freeze({ min: 0, max: 39, label: 'Low' }),
  Object.freeze({ min: 40, max: 64, label: 'Medium' }),
  Object.freeze({ min: 65, max: 84, label: 'High' }),
  Object.freeze({ min: 85, max: 100, label: 'Great' }),
]);

const PREFERRED_FACTOR = 0.3;
const DAYS_PER_YEAR = 365.2425;
const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'in',
  'into',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);

function clampScore(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

function normalizeText(value) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').toLowerCase()
    : '';
}

function uniqueNormalized(values = []) {
  const source = Array.isArray(values) ? values : [];
  const seen = new Set();
  const result = [];

  for (const value of source) {
    const normalized = normalizeText(value);

    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }

  return result;
}

function tokenize(...values) {
  const seen = new Set();

  for (const value of values.flat(Infinity)) {
    const normalized = normalizeText(value);

    if (!normalized) {
      continue;
    }

    for (const token of normalized.split(/[^a-z0-9]+/u)) {
      if (token && !STOPWORDS.has(token)) {
        seen.add(token);
      }
    }
  }

  return seen;
}

function intersectionSize(left, right) {
  let count = 0;

  for (const value of left) {
    if (right.has(value)) {
      count += 1;
    }
  }

  return count;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function skillLevel(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.min(5, Math.max(1, numeric)) / 5;
}

function scoreSkills(profile, application) {
  const skills = safeArray(profile?.skills);
  const required = uniqueNormalized(application?.skills);
  const preferred = uniqueNormalized(application?.preferredSkills);

  if ((required.length === 0 && preferred.length === 0) || skills.length === 0) {
    return null;
  }

  const profileSkills = new Map();

  for (const skill of skills) {
    const name = normalizeText(typeof skill === 'string' ? skill : skill?.name);

    if (name && !profileSkills.has(name)) {
      profileSkills.set(name, skillLevel(typeof skill === 'string' ? 2 : skill?.level));
    }
  }

  if (profileSkills.size === 0) {
    return null;
  }

  const requiredScore = required.length === 0
    ? 0
    : required.reduce((sum, name) => sum + (profileSkills.get(name) ?? 0), 0) / required.length;
  const preferredScore = preferred.length === 0
    ? 0
    : preferred.reduce((sum, name) => sum + (profileSkills.get(name) ?? 0), 0) / preferred.length;

  if (required.length === 0) {
    return Math.min(1, PREFERRED_FACTOR * preferredScore);
  }

  return Math.min(1, requiredScore + (PREFERRED_FACTOR * preferredScore));
}

function scoreRoleAlignment(profile, application) {
  const titleTokens = tokenize(application?.jobTitle);
  const profileTokens = tokenize(
    safeArray(profile?.experience).map((entry) => entry?.role),
    profile?.summary,
  );

  if (titleTokens.size === 0 || profileTokens.size === 0) {
    return null;
  }

  return intersectionSize(titleTokens, profileTokens) / titleTokens.size;
}

function parseDate(value, { endOfMonth = false } = {}) {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  let year;
  let month = 0;

  const monthYear = text.match(/^(\d{1,2})\/(\d{4})$/u);
  const yearOnly = text.match(/^(\d{4})$/u);
  const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})$/u);

  if (monthYear) {
    month = Number(monthYear[1]) - 1;
    year = Number(monthYear[2]);
  } else if (yearOnly) {
    year = Number(yearOnly[1]);
    month = endOfMonth ? 11 : 0;
  } else if (isoDate) {
    year = Number(isoDate[1]);
    month = Number(isoDate[2]) - 1;
    const day = Number(isoDate[3]);
    const date = new Date(Date.UTC(year, month, day));

    return Number.isNaN(date.getTime()) ? null : date;
  } else {
    return null;
  }

  if (!Number.isInteger(year) || year < 1900 || month < 0 || month > 11) {
    return null;
  }

  const day = endOfMonth ? new Date(Date.UTC(year, month + 1, 0)).getUTCDate() : 1;
  return new Date(Date.UTC(year, month, day));
}

export function derivedYears(experience = [], asOf) {
  const asOfDate = parseDate(asOf);

  return safeArray(experience).reduce((total, entry) => {
    const start = parseDate(entry?.dateStarted);

    if (!start) {
      return total;
    }

    const end = entry?.currentWork
      ? asOfDate
      : parseDate(entry?.dateEnded, { endOfMonth: true });

    if (!end || end <= start) {
      return total;
    }

    return total + ((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * DAYS_PER_YEAR));
  }, 0);
}

function scoreExperience(profile, application, asOf) {
  const required = Number(application?.minYearsExperience);

  if (!Number.isFinite(required) || required <= 0) {
    return null;
  }

  const candidate = derivedYears(profile?.experience, asOf);

  return candidate >= required ? 1 : Math.max(0, candidate / required);
}

function jdKeywordTokens(application) {
  return tokenize(
    application?.responsibilities,
    application?.jobTitle,
    application?.skills,
    application?.preferredSkills,
  );
}

function scoreKeywords(profile, application) {
  const jdTokens = jdKeywordTokens(application);
  const profileTokens = tokenize(
    profile?.summary,
    safeArray(profile?.experience).map((entry) => entry?.responsibilities),
    safeArray(profile?.skills).map((skill) => (typeof skill === 'string' ? skill : skill?.name)),
  );

  if (jdTokens.size === 0 || profileTokens.size === 0) {
    return null;
  }

  return intersectionSize(jdTokens, profileTokens) / jdTokens.size;
}

function scoreCertifications(profile, application) {
  const certifications = safeArray(profile?.certifications)
    .map((certification) => tokenize(
      typeof certification === 'string' ? certification : certification?.name,
    ))
    .filter((tokens) => tokens.size > 0);
  const jdTokens = jdKeywordTokens(application);

  if (certifications.length === 0 || jdTokens.size === 0) {
    return null;
  }

  const matched = certifications.filter((certificationTokens) => {
    const requiredMatches = Math.max(1, Math.ceil(certificationTokens.size * 0.6));

    return intersectionSize(certificationTokens, jdTokens) >= requiredMatches;
  }).length;

  return matched / certifications.length;
}

const CATEGORY_SCORERS = Object.freeze({
  skills: (profile, application) => scoreSkills(profile, application),
  roleAlignment: (profile, application) => scoreRoleAlignment(profile, application),
  experience: (profile, application, asOf) => scoreExperience(profile, application, asOf),
  keywords: (profile, application) => scoreKeywords(profile, application),
  certifications: (profile, application) => scoreCertifications(profile, application),
});

export function getCompatLabel(score) {
  const clamped = clampScore(score);

  return COMPAT_BANDS.find((band) => clamped >= band.min && clamped <= band.max)?.label ?? 'Low';
}

export function computeCompatibility(profile = {}, application = {}, options = {}) {
  const weights = options?.weights ?? COMPAT_WEIGHTS;
  const asOf = options?.asOf;
  const activeScores = [];

  for (const [category, scorer] of Object.entries(CATEGORY_SCORERS)) {
    const weight = Number(weights?.[category]);

    if (!Number.isFinite(weight) || weight <= 0) {
      continue;
    }

    const rawScore = scorer(profile, application, asOf);

    if (rawScore === null || rawScore === undefined || !Number.isFinite(rawScore)) {
      continue;
    }

    activeScores.push({
      weight,
      score: Math.min(1, Math.max(0, rawScore)),
    });
  }

  if (activeScores.length === 0) {
    return { score: 0, label: 'Low' };
  }

  const totalWeight = activeScores.reduce((sum, entry) => sum + entry.weight, 0);
  const score = clampScore(
    100 * activeScores.reduce(
      (sum, entry) => sum + ((entry.weight / totalWeight) * entry.score),
      0,
    ),
  );

  return {
    score,
    label: getCompatLabel(score),
  };
}
