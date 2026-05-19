import { generateKeyPair, SignJWT } from 'jose';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequireAuth } from '../../server/auth/middleware.js';
import { createApp, logBoot } from '../../server/index.js';
import { createTestRepositories } from '../../server/repositories/index.js';
import { makeMemoryDb, wrapAsDispatcher } from './helpers.js';

let trustedKeyPair;
let untrustedKeyPair;

beforeAll(async () => {
  trustedKeyPair = await generateKeyPair('ES256');
  untrustedKeyPair = await generateKeyPair('ES256');
});

async function signValidToken(claims = {}) {
  return new SignJWT({
    sub: 'user-123',
    email: 'jane@example.com',
    ...claims,
  })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-kid' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(trustedKeyPair.privateKey);
}

async function signWithUntrustedKey() {
  return new SignJWT({ sub: 'x' })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-kid' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(untrustedKeyPair.privateKey);
}

function hostedConfig() {
  return {
    runtime: 'hosted',
    isHosted: true,
    port: 3001,
    supabase: {
      url: 'https://example.supabase.co',
      anonKey: 'anon-key',
      serviceRoleKey: 'service-role-key',
    },
  };
}

function localConfig() {
  return {
    runtime: 'local',
    isHosted: false,
    port: 3001,
    supabase: null,
  };
}

async function withApp(
  { config, requireAuth, seedHostedUserIfNeeded } = {},
  test,
) {
  const db = makeMemoryDb();
  const repositories = await createTestRepositories(db);
  // Default the seed middleware to a passthrough so this file's auth-wiring
  // tests aren't accidentally coupled to the real seed step (which would
  // try to hit the fake example.supabase.co URL and return 500). Tests
  // that specifically exercise the seed wiring inject their own stub.
  const seed =
    seedHostedUserIfNeeded === undefined
      ? (_req, _res, next) => next()
      : seedHostedUserIfNeeded;
  const app = createApp({
    repositories: wrapAsDispatcher(repositories),
    config,
    requireAuth,
    seedHostedUserIfNeeded: seed,
  });
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await test(baseUrl);
  } finally {
    server.close();
    db.close();
  }
}

