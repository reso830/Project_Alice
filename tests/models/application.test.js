import { describe, expect, it, vi } from 'vitest';
import { normalizeApplication, validateApplication } from '../../src/models/application.js';
import { toISODate } from '../../src/utils/date.js';

function validRecord(overrides = {}) {
  return {
    id: '003',
    position: 'Frontend Engineer',
    company: 'Acme Corp',
    status: 'applied',
    last_status_update: '2026-04-25',
    compat: 70,
    fav: false,
    responsibilities: 'Build UI',
    skills: ['JavaScript'],
    salary: '$120k',
    recruiter: 'Jane Smith',
    url: 'https://jobs.example.com/frontend',
    ...overrides,
  };
}

describe('validateApplication', () => {
  it('marks missing and non-digit ids as corrupt', () => {
    expect(validateApplication(validRecord({ id: '' }))._corrupt).toBe(true);
    expect(validateApplication(validRecord({ id: 'abc' }))._corrupt).toBe(true);
  });

  it('allows digit string ids', () => {
    expect(validateApplication(validRecord({ id: '003' }))._corrupt).toBeUndefined();
  });

  it('coerces unrecognized status and preserves valid status', () => {
    expect(validateApplication(validRecord({ status: 'unknown' })).status).toBe('wishlisted');
    expect(validateApplication(validRecord({ status: 'interview' })).status).toBe('interview');
  });

  it('replaces invalid last_status_update with today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 25));

    expect(validateApplication(validRecord({ last_status_update: '2026-13-01' })).last_status_update)
      .toBe(toISODate());

    vi.useRealTimers();
  });

  it('clamps compatibility score to 0-100', () => {
    expect(validateApplication(validRecord({ compat: -5 })).compat).toBe(0);
    expect(validateApplication(validRecord({ compat: 120 })).compat).toBe(100);
  });

  it('coerces invalid skills and fav values to defaults', () => {
    const record = validateApplication(validRecord({ skills: 'React', fav: 'yes' }));

    expect(record.skills).toEqual([]);
    expect(record.fav).toBe(false);
  });

  it('removes invalid URLs', () => {
    expect(validateApplication(validRecord({ url: 'not-a-url' })).url).toBe('');
  });

  it('leaves required fields unchanged on a valid record', () => {
    const record = validateApplication(validRecord());

    expect(record.company).toBe('Acme Corp');
    expect(record.position).toBe('Frontend Engineer');
    expect(record.status).toBe('applied');
    expect(record.last_status_update).toBe('2026-04-25');
  });
});

describe('normalizeApplication', () => {
  it('fills absent optional string fields', () => {
    const record = normalizeApplication(validRecord({
      responsibilities: undefined,
      salary: undefined,
      recruiter: undefined,
      url: undefined,
    }));

    expect(record.responsibilities).toBe('');
    expect(record.salary).toBe('');
    expect(record.recruiter).toBe('');
    expect(record.url).toBe('');
  });
});
