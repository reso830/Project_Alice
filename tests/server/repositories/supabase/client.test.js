import process from 'node:process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createClient = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args) => createClient(...args),
}));

// Import after vi.mock so the mocked factory is used inside client.js.
const { createSupabaseClientForRequest } = await import(
  '../../../../server/repositories/supabase/client.js'
);

const SENTINEL_CLIENT = { __sentinel: 'supabase-client' };

const ORIGINAL_ENV = { ...process.env };

function setSupabaseEnv() {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon-key';
}

function clearSupabaseEnv() {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
}

describe('createSupabaseClientForRequest', () => {
  beforeEach(() => {
    createClient.mockReset();
    createClient.mockReturnValue(SENTINEL_CLIENT);
    process.env = { ...ORIGINAL_ENV };
    clearSupabaseEnv();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('constructs a client carrying the request Authorization header', () => {
    setSupabaseEnv();
    const req = {
      headers: { authorization: 'Bearer test.jwt.token' },
    };

    const client = createSupabaseClientForRequest(req);

    expect(client).toBe(SENTINEL_CLIENT);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
      {
        global: { headers: { Authorization: 'Bearer test.jwt.token' } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  });

  it('disables session persistence and auto-refresh', () => {
    setSupabaseEnv();
    const req = { headers: { authorization: 'Bearer x' } };

    createSupabaseClientForRequest(req);

    const opts = createClient.mock.calls[0][2];
    expect(opts.auth).toEqual({
      persistSession: false,
      autoRefreshToken: false,
    });
  });

  it('throws when the Authorization header is missing', () => {
    setSupabaseEnv();
    const req = { headers: {} };

    expect(() => createSupabaseClientForRequest(req)).toThrow(
      /Authorization header/,
    );
    expect(createClient).not.toHaveBeenCalled();
  });

  it('throws when req.headers is undefined', () => {
    setSupabaseEnv();
    const req = {};

    expect(() => createSupabaseClientForRequest(req)).toThrow(
      /Authorization header/,
    );
    expect(createClient).not.toHaveBeenCalled();
  });

  it('does not read SUPABASE_SERVICE_ROLE_KEY', () => {
    setSupabaseEnv();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-must-not-leak';
    const req = { headers: { authorization: 'Bearer x' } };

    createSupabaseClientForRequest(req);

    // Assert the service-role key never appears in any call argument.
    const args = createClient.mock.calls[0];
    const serialized = JSON.stringify(args);
    expect(serialized).not.toContain('service-role-must-not-leak');
  });

  it('does not cache — each call constructs a fresh client', () => {
    setSupabaseEnv();
    const req = { headers: { authorization: 'Bearer x' } };

    createSupabaseClientForRequest(req);
    createSupabaseClientForRequest(req);

    expect(createClient).toHaveBeenCalledTimes(2);
  });

  it('passes the bearer header verbatim — no JWT parsing or validation', () => {
    setSupabaseEnv();
    // Intentionally malformed; the factory must not inspect or rewrite it.
    const req = { headers: { authorization: 'NotEvenBearer garbled' } };

    createSupabaseClientForRequest(req);

    expect(createClient.mock.calls[0][2].global.headers.Authorization).toBe(
      'NotEvenBearer garbled',
    );
  });
});
