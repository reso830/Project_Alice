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
    location: 'Manila',
    shift: 'Day',
    workSetup: 'Remote',
    compatNotes: 'Strong React match',
    compatAnalysis: {
      summary: 'Strong React fit',
      body: 'React and TypeScript line up with the role.',
      generatedAt: '2026-06-17T10:34:56.789Z',
    },
    compatScoredAt: '2026-06-17T10:00:00.000Z',
    generalNotes: 'Applied via referral',
    preferredSkills: ['GraphQL', 'Figma'],
    minYearsExperience: 3,
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

  it('accepts "accepted" as a valid status', () => {
    expect(createSchema.safeParse(validPayload({ status: 'accepted' })).success).toBe(true);
  });

  it('requires companyName, jobTitle, status, and responsibilities', () => {
    expectFieldError(validPayload({ companyName: undefined }), 'companyName');
    expectFieldError(validPayload({ jobTitle: undefined }), 'jobTitle');
    expectFieldError(validPayload({ status: undefined }), 'status');
    expectFieldError(validPayload({ responsibilities: undefined }), 'responsibilities');
    expectFieldError(validPayload({ responsibilities: '' }), 'responsibilities');
  });

  it('rejects invalid status, URL, date, skills, and metadata values', () => {
    expectFieldError(validPayload({ status: 'unknown' }), 'status');
    expectFieldError(validPayload({ jobPostingUrl: 'ftp://example.com/job' }), 'jobPostingUrl');
    expectFieldError(validPayload({ applicationDate: '2026/04/20' }), 'applicationDate');
    expectFieldError(validPayload({ skills: 'JavaScript' }), 'skills');
    expectFieldError(validPayload({ metadata: 'string' }), 'metadata');
  });

  it('strips client-supplied compatibility scores', () => {
    expect(createSchema.parse(validPayload({ compat: 150 }))).not.toHaveProperty('compat');
    expect(updateSchema.parse({ compat: 72 })).toEqual({});
  });

  it('strips retired and server-managed compatibility fields', () => {
    const parsedCreate = createSchema.parse(validPayload());

    expect(parsedCreate).not.toHaveProperty('compatNotes');
    expect(parsedCreate).not.toHaveProperty('compatAnalysis');
    expect(parsedCreate).not.toHaveProperty('compatScoredAt');

    expect(updateSchema.parse({
      compatNotes: 'legacy note',
      compatAnalysis: {
        summary: 'Strong React fit',
        body: 'React and TypeScript line up with the role.',
        generatedAt: '2026-06-17T10:34:56.789Z',
      },
      compatScoredAt: '2026-06-17T10:00:00.000Z',
    })).toEqual({});
  });

  it('accepts all optional fields omitted', () => {
    const result = createSchema.safeParse({
      companyName: 'Acme Corp',
      jobTitle: 'Frontend Engineer',
      status: 'applied',
      responsibilities: 'Build product UI',
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

  it('accepts valid shift and work setup values', () => {
    for (const shift of ['Day', 'Mid', 'Night', 'Flexible']) {
      expect(createSchema.safeParse(validPayload({ shift })).success).toBe(true);
    }

    for (const workSetup of ['Remote', 'Hybrid', 'On-site', 'Field']) {
      expect(createSchema.safeParse(validPayload({ workSetup })).success).toBe(true);
    }
  });

  it('rejects invalid shift and work setup values', () => {
    expectFieldError(validPayload({ shift: 'Morning' }), 'shift');
    expectFieldError(validPayload({ workSetup: 'Office' }), 'workSetup');
  });

  it('accepts empty shift and work setup values', () => {
    expect(createSchema.safeParse(validPayload({ shift: '', workSetup: '' })).success).toBe(true);
  });

  it('rejects non-array preferred skills', () => {
    expectFieldError(validPayload({ preferredSkills: 'React' }), 'preferredSkills');
  });

  it('accepts preferred skills arrays and all extended metadata omitted', () => {
    expect(createSchema.parse(validPayload({ preferredSkills: ['GraphQL'] })).preferredSkills)
      .toEqual(['GraphQL']);

    const result = createSchema.safeParse({
      companyName: 'Acme Corp',
      jobTitle: 'Frontend Engineer',
      status: 'wishlisted',
      responsibilities: 'Build product UI',
    });

    expect(result.success).toBe(true);
  });

  it('accepts and rejects minYearsExperience values', () => {
    expect(createSchema.parse(validPayload({ minYearsExperience: 0 })).minYearsExperience).toBe(0);
    expect(createSchema.parse(validPayload({ minYearsExperience: 4 })).minYearsExperience).toBe(4);
    expect(createSchema.parse(validPayload({ minYearsExperience: null })).minYearsExperience)
      .toBeNull();
    expect(createSchema.parse(validPayload({ minYearsExperience: '' })).minYearsExperience)
      .toBeNull();

    expectFieldError(validPayload({ minYearsExperience: -1 }), 'minYearsExperience');
    expectFieldError(validPayload({ minYearsExperience: 3.7 }), 'minYearsExperience');
    expectFieldError(validPayload({ minYearsExperience: 'abc' }), 'minYearsExperience');
  });

  it('accepts a valid timeline array', () => {
    const result = createSchema.safeParse(validPayload({
      timeline: [
        { id: 1, date: '2026-05-21', status: 'applied', text: 'Submitted.' },
      ],
    }));

    expect(result.success).toBe(true);
  });

  it('rejects malformed timeline payloads', () => {
    expectFieldError(validPayload({
      timeline: [{ date: '2026-05-21', status: 'applied', text: '' }],
    }), 'timeline');
    expectFieldError(validPayload({
      timeline: [{ id: 1, date: '2026/05/21', status: 'applied', text: '' }],
    }), 'timeline');
    expectFieldError(validPayload({
      timeline: [{ id: 1, date: '2026-05-21', status: 'unknown', text: '' }],
    }), 'timeline');
    expectFieldError(validPayload({ timeline: 'not-array' }), 'timeline');
  });

  it('rejects duplicate timeline ids and overlong entry text', () => {
    expectFieldError(validPayload({
      timeline: [
        { id: 1, date: '2026-05-21', status: 'applied', text: 'Submitted.' },
        { id: 1, date: '2026-05-22', status: 'interview', text: 'Interviewed.' },
      ],
    }), 'timeline');

    expectFieldError(validPayload({
      timeline: [{ id: 1, date: '2026-05-21', status: 'applied', text: 'x'.repeat(501) }],
    }), 'timeline');
  });
});

describe('updateSchema', () => {
  it('accepts partial status updates', () => {
    expect(updateSchema.parse({ status: 'interview' })).toEqual({ status: 'interview' });
  });

  it('strips client-managed fields silently', () => {
    expect(updateSchema.parse({
      id: 1,
      archivedDate: '2099-01-01',
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

  it('accepts partial updates with extended metadata fields', () => {
    expect(updateSchema.parse({
      location: 'Cebu',
      shift: 'Flexible',
      workSetup: 'Hybrid',
      compatNotes: 'Updated compatibility notes',
      compatAnalysis: { summary: 'x', body: 'y', generatedAt: '2026-06-17T10:00:00.000Z' },
      compatScoredAt: '2026-06-17T10:00:00.000Z',
      generalNotes: 'Updated general notes',
      preferredSkills: ['GraphQL'],
      minYearsExperience: 5,
    })).toEqual({
      location: 'Cebu',
      shift: 'Flexible',
      workSetup: 'Hybrid',
      generalNotes: 'Updated general notes',
      preferredSkills: ['GraphQL'],
      minYearsExperience: 5,
    });
  });

  it('rejects string salary updates', () => {
    const result = updateSchema.safeParse({ salary: '$120k' });

    expect(result.success).toBe(false);
    expect(toApiError(result.error).salary).toBe('Invalid input');
  });

  it('rejects empty responsibilities updates when present', () => {
    const result = updateSchema.safeParse({ responsibilities: '' });

    expect(result.success).toBe(false);
    expect(toApiError(result.error).responsibilities).toBe('Responsibilities is required');
  });

  it('coerces null favorite updates to false and accepts archive updates', () => {
    expect(updateSchema.parse({ fav: null })).toEqual({ fav: false });
    expect(updateSchema.parse({ archived: true })).toEqual({ archived: true });
  });

  it('accepts valid timeline updates and rejects invalid entry ids', () => {
    expect(updateSchema.parse({
      timeline: [{ id: 1, date: '2026-06-20', status: 'phone_screen', text: 'Callback.' }],
    })).toEqual({
      timeline: [{ id: 1, date: '2026-06-20', status: 'phone_screen', text: 'Callback.' }],
    });

    const result = updateSchema.safeParse({
      timeline: [{ id: 0, date: '2026-06-20', status: 'phone_screen', text: '' }],
    });

    expect(result.success).toBe(false);
    expect(toApiError(result.error).timeline).toEqual(expect.any(String));
  });

  it('rejects duplicate timeline ids and overlong text on update', () => {
    for (const timeline of [
      [
        { id: 1, date: '2026-06-20', status: 'applied', text: 'Submitted.' },
        { id: 1, date: '2026-06-21', status: 'interview', text: 'Interviewed.' },
      ],
      [{ id: 1, date: '2026-06-20', status: 'applied', text: 'x'.repeat(501) }],
    ]) {
      const result = updateSchema.safeParse({ timeline });

      expect(result.success).toBe(false);
      expect(toApiError(result.error).timeline).toEqual(expect.any(String));
    }
  });
});
