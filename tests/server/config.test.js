import process from 'node:process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../server/config.js';

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.APP_RUNTIME;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.PORT;
}

function setHostedEnv(overrides = {}) {
  process.env.APP_RUNTIME = 'hosted';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe('loadConfig', () => {
  beforeEach(() => {
    resetEnv();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('defaults to local mode when APP_RUNTIME is absent', () => {
    expect(loadConfig()).toEqual({
      runtime: 'local',
      isHosted: false,
      isDemo: false,
      port: 3001,
      supabase: null,
    });
  });

  it('uses local mode explicitly', () => {
    process.env.APP_RUNTIME = 'local';

    expect(loadConfig()).toMatchObject({
      runtime: 'local',
      isHosted: false,
      isDemo: false,
      supabase: null,
    });
  });

  it('loads hosted mode when all hosted variables are present', () => {
    setHostedEnv();

    expect(loadConfig()).toEqual({
      runtime: 'hosted',
      isHosted: true,
      isDemo: false,
      port: 3001,
      supabase: {
        url: 'https://example.supabase.co',
        anonKey: 'anon-key',
        serviceRoleKey: 'service-role-key',
      },
    });
  });

  it('accepts demo mode without requiring any hosted env vars', () => {
    process.env.APP_RUNTIME = 'demo';

    expect(loadConfig()).toEqual({
      runtime: 'demo',
      isHosted: false,
      isDemo: true,
      port: 3001,
      supabase: null,
    });
  });

  it('demo mode ignores hosted env vars when they happen to be set', () => {
    setHostedEnv({ APP_RUNTIME: 'demo' });

    expect(loadConfig()).toMatchObject({
      runtime: 'demo',
      isHosted: false,
      isDemo: true,
      supabase: null,
    });
  });

  it('rejects hosted mode when SUPABASE_URL is missing', () => {
    setHostedEnv({ SUPABASE_URL: undefined });

    expect(() => loadConfig()).toThrow(/SUPABASE_URL/);
  });

  it('rejects hosted mode when SUPABASE_ANON_KEY is missing', () => {
    setHostedEnv({ SUPABASE_ANON_KEY: undefined });

    expect(() => loadConfig()).toThrow(/SUPABASE_ANON_KEY/);
  });

  it('rejects hosted mode when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
    setHostedEnv({ SUPABASE_SERVICE_ROLE_KEY: undefined });

    expect(() => loadConfig()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('rejects an invalid runtime value', () => {
    process.env.APP_RUNTIME = 'production';

    expect(() => loadConfig()).toThrow(/Invalid APP_RUNTIME.*production/);
  });

  it('error message lists all valid runtimes including demo', () => {
    process.env.APP_RUNTIME = 'staging';

    expect(() => loadConfig()).toThrow(/local.*hosted.*demo/);
  });

  it('returns a frozen config object', () => {
    const config = loadConfig();

    expect(Object.isFrozen(config)).toBe(true);
    expect(() => {
      config.runtime = 'hosted';
    }).toThrow();
    expect(config.runtime).toBe('local');
  });

  it('ignores hosted variables in local mode', () => {
    setHostedEnv({ APP_RUNTIME: 'local' });

    expect(loadConfig()).toMatchObject({
      runtime: 'local',
      isHosted: false,
      supabase: null,
    });
  });

  it('treats an empty SUPABASE_URL as missing in hosted mode', () => {
    setHostedEnv({ SUPABASE_URL: '' });

    expect(() => loadConfig()).toThrow(/SUPABASE_URL/);
  });
});
