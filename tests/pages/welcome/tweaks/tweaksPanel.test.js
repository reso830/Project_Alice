// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as tweaksStore from '../../../../src/pages/welcome/tweaks/tweaksStore.js';
import { TweaksPanel } from '../../../../src/pages/welcome/tweaks/TweaksPanel.js';

let container;

function stubMatchMedia({ mobile = false } = {}) {
  globalThis.matchMedia = vi.fn().mockImplementation((q) => ({
    matches: typeof q === 'string' && q.includes('max-width: 759px') ? mobile : false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  tweaksStore._resetForTests();
  window.history.replaceState({}, '', '/');
  stubMatchMedia({ mobile: false });
});

afterEach(() => {
  TweaksPanel.unmount();
  tweaksStore._resetForTests();
  container.remove();
  window.history.replaceState({}, '', '/');
  vi.restoreAllMocks();
});

describe('TweaksPanel — rendering', () => {
  it('renders the toggle + five labeled selects at desktop width', () => {
    tweaksStore.init({ search: '' });
    TweaksPanel.mount(container, { tweaksStore });

    expect(container.querySelector('.tweaks-panel')).not.toBeNull();
    expect(container.querySelector('.tweaks-panel__toggle')).not.toBeNull();
    const selects = container.querySelectorAll('.tweaks-panel__select');
    expect(selects.length).toBe(5);

    const keys = Array.from(selects).map((s) => s.dataset.tweakKey);
    expect(keys).toEqual(['layout', 'theme', 'copyIntensity', 'authState', 'heroScene']);
  });

  it('selects reflect the current tweaks snapshot at mount time', () => {
    tweaksStore.init({ search: '?layout=centered&heroScene=profile' });
    TweaksPanel.mount(container, { tweaksStore });

    const layoutSelect = container.querySelector('[data-tweak-key="layout"]');
    const heroSelect = container.querySelector('[data-tweak-key="heroScene"]');
    expect(layoutSelect.value).toBe('centered');
    expect(heroSelect.value).toBe('profile');
  });

  it('the panel body starts hidden', () => {
    tweaksStore.init({ search: '' });
    TweaksPanel.mount(container, { tweaksStore });
    expect(container.querySelector('.tweaks-panel__body').hidden).toBe(true);
  });
});

describe('TweaksPanel — open / close', () => {
  it('clicking the toggle opens the panel', () => {
    tweaksStore.init({ search: '' });
    TweaksPanel.mount(container, { tweaksStore });
    container.querySelector('.tweaks-panel__toggle').click();
    expect(container.querySelector('.tweaks-panel__body').hidden).toBe(false);
  });

  it('Escape closes an open panel', () => {
    tweaksStore.init({ search: '' });
    TweaksPanel.mount(container, { tweaksStore });
    container.querySelector('.tweaks-panel__toggle').click();
    expect(container.querySelector('.tweaks-panel__body').hidden).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(container.querySelector('.tweaks-panel__body').hidden).toBe(true);
  });

  it('clicking outside the panel closes it', () => {
    tweaksStore.init({ search: '' });
    TweaksPanel.mount(container, { tweaksStore });
    container.querySelector('.tweaks-panel__toggle').click();
    expect(container.querySelector('.tweaks-panel__body').hidden).toBe(false);

    document.body.click();
    expect(container.querySelector('.tweaks-panel__body').hidden).toBe(true);
  });
});

describe('TweaksPanel — change events', () => {
  it('changing a select calls setTweak with the right key/value', () => {
    tweaksStore.init({ search: '' });
    TweaksPanel.mount(container, { tweaksStore });

    const layoutSelect = container.querySelector('[data-tweak-key="layout"]');
    layoutSelect.value = 'navy'; // invalid for layout — store should reject
    layoutSelect.dispatchEvent(new Event('change', { bubbles: true }));
    expect(tweaksStore.getTweaks().layout).toBe('diagonal');

    layoutSelect.value = 'split';
    layoutSelect.dispatchEvent(new Event('change', { bubbles: true }));
    expect(tweaksStore.getTweaks().layout).toBe('split');
  });

  it('external setTweak updates the visible select value (subscription sync)', () => {
    tweaksStore.init({ search: '' });
    TweaksPanel.mount(container, { tweaksStore });

    const themeSelect = container.querySelector('[data-tweak-key="theme"]');
    expect(themeSelect.value).toBe('warm');

    tweaksStore.setTweak('theme', 'navy');
    expect(themeSelect.value).toBe('navy');
  });
});

describe('TweaksPanel — mobile', () => {
  it('does not render anything at <760px (mobile)', () => {
    stubMatchMedia({ mobile: true });
    tweaksStore.init({ search: '' });
    TweaksPanel.mount(container, { tweaksStore });

    expect(container.querySelector('.tweaks-panel')).toBeNull();
    expect(container.querySelector('.tweaks-panel__toggle')).toBeNull();
  });
});

describe('TweaksPanel — unmount', () => {
  it('removes the panel and unsubscribes (no DOM leak)', () => {
    tweaksStore.init({ search: '' });
    TweaksPanel.mount(container, { tweaksStore });
    expect(container.querySelector('.tweaks-panel')).not.toBeNull();

    TweaksPanel.unmount();
    expect(container.querySelector('.tweaks-panel')).toBeNull();

    // After unmount, store mutations must not throw or affect any prior DOM.
    expect(() => tweaksStore.setTweak('layout', 'split')).not.toThrow();
  });
});
