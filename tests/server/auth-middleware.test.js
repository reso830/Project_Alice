import { generateKeyPair, SignJWT } from 'jose';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequireAuth } from '../../server/auth/middleware.js';

const UNAUTHORIZED_BODY = {
  error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
};

let trustedKeyPair;
let untrustedKeyPair;

beforeAll(async () => {
  trustedKeyPair = await generateKeyPair('ES256');
  untrustedKeyPair = await generateKeyPair('ES256');
});

function makeReq({ authorization, path = '/api/applications' } = {}) {
  return {
    headers: authorization === undefined ? {} : { authorization },
    path,
  };
}

function makeRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

function makeLogger() {
  return { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
}

async function signToken({
  privateKey = trustedKeyPair.privateKey,
  alg = 'ES256',
  claims = {},
  expiresIn = '1h',
} = {}) {
  return new SignJWT({
    sub: 'user-uuid',
    email: 'user@example.com',
    ...claims,
  })
    .setProtectedHeader({ alg, kid: 'test-kid' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(privateKey);
}

describe('createRequireAuth', () => {
  let logger;
  let next;
  let middleware;

  beforeEach(() => {
    logger = makeLogger();
    next = vi.fn();
    middleware = createRequireAuth({
      jwks: async () => trustedKeyPair.publicKey,
      logger,
    });
  });

  it('throws when constructed without jwksUri or jwks', () => {
    expect(() => createRequireAuth({})).toThrow(/jwksUri/);
    expect(() => createRequireAuth()).toThrow(/jwksUri/);
  });

  it('rejects requests with no Authorization header (category: missing)', async () => {
    const req = makeReq();
    const res = makeRes();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED_BODY);
    expect(next).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith('[auth] reject', {
      category: 'missing',
      path: '/api/applications',
    });
  });

  it('rejects header that does not start with "Bearer " (category: malformed)', async () => {
    const req = makeReq({ authorization: 'Token abc.def.ghi' });
    const res = makeRes();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED_BODY);
    expect(next).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('[auth] reject', {
      category: 'malformed',
      path: '/api/applications',
    });
  });

  it('rejects Bearer token with malformed JWT body (category: malformed)', async () => {
    const req = makeReq({ authorization: 'Bearer not-a-real-jwt' });
    const res = makeRes();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('[auth] reject', {
      category: 'malformed',
      path: '/api/applications',
    });
  });

  it('rejects token signed with a different keypair (category: signature)', async () => {
    const token = await signToken({ privateKey: untrustedKeyPair.privateKey });
    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('[auth] reject', {
      category: 'signature',
      path: '/api/applications',
    });
  });

  it('rejects an expired token (category: expired)', async () => {
    const token = await new SignJWT({ sub: 'x' })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-kid' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(trustedKeyPair.privateKey);
    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('[auth] reject', {
      category: 'expired',
      path: '/api/applications',
    });
  });

  it('rejects a token signed with a non-allowlisted algorithm (HS256, category: signature)', async () => {
    const secret = new TextEncoder().encode('shared-secret-not-allowed');
    const token = await new SignJWT({ sub: 'x' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secret);
    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
    expect(logger.warn.mock.calls[0][1].category).toBe('signature');
  });

  it('accepts a valid ES256 token and populates req.user', async () => {
    const token = await signToken({
      claims: { sub: 'user-123', email: 'jane@example.com' },
    });
    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({ id: 'user-123', email: 'jane@example.com' });
    expect(res.statusCode).toBeNull();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('uses the request path in the log entry, not a hardcoded value', async () => {
    const req = makeReq({ path: '/api/profile' });
    const res = makeRes();

    await middleware(req, res, next);

    expect(logger.warn).toHaveBeenCalledWith('[auth] reject', {
      category: 'missing',
      path: '/api/profile',
    });
  });

  it('never includes the rejected token in any log argument across all rejection categories', async () => {
    const tokens = {
      malformedBody: 'eyJhbGciOiJI.malformed-token.zzz',
      wrongSig: await signToken({ privateKey: untrustedKeyPair.privateKey }),
      expired: await new SignJWT({ sub: 'x' })
        .setProtectedHeader({ alg: 'ES256', kid: 'test-kid' })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
        .sign(trustedKeyPair.privateKey),
    };

    for (const [label, token] of Object.entries(tokens)) {
      const req = makeReq({ authorization: `Bearer ${token}` });
      const res = makeRes();
      await middleware(req, res, next);

      const tokenAppearedSomewhere = logger.warn.mock.calls.some((call) =>
        call.some((arg) => {
          const serialized =
            typeof arg === 'string' ? arg : JSON.stringify(arg);
          return serialized.includes(token);
        }),
      );

      expect(
        tokenAppearedSomewhere,
        `token from "${label}" case must not appear in any log argument`,
      ).toBe(false);
    }
  });
});
