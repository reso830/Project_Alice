import process from 'node:process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertHostedFrontendEnv } from '../../vite.config.js';

const VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_AUTH_EMAIL_REDIRECT_URL',
];

const ORIGINAL_ENV = { ...process.env };

function clearViteEnv() {
  for (const key of VARS) delete process.env[key];
}

function setAllViteEnv() {
  process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
  process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';
  process.env.VITE_AUTH_EMAIL_REDIRECT_URL = 'http://localhost:5173/?auth=callback';
}

function runConfigHook(mode) {
  const plugin = assertHostedFrontendEnv();
  return plugin.config({}, { mode });
}

describe('assertHostedFrontendEnv', () => {
  beforeEach(() => {
    clearViteEnv();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('does not throw in development mode when vars are missing', () => {
    expect(() => runConfigHook('development')).not.toThrow();
  });

  it('does not throw in test mode when vars are missing', () => {
    expect(() => runConfigHook('test')).not.toThrow();
  });

  it('throws in production when VITE_SUPABASE_URL is missing', () => {
    setAllViteEnv();
    delete process.env.VITE_SUPABASE_URL;

    expect(() => runConfigHook('production')).toThrow(/VITE_SUPABASE_URL/);
  });

  it('throws in production when VITE_SUPABASE_ANON_KEY is missing', () => {
    setAllViteEnv();
    delete process.env.VITE_SUPABASE_ANON_KEY;

    expect(() => runConfigHook('production')).toThrow(/VITE_SUPABASE_ANON_KEY/);
  });

  it('throws in production when VITE_AUTH_EMAIL_REDIRECT_URL is missing', () => {
    setAllViteEnv();
    delete process.env.VITE_AUTH_EMAIL_REDIRECT_URL;

    expect(() => runConfigHook('production')).toThrow(
      /VITE_AUTH_EMAIL_REDIRECT_URL/,
    );
  });

  it('throws naming every missing var when several are absent', () => {
    expect(() => runConfigHook('production')).toThrow(
      /VITE_SUPABASE_URL.*VITE_SUPABASE_ANON_KEY.*VITE_AUTH_EMAIL_REDIRECT_URL/s,
    );
  });

  it('treats an empty-string var as missing in production', () => {
    setAllViteEnv();
    process.env.VITE_SUPABASE_URL = '';

    expect(() => runConfigHook('production')).toThrow(/VITE_SUPABASE_URL/);
  });

  it('does not throw in production when all vars are present', () => {
    setAllViteEnv();

    expect(() => runConfigHook('production')).not.toThrow();
  });
});
