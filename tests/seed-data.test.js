// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { DEMO_RECORDS } from '../server/db-seed.js';
import { SEED_DATA } from '../src/main.js';

function nonEmptyResponsibilities(records, field = 'responsibilities') {
  return records.map((record) => record[field]).filter((value) => typeof value === 'string' && value.trim());
}

function sentenceOpeners(values) {
  return values.map((value) => value.trim().split(/\s+/).slice(0, 3).join(' ').toLowerCase());
}

describe('seed data variety', () => {
  it('keeps server seed responsibilities distinct and domain-varied', () => {
    const responsibilities = nonEmptyResponsibilities(DEMO_RECORDS);
    const joined = responsibilities.join(' ').toLowerCase();

    expect(responsibilities).toHaveLength(DEMO_RECORDS.length);
    expect(new Set(sentenceOpeners(responsibilities)).size).toBe(responsibilities.length);
    expect(joined).toContain('corporate');
    expect(joined).toContain('startup');
    expect(joined).toContain('fintech');
  });

  it('keeps client fallback seed compact with numeric salaries and varied responsibilities', () => {
    const responsibilities = nonEmptyResponsibilities(SEED_DATA);

    expect(SEED_DATA).toHaveLength(3);
    expect(SEED_DATA.every((record) => Number.isInteger(record.salary))).toBe(true);
    expect(new Set(sentenceOpeners(responsibilities)).size).toBe(responsibilities.length);
  });
});
