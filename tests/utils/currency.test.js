import { describe, expect, it } from 'vitest';
import { formatPeso, parseSalaryInput } from '../../src/utils/currency.js';

describe('formatPeso', () => {
  it('formats positive integers as Philippine Peso without decimals', () => {
    expect(formatPeso(150000)).toBe('₱150,000');
    expect(formatPeso(50000)).toBe('₱50,000');
  });

  it('treats absent, zero, and negative values as empty salary display', () => {
    expect(formatPeso(null)).toBe('');
    expect(formatPeso(undefined)).toBe('');
    expect(formatPeso(0)).toBe('');
    expect(formatPeso(-1)).toBe('');
  });
});

describe('parseSalaryInput', () => {
  it('parses plain, comma-separated, and shorthand salary amounts', () => {
    expect(parseSalaryInput('80000')).toBe(80000);
    expect(parseSalaryInput('80,000')).toBe(80000);
    expect(parseSalaryInput('80k')).toBe(80000);
    expect(parseSalaryInput('80K')).toBe(80000);
    expect(parseSalaryInput('₱80k')).toBe(80000);
    expect(parseSalaryInput('PHP 80k')).toBe(80000);
  });

  it('parses salary ranges to the lower bound', () => {
    expect(parseSalaryInput('50000-80000')).toBe(50000);
    expect(parseSalaryInput('50k-80k')).toBe(50000);
    expect(parseSalaryInput('₱50,000 - ₱80,000')).toBe(50000);
    expect(parseSalaryInput('PHP 50,000 - PHP 80,000')).toBe(50000);
  });

  it('returns null for empty, absent, and unparseable salary input', () => {
    expect(parseSalaryInput('')).toBeNull();
    expect(parseSalaryInput('abc')).toBeNull();
    expect(parseSalaryInput(null)).toBeNull();
  });
});