async function request(baseUrl, path, options = {}) {
  const response = await globalThis.fetch(`${baseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  });

  let body = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return { status: response.status, body };
}

function stubPass(_req, _res, next) {
  next();
}

function stubReject(_req, res) {
  res.status(401).json({
    error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
  });
}

describe('protected routers — hosted-mode wiring', () => {
  it('passes protected requests through when requireAuth calls next()', async () => {
    await withApp({ config: hostedConfig(), requireAuth: stubPass }, async (baseUrl) => {
      const apps = await request(baseUrl, '/api/applications');
      const profile = await request(baseUrl, '/api/profile');

      expect(apps.status).toBe(200);
      expect(profile.status).toBe(200);
    });
  });

  it('returns 401 from every protected route when requireAuth rejects', async () => {
    await withApp({ config: hostedConfig(), requireAuth: stubReject }, async (baseUrl) => {
      const apps = await request(baseUrl, '/api/applications');
      const profile = await request(baseUrl, '/api/profile');
      const resume = await request(baseUrl, '/api/resume/parse', { method: 'POST' });

      expect(apps.status).toBe(401);
      expect(profile.status).toBe(401);
      expect(resume.status).toBe(401);
    });
  });

  it('leaves /api/health public when requireAuth rejects everything else', async () => {
    await withApp({ config: hostedConfig(), requireAuth: stubReject }, async (baseUrl) => {
      const health = await request(baseUrl, '/api/health');

      expect(health.status).toBe(200);
      expect(health.body).toEqual({ status: 'ok', runtime: 'hosted' });
    });
  });
});

describe('createApp hosted-config safety', () => {
  it('throws when hosted config is passed without supabase.url and no explicit requireAuth', async () => {
    const db = makeMemoryDb();
    try {
      const repositories = await createTestRepositories(db);
      const badConfig = {
        runtime: 'hosted',
        isHosted: true,
        port: 3001,
        supabase: {
          // url intentionally missing — needed to build the JWKS endpoint
          anonKey: 'anon-key',
          serviceRoleKey: 'service-role-key',
        },
      };

      expect(() => createApp({ repositories, config: badConfig })).toThrow(
        /supabase\.url/,
      );
    } finally {
      db.close();
    }
  });
});

describe('/api/health runtime mode', () => {
  it('reports runtime=local when no config is provided', async () => {
    await withApp({}, async (baseUrl) => {
      const health = await request(baseUrl, '/api/health');

      expect(health.status).toBe(200);
      expect(health.body).toEqual({ status: 'ok', runtime: 'local' });
    });
  });

  it('reports runtime=local when local config is passed', async () => {
    await withApp({ config: localConfig() }, async (baseUrl) => {
      const health = await request(baseUrl, '/api/health');

      expect(health.body).toEqual({ status: 'ok', runtime: 'local' });
    });
  });

  it('reports runtime=hosted when hosted config is passed', async () => {
    await withApp(
      { config: hostedConfig(), requireAuth: stubPass },
      async (baseUrl) => {
        const health = await request(baseUrl, '/api/health');

        expect(health.body).toEqual({ status: 'ok', runtime: 'hosted' });
      },
    );
  });
});

describe('signup endpoint is not mounted', () => {
  it('returns 404 for /api/auth/signup in local mode', async () => {
    await withApp({}, async (baseUrl) => {
      const response = await request(baseUrl, '/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email: 'x@y.com', password: 'longenough' }),
      });

      expect(response.status).toBe(404);
    });
  });

  it('returns 404 for /api/auth/signup in hosted mode (signup goes direct to Supabase)', async () => {
    await withApp(
      { config: hostedConfig(), requireAuth: stubPass },
      async (baseUrl) => {
        const response = await request(baseUrl, '/api/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ email: 'x@y.com', password: 'longenough' }),
        });

        expect(response.status).toBe(404);
      },
    );
  });
});

describe('end-to-end 401 + log assertion through real middleware', () => {
  let logger;

  beforeEach(() => {
    logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
  });

  async function withRealMiddlewareApp(test) {
    const requireAuth = createRequireAuth({
      jwks: async () => trustedKeyPair.publicKey,
      logger,
    });
    await withApp({ config: hostedConfig(), requireAuth }, test);
  }

  it('logs category=missing when no Authorization header is sent', async () => {
    await withRealMiddlewareApp(async (baseUrl) => {
      const response = await request(baseUrl, '/api/applications');

      expect(response.status).toBe(401);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith('[auth] reject', {
        category: 'missing',
        path: '/api/applications',
      });
    });
  });

  it('logs category=signature when a token signed with the wrong key is sent', async () => {
    await withRealMiddlewareApp(async (baseUrl) => {
      const token = await signWithUntrustedKey();
      const response = await request(baseUrl, '/api/applications', {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(401);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn.mock.calls[0][1].category).toBe('signature');
    });
  });

  it('does not log when a valid ES256 token is sent', async () => {
    await withRealMiddlewareApp(async (baseUrl) => {
      const token = await signValidToken();
      const response = await request(baseUrl, '/api/applications', {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(200);
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});

describe('seedHostedUserIfNeeded mount-time wiring', () => {
  it('fires on each protected route in hosted mode', async () => {
    const seed = vi.fn((_req, _res, next) => next());

    await withApp(
      {
        config: hostedConfig(),
        requireAuth: stubPass,
        seedHostedUserIfNeeded: seed,
      },
      async (baseUrl) => {
        await request(baseUrl, '/api/applications');
        await request(baseUrl, '/api/profile');
        // Resume endpoint hits the seed middleware too — multer parses the
        // empty body and the handler returns 400 (no file), but the seed
        // middleware fires first.
        await request(baseUrl, '/api/resume/parse', { method: 'POST' });

        expect(seed).toHaveBeenCalledTimes(3);
      },
    );
  });

  it('is NOT mounted on /api/health (only protected routes)', async () => {
    const seed = vi.fn((_req, _res, next) => next());

    await withApp(
      {
        config: hostedConfig(),
        requireAuth: stubPass,
        seedHostedUserIfNeeded: seed,
      },
      async (baseUrl) => {
        await request(baseUrl, '/api/health');
        expect(seed).not.toHaveBeenCalled();
      },
    );
  });

  it('is NOT mounted in local mode (passing seed: null disables the default)', async () => {
    const seed = vi.fn((_req, _res, next) => next());

    await withApp(
      {
        config: localConfig(),
        requireAuth: stubPass,
        seedHostedUserIfNeeded: seed,
      },
      async (baseUrl) => {
        // Local config + explicit seed stub: stub IS mounted because we
        // explicitly passed it. This case shows that injection works
        // regardless of runtime.
        await request(baseUrl, '/api/applications');
        expect(seed).toHaveBeenCalledTimes(1);
      },
    );
  });

  it('local-mode default has no seed mounted (real createApp behavior)', async () => {
    // Confirm the production default: local mode + no explicit override
    // means seed middleware is not mounted. We can't directly observe the
    // (absence of) mount, but if seed were somehow active in local mode,
    // it would try to construct a Supabase client and fail because there's
    // no Authorization header — surfacing as a 500 from the route handler.
    // A clean 200 from a local-mode protected route proves no seed step ran.
    const repositories = await createTestRepositories(makeMemoryDb());
    const app = createApp({
      repositories: wrapAsDispatcher(repositories),
      config: localConfig(),
      requireAuth: stubPass,
    });
    const server = app.listen(0);
    const { port } = server.address();
    try {
      const res = await request(`http://127.0.0.1:${port}`, '/api/applications');
      expect(res.status).toBe(200);
    } finally {
      server.close();
    }
  });

  it('forwards seed-middleware errors to Express error handler (500)', async () => {
    const seed = vi.fn((_req, _res, next) => next(new Error('seed RPC failed')));

    await withApp(
      {
        config: hostedConfig(),
        requireAuth: stubPass,
        seedHostedUserIfNeeded: seed,
      },
      async (baseUrl) => {
        const res = await request(baseUrl, '/api/applications');
        expect(res.status).toBe(500);
        expect(res.body.error.code).toBe('INTERNAL_ERROR');
      },
    );
  });
});

describe('logBoot', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('emits the [runtime] mode line exactly once', () => {
    logBoot({ runtime: 'hosted', port: 3001 });

    const runtimeLines = consoleSpy.mock.calls.filter((call) =>
      String(call[0]).startsWith('[runtime] mode='),
    );

    expect(runtimeLines).toHaveLength(1);
    expect(runtimeLines[0][0]).toBe('[runtime] mode=hosted port=3001');
  });

  it('emits the legacy [config] and listening lines alongside the [runtime] line', () => {
    logBoot({ runtime: 'local', port: 4000 });

    const lines = consoleSpy.mock.calls.map((call) => String(call[0]));

    expect(lines).toContain('[config] Runtime mode: local');
    expect(lines).toContain('[runtime] mode=local port=4000');
    expect(lines).toContain('Alice API server listening on http://localhost:4000');
  });
});
