import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  YEAR_MAX,
  YEAR_MIN,
  businessDaysBetween,
  dayOfWeekIso,
  daysBetween,
  isoWeekNumber,
  weeksInMonthGrid,
} from '../../src/utils/calendar.js';

describe('calendar year constants', () => {
  it('defines the supported navigation window', () => {
    expect(YEAR_MIN).toBe(2020);
    expect(YEAR_MAX).toBe(new Date().getFullYear() + 5);
  });
});

describe('isoWeekNumber', () => {
  it('handles ISO week boundaries and leap weeks', () => {
    expect(isoWeekNumber(2026, 11, 28)).toBe(53);
    expect(isoWeekNumber(2025, 11, 30)).toBe(1);
    expect(isoWeekNumber(2027, 0, 2)).toBe(53);
    expect(isoWeekNumber(2026, 0, 4)).toBe(1);
    expect(isoWeekNumber(2020, 11, 31)).toBe(53);
  });
});

describe('dayOfWeekIso', () => {
  it('converts JS weekday values to ISO Monday-start indexes', () => {
    expect(dayOfWeekIso(new Date(2026, 4, 18))).toBe(0);
    expect(dayOfWeekIso(new Date(2026, 4, 21))).toBe(3);
    expect(dayOfWeekIso(new Date(2026, 4, 24))).toBe(6);
  });
});

describe('daysBetween', () => {
  it('returns calendar days between ISO dates', () => {
    expect(daysBetween('2026-05-21', '2026-05-21')).toBe(0);
    expect(daysBetween('2026-05-22', '2026-05-21')).toBe(0);
    expect(daysBetween('2026-05-15', '2026-05-22')).toBe(7);
  });
});

describe('businessDaysBetween', () => {
  it('counts weekdays exclusive of the start and inclusive of the end', () => {
    expect(businessDaysBetween('2026-05-15', '2026-05-22')).toBe(5);
    expect(businessDaysBetween('2026-05-15', '2026-05-18')).toBe(1);
    expect(businessDaysBetween('2026-05-16', '2026-05-17')).toBe(0);
    expect(businessDaysBetween('2026-05-22', '2026-05-15')).toBe(0);
  });
});

describe('weeksInMonthGrid', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('always returns 6 Monday-start weeks and 42 cells', () => {
    const weeks = weeksInMonthGrid(2026, 4);
    const cells = weeks.flat();

    expect(weeks).toHaveLength(6);
    expect(cells).toHaveLength(42);
    expect(cells[0].iso).toBe('2026-04-27');
    expect(cells[41].iso).toBe('2026-06-07');
    expect(dayOfWeekIso(new Date(cells[0].year, cells[0].month, cells[0].day))).toBe(0);
  });

  it('marks current-month, weekend, ISO week, and today flags', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 21));

    const cells = weeksInMonthGrid(2026, 4).flat();
    const first = cells[0];
    const today = cells.find((cell) => cell.iso === '2026-05-21');
    const saturday = cells.find((cell) => cell.iso === '2026-05-23');

    expect(first.isCurrentMonth).toBe(false);
    expect(first.isoWeek).toBe(18);
    expect(today.isCurrentMonth).toBe(true);
    expect(today.isToday).toBe(true);
    expect(saturday.isWeekend).toBe(true);
  });
});
