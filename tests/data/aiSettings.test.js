import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class LocalStorageStub {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

let aiSettings;

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('localStorage', new LocalStorageStub());
  aiSettings = await import('../../src/data/aiSettings.js');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('aiSettings', () => {
  it('defaults to disabled AI features with CV ready when no prior settings exist', () => {
    expect(aiSettings.isEnabled()).toBe(false);
    expect(aiSettings.getModel()).toBe(aiSettings.DEFAULT_MODEL);
    expect(aiSettings.getFeature('cv')).toBe(true);
    expect(aiSettings.getFeature('jd')).toBe(false);
    expect(aiSettings.getFeature('compat')).toBe(false);
    expect(aiSettings.getConnectionStatus()).toBe('none');
  });

  it('stores and reads the master enabled state', () => {
    aiSettings.setEnabled(true);

    expect(aiSettings.isEnabled()).toBe(true);

    aiSettings.setEnabled(false);

    expect(aiSettings.isEnabled()).toBe(false);
  });

  it('stores and reads a trimmed OpenRouter key', () => {
    aiSettings.setKey('  sk-or-test  ');

    expect(aiSettings.getKey()).toBe('sk-or-test');
    expect(aiSettings.hasKey()).toBe(true);
  });

  it('treats empty and whitespace keys as not configured', () => {
    aiSettings.setKey('   ');

    expect(aiSettings.getKey()).toBe('');
    expect(aiSettings.hasKey()).toBe(false);
  });

  it('clears the stored key', () => {
    aiSettings.setKey('sk-or-test');
    aiSettings.clearKey();

    expect(aiSettings.getKey()).toBe('');
    expect(aiSettings.hasKey()).toBe(false);
  });

  it('treats saving a key as consent and keeps legacy consent helpers as derived aliases', () => {
    expect(aiSettings.hasConsent()).toBe(false);

    aiSettings.setKey('sk-or-test');

    expect(aiSettings.getConsent()).toBe('granted');
    expect(aiSettings.hasConsent()).toBe(true);

    aiSettings.clearConsent();

    expect(aiSettings.getConsent()).toBe('');
    expect(aiSettings.hasConsent()).toBe(false);
    expect(aiSettings.hasKey()).toBe(false);
  });

  it('stores and reads a free-text model with a default for blank values', () => {
    aiSettings.setModel('  anthropic/claude-sonnet-4  ');

    expect(aiSettings.getModel()).toBe('anthropic/claude-sonnet-4');

    aiSettings.setModel('   ');

    expect(aiSettings.getModel()).toBe(aiSettings.DEFAULT_MODEL);
  });

  it('stores and reads feature toggles for known features only', () => {
    aiSettings.setFeature('cv', false);
    aiSettings.setFeature('jd', true);
    aiSettings.setFeature('compat', true);

    expect(aiSettings.getFeature('cv')).toBe(false);
    expect(aiSettings.getFeature('jd')).toBe(true);
    expect(aiSettings.getFeature('compat')).toBe(true);
    expect(() => aiSettings.setFeature('other', true)).toThrow(/Unknown AI feature/);
    expect(() => aiSettings.getFeature('other')).toThrow(/Unknown AI feature/);
  });

  it('allows compatibility analysis only when AI, key, and compat feature are enabled', () => {
    expect(aiSettings.canUseCompatAnalysis()).toBe(false);

    aiSettings.setEnabled(true);
    aiSettings.setKey('sk-or-test');
    expect(aiSettings.canUseCompatAnalysis()).toBe(false);

    aiSettings.setFeature('compat', true);
    expect(aiSettings.canUseCompatAnalysis()).toBe(true);

    aiSettings.setEnabled(false);
    expect(aiSettings.canUseCompatAnalysis()).toBe(false);
  });

  it('derives connection status from key presence and transient test state', () => {
    expect(aiSettings.getConnectionStatus()).toBe('none');

    aiSettings.setKey('sk-or-test');

    expect(aiSettings.getConnectionStatus()).toBe('connected');
    expect(aiSettings.getConnectionStatus('testing')).toBe('testing');
    expect(aiSettings.getConnectionStatus('error')).toBe('error');
    expect(aiSettings.getConnectionStatus({ status: 'testing' })).toBe('testing');
    expect(aiSettings.getConnectionStatus({ ok: false })).toBe('error');
    expect(aiSettings.getConnectionStatus({ ok: true })).toBe('connected');
  });

  it('migrates a legacy key with granted consent to enabled AI settings once', async () => {
    localStorage.setItem('alice.ai.openrouterKey', 'sk-or-legacy');
    localStorage.setItem('alice.ai.consent', 'granted');
    vi.resetModules();

    aiSettings = await import('../../src/data/aiSettings.js');

    expect(aiSettings.isEnabled()).toBe(true);
    expect(aiSettings.getKey()).toBe('sk-or-legacy');
    expect(aiSettings.getModel()).toBe(aiSettings.DEFAULT_MODEL);
    expect(aiSettings.getFeature('cv')).toBe(true);
    expect(aiSettings.getFeature('jd')).toBe(false);
    expect(aiSettings.getFeature('compat')).toBe(false);

    aiSettings.setEnabled(false);
    vi.resetModules();
    aiSettings = await import('../../src/data/aiSettings.js');

    expect(aiSettings.isEnabled()).toBe(false);
    expect(aiSettings.getKey()).toBe('sk-or-legacy');
  });

  it('migrates a legacy key without consent to disabled AI settings', async () => {
    localStorage.setItem('alice.ai.openrouterKey', 'sk-or-legacy');
    vi.resetModules();

    aiSettings = await import('../../src/data/aiSettings.js');

    expect(aiSettings.isEnabled()).toBe(false);
    expect(aiSettings.getKey()).toBe('sk-or-legacy');
    expect(aiSettings.getFeature('cv')).toBe(true);
  });

  it('migrates an empty legacy browser to brand-new defaults', async () => {
    vi.resetModules();

    aiSettings = await import('../../src/data/aiSettings.js');

    expect(aiSettings.isEnabled()).toBe(false);
    expect(aiSettings.hasKey()).toBe(false);
    expect(aiSettings.getModel()).toBe(aiSettings.DEFAULT_MODEL);
    expect(aiSettings.getFeature('cv')).toBe(true);
  });
});
