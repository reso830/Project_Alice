import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CLIENT_PATH = resolve(__dirname, '../../src/services/supabaseClient.js');

const createClientMock = vi.fn(() => ({ __mocked: true }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args) => createClientMock(...args),
}));

beforeEach(() => {
  createClientMock.mockClear();
  vi.resetModules();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('supabaseClient', () => {
  it('exports null when VITE_SUPABASE_URL is absent', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    vi.stubEnv('VITE_AUTH_EMAIL_REDIRECT_URL', '');

    const mod = await import('../../src/services/supabaseClient.js');

    expect(mod.supabase).toBeNull();
    expect(mod.isHostedAuthAvailable).toBe(false);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('exports null when VITE_SUPABASE_ANON_KEY is absent', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    vi.stubEnv('VITE_AUTH_EMAIL_REDIRECT_URL', '');

    const mod = await import('../../src/services/supabaseClient.js');

    expect(mod.supabase).toBeNull();
    expect(mod.isHostedAuthAvailable).toBe(false);
  });

  it('creates a client when both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are present', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubEnv(
      'VITE_AUTH_EMAIL_REDIRECT_URL',
      'https://example.com/?auth=callback',
    );

    const mod = await import('../../src/services/supabaseClient.js');

    expect(mod.supabase).not.toBeNull();
    expect(mod.isHostedAuthAvailable).toBe(true);
    expect(mod.emailRedirectUrl).toBe('https://example.com/?auth=callback');
    expect(createClientMock).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      },
    );
  });

  it('never references VITE_SUPABASE_SERVICE_ROLE_KEY in source', () => {
    const source = readFileSync(CLIENT_PATH, 'utf8');
    expect(source).not.toContain('VITE_SUPABASE_SERVICE_ROLE_KEY');
    expect(source).not.toContain('SERVICE_ROLE');
    expect(source).not.toContain('jwtSecret');
    expect(source).not.toContain('JWT_SECRET');
  });
});
