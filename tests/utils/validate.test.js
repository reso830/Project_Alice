import { describe, expect, it } from 'vitest';
import {
  validateEmail,
  validateMonthYear,
  validatePassword,
  validateRequired,
  validateUrl,
  validateYear,
} from '../../src/utils/validate.js';

describe('validate utilities', () => {
  it('validates required values', () => {
    expect(validateRequired('')).toBe('This field is required.');
    expect(validateRequired('   ')).toBe('This field is required.');
    expect(validateRequired('Ana')).toBeNull();
  });

  it('validates MM/YYYY dates', () => {
    expect(validateMonthYear('01/2024')).toBeNull();
    expect(validateMonthYear('13/2024')).toBe('Month must be 01-12.');
    expect(validateMonthYear('01/24')).toBe('Year must be a valid four-digit year.');
    expect(validateMonthYear('2024-01')).toBe('Date must be in MM/YYYY format.');
  });

  it('validates four-digit years', () => {
    expect(validateYear('2024')).toBeNull();
    expect(validateYear('1899')).toBe('Year must be a valid four-digit year.');
    expect(validateYear('20-24')).toBe('Year must be a valid four-digit year.');
  });

  it('validates safe URLs', () => {
    expect(validateUrl('https://example.com')).toBeNull();
    expect(validateUrl('http://example.com')).toBeNull();
    expect(validateUrl('javascript:alert(1)')).toBe('Please enter a valid URL (http or https).');
    expect(validateUrl('data:text/plain,hello')).toBe('Please enter a valid URL (http or https).');
    expect(validateUrl('not a url')).toBe('Please enter a valid URL (http or https).');
  });

  it('validates email values when provided', () => {
    expect(validateEmail('ana@example.com')).toBeNull();
    expect(validateEmail('not-an-email')).toBe('Email must be a valid email address.');
    expect(validateEmail('')).toBeNull();
  });

  it('validates password minimum length', () => {
    expect(validatePassword('12345678')).toBeNull();
    expect(validatePassword('1234567890')).toBeNull();
    expect(validatePassword('1234567')).toBe('Password must be at least 8 characters.');
    expect(validatePassword('')).toBe('Password must be at least 8 characters.');
    expect(validatePassword('       ')).toBe('Password must be at least 8 characters.');
  });

  it('does not trim passwords (raw length only, matching pre-existing form behavior)', () => {
    // 8 spaces: raw length is 8, so this must pass — trimming would silently
    // change what qualifies as valid, which is not a policy change this
    // consolidation is allowed to make.
    expect(validatePassword('        ')).toBeNull();
    // Leading/trailing whitespace around a short password must not be
    // trimmed away to "help" it pass either.
    expect(validatePassword(' 1234 ')).toBe('Password must be at least 8 characters.');
  });
});
