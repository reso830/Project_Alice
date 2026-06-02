import { describe, expect, it, vi } from 'vitest';
import { createSupabaseProfileRepository } from '../../../../server/repositories/supabase/profile.js';

const USER_ID = 'user-uuid-abc';

function makeSelectClient({
  profileRow = null,
  skillRows = [],
  profileError = null,
  skillError = null,
  rpcResult = { data: null, error: null },
} = {}) {
  const calls = [];

  const profileChain = {
    select: (...args) => {
      calls.push({ table: 'profile', method: 'select', args });
      return profileChain;
    },
    eq: (...args) => {
      calls.push({ table: 'profile', method: 'eq', args });
      return profileChain;
    },
    maybeSingle: (...args) => {
      calls.push({ table: 'profile', method: 'maybeSingle', args });
      return Promise.resolve({ data: profileRow, error: profileError });
    },
  };

  const skillChain = {
    select: (...args) => {
      calls.push({ table: 'profile_skill', method: 'select', args });
      return skillChain;
    },
    eq: (...args) => {
      calls.push({ table: 'profile_skill', method: 'eq', args });
      return skillChain;
    },
    order: (...args) => {
      calls.push({ table: 'profile_skill', method: 'order', args });
      return Promise.resolve({ data: skillRows, error: skillError });
    },
  };

  const client = {
    from: vi.fn((table) => {
      calls.push({ table, method: 'from', args: [table] });
      return table === 'profile_skill' ? skillChain : profileChain;
    }),
    rpc: vi.fn((...args) => {
      calls.push({ table: 'rpc', method: 'rpc', args });
      return Promise.resolve(rpcResult);
    }),
  };

  return { client, calls };
}

function callsOf(calls, table, method) {
  return calls.filter((call) => call.table === table && call.method === method);
}

describe('createSupabaseProfileRepository.get', () => {
  it('returns null when no row exists for this user', async () => {
    const { client, calls } = makeSelectClient();
    const repo = createSupabaseProfileRepository(client, USER_ID);

    expect(await repo.get()).toBeNull();

    expect(callsOf(calls, 'profile', 'eq').map((call) => call.args)).toContainEqual(['user_id', USER_ID]);
    expect(callsOf(calls, 'profile', 'maybeSingle')).toHaveLength(1);
    expect(callsOf(calls, 'profile_skill', 'from')).toHaveLength(0);
  });

  it('reads profile data and ordered skill rows, then returns embedded skills', async () => {
    const { client, calls } = makeSelectClient({
      profileRow: {
        data: {
          firstName: 'Ada',
          lastName: 'Lovelace',
          summary: 'Mathematician',
        },
      },
      skillRows: [
        { skill_name: 'Analytical Engine', proficiency: 5 },
        { skill_name: 'Documentation', proficiency: 4 },
      ],
    });
    const repo = createSupabaseProfileRepository(client, USER_ID);

    expect(await repo.get()).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      summary: 'Mathematician',
      skills: [
        { name: 'Analytical Engine', level: 5 },
        { name: 'Documentation', level: 4 },
      ],
    });

    expect(callsOf(calls, 'profile', 'select')[0].args[0]).toBe('data');
    expect(callsOf(calls, 'profile_skill', 'select')[0].args[0]).toBe('skill_name, proficiency');
    expect(callsOf(calls, 'profile_skill', 'eq')[0].args).toEqual(['user_id', USER_ID]);
    expect(callsOf(calls, 'profile_skill', 'order')[0].args).toEqual(['id', { ascending: true }]);
  });

  it('lazily migrates embedded skills through the RPC and returns the cleaned shape', async () => {
    const { client } = makeSelectClient({
      profileRow: {
        data: {
          firstName: 'Ada',
          lastName: 'Lovelace',
          summary: ' Legacy summary  ',
          skills: [
            { name: 'Analytical Engine', level: 5 },
            ' Documentation ',
            { name: 'documentation', level: 2 },
            { name: '  ', level: 3 },
          ],
        },
      },
    });
    const repo = createSupabaseProfileRepository(client, USER_ID);

    expect(await repo.get()).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      summary: ' Legacy summary  ',
      skills: [
        { name: 'Analytical Engine', level: 5 },
        { name: 'Documentation', level: 2 },
      ],
    });

    expect(client.rpc).toHaveBeenCalledWith('save_profile_with_skills', {
      p_data: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        summary: ' Legacy summary  ',
      },
      p_skills: [
        { name: 'Analytical Engine', level: 5 },
        { name: 'Documentation', level: 2 },
      ],
    });
  });

  it('throws profile, skill, and migration RPC errors', async () => {
    await expect(
      createSupabaseProfileRepository(
        makeSelectClient({ profileError: new Error('profile denied') }).client,
        USER_ID,
      ).get(),
    ).rejects.toThrow('profile denied');

    await expect(
      createSupabaseProfileRepository(
        makeSelectClient({
          profileRow: { data: { firstName: 'Ada' } },
          skillError: new Error('skill denied'),
        }).client,
        USER_ID,
      ).get(),
    ).rejects.toThrow('skill denied');

    await expect(
      createSupabaseProfileRepository(
        makeSelectClient({
          profileRow: { data: { firstName: 'Ada', skills: ['SQL'] } },
          rpcResult: { data: null, error: new Error('rpc denied') },
        }).client,
        USER_ID,
      ).get(),
    ).rejects.toThrow('rpc denied');
  });
});

describe('createSupabaseProfileRepository.upsert', () => {
  it('saves via save_profile_with_skills with split args and returns reassembled profile', async () => {
    const { client } = makeSelectClient({
      profileRow: {
        data: {
          firstName: 'Ada',
          lastName: 'Lovelace',
        },
      },
      skillRows: [
        { skill_name: 'Analytical Engine', proficiency: 5 },
        { skill_name: 'Documentation', proficiency: 4 },
      ],
    });
    const repo = createSupabaseProfileRepository(client, USER_ID);

    const result = await repo.upsert({
      firstName: ' Ada ',
      lastName: ' Lovelace ',
      skills: [
        { name: ' Analytical Engine ', level: 5 },
        { name: 'Documentation', level: 4 },
      ],
      user_id: 'spoofed',
    });

    expect(client.rpc).toHaveBeenCalledWith('save_profile_with_skills', {
      p_data: expect.objectContaining({
        firstName: 'Ada',
        lastName: 'Lovelace',
      }),
      p_skills: [
        { name: 'Analytical Engine', level: 5 },
        { name: 'Documentation', level: 4 },
      ],
    });
    expect(client.rpc.mock.calls[0][1].p_data).not.toHaveProperty('skills');
    expect(client.rpc.mock.calls[0][1].p_data).not.toHaveProperty('user_id');
    expect(result.skills).toEqual([
      { name: 'Analytical Engine', level: 5 },
      { name: 'Documentation', level: 4 },
    ]);
  });

  it('throws RPC errors', async () => {
    const { client } = makeSelectClient({
      rpcResult: { data: null, error: new Error('unique violation') },
    });
    const repo = createSupabaseProfileRepository(client, USER_ID);

    await expect(repo.upsert({ firstName: 'Ada' })).rejects.toThrow('unique violation');
  });
});
