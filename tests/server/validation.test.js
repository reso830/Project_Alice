import { describe, expect, it } from 'vitest';
import { createSchema, toApiError, updateSchema } from '../../server/validation/application.js';

function validPayload(overrides = {}) {
  return {
    companyName: 'Acme Corp',
    jobTitle: 'Frontend Engineer',
    status: 'applied',
    compat: 72,
    fav: true,
    sourcePlatform: 'LinkedIn',
    applicationDate: '2026-04-26',
    jobPostingUrl: 'https://example.com/jobs/frontend',
    recruiter: 'Jane Smith',
    notes: 'Referred by a friend',
    salary: 120000,
    responsibilities: 'Build product UI',
    skills: ['JavaScript', 'React'],
    followUpAction: 'Send follow-up',
    followUpDate: '2026-04-30',
    metadata: { source: 'manual' },
    ...overrides,
  };
}

function expectFieldError(payload, field) {
  const result = createSchema.safeParse(payload);

  expect(result.success).toBe(false);
  expect(toApiError(result.error)[field]).toEqual(expect.any(String));
}

describe('createSchema', () => {
  it('accepts a valid full payload', () => {
    expect(createSchema.safeParse(validPayload()).success).toBe(true);
  });

  it('requires companyName, jobTitle, and status', () => {
    expectFieldError(validPayload({ companyName: undefined }), 'companyName');
    expectFieldError(validPayload({ jobTitle: undefined }), 'jobTitle');
    expectFieldError(validPayload({ status: undefined }), 'status');
  });

  it('rejects invalid status, URL, date, skills, and metadata values', () => {
    expectFieldError(validPayload({ status: 'unknown' }), 'status');
    expectFieldError(validPayload({ jobPostingUrl: 'ftp://example.com/job' }), 'jobPostingUrl');
    expectFieldError(validPayload({ applicationDate: '2026/04/20' }), 'applicationDate');
    expectFieldError(validPayload({ skills: 'JavaScript' }), 'skills');
    expectFieldError(validPayload({ metadata: 'string' }), 'metadata');
  });

  it('rejects out-of-range compatibility scores', () => {
    const high = createSchema.safeParse(validPayload({ compat: 150 }));
    const low = createSchema.safeParse(validPayload({ compat: -1 }));

    expect(high.success).toBe(false);
    expect(low.success).toBe(false);
    expect(toApiError(high.error).compat).toBe('Compatibility must be between 0 and 100');
  });

  it('accepts all optional fields omitted', () => {
    const result = createSchema.safeParse({
      companyName: 'Acme Corp',
      jobTitle: 'Frontend Engineer',
      status: 'applied',
    });

    expect(result.success).toBe(true);
  });

  it('allows empty URL and date fields for clearing optional values', () => {
    const result = createSchema.parse(validPayload({
      jobPostingUrl: '',
      applicationDate: '',
      followUpDate: '',
    }));

    expect(result.jobPostingUrl).toBe('');
    expect(result.applicationDate).toBeNull();
    expect(result.followUpDate).toBeNull();
  });
});

describe('updateSchema', () => {
  it('accepts partial status updates', () => {
    expect(updateSchema.parse({ status: 'interview' })).toEqual({ status: 'interview' });
  });

  it('strips client-managed fields silently', () => {
    expect(updateSchema.parse({
      id: 1,
      createdAt: '2026-04-20',
      status: 'interview',
    })).toEqual({ status: 'interview' });
  });

  it('rejects invalid follow-up dates', () => {
    const result = updateSchema.safeParse({ followUpDate: '2026/04/20' });

    expect(result.success).toBe(false);
    expect(toApiError(result.error).followUpDate).toEqual(expect.any(String));
  });

  it('allows empty URL and date fields on updates', () => {
    expect(updateSchema.parse({
      jobPostingUrl: '',
      applicationDate: '',
      followUpDate: '',
    })).toEqual({
      jobPostingUrl: '',
      applicationDate: null,
      followUpDate: null,
    });
  });

  it('accepts empty objects as valid no-op updates', () => {
    expect(updateSchema.parse({})).toEqual({});
  });

  it('rejects string salary updates', () => {
    const result = updateSchema.safeParse({ salary: '$120k' });

    expect(result.success).toBe(false);
    expect(toApiError(result.error).salary).toBe('Invalid input');
  });

  it('coerces null favorite updates to false and accepts archive updates', () => {
    expect(updateSchema.parse({ fav: null })).toEqual({ fav: false });
    expect(updateSchema.parse({ archived: true })).toEqual({ archived: true });
  });
});
