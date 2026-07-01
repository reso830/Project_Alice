import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  cancel,
  check,
  download,
  resetUpdateControllerForTesting,
  restart,
  subscribeUpdateController,
  versionsMatch,
} from '../../src/data/updateController.js';
import {
  getUpdateStatus,
  resetUpdateStatusForTesting,
  subscribeUpdateStatus,
} from '../../src/data/updateStatusStore.js';

const POLL_MS = 1000;
const RESTART_DELAYED_MS = 30_000;

async function flush(count = 20) {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
}

function okJson(body) {
  return Promise.resolve({
    ok: true,
    json: async () => body,
  });
}

function failJson(message) {
  return Promise.resolve({
    ok: false,
    json: async () => ({ error: { message } }),
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetUpdateControllerForTesting();
  resetUpdateStatusForTesting();
});

describe('updateController', () => {
  it('publishes settings and initial status on first subscriber only', async () => {
    const fetchMock = vi.fn((route) => {
      if (route === '/api/update/settings') {
        return okJson({ autoCheckUpdates: false, updateMode: 'notify' });
      }
      if (route === '/api/update/status') {
        return okJson({ status: 'available', latestVersion: '1.10.0' });
      }
      throw new Error(`Unexpected route ${route}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const unsubscribeA = subscribeUpdateController();
    const unsubscribeB = subscribeUpdateController();
    await flush();

    expect(fetchMock.mock.calls.filter(([route]) => route === '/api/update/settings')).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([route]) => route === '/api/update/status')).toHaveLength(1);
    expect(getUpdateStatus()).toEqual(expect.objectContaining({
      autoCheckUpdates: false,
      updateMode: 'notify',
      status: 'available',
      latestVersion: '1.10.0',
    }));

    unsubscribeA();
    unsubscribeB();
  });

  it('keeps one recursive status poller while active statuses continue', async () => {
    vi.useFakeTimers();
    let statusReads = 0;
    const fetchMock = vi.fn((route) => {
      if (route === '/api/update/settings') {
        return okJson({ autoCheckUpdates: false, updateMode: 'ask' });
      }
      if (route === '/api/update/status') {
        statusReads += 1;
        return okJson(statusReads < 3
          ? { status: 'downloading', progress: statusReads * 20 }
          : { status: 'ready-to-restart', progress: 100 });
      }
      throw new Error(`Unexpected route ${route}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const unsubscribeA = subscribeUpdateController();
    const unsubscribeB = subscribeUpdateController();
    await flush();

    expect(statusReads).toBe(1);

    await vi.advanceTimersByTimeAsync(POLL_MS);
    await flush();

    expect(statusReads).toBe(2);

    await vi.advanceTimersByTimeAsync(POLL_MS);
    await flush();

    expect(statusReads).toBe(3);

    await vi.advanceTimersByTimeAsync(POLL_MS);
    await flush();

    expect(statusReads).toBe(3);
    unsubscribeA();
    unsubscribeB();
  });

  it('does not keep status polling while installing', async () => {
    vi.useFakeTimers();
    let statusReads = 0;
    vi.stubGlobal('fetch', vi.fn((route) => {
      if (route === '/api/update/settings') {
        return okJson({ autoCheckUpdates: false, updateMode: 'ask' });
      }
      if (route === '/api/update/status') {
        statusReads += 1;
        return okJson({ status: 'installing', latestVersion: '1.10.0' });
      }
      throw new Error(`Unexpected route ${route}`);
    }));

    const unsubscribe = subscribeUpdateController();
    await flush();

    await vi.advanceTimersByTimeAsync(POLL_MS * 3);
    await flush();

    expect(statusReads).toBe(1);
    unsubscribe();
  });

  it('reloads after restart when health reports the target version', async () => {
    vi.useFakeTimers();
    const reloadPage = vi.fn();
    let healthReads = 0;
    vi.stubGlobal('fetch', vi.fn((route, options = {}) => {
      if (route === '/api/update/settings') {
        return okJson({ autoCheckUpdates: false, updateMode: 'ask' });
      }
      if (route === '/api/update/status') {
        return okJson({ status: 'ready-to-restart', latestVersion: '1.10.0' });
      }
      if (route === '/api/update/restart' && options.method === 'POST') {
        return okJson({ status: 'restarting' });
      }
      if (route === '/api/health') {
        healthReads += 1;
        return healthReads === 1
          ? Promise.reject(new Error('server restarting'))
          : okJson({ status: 'ok', version: 'v1.10.0' });
      }
      throw new Error(`Unexpected route ${route}`);
    }));

    const unsubscribe = subscribeUpdateController({ reloadPage });
    await flush();
    await restart();
    await flush();

    await vi.advanceTimersByTimeAsync(POLL_MS);
    await flush();
    expect(reloadPage).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(POLL_MS);
    await flush();
    expect(reloadPage).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('publishes restartDelayed when restart health keeps reporting the old version', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((route, options = {}) => {
      if (route === '/api/update/settings') {
        return okJson({ autoCheckUpdates: false, updateMode: 'ask' });
      }
      if (route === '/api/update/status') {
        return okJson({ status: 'ready-to-restart', latestVersion: '1.11.0' });
      }
      if (route === '/api/update/restart' && options.method === 'POST') {
        return okJson({ status: 'restarting' });
      }
      if (route === '/api/health') {
        return okJson({ status: 'ok', version: 'v1.10.0' });
      }
      throw new Error(`Unexpected route ${route}`);
    }));

    const unsubscribe = subscribeUpdateController({ reloadPage: vi.fn() });
    await flush();
    await restart();
    await flush();

    await vi.advanceTimersByTimeAsync(RESTART_DELAYED_MS);
    await flush();

    expect(getUpdateStatus()).toEqual(expect.objectContaining({
      status: 'installing',
      restartDelayed: true,
    }));
    unsubscribe();
  });

  it('wraps command actions and publishes failures through the store', async () => {
    let statusReads = 0;
    vi.stubGlobal('fetch', vi.fn((route, options = {}) => {
      if (route === '/api/update/check') {
        return okJson({ updateAvailable: true, latestVersion: '1.10.0' });
      }
      if (route === '/api/update/download' && options.method === 'POST') {
        return okJson({ status: 'downloading', progress: 0 });
      }
      if (route === '/api/update/cancel' && options.method === 'POST') {
        return okJson({ status: 'available', latestVersion: '1.10.0' });
      }
      if (route === '/api/update/status') {
        statusReads += 1;
        return statusReads === 1
          ? failJson('Network offline')
          : okJson({ status: 'downloading', progress: 0 });
      }
      throw new Error(`Unexpected route ${route}`);
    }));

    await check();
    expect(getUpdateStatus()).toEqual(expect.objectContaining({
      status: 'check-failed',
      error: 'Network offline',
    }));

    await download();
    expect(getUpdateStatus()).toEqual(expect.objectContaining({ status: 'downloading' }));

    await cancel();
    expect(getUpdateStatus()).toEqual(expect.objectContaining({ status: 'available' }));
  });

  it('tears down timers and subscribers for tests', async () => {
    vi.useFakeTimers();
    let snapshots = 0;
    vi.stubGlobal('fetch', vi.fn((route) => {
      if (route === '/api/update/settings') {
        return okJson({ autoCheckUpdates: true, updateMode: 'ask' });
      }
      if (route === '/api/update/check') {
        return okJson({ updateAvailable: false });
      }
      if (route === '/api/update/status') {
        return okJson({ status: 'downloading' });
      }
      throw new Error(`Unexpected route ${route}`);
    }));
    subscribeUpdateStatus(() => {
      snapshots += 1;
    });

    subscribeUpdateController();
    await flush();
    const statusReadsBeforeReset = globalThis.fetch.mock.calls
      .filter(([route]) => route === '/api/update/status').length;
    resetUpdateControllerForTesting();

    await vi.advanceTimersByTimeAsync(POLL_MS + 24 * 60 * 60 * 1000);
    await flush();

    expect(snapshots).toBeGreaterThan(0);
    expect(globalThis.fetch.mock.calls.filter(([route]) => route === '/api/update/status'))
      .toHaveLength(statusReadsBeforeReset);
    expect(versionsMatch('', '')).toBe(false);
    expect(versionsMatch('v1.10.0', '1.10.0')).toBe(true);
  });
});
