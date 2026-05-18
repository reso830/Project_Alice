import { beforeEach, describe, expect, it, vi } from 'vitest';

const createSupabaseClientForRequest = vi.fn();

vi.mock('../../../server/repositories/supabase/client.js', () => ({
  createSupabaseClientForRequest: (...args) =>
    createSupabaseClientForRequest(...args),
}));

const { seedHostedUserIfNeeded } = await import(
  '../../../server/auth/seedHostedUser.js'
);

function makeReq(overrides = {}) {
  return {
    user: { id: 'user-uuid-abc', email: 'test@example.com' },
    headers: { authorization: 'Bearer test.jwt.token' },
    ...overrides,
  };
}

function makeRpcMock(result) {
  // result: { data: boolean|null, error: object|null } OR a Promise/function
  // that resolves to the same shape, OR a function returning that.
  const rpc = vi.fn(() => Promise.resolve(result));
  createSupabaseClientForRequest.mockReturnValue({ rpc });
  return rpc;
}

describe('seedHostedUserIfNeeded', () => {
  beforeEach(() => {
    createSupabaseClientForRequest.mockReset();
  });

  describe('first authenticated call (RPC returns data:true)', () => {
    it('invokes claim_and_seed_starter once and calls next() with no args', async () => {
      const rpc = makeRpcMock({ data: true, error: null });
      const next = vi.fn();
      const req = makeReq();

      await seedHostedUserIfNeeded(req, {}, next);

      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith('claim_and_seed_starter');
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });

    it('constructs the Supabase client from the request', async () => {
      makeRpcMock({ data: true, error: null });
      const next = vi.fn();
      const req = makeReq();

      await seedHostedUserIfNeeded(req, {}, next);

      expect(createSupabaseClientForRequest).toHaveBeenCalledWith(req);
    });
  });

  describe('second authenticated call from same user (RPC returns data:false)', () => {
    it('invokes RPC and calls next() with no args (no special handling needed)', async () => {
      const rpc = makeRpcMock({ data: false, error: null });
      const next = vi.fn();

      await seedHostedUserIfNeeded(makeReq(), {}, next);

      expect(rpc).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('RPC error path', () => {
    it('forwards the RPC error to next(err)', async () => {
      const rpcError = { message: 'pgrst transient', code: 'XX000' };
      makeRpcMock({ data: null, error: rpcError });
      const next = vi.fn();

      await seedHostedUserIfNeeded(makeReq(), {}, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(rpcError);
    });

    it('forwards thrown exceptions (e.g. missing Authorization) to next(err)', async () => {
      createSupabaseClientForRequest.mockImplementation(() => {
        throw new Error('Authorization header missing');
      });
      const next = vi.fn();

      await seedHostedUserIfNeeded(makeReq({ headers: {} }), {}, next);

      expect(next).toHaveBeenCalledTimes(1);
      const passedError = next.mock.calls[0][0];
      expect(passedError).toBeInstanceOf(Error);
      expect(passedError.message).toMatch(/Authorization header missing/);
    });
  });

  describe('retry after RPC error (the atomicity assertion)', () => {
    it('a subsequent request re-attempts the seed and succeeds (Postgres rolled back the marker)', async () => {
      const next1 = vi.fn();
      const next2 = vi.fn();

      // First call: RPC throws/errors. Postgres rolls back the marker INSERT
      // (because both marker and rows live in one PL/pgSQL function body).
      const rpc = vi.fn();
      rpc
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'transient', code: 'XX000' },
        })
        // Second call: marker is fresh again (rolled back), so RPC seeds
        // and returns true.
        .mockResolvedValueOnce({ data: true, error: null });

      createSupabaseClientForRequest.mockReturnValue({ rpc });

      await seedHostedUserIfNeeded(makeReq(), {}, next1);
      await seedHostedUserIfNeeded(makeReq(), {}, next2);

      expect(rpc).toHaveBeenCalledTimes(2);
      expect(next1).toHaveBeenCalledWith({ message: 'transient', code: 'XX000' });
      expect(next2).toHaveBeenCalledWith();
    });
  });

  describe('concurrent first-call simulation', () => {
    it('two parallel middleware invocations both reach the RPC; exactly one returns data:true', async () => {
      // Mirrors what happens server-side: two concurrent requests from the
      // same user hit the middleware in parallel. Both invoke the RPC.
      // Postgres serializes the `user_seed_state` INSERT on the PK — one
      // wins (returns true), the other observes the conflict (returns false).
      const rpc = vi.fn();
      rpc
        .mockResolvedValueOnce({ data: true, error: null })
        .mockResolvedValueOnce({ data: false, error: null });

      createSupabaseClientForRequest.mockReturnValue({ rpc });

      const next1 = vi.fn();
      const next2 = vi.fn();

      await Promise.all([
        seedHostedUserIfNeeded(makeReq(), {}, next1),
        seedHostedUserIfNeeded(makeReq(), {}, next2),
      ]);

      expect(rpc).toHaveBeenCalledTimes(2);
      // Both requests reach the route handler (next() called with no args).
      expect(next1).toHaveBeenCalledWith();
      expect(next2).toHaveBeenCalledWith();

      // Exactly one RPC call returned data:true.
      const results = await Promise.all(rpc.mock.results.map((r) => r.value));
      const trueCount = results.filter((r) => r.data === true).length;
      expect(trueCount).toBe(1);
    });
  });
});
