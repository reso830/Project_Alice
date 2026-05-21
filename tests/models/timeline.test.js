import { describe, expect, it } from 'vitest';
import {
  allocateTimelineEntryId,
  sortTimelineEntries,
  synthesizeTimelineFromDates,
} from '../../src/models/application.js';

describe('timeline model helpers', () => {
  it('allocates the first positive id for an empty timeline', () => {
    expect(allocateTimelineEntryId([])).toBe(1);
  });

  it('allocates max existing id plus one', () => {
    expect(allocateTimelineEntryId([
      { id: 2, date: '2026-05-20', status: 'applied', text: '' },
      { id: 7, date: '2026-05-21', status: 'interview', text: '' },
      { id: 4, date: '2026-05-22', status: 'offer', text: '' },
    ])).toBe(8);
  });

  it('sorts entries by date descending and id descending for same-day ties', () => {
    const original = [
      { id: 1, date: '2026-05-20', status: 'applied', text: 'A' },
      { id: 3, date: '2026-05-21', status: 'interview', text: 'C' },
      { id: 2, date: '2026-05-21', status: 'phone_screen', text: 'B' },
      { id: 4, date: '2026-05-19', status: 'wishlisted', text: 'D' },
    ];

    const sorted = sortTimelineEntries(original);

    expect(sorted.map((entry) => entry.id)).toEqual([3, 2, 1, 4]);
    expect(sorted).not.toBe(original);
  });

  it('synthesizes an applied entry when applicationDate is present and status is applied', () => {
    expect(synthesizeTimelineFromDates({
      applicationDate: '2026-05-01',
      lastStatusUpdate: '2026-05-01',
      status: 'applied',
    })).toEqual([
      { id: 1, date: '2026-05-01', status: 'applied', text: 'Submitted application.' },
    ]);
  });

  it('synthesizes application and status entries when dates differ', () => {
    expect(synthesizeTimelineFromDates({
      applicationDate: '2026-05-01',
      lastStatusUpdate: '2026-05-10',
      status: 'interview',
    })).toEqual([
      { id: 1, date: '2026-05-01', status: 'applied', text: 'Submitted application.' },
      { id: 2, date: '2026-05-10', status: 'interview', text: '' },
    ]);
  });

  it('synthesizes a single current-status entry when applicationDate equals lastStatusUpdate', () => {
    expect(synthesizeTimelineFromDates({
      applicationDate: '2026-05-01',
      lastStatusUpdate: '2026-05-01',
      status: 'phone_screen',
    })).toEqual([
      { id: 1, date: '2026-05-01', status: 'phone_screen', text: '' },
    ]);
  });

  it('synthesizes from lastStatusUpdate when applicationDate is missing', () => {
    expect(synthesizeTimelineFromDates({
      applicationDate: '',
      lastStatusUpdate: '2026-05-10',
      status: 'offer',
    })).toEqual([
      { id: 1, date: '2026-05-10', status: 'offer', text: '' },
    ]);
  });
});
