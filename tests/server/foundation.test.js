import { describe, expect, it } from 'vitest';
import { STATUS_VALUES } from '../../shared/constants.js';
import { makeMemoryDb } from './helpers.js';
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
    ]);
    expect(indexes.map((index) => index.name)).toEqual(expect.arrayContaining([
      'idx_applications_status',
      'idx_applications_archived',
      'idx_applications_created',
    ]));

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

  it('clamps compat and rejects invalid metadata values', () => {
    expect(createSchema.parse({
      companyName: 'Acme',
      jobTitle: 'Engineer',
      status: 'applied',
      compat: 150,
      metadata: { source: 'manual' },
    }).compat).toBe(100);

    const result = createSchema.safeParse({
      companyName: 'Acme',
      jobTitle: 'Engineer',
      status: 'applied',
      metadata: 'plain text',
    });

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
    })).toMatchObject({
      companyName: 'Acme',
      jobTitle: 'Engineer',
      fav: true,
      archived: false,
      skills: ['JavaScript'],
      metadata: { source: 'manual' },
    });
  });

  it('maps only supplied API fields to SQL row fields', () => {
    expect(toRow({
      fav: true,
      compat: 150,
      skills: ['React'],
      metadata: null,
    })).toEqual({
      fav: 1,
      compat: 100,
      skills: '["React"]',
      metadata: null,
    });
  });
});
