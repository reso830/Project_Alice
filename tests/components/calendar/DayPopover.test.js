// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STATUS_CONFIG,
  STATUS_DISPLAY_PRIORITY,
} from '../../../src/models/application.js';
import { DayPopover } from '../../../src/components/calendar/DayPopover.js';

function setViewport(width, height = 600) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

function createAnchor() {
  const anchor = document.createElement('button');
  anchor.getBoundingClientRect = () => ({
    left: 100,
    right: 180,
    top: 40,
    bottom: 70,
    width: 80,
    height: 30,
  });
  document.body.append(anchor);
  return anchor;
}

function activity(status, id) {
  return {
    id,
    title: `${STATUS_CONFIG[status].label} milestone`,
    company: `Company ${id}`,
    status,
  };
}

function openPopover(overrides = {}) {
  const calls = [];
  const props = {
    mode: 'status',
    date: '2026-05-19',
    status: 'applied',
    activities: [
      activity('applied', 1),
      activity('applied', 2),
      activity('applied', 3),
    ],
    anchor: createAnchor(),
    onOpenApp: vi.fn((id) => calls.push(['open', id])),
    onClose: vi.fn(() => calls.push(['close'])),
    ...overrides,
  };

  DayPopover.open(props);
  return { props, calls };
}

function rowStatuses() {
  return [...document.querySelectorAll('.day-row')].map((row) => row.dataset.status);
}

describe('DayPopover', () => {
  beforeEach(() => {
    setViewport(800);
  });

  afterEach(() => {
    DayPopover.close();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('renders status mode with the formatted title and id-pill rows', () => {
    openPopover();

    expect(document.querySelector('.day-pop__ttl').textContent).toBe('Tue, May 19 · Applied (3)');
    expect(document.querySelector('.day-pop__count').textContent).toBe('(3)');
    expect(document.querySelectorAll('.day-row')).toHaveLength(3);
    expect([...document.querySelectorAll('.cal-id-pill')].map((node) => node.textContent))
      .toEqual(['#001', '#002', '#003']);
  });

  it('renders all mode with all-activity title and status-priority row order', () => {
    const unsorted = [
      activity('ghosted', 10),
      activity('interview', 11),
      activity('accepted', 12),
      activity('applied', 13),
      activity('offer', 14),
    ];

    openPopover({
      mode: 'all',
      status: null,
      activities: unsorted,
    });

    expect(document.querySelector('.day-pop__ttl').textContent).toBe('Tue, May 19 · All activity (5)');
    expect(rowStatuses()).toEqual(
      STATUS_DISPLAY_PRIORITY.filter((status) => unsorted.some((item) => item.status === status)),
    );
    expect([...document.querySelectorAll('.cal-status-badge')].map((badge) => badge.textContent))
      .toEqual(['Accepted', 'Offer', 'Interview', 'Applied', 'Ghosted']);
  });

  it('opens the application before closing when a row is clicked', () => {
    const { props, calls } = openPopover();

    document.querySelector('.day-row').click();

    expect(props.onOpenApp).toHaveBeenCalledWith(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([['open', 1], ['close']]);
  });

  it('renders an empty state when there are no activities', () => {
    const { props } = openPopover({ activities: [] });

    expect(document.querySelector('.day-pop__ttl').textContent).toBe('Tue, May 19 · Applied (0)');
    expect(document.querySelectorAll('.day-row')).toHaveLength(0);
    expect(document.querySelector('.day-pop-empty').textContent).toContain('No activity for this day');

    document.querySelector('.day-pop-empty').click();
    expect(props.onOpenApp).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('closes from the close button, Escape, and backdrop', () => {
    const first = openPopover();

    document.querySelector('.day-pop__close').click();
    expect(first.props.onClose).toHaveBeenCalledTimes(1);

    const second = openPopover();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(second.props.onClose).toHaveBeenCalledTimes(1);

    const third = openPopover();
    document.querySelector('.cal-dropdown-backdrop')
      .dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(third.props.onClose).toHaveBeenCalledTimes(1);
  });

  it('uses the mobile bottom-sheet variant with a scrim', () => {
    setViewport(320);

    openPopover();

    expect(document.querySelector('.cal-bottom-sheet .day-pop')).not.toBeNull();
    expect(document.querySelector('.bs-handle')).not.toBeNull();
    expect(document.querySelector('.cal-dropdown-backdrop').style.background)
      .toBe('rgba(8, 8, 24, 0.42)');
  });
});
