import { describe, expect, it } from 'vitest';
import {
  APPLICATION_COLUMNS_WITHOUT_USER_ID,
  currentDate,
  FIELD_TO_COLUMN,
  INSERTABLE_COLUMNS,
  UPDATABLE_COLUMNS,
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
      compat_analysis: '{"summary":"Strong match","body":"React aligns well.","generatedAt":"2026-06-17T10:34:56.789Z"}',
      compat_scored_at: '2026-06-17T10:00:00.000Z',
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
      min_years_experience: 3,
      last_status_update: '2026-05-01',
      created_at: '2026-05-01',
      updated_at: '2026-05-01',
      archived: 0,
      archived_date: null,
      metadata: null,
      timeline: '[]',
    };

    const record = toRecord(sampleRow);
    expect(Object.keys(record).sort()).toEqual([
      'applicationDate',
      'archived',
      'archivedDate',
      'companyName',
      'compat',
      'compatAnalysis',
      'compatNotes',
      'compatScoredAt',
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
      'minYearsExperience',
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
    expect(toRow({ archived: true })).toEqual({ archived: 1 });
    expect(toRow({ archived: false })).toEqual({ archived: 0 });
  });

  it('preserves fav when archived and fav are translated together', () => {
    expect(toRow({ archived: true, fav: true })).toEqual({ archived: 1, fav: 1 });
  });

  it('drops archivedDate from write rows and keeps archived_date non-updatable', () => {
    expect(toRow({ archivedDate: '2099-01-01' })).toEqual({});
    expect(UPDATABLE_COLUMNS.has('archived_date')).toBe(false);
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

  it('round-trips compatibility analysis and score timestamp while retiring compatNotes writes', () => {
    const notes = {
      summary: 'Strong React fit',
      body: 'React and TypeScript line up with the role.',
      generatedAt: '2026-06-17T10:34:56.789Z',
    };

    expect(FIELD_TO_COLUMN.compatAnalysis).toBe('compat_analysis');
    expect(FIELD_TO_COLUMN.compatScoredAt).toBe('compat_scored_at');
    expect(FIELD_TO_COLUMN).not.toHaveProperty('compatNotes');
    expect(APPLICATION_COLUMNS_WITHOUT_USER_ID).toEqual(expect.arrayContaining([
      'compat_notes',
      'compat_analysis',
      'compat_scored_at',
    ]));
    expect(INSERTABLE_COLUMNS).toEqual(expect.arrayContaining([
      'compat_analysis',
      'compat_scored_at',
    ]));
    expect(INSERTABLE_COLUMNS).not.toContain('compat_notes');

    expect(toRow({ compatAnalysis: notes, compatScoredAt: notes.generatedAt })).toEqual({
      compat_analysis: JSON.stringify(notes),
      compat_scored_at: notes.generatedAt,
    });
    expect(toRow({ compatAnalysis: null, compatScoredAt: null })).toEqual({
      compat_analysis: null,
      compat_scored_at: null,
    });
    expect(toRow({ compatNotes: 'legacy note' })).toEqual({});
    expect(UPDATABLE_COLUMNS.has('compat_notes')).toBe(false);

    const record = toRecord({
      id: 1,
      company_name: 'x',
      job_title: 'y',
      status: 'applied',
      compat: 0,
      compat_analysis: JSON.stringify(notes),
      compat_scored_at: notes.generatedAt,
      compat_notes: null,
      fav: 0,
      skills: '[]',
      preferred_skills: '[]',
      metadata: null,
      timeline: '[]',
      archived: 0,
      min_years_experience: null,
    });

    expect(record.compatAnalysis).toEqual(notes);
    expect(record.compatScoredAt).toBe(notes.generatedAt);
    expect(record.compatNotes).toBeNull();
  });

  it('treats malformed compat_analysis JSON as null', () => {
    const record = toRecord({
      id: 1,
      company_name: 'x',
      job_title: 'y',
      status: 'applied',
      compat: 0,
      compat_analysis: '{not-json',
      compat_scored_at: null,
      fav: 0,
      skills: '[]',
      preferred_skills: '[]',
      metadata: null,
      timeline: '[]',
      archived: 0,
      min_years_experience: null,
    });

    expect(record.compatAnalysis).toBeNull();
    expect(record.compatScoredAt).toBeNull();
  });

  it('round-trips minYearsExperience as min_years_experience including null', () => {
    expect(FIELD_TO_COLUMN.minYearsExperience).toBe('min_years_experience');
    expect(APPLICATION_COLUMNS_WITHOUT_USER_ID).toContain('min_years_experience');
    expect(toRow({ minYearsExperience: 3 })).toEqual({ min_years_experience: 3 });
    expect(toRow({ minYearsExperience: null })).toEqual({ min_years_experience: null });
    expect(toRecord({
      id: 1,
      company_name: 'x',
      job_title: 'y',
      status: 'applied',
      compat: 0,
      fav: 0,
      skills: '[]',
      preferred_skills: '[]',
      metadata: null,
      timeline: '[]',
      archived: 0,
      min_years_experience: 4,
    }).minYearsExperience).toBe(4);
    expect(toRecord({
      id: 1,
      company_name: 'x',
      job_title: 'y',
      status: 'applied',
      compat: 0,
      fav: 0,
      skills: '[]',
      preferred_skills: '[]',
      metadata: null,
      timeline: '[]',
      archived: 0,
      min_years_experience: null,
    }).minYearsExperience).toBeNull();
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
      archived_date: '2026-05-26',
    });
    expect(record.skills).toEqual(['js', 'ts']);
    expect(record.preferredSkills).toEqual(['storybook']);
    expect(record.metadata).toEqual({ key: 'value' });
    expect(record.timeline).toEqual([
      { id: 1, date: '2026-05-21', status: 'applied', text: 'x' },
    ]);
    expect(record.archivedDate).toBe('2026-05-26');
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

  it('currentDate() returns a UTC YYYY-MM-DD string (#43 — fallback when X-Client-Date is absent)', () => {
    // Pick a UTC instant where a local timezone east of UTC would have
    // already crossed into the next calendar day, and a TZ west of UTC
    // would still be on the previous day. The function MUST return the
    // UTC date regardless of process TZ — that is the documented fallback
    // contract that the X-Client-Date header overrides.
    const utc = new Date('2030-06-15T23:30:00Z');
    expect(utc.toISOString().slice(0, 10)).toBe('2030-06-15');
    // Sanity-check on the helper itself; behavior is intentionally UTC.
    expect(currentDate(utc)).toBe('2030-06-15');
  });

  it('currentDate() accepts an optional Date and matches its ISO date prefix', () => {
    const cases = [
      new Date('2026-01-01T00:00:01Z'),
      new Date('2026-12-31T23:59:59Z'),
      new Date('2030-06-15T12:00:00Z'),
    ];
    for (const d of cases) {
      expect(currentDate(d)).toBe(d.toISOString().slice(0, 10));
    }
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
