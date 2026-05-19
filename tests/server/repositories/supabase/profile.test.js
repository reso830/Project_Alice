import { describe, expect, it, vi } from 'vitest';
import { createSupabaseProfileRepository } from '../../../../server/repositories/supabase/profile.js';

const USER_ID = 'user-uuid-abc';

function makeChainMock(terminalValue) {
  const calls = [];
  const record = (method) => (...args) => {
    calls.push({ method, args });
    return chain;
  };
  const recordTerminal = (method) => (...args) => {
    calls.push({ method, args });
    return Promise.resolve(terminalValue);
  };
  const chain = {
    from: record('from'),
    select: record('select'),
    upsert: record('upsert'),
    eq: record('eq'),
    maybeSingle: recordTerminal('maybeSingle'),
    single: recordTerminal('single'),
  };
  return { chain, calls };
}

function makeClient(terminalValue) {
  const { chain, calls } = makeChainMock(terminalValue);
  const client = {
    from: vi.fn(() => {
      calls.push({ method: 'from', args: ['profile'] });
      return chain;
    }),
  };
  return { client, chain, calls };
}

function callsOf(calls, method) {
  return calls.filter((c) => c.method === method);
}

describe('createSupabaseProfileRepository.get', () => {
  it('returns null when no row exists for this user', async () => {
    const { client, calls } = makeClient({ data: null, error: null });
    const repo = createSupabaseProfileRepository(client, USER_ID);

    expect(await repo.get()).toBeNull();

    // user_id scoping enforced.
    const eqArgs = callsOf(calls, 'eq').map((c) => c.args);
    expect(eqArgs).toContainEqual(['user_id', USER_ID]);
    expect(callsOf(calls, 'maybeSingle')).toHaveLength(1);
  });

  it('parses JSON-stringified data (TEXT column shape)', async () => {
    const stored = JSON.stringify({
      firstName: 'Ada',
      lastName: 'Lovelace',
      summary: 'Mathematician',
    });
    const { client } = makeClient({
      data: { data: stored },
      error: null,
    });
    const repo = createSupabaseProfileRepository(client, USER_ID);

    expect(await repo.get()).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      summary: 'Mathematician',
    });
  });

  it('accepts pre-parsed data (JSONB column shape)', async () => {
    const preParsed = { firstName: 'Ada', lastName: 'Lovelace' };
    const { client } = makeClient({
      data: { data: preParsed },
      error: null,
    });
    const repo = createSupabaseProfileRepository(client, USER_ID);

    expect(await repo.get()).toEqual(preParsed);
  });

  it('returns null when data is malformed JSON', async () => {
    const { client } = makeClient({
      data: { data: 'not valid json' },
      error: null,
    });
    const repo = createSupabaseProfileRepository(client, USER_ID);
    expect(await repo.get()).toBeNull();
  });

  it('throws PostgREST errors', async () => {
    const { client } = makeClient({
      data: null,
      error: new Error('rls denied'),
    });
    const repo = createSupabaseProfileRepository(client, USER_ID);
    await expect(repo.get()).rejects.toThrow('rls denied');
  });

  it('does not select user_id (FR-017 invariant)', async () => {
    const { client, calls } = makeClient({ data: null, error: null });
    const repo = createSupabaseProfileRepository(client, USER_ID);
    await repo.get();

    const selectCall = callsOf(calls, 'select')[0];
    const projection = selectCall.args[0];
    expect(projection).not.toContain('user_id');
  });
});

