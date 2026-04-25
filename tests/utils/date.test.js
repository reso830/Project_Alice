import { describe, expect, it } from 'vitest';
import { toDisplayDate, toISODate } from '../../src/utils/date.js';

describe('date utilities', () => {
  it('formats today as an ISO date', () => {
    expect(toISODate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('formats a provided date as an ISO date', () => {
    expect(toISODate(new Date(2025, 0, 15))).toBe('2025-01-15');
  });

  it('omits the year for current-year display dates', () => {
    expect(toDisplayDate('2026-04-25')).toBe('Apr 25');
  });

  it('includes the year for non-current-year display dates', () => {
    expect(toDisplayDate('2025-01-01')).toBe('Jan 1, 2025');
  });

  it('returns an em dash for empty or malformed values', () => {
    expect(toDisplayDate('')).toBe('—');
    expect(toDisplayDate('not-a-date')).toBe('—');
  });

  it('returns an em dash for invalid calendar dates', () => {
    expect(toDisplayDate('2026-02-30')).toBe('—');
  });
});
