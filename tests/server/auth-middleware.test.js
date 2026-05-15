import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequireAuth } from '../../server/auth/middleware.js';

const SECRET = 'test-jwt-secret-do-not-use-in-production';
const OTHER_SECRET = 'a-different-secret';

const UNAUTHORIZED_BODY = {
  error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
};

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

function signToken(claims = {}, options = {}) {
  return jwt.sign(
    { sub: 'user-uuid', email: 'user@example.com', ...claims },
    SECRET,
    { algorithm: 'HS256', expiresIn: '1h', ...options },
  );
}

describe('createRequireAuth', () => {
  let logger;
  let next;
  let middleware;

  beforeEach(() => {
    logger = makeLogger();
    next = vi.fn();
    middleware = createRequireAuth({ jwtSecret: SECRET, logger });
  });

  it('throws when constructed without a jwtSecret', () => {
    expect(() => createRequireAuth({})).toThrow(/jwtSecret/);
    expect(() => createRequireAuth()).toThrow(/jwtSecret/);
  });

  it('rejects requests with no Authorization header (category: missing)', () => {
    const req = makeReq();
    const res = makeRes();

    middleware(req, res, next);

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

  it('rejects header that does not start with "Bearer " (category: malformed)', () => {
    const req = makeReq({ authorization: 'Token abc.def.ghi' });
    const res = makeRes();

    middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED_BODY);
    expect(next).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('[auth] reject', {
      category: 'malformed',
      path: '/api/applications',
    });
  });

  it('rejects Bearer token with malformed JWT body (category: malformed)', () => {
    const req = makeReq({ authorization: 'Bearer not-a-real-jwt' });
    const res = makeRes();

    middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('[auth] reject', {
      category: 'malformed',
      path: '/api/applications',
    });
  });

  it('rejects token signed with the wrong secret (category: signature)', () => {
    const token = jwt.sign({ sub: 'x' }, OTHER_SECRET, { algorithm: 'HS256' });
    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();

    middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('[auth] reject', {
      category: 'signature',
      path: '/api/applications',
    });
  });

  it('rejects an expired token (category: expired)', () => {
    const token = jwt.sign({ sub: 'x' }, SECRET, {
      algorithm: 'HS256',
      expiresIn: '-1s',
    });
    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();

    middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('[auth] reject', {
      category: 'expired',
      path: '/api/applications',
    });
  });

  it('rejects a token signed with HS512 even if the key matches (algorithm allowlist)', () => {
    const token = jwt.sign({ sub: 'x' }, SECRET, { algorithm: 'HS512' });
    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();

    middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
    expect(logger.warn.mock.calls[0][1].category).toBe('signature');
  });

  it('accepts a valid HS256 token and populates req.user', () => {
    const token = signToken({ sub: 'user-123', email: 'jane@example.com' });
    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({ id: 'user-123', email: 'jane@example.com' });
    expect(res.statusCode).toBeNull();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('uses the request path in the log entry, not a hardcoded value', () => {
    const req = makeReq({ path: '/api/profile' });
    const res = makeRes();

    middleware(req, res, next);

    expect(logger.warn).toHaveBeenCalledWith('[auth] reject', {
      category: 'missing',
      path: '/api/profile',
    });
  });

  it('never includes the rejected token in any log argument across all rejection categories', () => {
    const tokens = {
      malformedBody: 'eyJhbGciOiJI.malformed-token.zzz',
      wrongSig: jwt.sign({ sub: 'x' }, OTHER_SECRET, { algorithm: 'HS256' }),
      expired: jwt.sign({ sub: 'x' }, SECRET, {
        algorithm: 'HS256',
        expiresIn: '-1s',
      }),
    };

    for (const [label, token] of Object.entries(tokens)) {
      const req = makeReq({ authorization: `Bearer ${token}` });
      const res = makeRes();
      middleware(req, res, next);

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
