import { describe, expect, it } from 'vitest';
import {
  validateEmail,
  validateMonthYear,
  validateRequired,
  validateUrl,
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
});
