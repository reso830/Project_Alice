// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SceneMomentum } from '../../../../src/pages/welcome/scenes/SceneMomentum.js';

let container;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(() => {
  SceneMomentum.unmount();
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('SceneMomentum', () => {
  it('mounts five stat chips and five donut segments', () => {
    SceneMomentum.mount(container);

    expect(container.querySelectorAll('.scene-momentum__chip')).toHaveLength(5);
    expect(container.querySelectorAll('.scene-momentum__segment')).toHaveLength(5);
    expect(container.querySelector('.scene-momentum__total-value')?.textContent).toBe('15');
  });

  it('swaps to the grown dataset after 2500ms', () => {
    vi.useFakeTimers();
    SceneMomentum.mount(container);

    vi.advanceTimersByTime(2500);
    // Swap fires at 2500ms, then the count-up animates over 900ms via rAF.
    vi.advanceTimersByTime(1000);

    expect(container.querySelector('.scene-momentum__total-value')?.textContent).toBe('36');
    expect(container.querySelector('[data-stat="offer"] .scene-momentum__chip-value')?.textContent).toBe('3');
  });

  it('reduced motion renders final values without timers', () => {
    vi.useFakeTimers();
    SceneMomentum.mount(container, { motion: false });

    expect(container.querySelector('.scene-momentum__total-value')?.textContent).toBe('36');
    expect(vi.getTimerCount()).toBe(0);
  });
});
