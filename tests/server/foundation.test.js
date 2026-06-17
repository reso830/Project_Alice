import { describe, expect, it } from 'vitest';
import { STATUS_VALUES } from '../../shared/constants.js';
import { archive, create, getById } from '../../server/db/applications.js';
import { backfillCompatibility, initSchema } from '../../server/db.js';
import { saveProfile } from '../../server/db/profile.js';
import { makeMemoryDb } from './helpers.js';
import { computeCompatibility } from '../../src/models/compatibility.js';
import { toRecord, toRow } from '../../server/db/applications.js';
import { createSchema, toApiError, updateSchema } from '../../server/validation/application.js';

describe('initSchema', () => {
  it('creates the applications table with indexes', () => {
    const db = makeMemoryDb();

    const columns = db.prepare('PRAGMA table_info(applications)').all();
    const indexes = db.prepare('PRAGMA index_list(applications)').all();

    expect(columns.map((column) => column.name)).toEqual([
      'id',
      'company_name',
      'job_title',
      'status',
      'compat',
      'fav',
      'source_platform',
      'application_date',
      'job_posting_url',
      'recruiter',
      'notes',
      'salary',
      'responsibilities',
      'skills',
      'follow_up_action',
      'follow_up_date',
      'last_status_update',
      'created_at',
      'updated_at',
      'archived',
      'metadata',
      'archived_date',
      'location',
      'shift',
      'work_setup',
      'compat_notes',
      'general_notes',
      'preferred_skills',
      'timeline',
      'min_years_experience',
    ]);
    const timelineColumn = columns.find((column) => column.name === 'timeline');
    expect(timelineColumn.notnull).toBe(1);
    expect(timelineColumn.dflt_value).toBe("'[]'");
    expect(indexes.map((index) => index.name)).toEqual(expect.arrayContaining([
      'idx_applications_status',
      'idx_applications_archived',
      'idx_applications_created',
    ]));

    db.close();
  });

  it('backfills deterministic compatibility for active and archived legacy rows', () => {
    const db = makeMemoryDb();
    const asOf = '2026-06-11';
    const profile = saveProfile({
      firstName: 'Ada',
      lastName: 'Lovelace',
      summary: 'Frontend engineer working with React and TypeScript.',
      experience: [
        {
          role: 'Frontend Engineer',
          company: 'Acme',
          responsibilities: 'Built React TypeScript interfaces.',
          dateStarted: '01/2020',
          dateEnded: '',
          currentWork: true,
        },
      ],
      skills: [
        { name: 'React', level: 5 },
        { name: 'TypeScript', level: 5 },
      ],
    }, db);
    const active = create({
      companyName: 'Acme',
      jobTitle: 'Frontend Engineer',
      status: 'applied',
      responsibilities: 'Build React and TypeScript product interfaces.',
      skills: ['React', 'TypeScript'],
      minYearsExperience: 3,
      compat: 1,
    }, db, asOf);
    const archived = create({
      companyName: 'Archive Co',
      jobTitle: 'Frontend Engineer',
      status: 'rejected',
      responsibilities: 'Build React UI.',
      skills: ['React'],
      minYearsExperience: 3,
      compat: 99,
    }, db, asOf);
    archive(archived.id, db, asOf);
    db.prepare('UPDATE applications SET compat = 1 WHERE id = ?').run(active.id);
    db.prepare('UPDATE applications SET compat = 99 WHERE id = ?').run(archived.id);

    backfillCompatibility(db, asOf);

    const expectedActive = computeCompatibility(profile, getById(active.id, db), { asOf }).score;
    const expectedArchived = computeCompatibility(profile, getById(archived.id, db), { asOf }).score;

    expect(getById(active.id, db).compat).toBe(expectedActive);
    expect(getById(archived.id, db)).toMatchObject({
      archived: true,
      compat: expectedArchived,
    });

    db.close();
  });

  it('does not re-run the backfill on later initSchema calls (archived stays frozen)', () => {
    // The min_years_experience column already exists after makeMemoryDb's
    // initSchema, so the one-time migration backfill must not run again.
    const db = makeMemoryDb();
    const asOf = '2026-06-11';
    saveProfile({
      firstName: 'Ada',
      summary: 'Frontend engineer working with React.',
      skills: [{ name: 'React', level: 5 }],
    }, db);
    const app = create({
      companyName: 'Archive Co',
      jobTitle: 'Frontend Engineer',
      status: 'rejected',
      responsibilities: 'Build React UI.',
      skills: ['React'],
      minYearsExperience: 3,
    }, db, asOf);
    archive(app.id, db, asOf);
    // A deliberately "wrong" frozen score the backfill would overwrite if it ran.
    db.prepare('UPDATE applications SET compat = 7 WHERE id = ?').run(app.id);

    initSchema(db, { compatBackfillAsOf: asOf });

    expect(getById(app.id, db).compat).toBe(7);

    db.close();
  });
});

