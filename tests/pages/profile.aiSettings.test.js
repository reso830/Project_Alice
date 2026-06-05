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
  clearConsent: vi.fn(),
  clearKey: vi.fn(),
  getKey: vi.fn(),
  hasConsent: vi.fn(),
  hasKey: vi.fn(),
  setKey: vi.fn(),
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
import { Toast } from '../../src/components/Toast.js';
import { Profile } from '../../src/pages/Profile.js';

afterEach(() => {
  Profile.unmount();
  document.body.replaceChildren();
  vi.clearAllMocks();
});

async function mountProfile(status = 'authenticated') {
  authState.status = status;
  const container = document.createElement('main');

  await Profile.mount(container, { navigate: vi.fn() });

  return container;
}

function getSection(container, label) {
  return [...container.querySelectorAll('.section-card')]
    .find((section) => section.querySelector('.section-label')?.textContent === label);
}

function getButton(container, label) {
  return [...container.querySelectorAll('button')]
    .find((button) => button.textContent === label);
}

describe('Profile — AI resume parsing settings', () => {
  it('renders key controls with a browser-only responsibility notice', async () => {
    aiSettings.hasKey.mockReturnValue(false);
    aiSettings.hasConsent.mockReturnValue(false);

    const container = await mountProfile();
    const section = getSection(container, 'AI RESUME PARSING');
    const input = section.querySelector('#ai-openrouter-key');

    expect(section).not.toBeNull();
    expect(section.querySelector('label[for="ai-openrouter-key"]')?.textContent)
      .toBe('OpenRouter API key');
    expect(input.type).toBe('password');
    expect(section.textContent).toContain('stored only in this browser');
    expect(section.textContent).toContain('your responsibility');
    expect(section.textContent).toContain('No key saved');
  });

  it('saves and clears the OpenRouter key without rendering it back in plaintext', async () => {
    aiSettings.getKey.mockReturnValue('sk-secret-value');
    aiSettings.hasKey.mockReturnValue(true);
    aiSettings.hasConsent.mockReturnValue(false);
    const container = await mountProfile();
    const section = getSection(container, 'AI RESUME PARSING');
    const input = section.querySelector('#ai-openrouter-key');

    expect(input.value).toBe('');
    expect(section.textContent).not.toContain('sk-secret-value');

    input.value = '  sk-new-key  ';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    getButton(section, 'Save Key').click();

    expect(aiSettings.setKey).toHaveBeenCalledWith('sk-new-key');
    expect(Toast.show).toHaveBeenCalledWith('AI resume parsing key saved.', 'success');

    getButton(section, 'Clear Key').click();

    expect(aiSettings.clearKey).toHaveBeenCalledTimes(1);
    expect(Toast.show).toHaveBeenCalledWith('AI resume parsing key cleared.', 'success');
  });

  it('shows and clears consent status', async () => {
    aiSettings.hasKey.mockReturnValue(true);
    aiSettings.hasConsent.mockReturnValue(true);
    const container = await mountProfile();
    const section = getSection(container, 'AI RESUME PARSING');

    expect(section.textContent).toContain('Consent granted');

    getButton(section, 'Clear Consent').click();

    expect(aiSettings.clearConsent).toHaveBeenCalledTimes(1);
    expect(Toast.show).toHaveBeenCalledWith('AI resume parsing consent cleared.', 'success');
  });

  it('shows a non-interactive demo note', async () => {
    const container = await mountProfile('demo');
    const section = getSection(container, 'AI RESUME PARSING');

    expect(section.textContent).toContain('AI resume parsing is available after signing in.');
    expect(section.querySelector('input')).toBeNull();
    expect(getButton(section, 'Save Key')).toBeUndefined();
    expect(aiSettings.setKey).not.toHaveBeenCalled();
  });
});
