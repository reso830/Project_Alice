import { describe, expect, it } from 'vitest';
import {
  APPLICATION_COLUMNS_WITHOUT_USER_ID,
  FIELD_TO_COLUMN,
  toRecord,
  toRow,
} from '../../../server/db/columns.js';

// Task 03.1 validation: assert the shared column-list module is the single
// source of truth used by both SQLite and Supabase adapters.

describe('APPLICATION_COLUMNS_WITHOUT_USER_ID', () => {
  it('is an array of snake_case column names', () => {
    expect(Array.isArray(APPLICATION_COLUMNS_WITHOUT_USER_ID)).toBe(true);
    expect(APPLICATION_COLUMNS_WITHOUT_USER_ID.length).toBeGreaterThan(0);

    for (const col of APPLICATION_COLUMNS_WITHOUT_USER_ID) {
      expect(col).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('does NOT include user_id (019 invariant)', () => {
    expect(APPLICATION_COLUMNS_WITHOUT_USER_ID).not.toContain('user_id');
  });

  it('includes the primary key', () => {
    expect(APPLICATION_COLUMNS_WITHOUT_USER_ID).toContain('id');
  });

  it('includes every constitution-required column', () => {
    // Per project constitution: company_name, job_title, status,
    // last_status_update, responsibilities.
    expect(APPLICATION_COLUMNS_WITHOUT_USER_ID).toContain('company_name');
    expect(APPLICATION_COLUMNS_WITHOUT_USER_ID).toContain('job_title');
    expect(APPLICATION_COLUMNS_WITHOUT_USER_ID).toContain('status');
    expect(APPLICATION_COLUMNS_WITHOUT_USER_ID).toContain('last_status_update');
    expect(APPLICATION_COLUMNS_WITHOUT_USER_ID).toContain('responsibilities');
  });

  it('covers every column the FIELD_TO_COLUMN mapping references', () => {
    // Every snake_case column the camelCase writes reach is also in the
    // read projection — otherwise a write would succeed in DB but the
    // returned record (via .select(...)) would be missing the field.
    for (const column of Object.values(FIELD_TO_COLUMN)) {
      expect(APPLICATION_COLUMNS_WITHOUT_USER_ID).toContain(column);
    }
  });
});

describe('toRecord / toRow round-trip via shared module', () => {
  // Drift catcher: if a future change adds a column to one helper but not
  // the other, the round-trip identity breaks here.

  it('toRecord output keys are stable (snapshot guard)', () => {
    const sampleRow = {
      id: 1,
      company_name: 'Acme',
      job_title: 'FE',
      status: 'applied',
      compat: 50,
      fav: 1,
      source_platform: 'LinkedIn',
      application_date: '2026-05-01',
      job_posting_url: 'https://x.example.com',
      recruiter: 'Jane',
      notes: 'hello',
      salary: 100000,
      responsibilities: 'do the thing',
      skills: '["js"]',
      follow_up_action: null,
      follow_up_date: null,
      location: 'Remote',
      shift: 'Day',
      work_setup: 'Remote',
      compat_notes: null,
      general_notes: null,
      preferred_skills: '[]',
      last_status_update: '2026-05-01',
      created_at: '2026-05-01',
      updated_at: '2026-05-01',
      archived: 0,
      metadata: null,
      timeline: '[]',
    };

    const record = toRecord(sampleRow);
    expect(Object.keys(record).sort()).toEqual([
      'applicationDate',
      'archived',
      'companyName',
      'compat',
      'compatNotes',
      'createdAt',
      'fav',
      'followUpAction',
      'followUpDate',
      'generalNotes',
      'id',
      'jobPostingUrl',
      'jobTitle',
      'lastStatusUpdate',
      'location',
      'metadata',
      'notes',
      'preferredSkills',
      'recruiter',
      'responsibilities',
      'salary',
      'shift',
      'skills',
      'sourcePlatform',
      'status',
      'timeline',
      'updatedAt',
      'workSetup',
    ]);
  });

  it('toRow coerces fav and archived to 0/1 (SQLite + Supabase both consume integer flags)', () => {
    expect(toRow({ fav: true })).toEqual({ fav: 1 });
    expect(toRow({ fav: false })).toEqual({ fav: 0 });
    expect(toRow({ archived: true })).toEqual({ archived: 1, fav: 0 });
    expect(toRow({ archived: false })).toEqual({ archived: 0 });
  });

  it('toRow stringifies skills, preferredSkills, metadata, and timeline', () => {
    expect(toRow({ skills: ['js', 'ts'] })).toEqual({
      skills: JSON.stringify(['js', 'ts']),
    });
    expect(toRow({ preferredSkills: ['storybook'] })).toEqual({
      preferred_skills: JSON.stringify(['storybook']),
    });
    expect(toRow({ metadata: { source: 'x' } })).toEqual({
      metadata: JSON.stringify({ source: 'x' }),
    });
    expect(toRow({
      timeline: [{ id: 1, date: '2026-05-21', status: 'applied', text: 'x' }],
    })).toEqual({
      timeline: JSON.stringify([{ id: 1, date: '2026-05-21', status: 'applied', text: 'x' }]),
    });
  });

  it('toRecord parses JSON-stringified skills, metadata, and timeline (SQLite shape)', () => {
    const record = toRecord({
      id: 1,
      company_name: 'x',
      job_title: 'y',
      status: 'applied',
      compat: 0,
      fav: 0,
      skills: '["js","ts"]',
      preferred_skills: '["storybook"]',
      metadata: '{"key":"value"}',
      timeline: '[{"id":1,"date":"2026-05-21","status":"applied","text":"x"}]',
      archived: 0,
    });
    expect(record.skills).toEqual(['js', 'ts']);
    expect(record.preferredSkills).toEqual(['storybook']);
    expect(record.metadata).toEqual({ key: 'value' });
    expect(record.timeline).toEqual([
      { id: 1, date: '2026-05-21', status: 'applied', text: 'x' },
    ]);
  });

  it('toRecord accepts pre-parsed objects for JSON fields (Postgres JSONB shape)', () => {
    const timeline = [{ id: 1, date: '2026-05-21', status: 'applied', text: 'x' }];
    const record = toRecord({
      id: 1,
      company_name: 'x',
      job_title: 'y',
      status: 'applied',
      compat: 0,
      fav: 0,
      skills: ['js', 'ts'],
      preferred_skills: ['storybook'],
      metadata: { key: 'value' },
      timeline,
      archived: 0,
    });
    expect(record.skills).toEqual(['js', 'ts']);
    expect(record.preferredSkills).toEqual(['storybook']);
    expect(record.metadata).toEqual({ key: 'value' });
    expect(record.timeline).toBe(timeline);
  });

  it('round-trips timeline entries by value', () => {
    const timeline = [{ id: 1, date: '2026-05-21', status: 'applied', text: 'x' }];
    const row = toRow({ timeline });
    const record = toRecord({
      id: 1,
      company_name: 'x',
      job_title: 'y',
      status: 'applied',
      compat: 0,
      fav: 0,
      skills: '[]',
      preferred_skills: '[]',
      metadata: null,
      archived: 0,
      ...row,
    });

    expect(record.timeline).toEqual(timeline);
  });
});
