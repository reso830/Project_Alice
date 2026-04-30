import { describe, expect, it } from 'vitest';
import { formatPeso } from '../../src/utils/currency.js';

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
