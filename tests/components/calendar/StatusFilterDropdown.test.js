// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STATUS_CONFIG,
  STATUS_DISPLAY_PRIORITY,
} from '../../../src/models/application.js';
import { StatusFilterDropdown } from '../../../src/components/calendar/StatusFilterDropdown.js';

function setViewport(width, height = 600) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

function createAnchor() {
  const anchor = document.createElement('button');
  anchor.getBoundingClientRect = () => ({
    left: 240,
    right: 360,
    top: 40,
    bottom: 70,
    width: 120,
    height: 30,
  });
  document.body.append(anchor);
  return anchor;
}

function openDropdown(overrides = {}) {
  const calls = [];
  const props = {
    anchor: createAnchor(),
    filter: null,
    onSelect: vi.fn((value) => calls.push(['select', value])),
    onClose: vi.fn(() => calls.push(['close'])),
    ...overrides,
  };

  StatusFilterDropdown.open(props);
  return { props, calls };
}

function rows() {
  return [...document.querySelectorAll('.filter-dd-row')];
}

function stubDropdownWidth(width) {
  vi.spyOn(window.HTMLDivElement.prototype, 'getBoundingClientRect').mockImplementation(function rect() {
    if (this.classList.contains('cal-dropdown')) {
      return {
        left: 0,
        right: width,
        top: 0,
        bottom: 120,
        width,
        height: 120,
      };
    }

    return {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      width: 0,
      height: 0,
    };
  });
}

describe('StatusFilterDropdown', () => {
  beforeEach(() => {
    setViewport(800);
  });

  afterEach(() => {
    StatusFilterDropdown.close();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('renders all statuses in display-priority order after the all-statuses row', () => {
    openDropdown();

    expect(rows()).toHaveLength(STATUS_DISPLAY_PRIORITY.length + 1);
    expect(rows()[0].textContent).toContain('All statuses');
    expect(rows().slice(1).map((row) => row.dataset.status)).toEqual(STATUS_DISPLAY_PRIORITY);
    expect(rows().slice(1).map((row) => row.textContent.replace('✓', '').trim()))
      .toEqual(STATUS_DISPLAY_PRIORITY.map((status) => STATUS_CONFIG[status].label));
  });

  it('shows a single check on the active row', () => {
    openDropdown({ filter: 'interview' });

    const checkedRows = rows().filter((row) => row.querySelector('.filter-dd-check').textContent === '✓');

    expect(checkedRows).toHaveLength(1);
    expect(checkedRows[0].dataset.status).toBe('interview');

    StatusFilterDropdown.close();
    openDropdown({ filter: null });

    const allCheckedRows = rows().filter((row) => row.querySelector('.filter-dd-check').textContent === '✓');
    expect(allCheckedRows).toHaveLength(1);
    expect(allCheckedRows[0].dataset.status).toBe('all');
  });

  it('selects all statuses before closing', () => {
    const { props, calls } = openDropdown({ filter: 'interview' });

    rows()[0].click();

    expect(props.onSelect).toHaveBeenCalledWith(null);
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([['select', null], ['close']]);
  });

  it('selects an individual status before closing', () => {
    const { props, calls } = openDropdown();
    const interview = rows().find((row) => row.dataset.status === 'interview');

    interview.click();

    expect(props.onSelect).toHaveBeenCalledWith('interview');
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([['select', 'interview'], ['close']]);
  });

  it('mounts right-aligned through the anchored dropdown without a scrim', () => {
    stubDropdownWidth(200);

    openDropdown();

    const wrapper = document.querySelector('.cal-dropdown');
    expect(wrapper.getAttribute('aria-label')).toBe('Status filter');
    expect(wrapper.style.left).toBe('160px');
    expect(document.querySelector('.cal-dropdown-backdrop').style.background).toBe('transparent');
  });
});
