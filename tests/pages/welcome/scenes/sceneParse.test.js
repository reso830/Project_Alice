// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SceneParse } from '../../../../src/pages/welcome/scenes/SceneParse.js';

let container;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(() => {
  SceneParse.unmount();
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('SceneParse', () => {
  it('mounts the paste window, sparkle burst, and parsed card', () => {
    SceneParse.mount(container, { variant: 'default' });

    expect(container.querySelector('.scene-parse')?.dataset.variant).toBe('default');
    expect(container.querySelector('.scene-parse__window')).not.toBeNull();
    expect(container.querySelector('.scene-parse__card')).not.toBeNull();
    expect(container.querySelectorAll('.scene-parse__spark')).toHaveLength(22);
  });

  it('advances scan and parsed states with timers', () => {
    vi.useFakeTimers();
    SceneParse.mount(container);

    vi.advanceTimersByTime(420);
    expect(container.querySelector('.scene-parse')?.classList).toContain('is-scanned');
    vi.advanceTimersByTime(1130);
    expect(container.querySelector('.scene-parse')?.classList).toContain('is-shrunk');
    vi.advanceTimersByTime(1200);
    expect(container.querySelector('.scene-parse')?.classList).toContain('is-parsed');
  });

  it('reduced motion renders the settled parsed-card state without timers', () => {
    vi.useFakeTimers();
    SceneParse.mount(container, { motion: false });

    expect(container.querySelector('.scene-parse')?.classList).toContain('is-settled');
    expect(vi.getTimerCount()).toBe(0);
  });
});
