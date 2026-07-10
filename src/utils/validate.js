const EMAIL_PATTERN = /^[^@]+@[^@]+\.[^@]+$/;
const MONTH_YEAR_PATTERN = /^(\d{2})\/(\d{4})$/;
const YEAR_PATTERN = /^\d{4}$/;
const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:']);
export const PASSWORD_MIN = 8;

function asString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateRequired(value) {
  return asString(value) ? null : 'This field is required.';
}

export function validateMonthYear(value) {
  const trimmed = asString(value);
  const match = trimmed.match(MONTH_YEAR_PATTERN);

  if (!match) {
    const [, year = ''] = trimmed.split('/');

    if (year && year.length !== 4) {
      return 'Year must be a valid four-digit year.';
    }

    return 'Date must be in MM/YYYY format.';
  }

  const month = Number(match[1]);
  const year = Number(match[2]);

  if (month < 1 || month > 12) {
    return 'Month must be 01-12.';
  }

  if (year < 1900) {
    return 'Year must be a valid four-digit year.';
  }

  return null;
}

export function validateYear(value) {
  const trimmed = asString(value);

  if (!YEAR_PATTERN.test(trimmed) || Number(trimmed) < 1900) {
    return 'Year must be a valid four-digit year.';
  }

  return null;
}

export function validateUrl(value) {
  try {
    const url = new URL(asString(value));

    return SAFE_URL_PROTOCOLS.has(url.protocol)
      ? null
      : 'Please enter a valid URL (http or https).';
  } catch {
    return 'Please enter a valid URL (http or https).';
  }
}

export function validateEmail(value) {
  const trimmed = asString(value);

  if (!trimmed) {
    return null;
  }

  return EMAIL_PATTERN.test(trimmed) ? null : 'Email must be a valid email address.';
}

// Deliberately does NOT trim (unlike asString/other validators here): a
// password's raw length is the pre-existing LoginForm/SignupForm behavior
// this consolidates, and trimming would silently change what qualifies
// (e.g. an all-whitespace password) rather than just relocating the rule.
export function validatePassword(value) {
  const raw = typeof value === 'string' ? value : '';

  return raw.length >= PASSWORD_MIN
    ? null
    : `Password must be at least ${PASSWORD_MIN} characters.`;
}
