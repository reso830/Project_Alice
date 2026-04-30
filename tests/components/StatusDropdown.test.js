// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatusDropdown } from '../../src/components/StatusDropdown.js';
import { STATUS_CONFIG } from '../../src/models/application.js';

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

    const wishlistDot = document.querySelector('[data-status="wishlisted"] .status-dot');

    expect(wishlistDot.style.backgroundColor).toBe(hexToRgb(STATUS_CONFIG.wishlisted.badgeBg));
    expect(wishlistDot.style.border)
      .toBe(`1px solid ${hexToRgb(STATUS_CONFIG.wishlisted.borderAccent)}`);
  });
});
