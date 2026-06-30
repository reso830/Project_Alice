import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHealth } from '../../src/services/healthApi.js';

const localHealth = {
  status: 'ok',
  runtime: 'local',
  version: 'v1.9.0',
  updateSupported: true,
};

const hostedHealth = {
  status: 'ok',
  runtime: 'hosted',
  version: 'v1.9.0',
  updateSupported: false,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('healthApi.getHealth', () => {
  it('returns the full health envelope (status + runtime) for local mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(localHealth),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getHealth()).resolves.toEqual(localHealth);
    expect(fetchMock).toHaveBeenCalledWith('/api/health');
  });

  it('returns the full health envelope for hosted mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(hostedHealth),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getHealth()).resolves.toEqual(hostedHealth);
  });

  it('does not attach an Authorization header even when a token would be available', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(localHealth),
    });
    vi.stubGlobal('fetch', fetchMock);

    await getHealth();

    const init = fetchMock.mock.calls[0][1];
    expect(init === undefined || init.headers === undefined).toBe(true);
  });

  it('throws a NETWORK_ERROR envelope when fetch cannot reach the backend', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(getHealth()).rejects.toEqual({
      code: 'NETWORK_ERROR',
      message: 'Cannot connect to the backend — is the server running?',
    });
  });

  it('throws an INTERNAL_ERROR envelope for non-2xx responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    }));

    await expect(getHealth()).rejects.toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Health check failed',
    });
  });
});
