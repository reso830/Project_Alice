// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DayPanel } from '../../../src/components/calendar/DayPanel.js';

function activity(status, id = 1) {
  return {
    id,
    title: `${status} activity`,
    company: `Company ${id}`,
    jobTitle: `Role ${id}`,
    status,
  };
}

function renderPanel(props = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  DayPanel.render(host, {
    selectedDate: null,
    activities: [],
    todayISO: '2026-05-21',
    onOpenApp: vi.fn(),
    ...props,
  });
  return host;
}

afterEach(() => {
  DayPanel.destroy();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('DayPanel', () => {
  it('renders the prompt state with live region semantics', () => {
    renderPanel();

    const root = document.querySelector('.cal-day-panel');
    expect(root.classList).toContain('cal-day-panel--prompt');
    expect(root.getAttribute('aria-live')).toBe('polite');
    expect(root.querySelector('.cal-dp-prompt')).not.toBeNull();
  });

  it('renders the empty-day state for a selected date', () => {
    renderPanel({ selectedDate: '2026-05-20', activities: [] });

    const root = document.querySelector('.cal-day-panel');
    expect(root.classList).toContain('cal-day-panel--empty');
    expect(root.querySelector('.cal-dp-date').textContent).toBe('May 20');
    expect(root.querySelector('.cal-dp-count').textContent).toBe('No events');
    expect(root.querySelector('.cal-dp-empty').textContent).toBe('No events');
    expect(root.querySelector('.cal-dp-empty-sub')).toBeNull();
  });

  it('renders grouped activity rows in status priority order', () => {
    renderPanel({
      selectedDate: '2026-05-21',
      activities: [
        activity('applied', 3),
        activity('offer', 2),
        activity('interview', 1),
      ],
    });

    const root = document.querySelector('.cal-day-panel');
    const labels = [...root.querySelectorAll('.cal-dp-group .cal-status-badge')]
      .map((node) => node.textContent);

    expect(root.classList).toContain('cal-day-panel--populated');
    expect(labels).toEqual(['Offer', 'Interview', 'Applied']);
    expect(root.querySelectorAll('.cal-dp-row')).toHaveLength(3);
    expect(root.querySelector('.cal-dp-today-pill').textContent).toBe('Today');
  });

  it('ignores deferred variant props and keeps Variant A grouped rendering', () => {
    renderPanel({
      selectedDate: '2026-05-21',
      variant: 'B',
      detailsVariant: 'C',
      activities: [
        activity('applied', 3),
        activity('offer', 2),
      ],
    });

    expect(document.querySelectorAll('.cal-dp-group')).toHaveLength(2);
    expect(document.querySelector('.cal-dp-group-h')).not.toBeNull();
    expect(document.querySelector('.cal-dp-group-dash')).toBeNull();
    expect(document.querySelectorAll('.cal-dp-row')).toHaveLength(2);
  });

  it('opens an application from mouse and keyboard row activation', () => {
    const onOpenApp = vi.fn();
    renderPanel({
      selectedDate: '2026-05-21',
      activities: [activity('interview', 24)],
      onOpenApp,
    });

    const row = document.querySelector('.cal-dp-row');
    row.click();
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    row.dispatchEvent(space);

    expect(row.getAttribute('role')).toBe('button');
    expect(row.tabIndex).toBe(0);
    expect(onOpenApp).toHaveBeenCalledTimes(3);
    expect(onOpenApp).toHaveBeenCalledWith(24);
    expect(space.defaultPrevented).toBe(true);
  });

  it('updates body and state classes without recreating the root element', () => {
    renderPanel();
    const root = document.querySelector('.cal-day-panel');

    DayPanel.update({
      selectedDate: '2026-05-22',
      activities: [activity('offer', 8)],
      todayISO: '2026-05-21',
    });

    expect(document.querySelector('.cal-day-panel')).toBe(root);
    expect(root.classList).toContain('cal-day-panel--populated');
    expect(root.classList).not.toContain('cal-day-panel--prompt');
    expect(root.querySelector('.cal-dp-date').textContent).toBe('May 22');
    expect(root.querySelector('.cal-dp-row__job').textContent).toBe('offer activity');
  });

  it('renders row meta as company, separator, and job title', () => {
    renderPanel({
      selectedDate: '2026-05-21',
      activities: [activity('interview', 24)],
    });

    const meta = document.querySelector('.cal-dp-row__meta');
    expect(document.querySelector('.cal-dp-row__co')).toBeNull();
    expect(meta.textContent).toBe('Company 24·Role 24');
    expect(meta.querySelector('.cal-dp-row__sep').textContent).toBe('·');
  });
});
