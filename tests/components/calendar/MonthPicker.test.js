// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MonthPicker } from '../../../src/components/calendar/MonthPicker.js';

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

function openPicker(overrides = {}) {
  const calls = [];
  const props = {
    anchor: createAnchor(),
    viewYear: 2026,
    viewMonth: 4,
    onSelect: vi.fn((value) => calls.push(['select', value])),
    onClose: vi.fn(() => calls.push(['close'])),
    ...overrides,
  };

  MonthPicker.open(props);
  return { props, calls };
}

describe('MonthPicker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 21, 9));
    setViewport(800);
  });

  afterEach(() => {
    MonthPicker.close();
    document.body.replaceChildren();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders twelve month buttons and highlights selected/current states', () => {
    openPicker({ viewYear: 2026, viewMonth: 7 });

    const buttons = [...document.querySelectorAll('.cal-picker-grid .cal-picker-item')];

    expect(buttons).toHaveLength(12);
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ]);
    expect(buttons[4].classList).toContain('cal-picker-item--current');
    expect(buttons[7].classList).toContain('cal-picker-item--selected');
    expect(document.querySelector('.cal-picker__lbl')).toBeNull();
    expect(document.body.textContent).not.toContain('Jump to month');
    expect(document.querySelector('.cal-picker__yr').textContent).toBe('2026');
  });

  it('does not highlight the current month while viewing a different year', () => {
    openPicker({ viewYear: 2027, viewMonth: 4 });

    expect(document.querySelector('.cal-picker-item--current')).toBeNull();
    expect(document.querySelectorAll('.cal-picker-item--selected')).toHaveLength(1);
  });

  it('selects a month before closing', () => {
    const { props, calls } = openPicker();

    document.querySelectorAll('.cal-picker-item')[0].click();

    expect(props.onSelect).toHaveBeenCalledWith(0);
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([['select', 0], ['close']]);
  });

  it('uses the bottom-sheet dropdown variant on mobile', () => {
    setViewport(320);

    openPicker();

    expect(document.querySelector('.cal-bottom-sheet')).not.toBeNull();
    expect(document.querySelector('.cal-bottom-sheet .cal-picker')).not.toBeNull();
  });

  it('mounts through the anchored dropdown with the picker options', () => {
    openPicker();

    const wrapper = document.querySelector('.cal-dropdown');
    expect(wrapper.getAttribute('aria-label')).toBe('Month picker');
    expect(wrapper.parentElement).toBe(document.querySelector('button'));
    expect(wrapper.style.position).toBe('absolute');
    expect(document.querySelector('.cal-bottom-sheet')).toBeNull();
    expect(document.querySelector('.cal-dropdown-backdrop').style.background).toBe('transparent');
  });
});
