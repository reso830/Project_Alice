import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { create, getAll, getById } from '../../server/db/applications.js';
import { initSchema } from '../../server/db.js';
import { makeTestDb } from './helpers.js';

describe('SQLite persistence', () => {
  it('returns defaults for existing records after extended metadata migration', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE applications (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name        TEXT    NOT NULL,
        job_title           TEXT    NOT NULL,
        status              TEXT    NOT NULL DEFAULT 'wishlisted',
        compat              INTEGER NOT NULL DEFAULT 0,
        fav                 INTEGER NOT NULL DEFAULT 0,
        source_platform     TEXT,
        application_date    TEXT,
        job_posting_url     TEXT,
        recruiter           TEXT,
        notes               TEXT,
        salary              TEXT,
        responsibilities    TEXT,
        skills              TEXT,
        follow_up_action    TEXT,
        follow_up_date      TEXT,
        last_status_update  TEXT    NOT NULL,
        created_at          TEXT    NOT NULL,
        updated_at          TEXT    NOT NULL,
        archived            INTEGER NOT NULL DEFAULT 0,
        metadata            TEXT
      )
    `);
    db.prepare(`
      INSERT INTO applications (
        company_name, job_title, status, compat, fav, skills,
        last_status_update, created_at, updated_at, archived, metadata
      )
      VALUES (
        'Legacy Corp', 'Legacy Engineer', 'applied', 64, 0, '["JavaScript"]',
        '2026-04-01', '2026-04-01', '2026-04-01', 0, NULL
      )
    `).run();

    initSchema(db);
    const record = getById(1, db);

    expect(record).toMatchObject({
      companyName: 'Legacy Corp',
      jobTitle: 'Legacy Engineer',
      location: null,
      shift: null,
      workSetup: null,
      compatNotes: null,
      generalNotes: null,
      preferredSkills: [],
      minYearsExperience: null,
    });

    db.close();
  });

  it('creates the extended application metadata columns idempotently', () => {
    const db = new Database(':memory:');

    initSchema(db);
    initSchema(db);

    const columns = db.prepare('PRAGMA table_info(applications)').all()
      .map((column) => column.name);

    expect(columns).toEqual(expect.arrayContaining([
      'location',
      'shift',
      'work_setup',
      'compat_notes',
      'general_notes',
      'preferred_skills',
      'min_years_experience',
    ]));

    db.close();
  });

  it('keeps records available after closing and reopening the database', () => {
    const testDb = makeTestDb();

    const created = create({
      companyName: 'Acme Corp',
      jobTitle: 'Frontend Engineer',
      status: 'applied',
      jobPostingUrl: 'https://example.com/jobs/frontend',
      skills: ['JavaScript'],
      metadata: { source: 'manual' },
    }, testDb.db);

    testDb.close();

    const reopened = new Database(testDb.path);
    const row = reopened.prepare('SELECT * FROM applications WHERE id = ?').get(created.id);

    expect(row).toMatchObject({
      id: created.id,
      company_name: 'Acme Corp',
      job_title: 'Frontend Engineer',
      status: 'applied',
      job_posting_url: 'https://example.com/jobs/frontend',
      skills: '["JavaScript"]',
      metadata: '{"source":"manual"}',
    });
    expect(row.created_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(row.updated_at).toBe(row.created_at);
    expect(row.last_status_update).toBe(row.created_at);

    reopened.close();
    testDb.cleanup();
  });

  it('falls back when stored JSON columns are malformed', () => {
    const testDb = makeTestDb();
    const created = create({
      companyName: 'Acme Corp',
      jobTitle: 'Frontend Engineer',
      status: 'applied',
      skills: ['JavaScript'],
      preferredSkills: ['GraphQL'],
      metadata: { source: 'manual' },
    }, testDb.db);

    testDb.db.prepare(`
      UPDATE applications
      SET skills = ?, preferred_skills = ?, metadata = ?
      WHERE id = ?
    `).run('not-json', 'also-not-json', '{broken', created.id);

    const records = getAll(testDb.db);

    expect(records[0]).toMatchObject({
      id: created.id,
      skills: [],
      preferredSkills: [],
      metadata: null,
    });

    testDb.close();
    testDb.cleanup();
  });
});
