// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/assets/Alice_White.png', () => ({ default: '/Alice_White.png' }));

import { HeroSlideshow } from '../../../src/pages/welcome/HeroSlideshow.js';

let container;

function stubMatchMedia(matches) {
  globalThis.matchMedia = vi.fn().mockImplementation(() => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

function activeSceneName() {
  return container.querySelector('.hero-slideshow__layer--active')?.dataset.scene;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  stubMatchMedia(false);
});

afterEach(() => {
  HeroSlideshow.unmount();
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('HeroSlideshow — auto mode', () => {
  it('mounts with the stack scene on the active layer and four navigation dots', () => {
    HeroSlideshow.mount(container, { heroScene: 'auto', variant: 'default' });
    expect(activeSceneName()).toBe('stack');
    expect(container.querySelectorAll('.hero-slideshow__dot').length).toBe(4);
    expect(container.querySelector('.hero-slideshow__dot--active')?.dataset.dotScene).toBe('stack');
    expect(container.querySelector('.hero-slideshow__disclaimer')?.textContent).toBe('Illustrative purposes');
  });

  it('auto-cycles through all 4 scenes over time (fake timers)', () => {
    vi.useFakeTimers();
    HeroSlideshow.mount(container, { heroScene: 'auto', variant: 'default' });

    expect(activeSceneName()).toBe('stack');
    vi.advanceTimersByTime(5500);
    expect(activeSceneName()).toBe('pipeline');
    vi.advanceTimersByTime(5500);
    expect(activeSceneName()).toBe('profile');
    vi.advanceTimersByTime(5500);
    expect(activeSceneName()).toBe('logo');
    // Wraps back to stack.
    vi.advanceTimersByTime(5500);
    expect(activeSceneName()).toBe('stack');
  });
});

describe('HeroSlideshow — pinned scene', () => {
  it('heroScene="pipeline" pins to scene 2 and renders no dots or rotation timer', () => {
    vi.useFakeTimers();
    HeroSlideshow.mount(container, { heroScene: 'pipeline', variant: 'default' });

    expect(activeSceneName()).toBe('pipeline');
    expect(container.querySelector('.hero-slideshow__dots')).toBeNull();
    expect(container.querySelector('.hero-slideshow__disclaimer')?.textContent).toBe('Illustrative purposes');
    // ScenePipeline schedules its own setInterval; the slideshow itself does not.
    // The pipeline interval is the only pending timer at this point.
    expect(vi.getTimerCount()).toBe(1);

    // Advancing time keeps us on pipeline (no slideshow-level rotation).
    vi.advanceTimersByTime(20000);
    expect(activeSceneName()).toBe('pipeline');
  });

  it('invalid heroScene falls back to "stack"', () => {
    HeroSlideshow.mount(container, { heroScene: 'not-a-scene', variant: 'default' });
    expect(activeSceneName()).toBe('stack');
    expect(container.querySelector('.hero-slideshow__dots')).toBeNull();
  });
});

describe('HeroSlideshow — dot navigation', () => {
  it('clicking a dot jumps to that scene', () => {
    HeroSlideshow.mount(container, { heroScene: 'auto', variant: 'default' });
    const profileDot = container.querySelector('[data-dot-scene="profile"]');
    profileDot.click();

    expect(activeSceneName()).toBe('profile');
    expect(container.querySelector('.hero-slideshow__dot--active')?.dataset.dotScene).toBe('profile');
  });

  it('clicking a dot puts the running progress class on the now-active dot', () => {
    HeroSlideshow.mount(container, { heroScene: 'auto', variant: 'default' });
    const profileDot = container.querySelector('[data-dot-scene="profile"]');
    profileDot.click();

    const activeProgress = container
      .querySelector('.hero-slideshow__dot--active .hero-slideshow__dot-progress');
    expect(activeProgress).not.toBeNull();
    expect(activeProgress.classList.contains('hero-slideshow__dot-progress--running')).toBe(true);

    const stackDot = container.querySelector('[data-dot-scene="stack"]');
    const stackProgress = stackDot.querySelector('.hero-slideshow__dot-progress');
    expect(stackProgress.classList.contains('hero-slideshow__dot-progress--running')).toBe(false);
  });

  it('clicking a dot restarts the rotation cadence (next auto-cycle is 5500ms later, not earlier)', () => {
    vi.useFakeTimers();
    HeroSlideshow.mount(container, { heroScene: 'auto', variant: 'default' });
    // Advance 3000ms — we are 3000ms into the stack scene.
    vi.advanceTimersByTime(3000);
    expect(activeSceneName()).toBe('stack');

    // Jump to profile via dot click.
    container.querySelector('[data-dot-scene="profile"]').click();
    expect(activeSceneName()).toBe('profile');

    // 3000ms later — would have been a cycle in the old cadence; with restart, still profile.
    vi.advanceTimersByTime(3000);
    expect(activeSceneName()).toBe('profile');
    // After a full 5500ms from the jump, the next scene fires.
    vi.advanceTimersByTime(2500);
    expect(activeSceneName()).toBe('logo');
  });
});

describe('HeroSlideshow — reduced motion', () => {
  it('renders scene 1 (stack) only, statically, with no dots and no rotation timer', () => {
    stubMatchMedia(true);
    vi.useFakeTimers();
    HeroSlideshow.mount(container, { heroScene: 'auto', variant: 'default' });

    expect(activeSceneName()).toBe('stack');
    expect(container.querySelector('.hero-slideshow__dots')).toBeNull();
    // No JS timers at the slideshow level. The stack scene also has no timers under reduced motion.
    expect(vi.getTimerCount()).toBe(0);

    // Advancing time stays on stack — there is no rotation.
    vi.advanceTimersByTime(30000);
    expect(activeSceneName()).toBe('stack');
  });
});

describe('HeroSlideshow — unmount', () => {
  it('clears the rotation timer and removes the root', () => {
    vi.useFakeTimers();
    HeroSlideshow.mount(container, { heroScene: 'auto', variant: 'default' });
    expect(vi.getTimerCount()).toBeGreaterThanOrEqual(1);

    HeroSlideshow.unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(container.querySelector('.hero-slideshow')).toBeNull();
  });
});
