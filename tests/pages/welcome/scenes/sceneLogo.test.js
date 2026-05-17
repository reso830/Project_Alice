// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/assets/Alice_White.png', () => ({ default: '/Alice_White.png' }));

import { SceneLogo } from '../../../../src/pages/welcome/scenes/SceneLogo.js';

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
  SceneLogo.unmount();
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('SceneLogo', () => {
  it('mounts the floating logo with randomized sparkles in the default variant', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    SceneLogo.mount(container, { variant: 'default' });
    const root = container.querySelector('.scene-logo');
    expect(root).not.toBeNull();
    expect(root.dataset.variant).toBe('default');
    expect(container.querySelector('.scene-logo__mark')).not.toBeNull();
    const sparkles = container.querySelectorAll('.scene-logo__sparkle');
    expect(sparkles.length).toBe(12);
    expect(sparkles[0].style.getPropertyValue('--scene-logo-sparkle-x')).toBe('50%');
    expect(sparkles[0].style.getPropertyValue('--scene-logo-sparkle-y')).toBe('50%');
    expect(sparkles[0].style.getPropertyValue('--scene-logo-sparkle-size')).toBe('16px');
    expect(sparkles[0].style.getPropertyValue('--scene-logo-sparkle-delay')).toBe('0.13s');
  });

  it('mounts with the centered variant class for tablet sizing', () => {
    SceneLogo.mount(container, { variant: 'centered' });
    expect(container.querySelector('.scene-logo--centered')).not.toBeNull();
  });

  it('unmounts cleanly', () => {
    SceneLogo.mount(container, { variant: 'default' });
    SceneLogo.unmount();
    expect(container.querySelector('.scene-logo')).toBeNull();
  });

  it('reduced-motion: no setInterval/setTimeout left running after mount', () => {
    stubMatchMedia(true);
    vi.useFakeTimers();
    SceneLogo.mount(container, { variant: 'default' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('default: no JS timers either (animations are pure CSS)', () => {
    vi.useFakeTimers();
    SceneLogo.mount(container, { variant: 'default' });
    expect(vi.getTimerCount()).toBe(0);
  });
});
