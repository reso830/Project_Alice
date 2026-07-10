// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const authState = { status: 'authenticated' };

vi.mock('../../src/data/authStore.js', () => ({
  DEMO_STATUS: 'demo',
  getAuthState: () => authState,
  signOut: vi.fn(),
  setAuthNotice: vi.fn(),
}));

vi.mock('../../src/data/aiSettings.js', () => ({
  clearKey: vi.fn(),
  getConnectionStatus: vi.fn(),
  getFeature: vi.fn(),
  getKey: vi.fn(),
  getModel: vi.fn(),
  hasKey: vi.fn(),
  isEnabled: vi.fn(),
  setEnabled: vi.fn(),
  setFeature: vi.fn(),
  setKey: vi.fn(),
  setModel: vi.fn(),
}));

vi.mock('../../src/services/aiService.js', () => ({
  validateKey: vi.fn(),
}));

vi.mock('../../src/services/api.js', () => ({
  deleteAccount: vi.fn(),
  getAll: vi.fn().mockResolvedValue([]),
  getProfile: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../src/components/Toast.js', () => ({
  Toast: {
    show: vi.fn(),
  },
}));

import * as aiSettings from '../../src/data/aiSettings.js';
import * as aiService from '../../src/services/aiService.js';
import { Toast } from '../../src/components/Toast.js';
import { UpdateToast } from '../../src/components/UpdateToast.js';
import { Profile } from '../../src/pages/Profile.js';
import { resetUpdateControllerForTesting } from '../../src/data/updateController.js';
import {
  resetUpdateStatusForTesting,
  setUpdateStatus,
} from '../../src/data/updateStatusStore.js';

