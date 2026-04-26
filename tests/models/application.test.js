import { describe, expect, it, vi } from 'vitest';
import { normalizeApplication, validateApplication } from '../../src/models/application.js';
import { toISODate } from '../../src/utils/date.js';

function validRecord(overrides = {}) {
  return {
    id: 3,
    jobTitle: 'Frontend Engineer',
    companyName: 'Acme Corp',
    status: 'applied',
    lastStatusUpdate: '2026-04-25',
    compat: 70,
    fav: false,
    responsibilities: 'Build UI',
    skills: ['JavaScript'],
    salary: '$120k',
    recruiter: 'Jane Smith',
    jobPostingUrl: 'https://jobs.example.com/frontend',
    ...overrides,
  };
}

describe('validateApplication', () => {
  it('marks missing and non-integer ids as corrupt', () => {
    expect(validateApplication(validRecord({ id: '' }))._corrupt).toBe(true);
    expect(validateApplication(validRecord({ id: 'abc' }))._corrupt).toBe(true);
    expect(validateApplication(validRecord({ id: '003' }))._corrupt).toBe(true);
  });

  it('allows positive integer ids', () => {
    expect(validateApplication(validRecord({ id: 3 }))._corrupt).toBeUndefined();
  });

  it('coerces unrecognized status and preserves valid status', () => {
    expect(validateApplication(validRecord({ status: 'unknown' })).status).toBe('wishlisted');
    expect(validateApplication(validRecord({ status: 'interview' })).status).toBe('interview');
  });

  it('replaces invalid lastStatusUpdate with today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 25));

    expect(validateApplication(validRecord({ lastStatusUpdate: '2026-13-01' })).lastStatusUpdate)
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
    expect(validateApplication(validRecord({ jobPostingUrl: 'not-a-url' })).jobPostingUrl).toBe('');
  });

  it('leaves required fields unchanged on a valid record', () => {
    const record = validateApplication(validRecord());

    expect(record.companyName).toBe('Acme Corp');
    expect(record.jobTitle).toBe('Frontend Engineer');
    expect(record.status).toBe('applied');
    expect(record.lastStatusUpdate).toBe('2026-04-25');
  });

  it('returns a validated copy without mutating the input record', () => {
    const input = validRecord({
      status: 'unknown',
      compat: 150,
      skills: 'JavaScript',
    });
    const validated = validateApplication(input);

    expect(validated).not.toBe(input);
    expect(validated.status).toBe('wishlisted');
    expect(validated.compat).toBe(100);
    expect(validated.skills).toEqual([]);
    expect(input.status).toBe('unknown');
    expect(input.compat).toBe(150);
    expect(input.skills).toBe('JavaScript');
  });
});

describe('normalizeApplication', () => {
  it('fills absent optional string fields', () => {
    const record = normalizeApplication(validRecord({
      responsibilities: undefined,
      salary: undefined,
      recruiter: undefined,
      jobPostingUrl: undefined,
    }));

    expect(record.responsibilities).toBe('');
    expect(record.salary).toBe('');
    expect(record.recruiter).toBe('');
    expect(record.jobPostingUrl).toBe('');
  });
});
