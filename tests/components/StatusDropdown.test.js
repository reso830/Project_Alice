// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatusDropdown } from '../../src/components/StatusDropdown.js';
import { STATUS_CONFIG, STATUS_VALUES } from '../../src/models/application.js';

afterEach(() => {
  StatusDropdown.close();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgb(${red}, ${green}, ${blue})`;
}

describe('StatusDropdown', () => {
  it('renders status options with STATUS_CONFIG badge and accent colors', () => {
    const anchor = document.createElement('button');
    document.body.append(anchor);

    StatusDropdown.open(anchor, 'wishlisted', vi.fn());

    const appliedDot = document.querySelector('[data-status="applied"] .status-dot');

    expect(appliedDot.style.backgroundColor).toBe(hexToRgb(STATUS_CONFIG.applied.badgeBg));
    expect(appliedDot.style.border).toBe('');
  });

  it('renders only the valid next transition from wishlisted', () => {
    const anchor = document.createElement('button');
    document.body.append(anchor);

    StatusDropdown.open(anchor, 'wishlisted', vi.fn());

    expect(document.querySelectorAll('.status-option')).toHaveLength(1);
    expect(document.querySelector('[data-status="applied"]')).not.toBeNull();
  });

  it('focuses the first available transition when current status is absent', () => {
    const anchor = document.createElement('button');
    document.body.append(anchor);

    StatusDropdown.open(anchor, 'wishlisted', vi.fn());

    expect(document.activeElement).toBe(document.querySelector('[data-status="applied"]'));
  });

  it('renders only terminal options from offer', () => {
    const anchor = document.createElement('button');
    document.body.append(anchor);

    StatusDropdown.open(anchor, 'offer', vi.fn());

    expect(document.querySelectorAll('.status-option')).toHaveLength(4);
    expect([...document.querySelectorAll('.status-option')].map((option) => option.dataset.status))
      .toEqual(['accepted', 'rejected', 'withdrawn', 'ghosted']);
  });

  it('renders no options from terminal statuses', () => {
    const anchor = document.createElement('button');
    document.body.append(anchor);

    StatusDropdown.open(anchor, 'accepted', vi.fn());

    expect(document.querySelectorAll('.status-option')).toHaveLength(0);
  });

  it('can render all statuses for create mode callers', () => {
    const anchor = document.createElement('button');
    document.body.append(anchor);

    StatusDropdown.openAll(anchor, 'wishlisted', vi.fn());

    expect(document.querySelectorAll('.status-option')).toHaveLength(STATUS_VALUES.length);
    expect(document.querySelector('[data-status="accepted"]')).not.toBeNull();
  });

  it('marks the dropdown busy and prevents duplicate async commits', async () => {
    const anchor = document.createElement('button');
    let resolveCommit;
    const onChange = vi.fn(() => new Promise((resolve) => {
      resolveCommit = resolve;
    }));
    document.body.append(anchor);

    StatusDropdown.open(anchor, 'wishlisted', onChange);
    const option = document.querySelector('[data-status="applied"]');
    option.click();
    option.click();

    expect(document.querySelector('.status-dropdown')?.getAttribute('aria-busy')).toBe('true');
    expect(onChange).toHaveBeenCalledTimes(1);

    resolveCommit();
    for (let index = 0; index < 4; index += 1) {
      await Promise.resolve();
    }

    expect(document.querySelector('.status-dropdown')).toBeNull();
  });
});
