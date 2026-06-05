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

  it('stores, reads, and clears consent', () => {
    expect(aiSettings.hasConsent()).toBe(false);

    aiSettings.setConsent();

    expect(aiSettings.getConsent()).toBe('granted');
    expect(aiSettings.hasConsent()).toBe(true);

    aiSettings.clearConsent();

    expect(aiSettings.getConsent()).toBe('');
    expect(aiSettings.hasConsent()).toBe(false);
  });
});
