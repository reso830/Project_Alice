import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Issue #42: in-CI integration test for `api/index.js` (the Vercel entry).
// Boots the module exactly as Vercel does — top-level await runs
// `assertHostedSchema(config)`, dynamically imports the seed middleware,
// and constructs the hosted dispatcher via `createRepositories(config)`.
// Only two external seams are mocked:
//
//   1. `server/auth/middleware.js` — `createRequireAuth` is replaced by a
//      pass-through that pins `req.user`, so the JWKS fetch wired in
//      `server/index.js` does not hit the network.
//   2. `server/repositories/supabase/client.js` — `createSupabaseClientForRequest`
//      returns a fake chainable client. Adapter code in
//      `server/repositories/supabase/applications.js` and the seed RPC call in
//      `server/auth/seedHostedUser.js` both run against the fake.
//
// Everything else — `createApp`, route wiring, `attachRepos`,
// `seedHostedUserIfNeeded`, `createRepositories`, `assertHostedSchema` —
// runs as it does in production. A regression in any of those would now
// fail in CI instead of only on a Vercel preview deploy.

const { fakeClient } = vi.hoisted(() => {
  function makeChainable(result) {
    const c = {
      then(onFulfilled, onRejected) {
        try {
          onFulfilled(result);
        } catch (err) {
          if (onRejected) onRejected(err);
          else throw err;
        }
      },
      select() {
        return c;
      },
      insert() {
        return c;
      },
      update() {
        return c;
      },
      delete() {
        return c;
      },
      eq() {
        return c;
      },
      order() {
        return c;
      },
      limit() {
        return c;
      },
      maybeSingle() {
        return c;
      },
      single() {
        return c;
      },
    };
    return c;
  }

  return {
    fakeClient: {
      from: vi.fn(() => makeChainable({ data: [], error: null })),
      rpc: vi.fn(async () => ({ data: false, error: null })),
    },
  };
});

vi.mock('../../server/auth/middleware.js', () => ({
  createRequireAuth: () => (req, _res, next) => {
    req.user = { id: 'test-user' };
    next();
  },
}));

vi.mock('../../server/repositories/supabase/client.js', () => ({
  createSupabaseClientForRequest: vi.fn(() => fakeClient),
}));

let app;
let server;
let baseUrl;
let warnSpy;

beforeAll(async () => {
  // `vi.stubEnv` is scoped + auto-restored on `vi.unstubAllEnvs()`, which
  // keeps hosted config from leaking into other test files in the same
  // worker. `vi.resetModules()` is critical because `server/config.js`
  // reads env once at module load and freezes the result — without a
  // reset, a prior test in the same worker that imported `server/index.js`
  // would have already cached `config = { runtime: 'local', ... }`, and
  // `api/index.js` would inherit that stale config instead of the hosted
  // one we are stubbing here.
  vi.stubEnv('APP_RUNTIME', 'hosted');
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
  vi.stubEnv('SKIP_HOSTED_SCHEMA_CHECK', 'true');
  vi.resetModules();

  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  app = (await import('../../api/index.js')).default;
  server = app.listen(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
  warnSpy?.mockRestore();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('api/index.js (Vercel entry) — hosted-mode integration', () => {
  it('runs assertHostedSchema on cold start (warn-log evidence)', () => {
    // `api/index.js` invokes `assertHostedSchema(config)` without a custom
    // logger, so `logger.warn` falls through to `console.warn`. Under
    // `SKIP_HOSTED_SCHEMA_CHECK=true` the function emits the test-only
    // escape-hatch warning and returns. Asserting on that warning means
    // deleting the `await assertHostedSchema(config)` line in api/index.js
    // makes this expectation fail — without it, the early-return would be
    // silent and the regression invisible.
    const matched = warnSpy.mock.calls.find((args) =>
      String(args[0] ?? '').includes(
        '[hosted-schema] SKIP_HOSTED_SCHEMA_CHECK=true',
      ),
    );
    expect(matched).toBeDefined();
  });

  it('serves /api/health with runtime=hosted', async () => {
    const res = await globalThis.fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      status: 'ok',
      runtime: 'hosted',
    });
  });

  it('serves GET /api/applications end-to-end through requireAuth → attachRepos → seedHostedUserIfNeeded → handler', async () => {
    const res = await globalThis.fetch(`${baseUrl}/api/applications`, {
      headers: { Authorization: 'Bearer fake-jwt' },
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: [] });

    // Seed middleware ran before the route handler — proof that the
    // dynamic `import('../server/auth/seedHostedUser.js')` in api/index.js
    // resolved and the middleware was mounted on the applications router.
    expect(fakeClient.rpc).toHaveBeenCalledWith('claim_and_seed_starter');

    // Dispatcher built a per-request Supabase client — proof that
    // `createRepositories(config)` took the hosted branch and that
    // `attachRepos` invoked `forRequest(req)` for this call.
    const { createSupabaseClientForRequest } = await import(
      '../../server/repositories/supabase/client.js'
    );
    expect(createSupabaseClientForRequest).toHaveBeenCalledTimes(1);

    // Ordering proof: the req passed to the client factory already
    // carries `req.user` from the requireAuth mock. This pins the
    // middleware sequence end-to-end — requireAuth ran first (populated
    // req.user), attachRepos forwarded the SAME req to the dispatcher,
    // and the dispatcher passed it to the client factory. A regression
    // that reorders these (e.g. mounting attachRepos before requireAuth)
    // would make `req.user` undefined here.
    const firstReq = createSupabaseClientForRequest.mock.calls[0][0];
    expect(firstReq?.user?.id).toBe('test-user');

    // Adapter actually ran against the fake client — proves the
    // `applications` table chain was issued (not short-circuited by an
    // earlier middleware error).
    expect(fakeClient.from).toHaveBeenCalledWith('applications');
  });
});
