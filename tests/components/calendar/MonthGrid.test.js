// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STATUS_CONFIG,
  STATUS_DISPLAY_PRIORITY,
} from '../../../src/models/application.js';
import { MonthGrid } from '../../../src/components/calendar/MonthGrid.js';
import { YEAR_MAX, YEAR_MIN } from '../../../src/utils/calendar.js';

function activity(status, id = 1) {
  return {
    id,
    title: STATUS_CONFIG[status].label,
    company: 'Acme',
    status,
  };
}

function defaultProps(overrides = {}) {
  return {
    viewYear: 2026,
    viewMonth: 4,
    dayActivities: {},
    filter: null,
    onNavigatePrev: vi.fn(),
    onNavigateNext: vi.fn(),
    onJumpToToday: vi.fn(),
    onOpenMonthPicker: vi.fn(),
    onOpenYearPicker: vi.fn(),
    onOpenFilter: vi.fn(),
    onClearFilter: vi.fn(),
    onOpenDayPopover: vi.fn(),
    ...overrides,
  };
}

function renderGrid(props = {}) {
  const host = document.createElement('div');
  const merged = defaultProps(props);
  document.body.append(host);
  MonthGrid.render(host, merged);
  return { host, props: merged };
}

function cell(iso) {
  return document.querySelector(`.cal-cell[data-iso="${iso}"]`);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 4, 21, 9));
});

