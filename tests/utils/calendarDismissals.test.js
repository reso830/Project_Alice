import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _resetForTesting,
  add,
  isDismissed,
  load,
} from '../../src/utils/calendarDismissals.js';

function createStorage() {
  const values = new Map();
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => {
      values.set(key, String(value));
    }),
    removeItem: vi.fn((key) => {
      values.delete(key);
    }),
    clear: vi.fn(() => {
      values.clear();
    }),
  };
}

describe('calendarDismissals', () => {
  let storage;
  let warn;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 21));
    storage = createStorage();
    vi.stubGlobal('localStorage', storage);
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    _resetForTesting();
  });

  afterEach(() => {
    _resetForTesting();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('loads an empty list when no key exists', () => {
    expect(load({ status: 'local-mode' })).toEqual([]);
    expect(storage.getItem).toHaveBeenCalledWith('alice:calendar:dismissals:local');
  });

  it('round-trips local dismissals and overwrites by app and kind', () => {
    add({ status: 'local-mode' }, 7, 'followup');
    add({ status: 'local-mode' }, 7, 'followup');

    expect(load({ status: 'local-mode' })).toEqual([
      { appId: 7, kind: 'followup', dismissedAt: '2026-05-21' },
    ]);
    expect(JSON.parse(storage.getItem('alice:calendar:dismissals:local'))).toEqual([
      { appId: 7, kind: 'followup', dismissedAt: '2026-05-21' },
    ]);
  });

  it('scopes hosted dismissals by authenticated user id', () => {
    add({ status: 'authenticated', user: { id: 'abc-123' } }, 4, 'ghost');

    expect(storage.setItem).toHaveBeenCalledWith(
      'alice:calendar:dismissals:abc-123',
      JSON.stringify([{ appId: 4, kind: 'ghost', dismissedAt: '2026-05-21' }]),
    );
  });

  it('uses the local key for unauthenticated and initializing states', () => {
    add({ status: 'unauthenticated' }, 1, 'feedback');
    add({ status: 'initializing' }, 2, 'ghost');

    const stored = JSON.parse(storage.getItem('alice:calendar:dismissals:local'));
    expect(stored).toEqual([
      { appId: 1, kind: 'feedback', dismissedAt: '2026-05-21' },
      { appId: 2, kind: 'ghost', dismissedAt: '2026-05-21' },
    ]);
  });

  it('checks whether a suggestion is dismissed', () => {
    const list = [{ appId: 7, kind: 'followup', dismissedAt: '2026-05-21' }];

    expect(isDismissed(list, 7, 'followup')).toBe(true);
    expect(isDismissed(list, 7, 'ghost')).toBe(false);
    expect(isDismissed(list, 8, 'followup')).toBe(false);
  });

  it('falls back to memory and warns once when localStorage throws', () => {
    storage.setItem.mockImplementation(() => {
      throw new Error('quota');
    });
    storage.getItem.mockImplementation(() => {
      throw new Error('blocked');
    });

    add({ status: 'local-mode' }, 7, 'followup');
    add({ status: 'local-mode' }, 8, 'ghost');

    expect(load({ status: 'local-mode' })).toEqual([
      { appId: 7, kind: 'followup', dismissedAt: '2026-05-21' },
      { appId: 8, kind: 'ghost', dismissedAt: '2026-05-21' },
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('resets warning state and fallback memory for tests', () => {
    add({ status: 'local-mode' }, 7, 'followup');
    _resetForTesting();

    expect(load({ status: 'local-mode' })).toEqual([
      { appId: 7, kind: 'followup', dismissedAt: '2026-05-21' },
    ]);
    storage.clear();
    _resetForTesting();
    expect(load({ status: 'local-mode' })).toEqual([]);
  });

  it('keeps demo dismissals in memory and never touches localStorage', () => {
    add({ status: 'demo' }, 7, 'followup');

    expect(load({ status: 'demo' })).toEqual([
      { appId: 7, kind: 'followup', dismissedAt: '2026-05-21' },
    ]);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.getItem('alice:calendar:dismissals:demo')).toBeNull();
    expect(storage.getItem('alice:calendar:dismissals:local')).toBeNull();
  });

  it('does not warn in demo when localStorage is unavailable', () => {
    storage.setItem.mockImplementation(() => {
      throw new Error('quota');
    });
    storage.getItem.mockImplementation(() => {
      throw new Error('blocked');
    });

    add({ status: 'demo' }, 7, 'followup');

    expect(warn).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.getItem).not.toHaveBeenCalled();
  });
});
