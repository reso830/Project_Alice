// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const authState = { status: 'authenticated' };

vi.mock('../../src/data/authStore.js', () => ({
  DEMO_STATUS: 'demo',
  getAuthState: () => authState,
  signOut: vi.fn().mockResolvedValue(undefined),
  setAuthNotice: vi.fn(),
}));

vi.mock('../../src/services/api.js', () => ({
  getAll: vi.fn().mockResolvedValue([]),
  getProfile: vi.fn().mockResolvedValue(null),
  deleteAccount: vi.fn(),
}));

import * as api from '../../src/services/api.js';
import * as authStore from '../../src/data/authStore.js';
import { Profile } from '../../src/pages/Profile.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  Profile.unmount();
  document.body.replaceChildren();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function accountButton(container) {
  return container.querySelector('.account-section__btn');
}

function getSection(container, label) {
  return [...container.querySelectorAll('.section-card')]
    .find((section) => section.querySelector('.section-label')?.textContent === label);
}

async function mountProfile(status, options = {}) {
  authState.status = status;
  const container = document.createElement('main');
  document.body.append(container);
  await Profile.mount(container, { navigate: vi.fn(), ...options });
  return container;
}

describe('Profile — Account section', () => {
  it('hosted: renders an enabled "Delete account" button', async () => {
    const container = await mountProfile('authenticated');
    const btn = accountButton(container);

    expect(getSection(container, 'SETTINGS')).not.toBeNull();
    expect(getSection(container, 'ACCOUNT')).toBeUndefined();
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe('Delete account');
    expect(btn.disabled).toBe(false);
  });

  it('local: renders a "Clear all data" button', async () => {
    const container = await mountProfile('local-mode');
    const btn = accountButton(container);

    expect(btn.textContent).toBe('Clear all data');
    expect(btn.disabled).toBe(false);
  });

  it('demo: renders account management as a warning note with no destructive button', async () => {
    const container = await mountProfile('demo');
    const btn = accountButton(container);
    const settings = getSection(container, 'SETTINGS');

    expect(btn).toBeNull();
    expect(settings.textContent).toContain("Account management isn't available in the demo.");
    expect(settings.textContent).toContain("AI and Smart features aren't available in the demo.");
    expect(document.querySelector('.delete-modal-backdrop')).toBeNull();
    expect(api.deleteAccount).not.toHaveBeenCalled();
  });

  it('hosted: clicking the button opens the confirmation modal', async () => {
    const container = await mountProfile('authenticated');
    accountButton(container).click();

    const backdrop = document.querySelector('.delete-modal-backdrop');
    expect(backdrop).not.toBeNull();
    expect(document.querySelector('.delete-modal__title').textContent).toContain('Delete account');

    // Close to clean up the modal's document keydown listener.
    document.querySelector('.delete-modal__btn--cancel').click();
  });

  it('hosted: confirming stages the success notice + signs out, with no immediate toast (FR-013)', async () => {
    api.deleteAccount.mockResolvedValue({ deleted: true });
    const container = await mountProfile('authenticated');
    accountButton(container).click();

    const input = document.querySelector('.delete-modal__input');
    input.value = 'pw';
    input.dispatchEvent(new Event('input'));
    document.querySelector('.delete-modal__btn--danger').click();
    await flush();

    expect(api.deleteAccount).toHaveBeenCalledWith({ password: 'pw' });
    // Confirmation is staged for the Welcome reroute, not shown now (it would
    // be wiped by the sign-out reroute clearing document.body).
    expect(authStore.setAuthNotice).toHaveBeenCalledWith('Account deleted.', 'success');
    expect(authStore.signOut).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.toast')).toBeNull();
  });

  it('local: clear all data remount keeps supported update controls visible', async () => {
    api.deleteAccount.mockResolvedValue({ deleted: true });
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
          json: async () => ({ status: 'idle', currentVersion: 'v1.9.0' }),
        };
      }
      if (url === '/api/update/check') {
        return {
          ok: true,
          json: async () => ({ updateAvailable: false }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    }));
    const container = await mountProfile('local-mode', {
      health: { runtime: 'local', updateSupported: true },
    });
    await flush();

    expect(getSection(container, 'SETTINGS').textContent).toContain('UPDATES');
    accountButton(container).click();
    const input = document.querySelector('.delete-modal__input');
    input.value = 'DELETE';
    input.dispatchEvent(new Event('input'));
    document.querySelector('.delete-modal__btn--danger').click();
    await flush();
    await flush();

    expect(api.deleteAccount).toHaveBeenCalledWith({ confirm: 'DELETE' });
    expect(getSection(container, 'SETTINGS').textContent).toContain('UPDATES');
    expect(getSection(container, 'SETTINGS').textContent).toContain('Current version');
    expect(getSection(container, 'SETTINGS').querySelector('.update-settings__version-chip')?.textContent).toBe('v1.11.1');
  });
});
