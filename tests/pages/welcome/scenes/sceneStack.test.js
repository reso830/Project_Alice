// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SceneStack } from '../../../../src/pages/welcome/scenes/SceneStack.js';

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
  SceneStack.unmount();
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('SceneStack', () => {
  it('mounts 4 cards in the default variant', () => {
    SceneStack.mount(container, { variant: 'default' });
    const cards = container.querySelectorAll('.scene-stack__card');
    expect(cards.length).toBe(4);
    expect(container.querySelector('.scene-stack').dataset.variant).toBe('default');
  });

  it('mounts 2 flat cards in the centered variant (no rotation, no ghost opacity)', () => {
    SceneStack.mount(container, { variant: 'centered' });
    const cards = container.querySelectorAll('.scene-stack__card');
    expect(cards.length).toBe(2);
    cards.forEach((c) => {
      expect(c.style.getPropertyValue('--scene-stack-rotation')).toBe('0deg');
      expect(c.style.getPropertyValue('--scene-stack-opacity')).toBe('1');
      expect(c.classList.contains('scene-stack__card--entering')).toBe(false);
    });
  });

  it('unmounts cleanly: removes root from DOM', () => {
    SceneStack.mount(container, { variant: 'default' });
    expect(container.querySelector('.scene-stack')).not.toBeNull();
    SceneStack.unmount();
    expect(container.querySelector('.scene-stack')).toBeNull();
  });

  it('schedules stagger setTimeouts in the default variant', () => {
    vi.useFakeTimers();
    SceneStack.mount(container, { variant: 'default' });
    expect(vi.getTimerCount()).toBe(4);
    // All entering classes are present right after mount.
    const enter = container.querySelectorAll('.scene-stack__card--entering');
    expect(enter.length).toBe(4);

    // Advance past the last stagger; entering classes should have cleared.
    vi.advanceTimersByTime(500);
    expect(container.querySelectorAll('.scene-stack__card--entering').length).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reduced-motion: no setTimeout/setInterval scheduled after mount', () => {
    stubMatchMedia(true);
    vi.useFakeTimers();
    SceneStack.mount(container, { variant: 'default' });
    expect(vi.getTimerCount()).toBe(0);
    // Cards are present in their final state (no entering class).
    const cards = container.querySelectorAll('.scene-stack__card');
    expect(cards.length).toBe(4);
    expect(container.querySelectorAll('.scene-stack__card--entering').length).toBe(0);
  });

  it('unmount during stagger clears pending timers', () => {
    vi.useFakeTimers();
    SceneStack.mount(container, { variant: 'default' });
    expect(vi.getTimerCount()).toBe(4);
    SceneStack.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
