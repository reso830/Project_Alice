// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UpdateToast } from '../../src/components/UpdateToast.js';

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
});
