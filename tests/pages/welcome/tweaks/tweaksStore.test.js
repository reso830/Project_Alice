// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as tweaksStore from '../../../../src/pages/welcome/tweaks/tweaksStore.js';

const { init, getTweaks, setTweak, subscribe, _resetForTests, TWEAK_DEFAULTS } = tweaksStore;

beforeEach(() => {
  _resetForTests();
  window.history.replaceState({}, '', '/');
});

afterEach(() => {
  _resetForTests();
  window.history.replaceState({}, '', '/');
  vi.restoreAllMocks();
});

describe('tweaksStore — defaults', () => {
  it('returns the design §5 defaults when no URL params are present', () => {
    init({ search: '' });
    expect(getTweaks()).toEqual({
      layout: 'diagonal',
      theme: 'warm',
      copyIntensity: 'none',
      authState: 'signin',
      heroScene: 'auto',
    });
  });

  it('lazy-initializes on first getTweaks call when init was not called explicitly', () => {
    // Fresh store after _resetForTests; getTweaks should still return defaults
    // because lazy init reads the (empty) window.location.search.
    expect(getTweaks()).toEqual(TWEAK_DEFAULTS);
  });
});

describe('tweaksStore — URL overlay', () => {
  it('overlays valid query params onto the defaults', () => {
    init({ search: '?layout=centered&theme=navy' });
    const t = getTweaks();
    expect(t.layout).toBe('centered');
    expect(t.theme).toBe('navy');
    expect(t.copyIntensity).toBe('none');
    expect(t.authState).toBe('signin');
    expect(t.heroScene).toBe('auto');
  });

  it('reads from window.location.search when no `search` is passed', () => {
    window.history.replaceState({}, '', '/?layout=split&heroScene=pipeline');
    init();
    const t = getTweaks();
    expect(t.layout).toBe('split');
    expect(t.heroScene).toBe('pipeline');
  });

  it('ignores invalid values and retains the default', () => {
    init({ search: '?layout=spinny&theme=neon&copyIntensity=maximalist' });
    const t = getTweaks();
    expect(t.layout).toBe('diagonal');
    expect(t.theme).toBe('warm');
    expect(t.copyIntensity).toBe('none');
  });

  it('ignores unknown keys', () => {
    init({ search: '?layout=split&nonsense=42' });
    const t = getTweaks();
    expect(t.layout).toBe('split');
    expect(t).not.toHaveProperty('nonsense');
  });

  it('accepts both leading-? and bare param strings', () => {
    init({ search: 'layout=split' });
    expect(getTweaks().layout).toBe('split');
  });
});

describe('tweaksStore — setTweak', () => {
  it('updates a single key and leaves the others untouched', () => {
    init({ search: '' });
    expect(setTweak('theme', 'navy')).toBe(true);
    expect(getTweaks().theme).toBe('navy');
    expect(getTweaks().layout).toBe('diagonal');
  });

  it('rejects invalid values without mutating state', () => {
    init({ search: '' });
    expect(setTweak('layout', 'spinny')).toBe(false);
    expect(getTweaks().layout).toBe('diagonal');
  });

  it('rejects unknown keys without throwing', () => {
    init({ search: '' });
    expect(setTweak('mystery', 'value')).toBe(false);
    expect(getTweaks()).not.toHaveProperty('mystery');
  });

  it('notifies subscribers with the latest snapshot', () => {
    init({ search: '' });
    const handler = vi.fn();
    const unsubscribe = subscribe(handler);
    // Subscribing alone does not fire — only setTweak does.
    expect(handler).not.toHaveBeenCalled();

    setTweak('layout', 'centered');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toMatchObject({ layout: 'centered' });

    setTweak('heroScene', 'profile');
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[1][0]).toMatchObject({
      layout: 'centered',
      heroScene: 'profile',
    });

    unsubscribe();
    setTweak('theme', 'navy');
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('does not notify when setting a key to its current value', () => {
    init({ search: '' });
    const handler = vi.fn();
    subscribe(handler);
    setTweak('layout', 'diagonal');
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('tweaksStore — init', () => {
  it('fires notify so subscribers see the post-init snapshot', () => {
    const handler = vi.fn();
    subscribe(handler);
    init({ search: '?theme=navy' });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toMatchObject({ theme: 'navy' });
  });

  it('a second init fully resets state from the new search string', () => {
    init({ search: '?layout=centered' });
    expect(getTweaks().layout).toBe('centered');
    init({ search: '?theme=navy' });
    const t = getTweaks();
    expect(t.layout).toBe('diagonal');
    expect(t.theme).toBe('navy');
  });
});
