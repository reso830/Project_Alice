import { describe, expect, it } from 'vitest';
import {
  deriveActivityTitle,
  projectTimelineToCalendar,
  todayRowsFor,
  upcomingRowsFor,
} from '../../src/utils/calendarProjection.js';

function app(overrides = {}) {
  return {
    id: 1,
    companyName: 'Acme',
    jobTitle: 'Frontend Engineer',
    timeline: [],
    ...overrides,
  };
}

describe('deriveActivityTitle', () => {
  it('uses non-empty text first', () => {
    expect(deriveActivityTitle(
      { date: '2026-05-20', status: 'applied', text: 'Submitted through portal' },
      app(),
    )).toBe('Submitted through portal');
  });

  it('truncates long timeline text to 80 characters', () => {
    const title = deriveActivityTitle(
      { date: '2026-05-20', status: 'applied', text: 'a'.repeat(81) },
      app(),
    );

    expect(title).toHaveLength(78);
    expect(title.endsWith('\u2026')).toBe(true);
  });

  it('falls back to status label, job title, then Activity', () => {
    expect(deriveActivityTitle({ status: 'interview', text: '' }, app()))
      .toBe('Interview');
    expect(deriveActivityTitle({ status: 'unknown', text: '' }, app()))
      .toBe('Frontend Engineer');
    expect(deriveActivityTitle({ status: 'unknown', text: '' }, app({ jobTitle: undefined })))
      .toBe('Activity');
    expect(deriveActivityTitle({ status: 'unknown', text: '' }, app({ jobTitle: '   ' })))
      .toBe('Activity');
  });
});

describe('projectTimelineToCalendar', () => {
  it('groups timeline entries by date and preserves insertion order within a day', () => {
    const projected = projectTimelineToCalendar([
      app({
        id: 2,
        companyName: 'Beta',
        timeline: [
          { id: 1, date: '2026-05-21', status: 'applied', text: 'Applied' },
          { id: 2, date: '2026-05-21', status: 'interview', text: 'Interview' },
        ],
      }),
      app({
        id: 1,
        companyName: 'Acme',
        timeline: [
          { id: 1, date: '2026-05-22', status: 'offer', text: '' },
        ],
      }),
      app({ id: 3, timeline: undefined }),
    ]);

    expect(projected['2026-05-21']).toEqual([
      { id: 2, title: 'Applied', company: 'Beta', jobTitle: 'Frontend Engineer', status: 'applied' },
      { id: 2, title: 'Interview', company: 'Beta', jobTitle: 'Frontend Engineer', status: 'interview' },
    ]);
    expect(projected['2026-05-22']).toEqual([
      { id: 1, title: 'Offer', company: 'Acme', jobTitle: 'Frontend Engineer', status: 'offer' },
    ]);
  });
});

describe('todayRowsFor', () => {
  it('includes only today and sorts rows by application id', () => {
    const rows = todayRowsFor([
      app({
        id: 3,
        companyName: 'Gamma',
        timeline: [{ id: 1, date: '2026-05-21', status: 'applied', text: 'Applied' }],
      }),
      app({
        id: 1,
        companyName: 'Acme',
        timeline: [
          { id: 1, date: '2026-05-20', status: 'applied', text: 'Past' },
          { id: 2, date: '2026-05-21', status: 'interview', text: '' },
          { id: 3, date: '2026-05-22', status: 'offer', text: 'Future' },
        ],
      }),
    ], '2026-05-21');

    expect(rows).toEqual([
      { id: 1, title: 'Interview', company: 'Acme', role: 'Frontend Engineer' },
      { id: 3, title: 'Applied', company: 'Gamma', role: 'Frontend Engineer' },
    ]);
  });
});

describe('upcomingRowsFor', () => {
  it('partitions tomorrow and rest of ISO week and excludes later dates', () => {
    const rows = upcomingRowsFor([
      app({
        id: 2,
        companyName: 'Beta',
        timeline: [
          { id: 1, date: '2026-05-22', status: 'phone_screen', text: 'Call' },
          { id: 2, date: '2026-05-24', status: 'interview', text: 'Panel' },
          { id: 3, date: '2026-05-25', status: 'offer', text: 'Next week' },
        ],
      }),
      app({
        id: 1,
        companyName: 'Acme',
        timeline: [
          { id: 1, date: '2026-05-23', status: 'assessment', text: '' },
        ],
      }),
    ], '2026-05-21');

    expect(rows.tomorrow).toEqual([
      { id: 2, title: 'Call', company: 'Beta', role: 'Frontend Engineer' },
    ]);
    expect(rows.restOfWeek).toEqual([
      { id: 1, title: 'Technical', company: 'Acme', role: 'Frontend Engineer' },
      { id: 2, title: 'Panel', company: 'Beta', role: 'Frontend Engineer' },
    ]);
  });

  it('returns empty groups when no upcoming entries are within the current ISO week', () => {
    expect(upcomingRowsFor([
      app({ timeline: [{ id: 1, date: '2026-05-25', status: 'applied', text: '' }] }),
    ], '2026-05-21')).toEqual({ tomorrow: [], restOfWeek: [] });
  });
});
