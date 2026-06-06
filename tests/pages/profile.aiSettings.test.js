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

vi.mock('../../src/services/llmParser.js', () => ({
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
import * as llmParser from '../../src/services/llmParser.js';
import { Toast } from '../../src/components/Toast.js';
import { Profile } from '../../src/pages/Profile.js';

afterEach(() => {
  Profile.unmount();
  document.body.replaceChildren();
  vi.clearAllMocks();
});

async function mountProfile(status = 'authenticated', overrides = {}) {
  Profile.unmount();
  authState.status = status;
  aiSettings.isEnabled.mockReturnValue(overrides.enabled ?? true);
  aiSettings.hasKey.mockReturnValue(overrides.hasKey ?? false);
  aiSettings.getKey.mockReturnValue(overrides.key ?? '');
  aiSettings.getModel.mockReturnValue('meta-llama/llama-3.3-70b-instruct:free');
  aiSettings.getFeature.mockImplementation((key) => key === 'cv');
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

function getSection(container, label) {
  return [...container.querySelectorAll('.section-card')]
    .find((section) => section.querySelector('.section-label')?.textContent === label);
}

function getButton(container, label) {
  return [...container.querySelectorAll('button')]
    .find((button) => button.textContent === label || button.getAttribute('aria-label') === label);
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
    expect(jdToggle.disabled).toBe(true);
    expect(compatToggle.disabled).toBe(true);
    expect(section.textContent).toContain('ENABLED FEATURES');
    expect(section.textContent).toContain('Coming soon');
    expect(section.textContent).toContain('Stored only in this browser');
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
    llmParser.validateKey.mockResolvedValue({ ok: true });
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

    expect(llmParser.validateKey).toHaveBeenCalledWith('sk-secret-value');
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
    llmParser.validateKey.mockResolvedValue({ ok: false, reason: 'invalid_key' });
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
