// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeroSlideshow } from '../../src/pages/welcome/HeroSlideshow.js';

let container;
let originalMatchMedia;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  originalMatchMedia = globalThis.matchMedia;
});

afterEach(() => {
  HeroSlideshow.unmount();
  container.remove();
  globalThis.matchMedia = originalMatchMedia;
  vi.useRealTimers();
});

function stubMatchMedia(matches) {
  globalThis.matchMedia = vi.fn().mockImplementation(() => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe('HeroSlideshow', () => {
  it('renders a placeholder card when slides is empty', () => {
    stubMatchMedia(false);
    HeroSlideshow.mount(container, { slides: [] });

    expect(container.querySelector('.hero-slideshow__placeholder')).not.toBeNull();
    expect(container.querySelectorAll('.hero-slideshow__card').length).toBe(0);
  });

  it('renders a card per slide and marks the first as primary', () => {
    stubMatchMedia(false);
    const slides = [
      { src: '/a.png', alt: 'A' },
      { src: '/b.png', alt: 'B' },
      { src: '/c.png', alt: 'C' },
    ];
    HeroSlideshow.mount(container, { slides });

    const cards = container.querySelectorAll('.hero-slideshow__card');
    expect(cards.length).toBe(3);
    expect(cards[0].classList.contains('hero-slideshow__card--primary')).toBe(true);
    expect(cards[1].classList.contains('hero-slideshow__card--primary')).toBe(false);
  });

  it('renders only the first slide statically and registers no interval when prefers-reduced-motion is reduce', () => {
    stubMatchMedia(true);
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    HeroSlideshow.mount(container, {
      slides: [
        { src: '/a.png', alt: 'A' },
        { src: '/b.png', alt: 'B' },
        { src: '/c.png', alt: 'C' },
      ],
    });

    const cards = container.querySelectorAll('.hero-slideshow__card');
    expect(cards.length).toBe(1);
    expect(cards[0].querySelector('img')?.getAttribute('src')).toBe('/a.png');
    expect(cards[0].classList.contains('hero-slideshow__card--primary')).toBe(true);
    expect(setIntervalSpy).not.toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });

  it('advances the primary slide over time when motion is allowed', () => {
    stubMatchMedia(false);
    vi.useFakeTimers();

    const slides = [
      { src: '/a.png', alt: 'A' },
      { src: '/b.png', alt: 'B' },
      { src: '/c.png', alt: 'C' },
    ];
    HeroSlideshow.mount(container, { slides });

    const cards = container.querySelectorAll('.hero-slideshow__card');
    expect(cards[0].classList.contains('hero-slideshow__card--primary')).toBe(true);

    vi.advanceTimersByTime(5000);
    expect(cards[0].classList.contains('hero-slideshow__card--primary')).toBe(false);
    expect(cards[1].classList.contains('hero-slideshow__card--primary')).toBe(true);

    vi.advanceTimersByTime(5000);
    expect(cards[1].classList.contains('hero-slideshow__card--primary')).toBe(false);
    expect(cards[2].classList.contains('hero-slideshow__card--primary')).toBe(true);

    vi.advanceTimersByTime(5000);
    expect(cards[0].classList.contains('hero-slideshow__card--primary')).toBe(true);
  });

  it('clears the interval on unmount', () => {
    stubMatchMedia(false);
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    HeroSlideshow.mount(container, {
      slides: [
        { src: '/a.png', alt: 'A' },
        { src: '/b.png', alt: 'B' },
      ],
    });
    HeroSlideshow.unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(container.querySelector('.hero-slideshow')).toBeNull();
    clearIntervalSpy.mockRestore();
  });
});
