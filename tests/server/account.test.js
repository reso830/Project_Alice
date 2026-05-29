import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../server/index.js';
import { wrapAsDispatcher } from './helpers.js';

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

function stubPass(_req, _res, next) {
  next();
}

function stubReject(_req, res) {
  res.status(401).json({
    error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
  });
}

async function withApp({ account, config, requireAuth, seedHostedUserIfNeeded }, test) {
  const app = createApp({
    repositories: wrapAsDispatcher({ account, applications: {}, profile: {} }),
    config,
    requireAuth,
    seedHostedUserIfNeeded,
  });
  const server = app.listen(0);
  const { port } = server.address();
  try {
    await test(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

async function del(baseUrl, body) {
  const response = await globalThis.fetch(`${baseUrl}/api/account`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

describe('DELETE /api/account — hosted', () => {
  it('returns 200 and the adapter result on success; calls delete once with the body', async () => {
    const account = { delete: vi.fn().mockResolvedValue({ deleted: true }) };

    await withApp({ account, config: hostedConfig(), requireAuth: stubPass }, async (baseUrl) => {
      const res = await del(baseUrl, { password: 'pw' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: { deleted: true } });
      expect(account.delete).toHaveBeenCalledTimes(1);
      expect(account.delete).toHaveBeenCalledWith({ password: 'pw' });
    });
  });

  it('returns 401 UNAUTHORIZED and never calls delete when auth rejects', async () => {
    const account = { delete: vi.fn() };

    await withApp({ account, config: hostedConfig(), requireAuth: stubReject }, async (baseUrl) => {
      const res = await del(baseUrl, { password: 'pw' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(account.delete).not.toHaveBeenCalled();
    });
  });

  it('maps a typed INVALID_PASSWORD adapter error to 401', async () => {
    const account = {
      delete: vi.fn().mockRejectedValue(
        Object.assign(new Error('Incorrect password.'), {
          code: 'INVALID_PASSWORD',
          status: 401,
        }),
      ),
    };

    await withApp({ account, config: hostedConfig(), requireAuth: stubPass }, async (baseUrl) => {
      const res = await del(baseUrl, { password: 'wrong' });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: { code: 'INVALID_PASSWORD', message: 'Incorrect password.' },
      });
    });
  });

  it('maps a typed VALIDATION_ERROR adapter error to 400', async () => {
    const account = {
      delete: vi.fn().mockRejectedValue(
        Object.assign(new Error('Password is required.'), {
          code: 'VALIDATION_ERROR',
          status: 400,
        }),
      ),
    };

    await withApp({ account, config: hostedConfig(), requireAuth: stubPass }, async (baseUrl) => {
      const res = await del(baseUrl, {});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  it('forwards an untyped adapter error to the global handler as 500', async () => {
    const account = { delete: vi.fn().mockRejectedValue(new Error('admin boom')) };

    await withApp({ account, config: hostedConfig(), requireAuth: stubPass }, async (baseUrl) => {
      const res = await del(baseUrl, { password: 'pw' });

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  it('does NOT invoke seed middleware on the delete path', async () => {
    const account = { delete: vi.fn().mockResolvedValue({ deleted: true }) };
    const seed = vi.fn((_req, _res, next) => next());

    await withApp(
      { account, config: hostedConfig(), requireAuth: stubPass, seedHostedUserIfNeeded: seed },
      async (baseUrl) => {
        await del(baseUrl, { password: 'pw' });
        expect(seed).not.toHaveBeenCalled();
      },
    );
  });
});

describe('DELETE /api/account — local', () => {
  it('returns 200 and the cleared result with confirm', async () => {
    const account = { delete: vi.fn().mockResolvedValue({ cleared: true }) };

    await withApp({ account }, async (baseUrl) => {
      const res = await del(baseUrl, { confirm: 'DELETE' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: { cleared: true } });
      expect(account.delete).toHaveBeenCalledWith({ confirm: 'DELETE' });
    });
  });

  it('maps a missing/wrong confirm (typed VALIDATION_ERROR) to 400', async () => {
    const account = {
      delete: vi.fn().mockRejectedValue(
        Object.assign(new Error('Confirmation required.'), {
          code: 'VALIDATION_ERROR',
          status: 400,
        }),
      ),
    };

    await withApp({ account }, async (baseUrl) => {
      const res = await del(baseUrl, {});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
