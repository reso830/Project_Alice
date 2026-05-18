import { generateKeyPair, SignJWT } from 'jose';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequireAuth } from '../../server/auth/middleware.js';
import { createApp, logBoot } from '../../server/index.js';
import { createTestRepositories } from '../../server/repositories/index.js';
import { makeMemoryDb } from './helpers.js';

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

async function withApp({ config, requireAuth } = {}, test) {
  const db = makeMemoryDb();
  const repositories = await createTestRepositories(db);
  const app = createApp({ repositories, config, requireAuth });
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
