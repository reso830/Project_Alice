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
    onSelectDate: vi.fn(),
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
    expect(document.querySelector('.cal-year-btn').textContent).toBe('2026');
    expect(document.querySelector('.cal-status-filter-btn')).not.toBeNull();
    expect(document.querySelector('.cal-status-filter-btn svg.icon')).not.toBeNull();
    expect(document.querySelector('.filter-chip')).toBeNull();
    expect(document.querySelector('.cal-today-btn')).toBeNull();

    document.querySelector('[aria-label="Previous month"]').click();
    document.querySelector('[aria-label="Next month"]').click();
    document.querySelector('.cal-month-btn').click();
    document.querySelector('.cal-year-btn').click();
    document.querySelector('.cal-status-filter-btn').click();

    expect(props.onNavigatePrev).toHaveBeenCalledTimes(1);
    expect(props.onNavigateNext).toHaveBeenCalledTimes(1);
    expect(props.onOpenMonthPicker).toHaveBeenCalledWith(document.querySelector('.cal-title'));
    expect(props.onOpenYearPicker).toHaveBeenCalledWith(document.querySelector('.cal-title'));
    expect(props.onOpenFilter).toHaveBeenCalledWith(document.querySelector('.cal-status-filter-btn'));
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
    expect(document.querySelector('.dow-cell--cw').getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelector('.cal-cw').getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelector('.cal-cw').title).toMatch(/^Week \d+, 2026$/);
    expect(document.querySelectorAll('.cal-cell')).toHaveLength(42);
    expect(document.querySelector('.cal-grid').children).toHaveLength(48);
    expect(cell('2026-04-27')).not.toBeNull();
    expect(cell('2026-06-07')).not.toBeNull();
    expect(cell('2026-04-27').classList).toContain('cal-cell--out');
    expect(cell('2026-05-21').classList).toContain('cal-cell--today');
  });

  it('selects a populated cell when clicked or keyboard-activated', () => {
    const { props } = renderGrid({
      dayActivities: {
        '2026-05-21': [activity('interview', 4)],
      },
    });

    cell('2026-05-21').click();
    expect(props.onSelectDate).toHaveBeenCalledWith('2026-05-21', cell('2026-05-21'));

    cell('2026-05-21').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(props.onSelectDate).toHaveBeenCalledTimes(2);

    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    cell('2026-05-21').dispatchEvent(space);
    expect(props.onSelectDate).toHaveBeenCalledTimes(3);
    expect(space.defaultPrevented).toBe(true);
  });

  it('makes empty in-month cells selectable and leaves out-of-month cells inert', () => {
    const { props } = renderGrid();

    cell('2026-05-21').click();
    expect(cell('2026-05-21').getAttribute('role')).toBe('button');
    expect(cell('2026-05-21').tabIndex).toBe(0);
    expect(cell('2026-05-21').getAttribute('aria-label')).toContain('no activity');
    expect(props.onSelectDate).toHaveBeenCalledWith('2026-05-21', cell('2026-05-21'));

    cell('2026-04-27').click();
    cell('2026-04-27').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(cell('2026-04-27').getAttribute('role')).toBeNull();
    expect(props.onSelectDate).toHaveBeenCalledTimes(1);
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
    const statuses = chips.map((chip) => chip.title.match(/\d+ (.+) activit/)[1]);

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
      .map((chip) => chip.title);

    expect(chipLabels).toEqual(
      STATUS_DISPLAY_PRIORITY.slice(0, 3)
        .map((status) => `1 ${STATUS_CONFIG[status].label} activity on 2026-05-21`),
    );
  });

  it('keeps chips decorative and lets chip clicks select the cell', () => {
    const { props } = renderGrid({
      dayActivities: {
        '2026-05-21': [activity('interview', 1)],
      },
    });
    const chip = cell('2026-05-21').querySelector('.num-chip');

    chip.click();

    expect(chip.tagName).toBe('SPAN');
    expect(chip.getAttribute('role')).toBeNull();
    expect(chip.getAttribute('tabIndex')).toBeNull();
    expect(props.onSelectDate).toHaveBeenCalledTimes(1);
    expect(props.onSelectDate).toHaveBeenCalledWith('2026-05-21', cell('2026-05-21'));
  });

  it('keeps the overflow chip decorative and lets it select the cell', () => {
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

    expect(overflow.tagName).toBe('SPAN');
    expect(props.onSelectDate).toHaveBeenCalledWith('2026-05-21', cell('2026-05-21'));
  });

  it('applies the status filter to chips and shows the clear control', () => {
    const { props } = renderGrid({
      filter: 'interview',
      dayActivities: {
        '2026-05-21': [activity('offer', 1), activity('interview', 2), activity('interview', 3)],
        '2026-05-22': [activity('offer', 4)],
      },
    });

    expect(document.querySelector('.cal-status-filter-btn__swatch')).not.toBeNull();
    expect(cell('2026-05-21').querySelectorAll('.num-chip')).toHaveLength(1);
    expect(cell('2026-05-21').querySelector('.num-chip').textContent).toBe('2');
    expect(cell('2026-05-22').classList).toContain('cal-cell--filter-hidden');
    expect(cell('2026-05-23').classList).toContain('cal-cell--filter-hidden');
    expect([...cell('2026-05-22').querySelectorAll('.num-chip')].map((chip) => chip.textContent))
      .toEqual(['1']);
    expect(cell('2026-05-22').getAttribute('role')).toBe('button');

    cell('2026-05-22').click();
    expect(props.onSelectDate).toHaveBeenCalledWith('2026-05-22', cell('2026-05-22'));

    document.querySelector('.cal-filter-clear').click();
    expect(props.onClearFilter).toHaveBeenCalledTimes(1);
  });

  it('marks the selected cell with aria-pressed and selected class', () => {
    renderGrid({ selectedDate: '2026-05-21' });

    expect(cell('2026-05-21').classList).toContain('cal-cell--selected');
    expect(cell('2026-05-21').classList).toContain('cal-cell--today');
    expect(cell('2026-05-21').getAttribute('aria-pressed')).toBe('true');
  });

  it('destroy clears the current container', () => {
    const { host } = renderGrid();

    MonthGrid.destroy();

    expect(host.children).toHaveLength(0);
  });
});