afterEach(() => {
  MonthGrid.destroy();
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('MonthGrid', () => {
  it('renders the grid header and calls header actions', () => {
    const { props } = renderGrid();

    expect(document.querySelector('.cal-grid-header')).not.toBeNull();
    expect(document.querySelector('.cal-month-btn').textContent).toBe('May');
    expect(document.querySelector('.cal-year-btn').textContent).toContain('2026');
    expect(document.querySelector('.filter-chip').textContent).toBe('Status: All');
    expect(document.querySelector('.cal-today-btn')).toBeNull();

    document.querySelector('[aria-label="Previous month"]').click();
    document.querySelector('[aria-label="Next month"]').click();
    document.querySelector('.cal-month-btn').click();
    document.querySelector('.cal-year-btn').click();
    document.querySelector('.filter-chip').click();

    expect(props.onNavigatePrev).toHaveBeenCalledTimes(1);
    expect(props.onNavigateNext).toHaveBeenCalledTimes(1);
    expect(props.onOpenMonthPicker).toHaveBeenCalledWith(document.querySelector('.cal-month-btn'));
    expect(props.onOpenYearPicker).toHaveBeenCalledWith(document.querySelector('.cal-year-btn'));
    expect(props.onOpenFilter).toHaveBeenCalledWith(document.querySelector('.filter-chip'));
  });

  it('shows Today only away from the current month and clamps edge navigation', () => {
    const { props } = renderGrid({ viewYear: 2026, viewMonth: 5 });

    document.querySelector('.cal-today-btn').click();
    expect(props.onJumpToToday).toHaveBeenCalledTimes(1);

    MonthGrid.render(document.body.firstElementChild, defaultProps({ viewYear: YEAR_MIN, viewMonth: 0 }));
    expect(document.querySelector('[aria-label="Previous month"]').disabled).toBe(true);

    MonthGrid.render(document.body.firstElementChild, defaultProps({ viewYear: YEAR_MAX, viewMonth: 11 }));
    expect(document.querySelector('[aria-label="Next month"]').disabled).toBe(true);
  });

  it('renders day-of-week headers and exactly six weeks of cells', () => {
    renderGrid();

    expect([...document.querySelectorAll('.dow-cell')].map((node) => node.textContent))
      .toEqual(['CW', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(document.querySelectorAll('.cal-cw')).toHaveLength(6);
    expect(document.querySelectorAll('.cal-cell')).toHaveLength(42);
    expect(document.querySelector('.cal-grid').children).toHaveLength(48);
    expect(cell('2026-04-27')).not.toBeNull();
    expect(cell('2026-06-07')).not.toBeNull();
    expect(cell('2026-04-27').classList).toContain('cal-cell--out');
    expect(cell('2026-05-21').classList).toContain('cal-cell--today');
  });

  it('opens all-mode popover when a populated cell is clicked or keyboard-activated', () => {
    const { props } = renderGrid({
      dayActivities: {
        '2026-05-21': [activity('interview', 4)],
      },
    });

    cell('2026-05-21').click();
    expect(props.onOpenDayPopover).toHaveBeenCalledWith('all', '2026-05-21', null, cell('2026-05-21'));

    cell('2026-05-21').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(props.onOpenDayPopover).toHaveBeenCalledTimes(2);

    cell('2026-05-21').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(props.onOpenDayPopover).toHaveBeenCalledTimes(3);
  });

  it('leaves empty cells inert', () => {
    const { props } = renderGrid();

    cell('2026-05-21').click();

    expect(cell('2026-05-21').getAttribute('role')).toBeNull();
    expect(props.onOpenDayPopover).not.toHaveBeenCalled();
  });

  it('renders status chips in display priority order with overflow', () => {
    renderGrid({
      dayActivities: {
        '2026-05-21': [
          activity('interview', 1),
          activity('interview', 2),
          activity('applied', 3),
          activity('offer', 4),
          activity('wishlisted', 5),
        ],
      },
    });

    const chips = [...cell('2026-05-21').querySelectorAll('.num-chip')];
    const statuses = chips.map((chip) => chip.getAttribute('aria-label').match(/\d+ (.+) activit/)[1]);

    expect(chips).toHaveLength(3);
    expect(chips.map((chip) => chip.textContent)).toEqual(['1', '2', '1']);
    expect(statuses).toEqual(['Offer', 'Interview', 'Wishlisted']);
    expect(cell('2026-05-21').querySelector('.num-more').textContent).toBe('+1');
    expect(chips[0].style.backgroundColor).toBe('rgb(9, 188, 138)');
    expect(chips[0].title).toContain('1 Offer activity on 2026-05-21');
  });

  it('uses STATUS_DISPLAY_PRIORITY for chip ordering without redeclaring it', () => {
    renderGrid({
      dayActivities: {
        '2026-05-21': STATUS_DISPLAY_PRIORITY.map((status, index) => activity(status, index + 1)),
      },
    });

    const chipLabels = [...cell('2026-05-21').querySelectorAll('.num-chip')]
      .map((chip) => chip.getAttribute('aria-label'));

    expect(chipLabels).toEqual(
      STATUS_DISPLAY_PRIORITY.slice(0, 3)
        .map((status) => `1 ${STATUS_CONFIG[status].label} activity on 2026-05-21`),
    );
  });

  it('opens status-mode from a chip without also opening all-mode', () => {
    const { props } = renderGrid({
      dayActivities: {
        '2026-05-21': [activity('interview', 1)],
      },
    });
    const chip = cell('2026-05-21').querySelector('.num-chip');

    chip.click();

    expect(props.onOpenDayPopover).toHaveBeenCalledTimes(1);
    expect(props.onOpenDayPopover).toHaveBeenCalledWith('status', '2026-05-21', 'interview', chip);
  });

  it('opens all-mode from the overflow chip without also opening the cell handler', () => {
    const { props } = renderGrid({
      dayActivities: {
        '2026-05-21': [
          activity('offer', 1),
          activity('interview', 2),
          activity('wishlisted', 3),
          activity('applied', 4),
        ],
      },
    });
    const overflow = cell('2026-05-21').querySelector('.num-more');

    overflow.click();

    expect(props.onOpenDayPopover).toHaveBeenCalledTimes(1);
    expect(props.onOpenDayPopover).toHaveBeenCalledWith('all', '2026-05-21', null, overflow);
  });

  it('applies the status filter to chips and shows the clear control', () => {
    const { props } = renderGrid({
      filter: 'interview',
      dayActivities: {
        '2026-05-21': [activity('offer', 1), activity('interview', 2), activity('interview', 3)],
        '2026-05-22': [activity('offer', 4)],
      },
    });

    expect(document.querySelector('.filter-chip').textContent).toBe('Interview');
    expect(cell('2026-05-21').querySelectorAll('.num-chip')).toHaveLength(1);
    expect(cell('2026-05-21').querySelector('.num-chip').textContent).toBe('2');
    expect(cell('2026-05-22').classList).toContain('cal-cell--filter-hidden');
    expect([...cell('2026-05-22').querySelectorAll('.num-chip')].map((chip) => chip.textContent))
      .toEqual(['1']);
    expect(cell('2026-05-22').getAttribute('role')).toBe('button');

    cell('2026-05-22').click();
    expect(props.onOpenDayPopover).toHaveBeenCalledWith('all', '2026-05-22', null, cell('2026-05-22'));

    document.querySelector('.filter-clear').click();
    expect(props.onClearFilter).toHaveBeenCalledTimes(1);
  });

  it('destroy clears the current container', () => {
    const { host } = renderGrid();

    MonthGrid.destroy();

    expect(host.children).toHaveLength(0);
  });
});