afterEach(() => {
  vi.useRealTimers();
  UpdateToast.destroy();
  Profile.unmount();
  resetUpdateControllerForTesting();
  resetUpdateStatusForTesting();
  document.body.replaceChildren();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

async function mountProfile(status = 'authenticated', overrides = {}) {
  Profile.unmount();
  authState.status = status;
  aiSettings.isEnabled.mockReturnValue(overrides.enabled ?? true);
  aiSettings.hasKey.mockReturnValue(overrides.hasKey ?? false);
  aiSettings.getKey.mockReturnValue(overrides.key ?? '');
  aiSettings.getModel.mockReturnValue('meta-llama/llama-3.3-70b-instruct:free');
  aiSettings.getFeature.mockImplementation((key) => {
    const features = overrides.features ?? { cv: true, jd: false, compat: false };

    return Boolean(features[key]);
  });
  aiSettings.getConnectionStatus.mockImplementation((state) => {
    if (state === 'testing') {
      return 'testing';
    }
    if (state === 'error') {
      return 'error';
    }
    return aiSettings.hasKey() ? 'connected' : 'none';
  });
  const container = document.createElement('main');

  document.body.append(container);
  await Profile.mount(container, { navigate: vi.fn(), ...overrides.mountOptions });

  return container;
}

async function flushPromises(count = 20) {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
}

function getSection(container, label) {
  return [...container.querySelectorAll('.section-card')]
    .find((section) => section.querySelector('.section-label')?.textContent === label);
}

function getButton(container, label) {
  return [...container.querySelectorAll('button')]
    .find((button) => button.textContent === label || button.getAttribute('aria-label') === label);
}

function getFeatureItem(section, key) {
  return section.querySelector(`[data-ai-feature="${key}"]`)?.closest('.feat-item');
}

describe('Profile — AI resume parsing settings', () => {
  it('renders one unified Settings card with AI and Account sub-groups', async () => {
    let container = await mountProfile();
    const settingsCards = [...container.querySelectorAll('.section-card')]
      .filter((section) => section.querySelector('.section-label')?.textContent === 'SETTINGS');
    const settings = settingsCards[0];

    expect(settingsCards).toHaveLength(1);
    expect(getSection(container, 'AI RESUME PARSING')).toBeUndefined();
    expect(getSection(container, 'ACCOUNT')).toBeUndefined();
    expect(settings.textContent).toContain('ARTIFICIAL INTELLIGENCE');
    expect(settings.textContent).toContain('ACCOUNT');
    expect(settings.querySelector('.account-section__btn')?.textContent).toBe('Delete account');
  });

  it('renders enabled AI controls with model and feature toggles', async () => {
    let container = await mountProfile();
    const section = getSection(container, 'SETTINGS');
    const keyInput = section.querySelector('#ai-openrouter-key');
    const modelInput = section.querySelector('#ai-model-slug');
    const cvToggle = section.querySelector('[data-ai-feature="cv"]');
    const jdToggle = section.querySelector('[data-ai-feature="jd"]');
    const compatToggle = section.querySelector('[data-ai-feature="compat"]');

    expect(section.querySelector('.ai-body')?.getAttribute('aria-disabled')).toBe('false');
    expect(section.querySelector('.conn-status')?.textContent).toContain('Not connected');
    expect(section.querySelector('label[for="ai-openrouter-key"]')?.textContent).toBe('OpenRouter API key');
    expect(keyInput.type).toBe('password');
    expect(modelInput.value).toBe('meta-llama/llama-3.3-70b-instruct:free');
    expect(modelInput.getAttribute('list')).toBeNull();
    expect(section.querySelector('#ai-model-suggestions')).toBeNull();
    expect(section.textContent).toContain('Any OpenRouter model slug');
    expect(cvToggle.getAttribute('aria-pressed')).toBe('true');
    expect(cvToggle.disabled).toBe(false);
    expect(jdToggle.disabled).toBe(false);
    expect(compatToggle.disabled).toBe(false);
    expect(section.textContent).toContain('ENABLED FEATURES');
    expect(getFeatureItem(section, 'jd').textContent).not.toContain('Coming soon');
    expect(getFeatureItem(section, 'compat').textContent).not.toContain('Coming soon');
    expect(section.textContent).toContain('Stored only in this browser');
  });

  it('lets users toggle job-description parsing and compatibility analysis', async () => {
    const features = { cv: true, jd: false, compat: false };

    aiSettings.setFeature.mockImplementation((key, value) => {
      features[key] = value;
    });

    const container = await mountProfile('authenticated', { features });
    const section = getSection(container, 'SETTINGS');
    const jdToggle = section.querySelector('[data-ai-feature="jd"]');
    const compatToggle = section.querySelector('[data-ai-feature="compat"]');

    expect(jdToggle.disabled).toBe(false);
    expect(jdToggle.getAttribute('aria-pressed')).toBe('false');
    expect(getFeatureItem(section, 'jd').classList.contains('is-disabled')).toBe(false);
    expect(getFeatureItem(section, 'jd').textContent).not.toContain('Coming soon');

    jdToggle.click();

    expect(aiSettings.setFeature).toHaveBeenCalledWith('jd', true);
    expect(section.querySelector('[data-ai-feature="jd"]').getAttribute('aria-pressed')).toBe('true');
    expect(compatToggle.disabled).toBe(false);
    expect(compatToggle.getAttribute('aria-pressed')).toBe('false');
    expect(getFeatureItem(section, 'compat').classList.contains('is-disabled')).toBe(false);
    expect(getFeatureItem(section, 'compat').textContent).not.toContain('Coming soon');

    compatToggle.click();

    expect(aiSettings.setFeature).toHaveBeenCalledWith('compat', true);
    expect(section.querySelector('[data-ai-feature="compat"]').getAttribute('aria-pressed')).toBe('true');
  });

  it('gates the AI body when the master toggle is off', async () => {
    const container = await mountProfile('authenticated', { enabled: false });
    const section = getSection(container, 'SETTINGS');
    const master = section.querySelector('.master-row .sw');
    const aiBody = section.querySelector('.ai-body');
    const cvToggle = section.querySelector('[data-ai-feature="cv"]');
    const saveKey = getButton(section, 'Save key');

    expect(master.getAttribute('aria-pressed')).toBe('false');
    expect(aiBody.getAttribute('aria-disabled')).toBe('true');
    expect(aiBody.hasAttribute('inert')).toBe(true);
    expect(cvToggle.closest('[inert]')).toBe(aiBody);
    expect(saveKey.closest('[inert]')).toBe(aiBody);

    master.click();

    expect(aiSettings.setEnabled).toHaveBeenCalledWith(true);
  });

  it('saves, reveals, tests, replaces, and deletes the OpenRouter key', async () => {
    aiSettings.hasKey.mockReturnValue(false);
    aiService.validateKey.mockResolvedValue({ ok: true });
    let container = await mountProfile();
    const section = getSection(container, 'SETTINGS');
    const input = section.querySelector('#ai-openrouter-key');

    input.value = '  sk-new-key  ';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    getButton(section, 'Save key').click();

    expect(aiSettings.setKey).toHaveBeenCalledWith('sk-new-key');
    expect(Toast.show).toHaveBeenCalledWith('AI key saved.', 'success');

    aiSettings.getConnectionStatus.mockReturnValue('connected');
    container = await mountProfile('authenticated', { hasKey: true, key: 'sk-secret-value' });

    expect(container.textContent).not.toContain('sk-secret-value');
    getButton(container, 'Show key').click();
    expect(container.textContent).toContain('sk-secret-value');

    getButton(container, 'Test').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(aiService.validateKey).toHaveBeenCalledWith('sk-secret-value');
    expect(container.textContent).toContain('Connected');

    getButton(container, 'Delete').click();

    expect(aiSettings.clearKey).toHaveBeenCalledTimes(1);
    expect(Toast.show).toHaveBeenCalledWith('AI key deleted.', 'success');

    container = await mountProfile('authenticated', { hasKey: true, key: 'sk-secret-value' });
    getButton(container, 'Replace').click();
    expect(container.querySelector('#ai-openrouter-key')).not.toBeNull();
  });

  it('shows key invalid status when Test fails', async () => {
    aiSettings.getConnectionStatus.mockReturnValue('connected');
    aiService.validateKey.mockResolvedValue({ ok: false, reason: 'invalid_key' });
    const container = await mountProfile('authenticated', { hasKey: true, key: 'sk-secret-value' });

    getButton(container, 'Test').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(container.textContent).toContain('Key invalid');
  });

  it('keeps Settings visible in demo mode with a read-only AI notice', async () => {
    const container = await mountProfile('demo');
    const section = getSection(container, 'SETTINGS');

    expect(section).not.toBeNull();
    expect(section.textContent).toContain('ARTIFICIAL INTELLIGENCE');
    expect(section.textContent).toContain("AI and Smart features aren't available in the demo.");
    expect(section.textContent).toContain('They are available when using Alice with a real local or hosted profile.');
    expect(section.textContent).not.toContain('AI features');
    expect(section.querySelector('#ai-openrouter-key')).toBeNull();
    expect(section.querySelector('#ai-model-slug')).toBeNull();
    expect(section.querySelector('.ai-demo-note')).not.toBeNull();
    expect(section.querySelector('.account-section--demo')).not.toBeNull();
    expect(section.textContent).toContain("Account management isn't available in the demo.");
    expect(section.querySelector('.account-section__btn')).toBeNull();
  });

  it('hides the Updates subgroup when updates are unsupported', async () => {
    const container = await mountProfile('authenticated', {
      mountOptions: { health: { runtime: 'hosted', updateSupported: false } },
    });
    const section = getSection(container, 'SETTINGS');

    expect(section.textContent).toContain('ARTIFICIAL INTELLIGENCE');
    expect(section.textContent).toContain('ACCOUNT');
    expect(section.textContent).not.toContain('UPDATES');
  });

  it('renders update settings and persists toggle/mode changes when supported', async () => {
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url === '/api/update/settings' && !options.method) {
        return {
          ok: true,
          json: async () => ({ autoCheckUpdates: true, updateMode: 'ask' }),
        };
      }
      if (url === '/api/update/settings' && options.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            settings: JSON.parse(options.body),
          }),
        };
      }
      if (url === '/api/update/check') {
        return {
          ok: true,
          json: async () => ({ updateAvailable: false }),
        };
      }
      if (url === '/api/update/status') {
        return {
          ok: true,
          json: async () => ({ status: 'idle', currentVersion: 'v1.9.0' }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const container = await mountProfile('authenticated', {
      mountOptions: { health: { runtime: 'local', updateSupported: true, version: '1.9.0' } },
    });
    await flushPromises();
    const section = getSection(container, 'SETTINGS');

    expect(section.textContent).toContain('UPDATES');
    expect(section.textContent).toContain('Current version');
    expect(section.querySelector('.update-settings__version-chip')?.textContent).toBe('v1.13.1');
    expect(section.textContent).not.toContain('vv1.13.1');
    const modeSummary = section.querySelector('.update-mode__summary');
    modeSummary.click();
    expect(section.querySelector('.update-mode__summary').getAttribute('aria-expanded')).toBe('true');
    expect(section.querySelector('.update-mode__cards').getAttribute('role')).toBe('radiogroup');
    expect(section.querySelector('[data-update-mode="ask"]').getAttribute('aria-checked')).toBe('true');

    section.querySelector('[data-update-mode="ask"]').focus();
    section.querySelector('[data-update-mode="ask"]').dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
    }));
    expect(document.activeElement).toBe(section.querySelector('[data-update-mode="notify"]'));

    section.querySelector('[data-update-mode="notify"]').click();
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith('/api/update/settings', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ autoCheckUpdates: true, updateMode: 'notify' }),
    }));

    section.querySelector('.update-settings__auto-row .sw').click();
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith('/api/update/settings', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ autoCheckUpdates: false, updateMode: 'notify' }),
    }));
    expect(section.querySelector('.update-mode').classList.contains('is-disabled')).toBe(true);
    expect(section.querySelector('.update-mode__summary').disabled).toBe(true);
  });

  it('ignores stale update settings save responses', async () => {
    const saves = [];
    const events = [];
    const onSettingsChanged = (event) => events.push(event.detail);
    globalThis.addEventListener('alice-update-settings-changed', onSettingsChanged);
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url === '/api/update/settings' && !options.method) {
        return {
          ok: true,
          json: async () => ({ autoCheckUpdates: true, updateMode: 'ask' }),
        };
      }
      if (url === '/api/update/settings' && options.method === 'POST') {
        return new Promise((resolve) => {
          saves.push({
            settings: JSON.parse(options.body),
            resolve: () => resolve({
              ok: true,
              json: async () => ({ success: true }),
            }),
          });
        });
      }
      if (url === '/api/update/status') {
        return {
          ok: true,
          json: async () => ({ status: 'idle', currentVersion: 'v1.9.0' }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const container = await mountProfile('authenticated', {
        mountOptions: { health: { runtime: 'local', updateSupported: true, version: '1.9.0' } },
      });
      await flushPromises();
      const section = getSection(container, 'SETTINGS');

      section.querySelector('.update-mode__summary').click();
      section.querySelector('[data-update-mode="notify"]').click();
      section.querySelector('.update-settings__auto-row .sw').click();

      expect(saves.map((save) => save.settings)).toEqual([
        { autoCheckUpdates: true, updateMode: 'notify' },
        { autoCheckUpdates: false, updateMode: 'notify' },
      ]);

      saves[1].resolve();
      await flushPromises(6);

      expect(events).toEqual([{ autoCheckUpdates: false, updateMode: 'notify' }]);
      expect(section.querySelector('.update-mode').classList.contains('is-disabled')).toBe(true);

      saves[0].resolve();
      await flushPromises(6);

      expect(events).toEqual([{ autoCheckUpdates: false, updateMode: 'notify' }]);
      expect(section.querySelector('.update-mode').classList.contains('is-disabled')).toBe(true);
    } finally {
      globalThis.removeEventListener('alice-update-settings-changed', onSettingsChanged);
    }
  });

  it('renders connection error state when manual update checks fail', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url === '/api/update/settings') {
        return {
          ok: true,
          json: async () => ({ autoCheckUpdates: false, updateMode: 'ask' }),
        };
      }
      if (url === '/api/update/check') {
        return {
          ok: false,
          json: async () => ({ error: { message: 'Network offline' } }),
        };
      }
      if (url === '/api/update/status') {
        return {
          ok: true,
          json: async () => ({ status: 'idle', currentVersion: 'v1.9.0' }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    }));
    const container = await mountProfile('authenticated', {
      mountOptions: { health: { runtime: 'local', updateSupported: true } },
    });
    await flushPromises();

    getButton(container, 'Check now').click();
    await flushPromises();

    expect(container.textContent).toContain('Check failed');
    expect(container.textContent).toContain('Connection Error');
    expect(container.textContent).toContain('Network offline');
  });

  it('hydrates background check failures as connection errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url === '/api/update/settings') {
        return {
          ok: true,
          json: async () => ({ autoCheckUpdates: true, updateMode: 'ask' }),
        };
      }
      if (url === '/api/update/status') {
        return {
          ok: true,
          json: async () => ({
            status: 'check-failed',
            currentVersion: 'v1.9.0',
            error: 'Network offline',
          }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    }));

    const container = await mountProfile('authenticated', {
      mountOptions: { health: { runtime: 'local', updateSupported: true } },
    });
    await flushPromises();

    expect(container.textContent).toContain('Check failed');
    expect(container.textContent).toContain('Connection Error');
    expect(container.textContent).toContain('Network offline');
    expect(getButton(container, 'Retry Download')).toBeUndefined();
  });

  it('renders update failed state and retry when download fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      if (url === '/api/update/settings') {
        return {
          ok: true,
          json: async () => ({ autoCheckUpdates: true, updateMode: 'ask' }),
        };
      }
      if (url === '/api/update/check') {
        return {
          ok: true,
          json: async () => ({
            updateAvailable: true,
            currentVersion: '1.9.0',
            latestVersion: '1.10.0',
            releaseNotesUrl: 'https://example.test/release',
          }),
        };
      }
      if (url === '/api/update/download' && options.method === 'POST') {
        return {
          ok: false,
          json: async () => ({ error: { message: 'Checksum verification failed.' } }),
        };
      }
      if (url === '/api/update/status') {
        return {
          ok: true,
          json: async () => ({ status: 'idle', currentVersion: 'v1.9.0' }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    }));
    const container = await mountProfile('authenticated', {
      mountOptions: { health: { runtime: 'local', updateSupported: true } },
    });
    await flushPromises();

    getButton(container, 'Check now').click();
    await flushPromises();
    getButton(container, 'Install').click();
    await flushPromises();

    expect(container.textContent).toContain('Update failed');
    expect(container.textContent).toContain('Update Failed');
    expect(container.textContent).toContain('Checksum verification failed.');
    expect(getButton(container, 'Retry Download')).not.toBeNull();
  });

  it('syncs terminal update status from the shared update store', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url === '/api/update/settings') {
        return {
          ok: true,
          json: async () => ({ autoCheckUpdates: true, updateMode: 'ask' }),
        };
      }
      if (url === '/api/update/status') {
        return {
          ok: true,
          json: async () => ({
            status: 'available',
            currentVersion: 'v1.9.0',
            latestVersion: 'v1.10.0',
          }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    }));

    const container = await mountProfile('authenticated', {
      mountOptions: { health: { runtime: 'local', updateSupported: true } },
    });
    await flushPromises();

    expect(container.textContent).toContain('Update available');

    setUpdateStatus({ status: 'failed', error: 'Checksum verification failed.' });
    await flushPromises();

    expect(container.textContent).toContain('Update failed');
    expect(container.textContent).toContain('Checksum verification failed.');
    expect(getButton(container, 'Retry Download')).not.toBeNull();
  });

  it('hydrates staged update status on mount', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url === '/api/update/settings') {
        return {
          ok: true,
          json: async () => ({ autoCheckUpdates: true, updateMode: 'ask' }),
        };
      }
      if (url === '/api/update/status') {
        return {
          ok: true,
          json: async () => ({
            status: 'ready-to-restart',
            currentVersion: 'v1.9.0',
            latestVersion: 'v1.10.0',
            progress: 100,
          }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    }));

    const container = await mountProfile('authenticated', {
      mountOptions: { health: { runtime: 'local', updateSupported: true } },
    });
    await flushPromises();

    expect(container.textContent).toContain('Restart to finish');
    expect(container.textContent).toContain('Restart to apply the update.');
  });

  it('does not offer cancel while verifying or extracting an update', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url === '/api/update/settings') {
        return {
          ok: true,
          json: async () => ({ autoCheckUpdates: true, updateMode: 'ask' }),
        };
      }
      if (url === '/api/update/status') {
        return {
          ok: true,
          json: async () => ({
            status: 'extracting',
            currentVersion: 'v1.9.0',
            latestVersion: 'v1.10.0',
            progress: 100,
          }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    }));

    const container = await mountProfile('authenticated', {
      mountOptions: { health: { runtime: 'local', updateSupported: true } },
    });
    await flushPromises();

    expect(container.textContent).toContain('Extracting');
    expect(getButton(container, 'Cancel')).toBeUndefined();
  });

  it('does not offer a second settings restart action after restart is accepted', async () => {
    vi.useFakeTimers();
    let healthReads = 0;
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      if (url === '/api/update/settings') {
        return {
          ok: true,
          json: async () => ({ autoCheckUpdates: true, updateMode: 'ask' }),
        };
      }
      if (url === '/api/update/status') {
        return {
          ok: true,
          json: async () => ({
            status: 'ready-to-restart',
            currentVersion: 'v1.9.0',
            latestVersion: 'v1.10.0',
            progress: 100,
          }),
        };
      }
      if (url === '/api/update/restart' && options.method === 'POST') {
        return {
          ok: true,
          json: async () => ({ status: 'restarting' }),
        };
      }
      if (url === '/api/health') {
        healthReads += 1;
        return {
          ok: true,
          json: async () => ({ version: 'v1.9.0' }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    }));

    const container = await mountProfile('authenticated', {
      mountOptions: { health: { runtime: 'local', updateSupported: true } },
    });
    await flushPromises();
    getButton(container, 'Restart to finish').click();
    await flushPromises();

    expect(getButton(container, 'Restart to finish')).toBeUndefined();
    expect(container.textContent).toContain('Restarting Alice');

    await vi.advanceTimersByTimeAsync(1000);
    await flushPromises();

    expect(healthReads).toBe(1);
  });

  it('polls update status while a download is in progress', async () => {
    vi.useFakeTimers();
    let statusReads = 0;
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      if (url === '/api/update/settings') {
        return {
          ok: true,
          json: async () => ({ autoCheckUpdates: false, updateMode: 'ask' }),
        };
      }
      if (url === '/api/update/check') {
        return {
          ok: true,
          json: async () => ({
            updateAvailable: true,
            currentVersion: 'v1.9.0',
            latestVersion: 'v1.10.0',
          }),
        };
      }
      if (url === '/api/update/download' && options.method === 'POST') {
        return {
          ok: true,
          json: async () => ({ status: 'downloading' }),
        };
      }
      if (url === '/api/update/status') {
        statusReads += 1;
        return {
          ok: true,
          json: async () => (statusReads < 3
            ? {
              status: statusReads === 1 ? 'idle' : 'downloading',
              currentVersion: 'v1.9.0',
              latestVersion: 'v1.10.0',
              progress: 20,
              secondsRemaining: 12,
            }
            : {
              status: 'ready-to-restart',
              currentVersion: 'v1.9.0',
              latestVersion: 'v1.10.0',
              progress: 100,
            }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    }));

    const container = await mountProfile('authenticated', {
      mountOptions: { health: { runtime: 'local', updateSupported: true } },
    });
    await flushPromises();

    getButton(container, 'Check now').click();
    await flushPromises();
    getButton(container, 'Install').click();
    await flushPromises(6);

    expect(container.textContent).toContain('Downloading');
    expect(container.textContent).toContain('20% · ~12s');
    const progress = container.querySelector('.update-settings__progress');

    expect(progress.getAttribute('role')).toBe('progressbar');
    expect(progress.getAttribute('aria-valuenow')).toBe('20');

    await vi.advanceTimersByTimeAsync(1000);
    await flushPromises();

    expect(container.textContent).toContain('Restart to finish');
    vi.useRealTimers();
  });

  it('uses one status poller when the toast and Profile Updates panel are both mounted', async () => {
    vi.useFakeTimers();
    let statusReads = 0;
    const fetchMock = vi.fn(async (url) => {
      if (url === '/api/update/settings') {
        return {
          ok: true,
          json: async () => ({ autoCheckUpdates: false, updateMode: 'ask' }),
        };
      }
      if (url === '/api/update/status') {
        statusReads += 1;
        return {
          ok: true,
          json: async () => (statusReads < 3
            ? {
              status: 'downloading',
              currentVersion: 'v1.9.0',
              latestVersion: 'v1.10.0',
              progress: statusReads * 25,
            }
            : {
              status: 'ready-to-restart',
              currentVersion: 'v1.9.0',
              latestVersion: 'v1.10.0',
              progress: 100,
            }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    UpdateToast.mount({ health: { updateSupported: true } });
    const container = await mountProfile('authenticated', {
      mountOptions: { health: { runtime: 'local', updateSupported: true } },
    });
    await flushPromises(8);

    expect(document.querySelector('.update-toast')?.textContent).toContain('Downloading update');
    expect(container.textContent).toContain('Downloading');
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/update/status')).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1000);
    await flushPromises(8);

    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/update/status')).toHaveLength(2);
    vi.useRealTimers();
  });

  it('scrolls and focuses Settings when requested by navigation options', async () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;

    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;

    const container = await mountProfile('authenticated', {
      mountOptions: { focusSettings: true },
    });
    const section = getSection(container, 'SETTINGS');

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(section.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(section);

    if (originalScrollIntoView) {
      window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    } else {
      delete window.HTMLElement.prototype.scrollIntoView;
    }
  });
});
