// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Timeline } from '../../src/components/Timeline.js';
import { STATUS_CONFIG, STATUS_VALUES } from '../../src/models/application.js';

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgb(${red}, ${green}, ${blue})`;
}

afterEach(() => {
  vi.useRealTimers();
  Timeline.reset();
  document.body.replaceChildren();
});

describe('Timeline collapsed render', () => {
  it('renders the newest timeline entry in collapsed mode', () => {
    const el = Timeline.render({
      timeline: [
        { id: 1, date: '2026-05-20', status: 'applied', text: 'Submitted.' },
        { id: 3, date: '2026-05-22', status: 'interview', text: 'Tech round.' },
        { id: 2, date: '2026-05-22', status: 'phone_screen', text: 'Recruiter call.' },
      ],
    }, { currentStatus: 'interview', onChange: vi.fn() });

    expect(el.className).toContain('modal-field--full');
    expect(el.querySelector('.modal-field__label').textContent).toBe('Timeline');
    expect(el.querySelector('.tl-collapsed').getAttribute('role')).toBe('button');
    expect(el.querySelector('.tl-collapsed').tabIndex).toBe(0);
    expect(el.querySelector('.tl-date-text').textContent).toBe('May 22');
    expect(el.querySelector('.status-badge').textContent).toBe(STATUS_CONFIG.interview.label);
    expect(el.querySelector('.status-badge').style.backgroundColor)
      .toBe(hexToRgb(STATUS_CONFIG.interview.badgeBg));
    expect(el.querySelector('.tl-text-line').textContent).toBe('Tech round.');
  });

  it('renders an empty-state prompt when there are no entries', () => {
    const el = Timeline.render({ timeline: [] }, { currentStatus: 'applied', onChange: vi.fn() });

    expect(el.querySelector('.tl-empty').textContent).toBe('No entries yet — click to add');
    expect(el.querySelector('.status-badge')).toBeNull();
  });

  it('toggles out of collapsed mode on click and keyboard activation', () => {
    const el = Timeline.render({ timeline: [] }, { currentStatus: 'applied', onChange: vi.fn() });

    el.querySelector('.tl-collapsed').click();
    expect(el.querySelector('.tl-header')).not.toBeNull();

    Timeline.reset();
    const keyboardEl = Timeline.render({ timeline: [] }, { currentStatus: 'applied', onChange: vi.fn() });
    keyboardEl.querySelector('.tl-collapsed')
      .dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(keyboardEl.querySelector('.tl-row--add')).not.toBeNull();
  });
});

describe('Timeline expanded add-entry render', () => {
  it('renders an expanded header, add row, entry list, and collapse button', () => {
    const el = Timeline.render({
      timeline: [
        { id: 1, date: '2026-05-18', status: 'applied', text: 'Submitted.' },
        { id: 2, date: '2026-05-20', status: 'phone_screen', text: 'Recruiter call.' },
      ],
    }, { currentStatus: 'phone_screen', onChange: vi.fn() });

    el.querySelector('.tl-collapsed').click();

    expect(el.querySelector('.tl-header .modal-field__label').textContent).toBe('Timeline');
    expect(el.querySelector('.tl-collapse-btn').getAttribute('aria-label')).toBe('Collapse timeline');
    expect(el.querySelector('.tl-row--add')).not.toBeNull();
    expect(el.querySelector('.tl-date-input').getAttribute('type')).toBe('date');
    expect(el.querySelector('.tl-date-input').hasAttribute('max')).toBe(false);
    expect(el.querySelector('.tl-text-input').getAttribute('placeholder')).toBe('What happened? (optional)');
    expect([...el.querySelectorAll('.tl-row--entry')].map((row) => row.querySelector('.tl-text-line')?.textContent))
      .toEqual(['Recruiter call.', 'Submitted.']);

    el.querySelector('.tl-collapse-btn').click();

    expect(el.querySelector('.tl-collapsed')).not.toBeNull();
  });

  it('commits an add-row entry with Enter, resets inputs, refocuses text, and calls onChange once', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 21, 9, 0, 0));
    const onChange = vi.fn();
    const draft = { timeline: [] };
    const el = Timeline.render(draft, { currentStatus: 'interview', onChange });
    document.body.append(el);

    el.querySelector('.tl-collapsed').click();
    const textInput = el.querySelector('.tl-text-input');
    textInput.value = 'Tech screen with Mira.';
    textInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(draft.timeline).toEqual([
      { id: 1, date: '2026-05-21', status: 'interview', text: 'Tech screen with Mira.' },
    ]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(el.querySelector('.tl-date-input').value).toBe('2026-05-21');
    expect(el.querySelector('.tl-text-input').value).toBe('');
    expect(document.activeElement).toBe(el.querySelector('.tl-text-input'));
  });

  it('commits with the add button and disables add while the date is empty', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 21, 9, 0, 0));
    const onChange = vi.fn();
    const draft = { timeline: [] };
    const el = Timeline.render(draft, { currentStatus: 'applied', onChange });

    el.querySelector('.tl-collapsed').click();
    const dateInput = el.querySelector('.tl-date-input');
    const textInput = el.querySelector('.tl-text-input');
    const addButton = el.querySelector('.tl-add');

    dateInput.value = '';
    dateInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    expect(addButton.disabled).toBe(true);
    textInput.value = 'Should not commit.';
    textInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(draft.timeline).toEqual([]);

    dateInput.value = '2026-05-20';
    dateInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    textInput.value = 'Submitted via portal.';
    addButton.click();

    expect(draft.timeline).toEqual([
      { id: 1, date: '2026-05-20', status: 'applied', text: 'Submitted via portal.' },
    ]);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('accepts a future-dated entry and renders it first by newest date', () => {
    const draft = {
      timeline: [
        { id: 1, date: '2026-05-14', status: 'applied', text: 'Applied.' },
        { id: 2, date: '2026-05-18', status: 'phone_screen', text: 'Recruiter call.' },
      ],
    };
    const el = Timeline.render(draft, { currentStatus: 'interview', onChange: vi.fn() });

    el.querySelector('.tl-collapsed').click();
    el.querySelector('.tl-date-input').value = '2026-06-20';
    el.querySelector('.tl-date-input').dispatchEvent(new window.Event('input', { bubbles: true }));
    el.querySelector('.tl-text-input').value = 'Future follow-up.';
    el.querySelector('.tl-add').click();

    const rows = [...el.querySelectorAll('.tl-row--entry')];
    expect(rows[0].querySelector('.tl-date-text').textContent).toBe('Jun 20');
    expect(rows[0].querySelector('.tl-text-line').textContent).toBe('Future follow-up.');
  });
});

describe('Timeline inline status picker', () => {
  it('renders all statuses including accepted and updates the add-row pill on pick', () => {
    const draft = { timeline: [] };
    const el = Timeline.render(draft, { currentStatus: 'applied', onChange: vi.fn() });

    el.querySelector('.tl-collapsed').click();
    el.querySelector('.tl-row--add .status-badge').click();

    const options = [...document.querySelectorAll('.status-option')];
    expect(options).toHaveLength(STATUS_VALUES.length);
    expect(document.querySelector('[data-status="accepted"]')).not.toBeNull();

    document.querySelector('[data-status="accepted"]').click();

    expect(document.querySelector('.status-dropdown')).toBeNull();
    expect(el.querySelector('.tl-row--add .status-badge').textContent).toBe(STATUS_CONFIG.accepted.label);
  });

  it('closes the inline status picker on Escape', () => {
    const el = Timeline.render({ timeline: [] }, { currentStatus: 'applied', onChange: vi.fn() });

    el.querySelector('.tl-collapsed').click();
    el.querySelector('.tl-row--add .status-badge').click();
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(document.querySelector('.status-dropdown')).toBeNull();
  });
});

describe('Timeline existing entry editing', () => {
  it('updates an existing entry status through the inline picker', () => {
    const onChange = vi.fn();
    const draft = {
      timeline: [{ id: 1, date: '2026-05-20', status: 'applied', text: 'Submitted.' }],
    };
    const el = Timeline.render(draft, { currentStatus: 'applied', onChange });

    el.querySelector('.tl-collapsed').click();
    el.querySelector('.tl-row--entry .status-badge').click();
    document.querySelector('[data-status="interview"]').click();

    expect(draft.timeline[0].status).toBe('interview');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(el.querySelector('.tl-row--entry .status-badge').textContent).toBe(STATUS_CONFIG.interview.label);
  });

  it('commits existing entry text on Enter and blur, and reverts on Escape', () => {
    const onChange = vi.fn();
    const draft = {
      timeline: [{ id: 1, date: '2026-05-20', status: 'applied', text: 'Submitted.' }],
    };
    const el = Timeline.render(draft, { currentStatus: 'applied', onChange });

    el.querySelector('.tl-collapsed').click();
    el.querySelector('.tl-row--entry .tl-text-line').click();
    let input = el.querySelector('.tl-entry-text-input');
    expect(input.value).toBe('Submitted.');
    input.value = 'Recruiter replied.';
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(draft.timeline[0].text).toBe('Recruiter replied.');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(el.querySelector('.tl-row--entry .tl-text-line').textContent).toBe('Recruiter replied.');

    el.querySelector('.tl-row--entry .tl-text-line').click();
    input = el.querySelector('.tl-entry-text-input');
    input.value = 'Discard this.';
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(draft.timeline[0].text).toBe('Recruiter replied.');
    expect(onChange).toHaveBeenCalledTimes(1);

    el.querySelector('.tl-row--entry .tl-text-line').click();
    input = el.querySelector('.tl-entry-text-input');
    input.value = '';
    input.dispatchEvent(new window.Event('blur'));

    expect(draft.timeline[0].text).toBe('');
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(el.querySelector('.tl-row--entry .tl-text-line').textContent).toBe('—');
  });

  it('edits existing entry dates, accepts future dates, re-sorts, and reverts on Escape', () => {
    const onChange = vi.fn();
    const draft = {
      timeline: [
        { id: 1, date: '2026-05-20', status: 'applied', text: 'Submitted.' },
        { id: 2, date: '2026-05-22', status: 'interview', text: 'Interview.' },
      ],
    };
    const el = Timeline.render(draft, { currentStatus: 'interview', onChange });

    el.querySelector('.tl-collapsed').click();
    el.querySelectorAll('.tl-row--entry')[0].querySelector('.tl-date-text').click();
    let input = el.querySelector('.tl-entry-date-input');
    expect(input.value).toBe('2026-05-22');
    input.value = '2026-05-18';
    input.dispatchEvent(new window.Event('blur'));

    expect(draft.timeline.find((entry) => entry.id === 2).date).toBe('2026-05-18');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect([...el.querySelectorAll('.tl-row--entry')].map((row) => row.querySelector('.tl-text-line').textContent))
      .toEqual(['Submitted.', 'Interview.']);

    el.querySelectorAll('.tl-row--entry')[1].querySelector('.tl-date-text').click();
    input = el.querySelector('.tl-entry-date-input');
    input.value = '2026-06-20';
    input.dispatchEvent(new window.Event('blur'));

    expect(draft.timeline.find((entry) => entry.id === 2).date).toBe('2026-06-20');
    expect([...el.querySelectorAll('.tl-row--entry')].map((row) => row.querySelector('.tl-text-line').textContent))
      .toEqual(['Interview.', 'Submitted.']);

    el.querySelectorAll('.tl-row--entry')[0].querySelector('.tl-date-text').click();
    input = el.querySelector('.tl-entry-date-input');
    input.value = '2026-04-01';
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(draft.timeline.find((entry) => entry.id === 2).date).toBe('2026-06-20');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('deletes an existing entry immediately and calls onChange', () => {
    const onChange = vi.fn();
    const draft = {
      timeline: [
        { id: 1, date: '2026-05-20', status: 'applied', text: 'Submitted.' },
        { id: 2, date: '2026-05-22', status: 'interview', text: 'Interview.' },
      ],
    };
    const el = Timeline.render(draft, { currentStatus: 'interview', onChange });

    el.querySelector('.tl-collapsed').click();
    el.querySelectorAll('.tl-row--entry')[0].querySelector('.tl-del').click();

    expect(draft.timeline).toEqual([
      { id: 1, date: '2026-05-20', status: 'applied', text: 'Submitted.' },
    ]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect([...el.querySelectorAll('.tl-row--entry')].map((row) => row.querySelector('.tl-text-line').textContent))
      .toEqual(['Submitted.']);
  });
});