describe('application validation schemas', () => {
  it('share the controlled status values and strip system fields on update', () => {
    expect(STATUS_VALUES).toContain('phone_screen');

    const result = updateSchema.parse({
      id: 10,
      status: 'interview',
      createdAt: '2026-04-26',
    });

    expect(result).toEqual({ status: 'interview' });
  });

  it('rejects out-of-range compat and invalid metadata values', () => {
    const compatResult = createSchema.safeParse({
      companyName: 'Acme',
      jobTitle: 'Engineer',
      status: 'applied',
      compat: 150,
      metadata: { source: 'manual' },
    });

    const result = createSchema.safeParse({
      companyName: 'Acme',
      jobTitle: 'Engineer',
      status: 'applied',
      metadata: 'plain text',
    });

    expect(compatResult.success).toBe(false);
    expect(result.success).toBe(false);
  });

  it('returns validation errors for invalid URLs', () => {
    const malformedUrl = createSchema.safeParse({
      companyName: 'Acme',
      jobTitle: 'Engineer',
      status: 'applied',
      jobPostingUrl: 'not-a-url',
    });
    const unsupportedProtocol = createSchema.safeParse({
      companyName: 'Acme',
      jobTitle: 'Engineer',
      status: 'applied',
      jobPostingUrl: 'ftp://example.com/job',
    });

    expect(malformedUrl.success).toBe(false);
    expect(unsupportedProtocol.success).toBe(false);
  });

  it('returns camelCase field errors', () => {
    const result = createSchema.safeParse({});

    expect(result.success).toBe(false);
    expect(toApiError(result.error)).toMatchObject({
      companyName: 'Required',
      jobTitle: 'Required',
      status: 'Required',
    });
  });
});

describe('application row mapping', () => {
  it('maps SQL rows to API records', () => {
    expect(toRecord({
      id: 1,
      company_name: 'Acme',
      job_title: 'Engineer',
      status: 'applied',
      compat: 80,
      fav: 1,
      source_platform: 'LinkedIn',
      application_date: '2026-04-26',
      job_posting_url: 'https://example.com/job',
      recruiter: 'Jane',
      notes: 'Follow up',
      salary: '$100k',
      responsibilities: 'Build features',
      skills: '["JavaScript"]',
      follow_up_action: 'Email',
      follow_up_date: '2026-04-30',
      last_status_update: '2026-04-26',
      created_at: '2026-04-26T00:00:00.000Z',
      updated_at: '2026-04-26T00:00:00.000Z',
      archived: 0,
      metadata: '{"source":"manual"}',
      timeline: '[{"id":1,"date":"2026-05-21","status":"applied","text":"Submitted."}]',
      min_years_experience: 3,
    })).toMatchObject({
      companyName: 'Acme',
      jobTitle: 'Engineer',
      fav: true,
      archived: false,
      salary: 100000,
      skills: ['JavaScript'],
      metadata: { source: 'manual' },
      timeline: [{ id: 1, date: '2026-05-21', status: 'applied', text: 'Submitted.' }],
      minYearsExperience: 3,
    });
  });

  it('maps numeric salary strings from SQLite rows', () => {
    expect(toRecord({
      id: 1,
      company_name: 'Acme',
      job_title: 'Engineer',
      status: 'applied',
      compat: 80,
      fav: 0,
      source_platform: null,
      application_date: null,
      job_posting_url: null,
      recruiter: null,
      notes: null,
      salary: '120000',
      responsibilities: '',
      skills: '[]',
      follow_up_action: null,
      follow_up_date: null,
      last_status_update: '2026-04-26',
      created_at: '2026-04-26',
      updated_at: '2026-04-26',
      archived: 0,
      metadata: null,
      timeline: '[]',
      min_years_experience: null,
    }).salary).toBe(120000);
  });

  it('maps only supplied API fields to SQL row fields', () => {
    expect(toRow({
      fav: true,
      compat: 72,
      skills: ['React'],
      metadata: null,
      timeline: [{ id: 1, date: '2026-05-21', status: 'applied', text: '' }],
      minYearsExperience: 4,
    })).toEqual({
      fav: 1,
      compat: 72,
      skills: '["React"]',
      metadata: null,
      timeline: '[{"id":1,"date":"2026-05-21","status":"applied","text":""}]',
      min_years_experience: 4,
    });
  });
});