describe('createSupabaseProfileRepository.upsert', () => {
  it('writes user_id from context, not from input', async () => {
    const { client, calls } = makeClient({
      data: { data: JSON.stringify({ firstName: 'Ada' }) },
      error: null,
    });
    const repo = createSupabaseProfileRepository(client, USER_ID);

    await repo.upsert({
      firstName: 'Ada',
      user_id: 'attacker-uuid', // would be dropped by normaliseProfile regardless
    });

    const upsertCall = callsOf(calls, 'upsert')[0];
    const row = upsertCall.args[0];

    expect(row.user_id).toBe(USER_ID);
    expect(row.user_id).not.toBe('attacker-uuid');
  });

  it('uses onConflict: user_id (one row per user invariant)', async () => {
    const { client, calls } = makeClient({
      data: { data: JSON.stringify({}) },
      error: null,
    });
    const repo = createSupabaseProfileRepository(client, USER_ID);
    await repo.upsert({ firstName: 'Ada' });

    const upsertCall = callsOf(calls, 'upsert')[0];
    const opts = upsertCall.args[1];
    expect(opts).toEqual({ onConflict: 'user_id' });
  });

  it('normalises and JSON-stringifies the profile blob', async () => {
    const { client, calls } = makeClient({
      data: { data: JSON.stringify({ firstName: 'Ada' }) },
      error: null,
    });
    const repo = createSupabaseProfileRepository(client, USER_ID);

    // Pass garbage fields alongside a valid one; normaliseProfile should
    // strip unknown fields like `random` and `user_id` before stringify.
    await repo.upsert({
      firstName: '  Ada  ',
      random: 'unknown-field',
      user_id: 'spoofed',
    });

    const row = callsOf(calls, 'upsert')[0].args[0];
    expect(typeof row.data).toBe('string');
    const parsed = JSON.parse(row.data);
    // cleanString trims firstName
    expect(parsed.firstName).toBe('Ada');
    // normaliseProfile drops unknown fields
    expect(parsed).not.toHaveProperty('random');
    expect(parsed).not.toHaveProperty('user_id');
  });

  it('sets updated_at to an ISO timestamp', async () => {
    const { client, calls } = makeClient({
      data: { data: JSON.stringify({}) },
      error: null,
    });
    const repo = createSupabaseProfileRepository(client, USER_ID);
    await repo.upsert({ firstName: 'Ada' });

    const row = callsOf(calls, 'upsert')[0].args[0];
    // ISO 8601 — YYYY-MM-DDTHH:MM:SS.sssZ
    expect(row.updated_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it('returns the parsed profile object (no user_id, no envelope)', async () => {
    const persisted = { firstName: 'Ada', lastName: 'Lovelace' };
    const { client } = makeClient({
      data: { data: JSON.stringify(persisted) },
      error: null,
    });
    const repo = createSupabaseProfileRepository(client, USER_ID);

    const result = await repo.upsert({
      firstName: 'Ada',
      lastName: 'Lovelace',
    });

    expect(result).toEqual(persisted);
    expect(result).not.toHaveProperty('user_id');
    expect(result).not.toHaveProperty('data');
  });

  it('throws PostgREST errors', async () => {
    const { client } = makeClient({
      data: null,
      error: new Error('unique violation'),
    });
    const repo = createSupabaseProfileRepository(client, USER_ID);
    await expect(repo.upsert({ firstName: 'Ada' })).rejects.toThrow(
      'unique violation',
    );
  });
});

describe('createSupabaseProfileRepository — response shape invariants', () => {
  it('get and upsert both project only PROFILE_COLUMNS_WITHOUT_USER_ID', async () => {
    // Get path
    const { client: getClient, calls: getCalls } = makeClient({
      data: null,
      error: null,
    });
    const repo1 = createSupabaseProfileRepository(getClient, USER_ID);
    await repo1.get();
    const getSelect = callsOf(getCalls, 'select')[0].args[0];
    expect(getSelect).toBe('data');

    // Upsert path
    const { client: upsertClient, calls: upsertCalls } = makeClient({
      data: { data: JSON.stringify({}) },
      error: null,
    });
    const repo2 = createSupabaseProfileRepository(upsertClient, USER_ID);
    await repo2.upsert({ firstName: 'Ada' });
    const upsertSelect = callsOf(upsertCalls, 'select')[0].args[0];
    expect(upsertSelect).toBe('data');
  });
});
