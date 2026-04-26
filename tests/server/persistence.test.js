import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { create } from '../../server/db/applications.js';
import { makeTestDb } from './helpers.js';

describe('SQLite persistence', () => {
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
});
