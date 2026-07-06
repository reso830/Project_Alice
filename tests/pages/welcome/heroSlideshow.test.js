// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/assets/logo/alice-sigil-full-white.svg', () => ({
  default: '/alice-sigil-full-white.svg',
}));

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
  it('mounts with the constellation scene on the active layer and five navigation dots', () => {
    HeroSlideshow.mount(container, { heroScene: 'auto', variant: 'default' });
    expect(activeSceneName()).toBe('constellation');
    expect(container.querySelectorAll('.hero-slideshow__dot').length).toBe(5);
    expect(container.querySelector('.hero-slideshow__dot--active')?.dataset.dotScene).toBe('constellation');
    expect(container.querySelector('.hero-slideshow__caption')?.textContent).toBe('Every step, in view.');
    expect(container.querySelector('.hero-slideshow__disclaimer')?.textContent).toBe('Illustrative purposes');
  });

  it('auto-cycles through all 5 scenes over time (fake timers)', () => {
    vi.useFakeTimers();
    HeroSlideshow.mount(container, { heroScene: 'auto', variant: 'default' });

    expect(activeSceneName()).toBe('constellation');
    vi.advanceTimersByTime(8600);
    expect(activeSceneName()).toBe('parse');
    vi.advanceTimersByTime(8600);
    expect(activeSceneName()).toBe('pipeline');
    vi.advanceTimersByTime(8600);
    expect(activeSceneName()).toBe('momentum');
    vi.advanceTimersByTime(8600);
    expect(activeSceneName()).toBe('deck');
    // Wraps back to constellation.
    vi.advanceTimersByTime(8600);
    expect(activeSceneName()).toBe('constellation');
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
    expect(vi.getTimerCount()).toBe(1);

    // Advancing time keeps us on pipeline (no slideshow-level rotation).
    vi.advanceTimersByTime(20000);
    expect(activeSceneName()).toBe('pipeline');
  });

  it('invalid heroScene falls back to "constellation"', () => {
    HeroSlideshow.mount(container, { heroScene: 'not-a-scene', variant: 'default' });
    expect(activeSceneName()).toBe('constellation');
    expect(container.querySelector('.hero-slideshow__dots')).toBeNull();
  });
});

describe('HeroSlideshow — dot navigation', () => {
  it('clicking a dot jumps to that scene', () => {
    HeroSlideshow.mount(container, { heroScene: 'auto', variant: 'default' });
    const momentumDot = container.querySelector('[data-dot-scene="momentum"]');
    momentumDot.click();

    expect(activeSceneName()).toBe('momentum');
    expect(container.querySelector('.hero-slideshow__dot--active')?.dataset.dotScene).toBe('momentum');
    expect(container.querySelector('.hero-slideshow__caption')?.textContent).toBe('See your momentum.');
  });

  it('clicking a dot puts the running progress class on the now-active dot', () => {
    HeroSlideshow.mount(container, { heroScene: 'auto', variant: 'default' });
    const momentumDot = container.querySelector('[data-dot-scene="momentum"]');
    momentumDot.click();

    const activeProgress = container
      .querySelector('.hero-slideshow__dot--active .hero-slideshow__dot-progress');
    expect(activeProgress).not.toBeNull();
    expect(activeProgress.classList.contains('hero-slideshow__dot-progress--running')).toBe(true);

    const constellationDot = container.querySelector('[data-dot-scene="constellation"]');
    const constellationProgress = constellationDot.querySelector('.hero-slideshow__dot-progress');
    expect(constellationProgress.classList.contains('hero-slideshow__dot-progress--running')).toBe(false);
  });

  it('clicking a dot restarts the rotation cadence (next auto-cycle is 8600ms later, not earlier)', () => {
    vi.useFakeTimers();
    HeroSlideshow.mount(container, { heroScene: 'auto', variant: 'default' });
    // Advance 3000ms — we are 3000ms into the constellation scene.
    vi.advanceTimersByTime(3000);
    expect(activeSceneName()).toBe('constellation');

    // Jump to momentum via dot click.
    container.querySelector('[data-dot-scene="momentum"]').click();
    expect(activeSceneName()).toBe('momentum');

    // 3000ms later — would have been a cycle in the old cadence; with restart, still momentum.
    vi.advanceTimersByTime(3000);
    expect(activeSceneName()).toBe('momentum');
    // After a full 8600ms from the jump, the next scene fires.
    vi.advanceTimersByTime(5600);
    expect(activeSceneName()).toBe('deck');
  });
});

describe('HeroSlideshow — reduced motion', () => {
  it('renders scene 1 (constellation) only, statically, with no dots and no rotation timer', () => {
    stubMatchMedia(true);
    vi.useFakeTimers();
    HeroSlideshow.mount(container, { heroScene: 'auto', variant: 'default' });

    expect(activeSceneName()).toBe('constellation');
    expect(container.querySelector('.hero-slideshow__dots')).toBeNull();
    // No JS timers at the slideshow level. The constellation scene also has no timers under reduced motion.
    expect(vi.getTimerCount()).toBe(0);

    // Advancing time stays on constellation — there is no rotation.
    vi.advanceTimersByTime(30000);
    expect(activeSceneName()).toBe('constellation');
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
