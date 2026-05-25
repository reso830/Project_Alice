// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { YearPicker } from '../../../src/components/calendar/YearPicker.js';
import { YEAR_MAX, YEAR_MIN } from '../../../src/utils/calendar.js';

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
    viewYear: Math.min(YEAR_MIN + 5, YEAR_MAX),
    onSelect: vi.fn((value) => calls.push(['select', value])),
    onClose: vi.fn(() => calls.push(['close'])),
    ...overrides,
  };

  YearPicker.open(props);
  return { props, calls };
}

function yearButtons() {
  return [...document.querySelectorAll('.cal-picker-grid .cal-picker-item')];
}

describe('YearPicker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 21, 9));
    setViewport(800);
  });

  afterEach(() => {
    YearPicker.close();
    document.body.replaceChildren();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders the initial twelve-year range centered on the view year when possible', () => {
    openPicker({ viewYear: Math.min(YEAR_MIN + 5, YEAR_MAX) });

    const years = yearButtons().map((button) => Number(button.textContent));

    expect(years).toHaveLength(12);
    expect(years[0]).toBe(YEAR_MIN);
    expect(years.at(-1)).toBe(Math.min(YEAR_MIN + 11, YEAR_MAX));
    expect(document.querySelector('.cal-picker__lbl')).toBeNull();
    expect(document.body.textContent).not.toContain('Jump to year');
    expect(document.querySelector('.cal-picker__yr-nav').textContent).toContain(`${YEAR_MIN}`);
    expect(document.querySelector('.cal-picker__yr-range').textContent).toBe(`${YEAR_MIN} - ${YEAR_MIN + 11}`);
  });

  it('disables range navigation at the year boundaries', () => {
    openPicker({ viewYear: YEAR_MIN });

    expect(document.querySelector('[aria-label="Previous year range"]').disabled).toBe(true);

    YearPicker.close();
    openPicker({ viewYear: YEAR_MAX });

    expect(document.querySelector('[aria-label="Next year range"]').disabled).toBe(true);
  });

  it('selects a valid year before closing', () => {
    const { props, calls } = openPicker();
    const target = yearButtons().find((button) => Number(button.textContent) === props.viewYear + 1)
      ?? yearButtons().find((button) => Number(button.textContent) === props.viewYear);

    target.click();

    expect(props.onSelect).toHaveBeenCalledWith(Number(target.textContent));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([['select', Number(target.textContent)], ['close']]);
  });

  it('ignores disabled year buttons if an out-of-range year is rendered', () => {
    const { props } = openPicker({ viewYear: YEAR_MAX });
    const disabled = yearButtons().find((button) => button.classList.contains('cal-picker-item--disabled'));

    if (!disabled) {
      expect(yearButtons().every((button) => !button.disabled)).toBe(true);
      return;
    }

    disabled.click();

    expect(props.onSelect).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('mounts through the anchored dropdown with the picker options', () => {
    openPicker();

    const wrapper = document.querySelector('.cal-dropdown');
    expect(wrapper.getAttribute('aria-label')).toBe('Year picker');
    expect(wrapper.parentElement).toBe(document.querySelector('button'));
    expect(wrapper.style.position).toBe('absolute');
    expect(document.querySelector('.cal-bottom-sheet')).toBeNull();
    expect(document.querySelector('.cal-dropdown-backdrop').style.background).toBe('transparent');
  });
});
