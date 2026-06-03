// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Toast } from '../../src/components/Toast.js';

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

function toastDotColor() {
  return document.querySelector('.toast-dot')?.style.backgroundColor;
}

describe('Toast', () => {
  it('renders info notices with neutral styling instead of error red', () => {
    vi.useFakeTimers();

    Toast.show('Heads up', 'info');

    expect(document.querySelector('.toast')?.textContent).toContain('Heads up');
    expect(toastDotColor()).toBe('rgb(245, 158, 11)');
    expect(toastDotColor()).not.toBe('rgb(239, 68, 68)');
  });

  it('keeps success and failure colors distinct', () => {
    vi.useFakeTimers();

    Toast.show('Saved', 'success');
    expect(toastDotColor()).toBe('rgb(34, 197, 94)');

    Toast.show('Failed', 'failure');
    expect(toastDotColor()).toBe('rgb(239, 68, 68)');
  });
});
