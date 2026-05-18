// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SceneProfile } from '../../../../src/pages/welcome/scenes/SceneProfile.js';

const mainCss = readFileSync(join(cwd(), 'src/styles/main.css'), 'utf8');

let container;

function stubMatchMedia(matches) {
  globalThis.matchMedia = vi.fn().mockImplementation(() => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  stubMatchMedia(false);
});

afterEach(() => {
  SceneProfile.unmount();
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('SceneProfile', () => {
  it('mounts chips, donut, and legend with the initial values', () => {
    SceneProfile.mount(container, { variant: 'default' });
    expect(container.querySelectorAll('.scene-profile__chip').length).toBe(4);
    expect(container.querySelectorAll('.scene-profile__donut-segment').length).toBe(4);
    expect(container.querySelectorAll('.scene-profile__legend-row').length).toBe(4);

    // Initial legend values come from DONUT_INITIAL.
    const initial = {
      applied: '12',
      interview: '6',
      offered: '2',
      rejected: '8',
    };
    Object.entries(initial).forEach(([key, val]) => {
      const cell = container.querySelector(`[data-legend-value="${key}"]`);
      expect(cell?.textContent).toBe(val);
    });
  });

  it('redraws the donut + legend when the DONUT_AFTER swap fires at 2700ms', () => {
    vi.useFakeTimers();
    SceneProfile.mount(container, { variant: 'default' });

    const beforeDash = container.querySelector('[data-segment="applied"]').getAttribute('stroke-dasharray');
    expect(container.querySelector('[data-legend-value="interview"]').textContent).toBe('6');

    vi.advanceTimersByTime(2700);

    const afterDash = container.querySelector('[data-segment="applied"]').getAttribute('stroke-dasharray');
    expect(afterDash).not.toBe(beforeDash);
    expect(container.querySelector('[data-legend-value="interview"]').textContent).toBe('8');
    expect(container.querySelector('[data-legend-value="offered"]').textContent).toBe('4');
  });

  it('unmount clears pending swap timer and tick interval', () => {
    vi.useFakeTimers();
    SceneProfile.mount(container, { variant: 'default' });
    expect(vi.getTimerCount()).toBeGreaterThanOrEqual(1);
    SceneProfile.unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(container.querySelector('.scene-profile')).toBeNull();
  });

  it('reduced-motion: renders the final state with no timers', () => {
    stubMatchMedia(true);
    vi.useFakeTimers();
    SceneProfile.mount(container, { variant: 'default' });
    expect(vi.getTimerCount()).toBe(0);
    // Final values come from DONUT_AFTER.
    expect(container.querySelector('[data-legend-value="interview"]').textContent).toBe('8');
    expect(container.querySelector('[data-legend-value="offered"]').textContent).toBe('4');
  });

  it('keeps the centered/tablet variant compact enough for the slideshow band', () => {
    expect(mainCss).toContain('.scene-profile--centered');
    expect(mainCss).toContain('gap: 18px');
    expect(mainCss).toContain('flex-basis: 124px');
  });
});
