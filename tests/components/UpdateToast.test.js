// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UpdateToast } from '../../src/components/UpdateToast.js';
import {
  resetUpdateStatusForTesting,
  setUpdateStatus,
} from '../../src/data/updateStatusStore.js';

async function flush() {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  UpdateToast.destroy();
  resetUpdateStatusForTesting();
  document.body.replaceChildren();
});

describe('UpdateToast', () => {
  it('does not render when update capability is unsupported', () => {
    const onStatusChange = vi.fn();

    const root = UpdateToast.mount({
      health: { updateSupported: false },
      onStatusChange,
    });

    expect(root).toBeNull();
    expect(document.querySelector('.update-toast')).toBeNull();
    expect(onStatusChange).toHaveBeenCalledWith({ status: 'idle' });
  });

  it('renders an available update from the check/status endpoints', async () => {
    vi.stubGlobal('fetch', vi.fn((route) => {
      if (route === '/api/update/settings') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ autoCheckUpdates: true, updateMode: 'ask' }),
        });
      }
      if (route === '/api/update/check') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            updateAvailable: true,
            latestVersion: '1.10.0',
            releaseNotesUrl: 'https://example.test/release',
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          status: 'available',
          latestVersion: '1.10.0',
          releaseNotesUrl: 'https://example.test/release',
        }),
      });
    }));

    UpdateToast.mount({ health: { updateSupported: true } });
    await flush();

    const toast = document.querySelector('.update-toast');
    expect(toast.hidden).toBe(false);
    expect(toast.textContent).toContain('A new version is available');
    expect(toast.textContent).toContain('Install now');
    expect(toast.querySelector('.update-toast__version-chip')?.textContent).toBe('v1.10.0');
    expect(toast.querySelector('.update-toast__actions')?.parentElement).toBe(toast);
    expect(toast.querySelector('.update-toast__link').href).toBe('https://example.test/release');
  });

  it('does not check for updates on mount when auto-check is disabled', async () => {
    const fetchMock = vi.fn((route) => {
      if (route === '/api/update/settings') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ autoCheckUpdates: false, updateMode: 'ask' }),
        });
      }
      throw new Error(`Unexpected fetch ${route}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    UpdateToast.mount({ health: { updateSupported: true } });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/update/settings', undefined);
    expect(document.querySelector('.update-toast').hidden).toBe(true);
  });

  it('checks for updates every 24 hours when auto-check is enabled', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((route) => {
      if (route === '/api/update/settings') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ autoCheckUpdates: true, updateMode: 'ask' }),
        });
      }
      if (route === '/api/update/check') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ updateAvailable: false }),
        });
      }
      if (route === '/api/update/status') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'idle' }),
        });
      }
      throw new Error(`Unexpected fetch ${route}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    UpdateToast.mount({ health: { updateSupported: true } });
    await flush();

    expect(fetchMock).toHaveBeenCalledWith('/api/update/check', undefined);
    expect(fetchMock.mock.calls.filter(([route]) => route === '/api/update/check')).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    await flush();

    expect(fetchMock.mock.calls.filter(([route]) => route === '/api/update/check')).toHaveLength(2);
  });

  it('does not show an update-failed toast for background check failures', async () => {
    const onStatusChange = vi.fn();
    vi.stubGlobal('fetch', vi.fn((route) => {
      if (route === '/api/update/settings') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ autoCheckUpdates: true, updateMode: 'ask' }),
        });
      }
      if (route === '/api/update/check') {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: { message: 'Network offline' } }),
        });
      }
      throw new Error(`Unexpected route ${route}`);
    }));

    UpdateToast.mount({
      health: { updateSupported: true },
      onStatusChange,
    });
    await flush();

    expect(document.querySelector('.update-toast').hidden).toBe(true);
    expect(document.body.textContent).not.toContain('Update failed');
    expect(onStatusChange).toHaveBeenLastCalledWith(expect.objectContaining({
      status: 'check-failed',
      error: 'Network offline',
    }));
  });

  it('starts the download when Install now is clicked', async () => {
    const fetchMock = vi.fn((route) => {
      if (route === '/api/update/download') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'downloading', progress: 0 }),
        });
      }
      if (route === '/api/update/settings') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ autoCheckUpdates: true, updateMode: 'ask' }),
        });
      }
      if (route === '/api/update/check') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ updateAvailable: true, latestVersion: '1.10.0' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: 'available', latestVersion: '1.10.0' }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    UpdateToast.mount({ health: { updateSupported: true } });
    await flush();
    document.querySelector('.update-toast__button--primary').click();
    await flush();

    expect(fetchMock).toHaveBeenCalledWith('/api/update/download', { method: 'POST' });
    const progress = document.querySelector('.update-toast__progress');

    expect(progress.getAttribute('role')).toBe('progressbar');
    expect(progress.getAttribute('aria-label')).toBe('Update download progress');
    expect(progress.getAttribute('aria-valuenow')).toBe('0');
  });

  it('syncs terminal update status from the shared update store', async () => {
    vi.stubGlobal('fetch', vi.fn((route) => {
      if (route === '/api/update/settings') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ autoCheckUpdates: false, updateMode: 'ask' }),
        });
      }
      throw new Error(`Unexpected fetch ${route}`);
    }));

    UpdateToast.mount({ health: { updateSupported: true } });
    await flush();

    expect(document.querySelector('.update-toast').hidden).toBe(true);

    setUpdateStatus({ status: 'failed', error: 'Checksum verification failed.' });
    await flush();

    expect(document.body.textContent).toContain('Update failed');
    expect(document.body.textContent).toContain('Checksum verification failed.');
  });

  it('keeps polling while verification and extraction are in progress', async () => {
    vi.useFakeTimers();
    let statusReads = 0;
    vi.stubGlobal('fetch', vi.fn((route) => {
      if (route === '/api/update/settings') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ autoCheckUpdates: true, updateMode: 'ask' }),
        });
      }
      if (route === '/api/update/check') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ updateAvailable: true, latestVersion: '1.10.0' }),
        });
      }
      if (route === '/api/update/status') {
        statusReads += 1;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(
            statusReads === 1
              ? { status: 'verifying', progress: 100, latestVersion: '1.10.0' }
              : { status: 'ready-to-restart', latestVersion: '1.10.0' },
          ),
        });
      }
      return Promise.reject(new Error(`Unexpected route ${route}`));
    }));

    UpdateToast.mount({ health: { updateSupported: true } });
    await flush();

    expect(document.body.textContent).toContain('Verifying update');
    expect(document.body.textContent).not.toContain('Cancel');

    await vi.advanceTimersByTimeAsync(1000);
    await flush();

    expect(document.body.textContent).toContain('Restart to finish');
  });

  it('does not offer a second restart action after restart is accepted', async () => {
    const fetchMock = vi.fn((route, options = {}) => {
      if (route === '/api/update/settings') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ autoCheckUpdates: true, updateMode: 'ask' }),
        });
      }
      if (route === '/api/update/check') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ updateAvailable: true, latestVersion: '1.10.0' }),
        });
      }
      if (route === '/api/update/status') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'ready-to-restart', latestVersion: '1.10.0' }),
        });
      }
      if (route === '/api/update/restart' && options.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'restarting' }),
        });
      }
      throw new Error(`Unexpected fetch ${route}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    UpdateToast.mount({ health: { updateSupported: true } });
    await flush();
    document.querySelector('.update-toast__button--primary').click();
    await flush();

    const restartButtons = [...document.querySelectorAll('button')]
      .filter((button) => button.textContent === 'Restart to finish');

    expect(fetchMock.mock.calls.filter(([route]) => route === '/api/update/restart')).toHaveLength(1);
    expect(restartButtons).toHaveLength(0);
  });

  it('reloads after restart once the server is back online with the target version', async () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    let healthReads = 0;
    vi.stubGlobal('fetch', vi.fn((route, options = {}) => {
      if (route === '/api/update/settings') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ autoCheckUpdates: true, updateMode: 'ask' }),
        });
      }
      if (route === '/api/update/check') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ updateAvailable: true, latestVersion: '1.10.0' }),
        });
      }
      if (route === '/api/update/status') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'ready-to-restart', latestVersion: '1.10.0' }),
        });
      }
      if (route === '/api/update/restart' && options.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'restarting' }),
        });
      }
      if (route === '/api/health') {
        healthReads += 1;
        if (healthReads === 1) {
          return Promise.reject(new Error('server restarting'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'ok', version: 'v1.10.0' }),
        });
      }
      throw new Error(`Unexpected fetch ${route}`);
    }));

    UpdateToast.mount({
      health: { updateSupported: true },
      reloadPage: reload,
    });
    await flush();
    document.querySelector('.update-toast__button--primary').click();
    await flush();
    await vi.advanceTimersByTimeAsync(1000);
    await flush();

    expect(reload).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    await flush();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('shows a fallback message when restart polling keeps seeing the old version', async () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    vi.stubGlobal('fetch', vi.fn((route, options = {}) => {
      if (route === '/api/update/settings') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ autoCheckUpdates: true, updateMode: 'ask' }),
        });
      }
      if (route === '/api/update/check') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ updateAvailable: true, latestVersion: '1.11.0' }),
        });
      }
      if (route === '/api/update/status') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'ready-to-restart', latestVersion: '1.11.0' }),
        });
      }
      if (route === '/api/update/restart' && options.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'restarting' }),
        });
      }
      if (route === '/api/health') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'ok', version: 'v1.10.0' }),
        });
      }
      throw new Error(`Unexpected fetch ${route}`);
    }));

    UpdateToast.mount({
      health: { updateSupported: true },
      reloadPage: reload,
    });
    await flush();
    document.querySelector('.update-toast__button--primary').click();
    await flush();
    await vi.advanceTimersByTimeAsync(30_000);
    await flush();

    expect(reload).not.toHaveBeenCalled();
    expect(document.querySelector('.update-toast')?.textContent)
      .toContain('Alice is taking longer than expected to come back online.');
  });
});
