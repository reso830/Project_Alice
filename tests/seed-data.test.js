// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_RECORDS } from '../server/seeds/applicationsData.js';
import { buildDemoSeed } from '../src/data/demoSeed.js';
import { validateApplication } from '../src/models/application.js';
import { SEED_DATA } from '../src/main.js';
import { evaluateSuggestions } from '../src/utils/calendarSuggestions.js';
import { toISODate } from '../src/utils/date.js';

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

function expectAllSuggestionKinds(applications) {
  const suggestions = evaluateSuggestions(applications, toISODate(), []);
  const kinds = new Set(suggestions.map((suggestion) => suggestion.kind));

  expect(kinds).toContain('followup');
  expect(kinds).toContain('feedback');
  expect(kinds).toContain('interview_followup');
  expect(kinds).toContain('offer_expiry');
  expect(kinds).toContain('ghost');
}

function maxDistinctStatusesPerDay(applications) {
  const byDate = new Map();

  for (const app of applications) {
    for (const entry of app.timeline ?? []) {
      if (!byDate.has(entry.date)) {
        byDate.set(entry.date, new Set());
      }
      byDate.get(entry.date).add(entry.status);
    }
  }

  return Math.max(0, ...[...byDate.values()].map((statuses) => statuses.size));
}

async function loadSQLiteSeedApplicationsForToday() {
  vi.resetModules();
  const { DEMO_RECORDS: records } = await import('../server/seeds/applicationsData.js');

  return records.map((record, index) => (
    seedRecordToApplication(record, index, JSON.parse(record.timeline))
  ));
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

  it('includes exactly two archived client demo seed rows with favorite and terminal coverage', () => {
    const { applications } = buildDemoSeed();
    const archived = applications.filter((record) => record.archived === true);

    expect(archived).toHaveLength(2);
    expect(archived.every((record) => typeof record.archivedDate === 'string' && record.archivedDate !== '')).toBe(true);
    expect(archived.some((record) => record.fav === true)).toBe(true);
    expect(archived.some((record) => ['accepted', 'rejected', 'withdrawn', 'ghosted'].includes(record.status))).toBe(true);
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

describe('seed data calendar suggestion coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-21T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('triggers all five suggestion kinds from the demo seed', () => {
    const { applications } = buildDemoSeed();

    expectAllSuggestionKinds(applications);
    expect(maxDistinctStatusesPerDay(applications)).toBeGreaterThanOrEqual(4);
  });

  it('triggers all five suggestion kinds from the SQLite seed', async () => {
    const applications = await loadSQLiteSeedApplicationsForToday();

    expectAllSuggestionKinds(applications);
    expect(maxDistinctStatusesPerDay(applications)).toBeGreaterThanOrEqual(4);
  });
});
