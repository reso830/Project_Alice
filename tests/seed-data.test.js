// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';
import { DEMO_RECORDS } from '../server/db-seed.js';
import { validateApplication } from '../src/models/application.js';
import { SEED_DATA } from '../src/main.js';

function nonEmptyResponsibilities(records, field = 'responsibilities') {
  return records.map((record) => record[field]).filter((value) => typeof value === 'string' && value.trim());
}

function sentenceOpeners(values) {
  return values.map((value) => value.trim().split(/\s+/).slice(0, 3).join(' ').toLowerCase());
}

function seedRecordToApplication(record, index, timeline) {
  return {
    id: index + 1,
    companyName: record.company_name,
    jobTitle: record.job_title,
    status: record.status,
    lastStatusUpdate: record.last_status_update,
    responsibilities: record.responsibilities,
    skills: JSON.parse(record.skills ?? '[]'),
    timeline,
    fav: record.fav === 1,
    shift: record.shift ?? '',
    workSetup: record.work_setup ?? '',
    jobPostingUrl: record.job_posting_url ?? '',
  };
}

describe('seed data variety', () => {
  it('keeps server seed responsibilities distinct and domain-varied', () => {
    const responsibilities = nonEmptyResponsibilities(DEMO_RECORDS);
    const joined = responsibilities.join(' ').toLowerCase();

    expect(responsibilities).toHaveLength(DEMO_RECORDS.length);
    expect(new Set(sentenceOpeners(responsibilities)).size).toBe(responsibilities.length);
    expect(joined).toContain('corporate');
    expect(joined).toContain('startup');
    expect(joined).toContain('fintech');
  });

  it('keeps client fallback seed compact with numeric salaries and varied responsibilities', () => {
    const responsibilities = nonEmptyResponsibilities(SEED_DATA);

    expect(SEED_DATA).toHaveLength(3);
    expect(SEED_DATA.every((record) => Number.isInteger(record.salary))).toBe(true);
    expect(new Set(sentenceOpeners(responsibilities)).size).toBe(responsibilities.length);
  });

  it('keeps every SQLite seed timeline valid and covers the required Timeline shapes', () => {
    const timelines = DEMO_RECORDS.map((record, index) => {
      expect(typeof record.timeline).toBe('string');
      const timeline = JSON.parse(record.timeline);
      const validated = validateApplication(seedRecordToApplication(record, index, timeline));

      expect(validated._corrupt).toBeUndefined();
      expect(timeline.map((entry) => entry.id)).toEqual(
        Array.from({ length: timeline.length }, (_, entryIndex) => entryIndex + 1),
      );

      return timeline;
    });
    const allEntries = timelines.flat();

    expect(timelines).toHaveLength(23);
    expect(timelines.some((timeline) => timeline.length === 0)).toBe(true);
    expect(timelines.some((timeline) => timeline.length === 1)).toBe(true);
    expect(timelines.some((timeline) => timeline.length >= 5)).toBe(true);
    expect(allEntries.some((entry) => entry.date > '2026-04-26')).toBe(true);
    expect(allEntries.some((entry) => entry.status === 'accepted')).toBe(true);
    expect(allEntries.some((entry) => entry.status === 'rejected')).toBe(true);
    expect(allEntries.some((entry) => /recruiter|outreach/i.test(entry.text))).toBe(true);
    expect(allEntries.some((entry) => /interview|onsite|panel/i.test(entry.text))).toBe(true);
    expect(allEntries.some((entry) => /assessment|take-home|technical/i.test(entry.text))).toBe(true);
    expect(allEntries.some((entry) => /offer/i.test(entry.text))).toBe(true);
    expect(allEntries.some((entry) => /ghosted|no response|followed up/i.test(entry.text))).toBe(true);
    expect(allEntries.some((entry) => /follow-up|reminder|check in/i.test(entry.text))).toBe(true);
  });

  it('includes timeline in the SQLite seed insertion column list', () => {
    const seedScript = readFileSync(join(cwd(), 'server/db-seed.js'), 'utf8');

    expect(seedScript).toMatch(/'timeline'/);
  });
});
