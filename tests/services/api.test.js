import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  archive,
  create,
  deleteAccount,
  getAll,
  getById,
  getProfile,
  request,
  saveProfile,
  unarchive,
  update,
} from '../../src/services/api.js';
import * as authStore from '../../src/data/authStore.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('api service', () => {
  it('returns data from create responses', async () => {
    const record = {
      id: 1,
      companyName: 'Acme Corp',
      jobTitle: 'Frontend Engineer',
      status: 'applied',
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: record }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(create({
      companyName: 'Acme Corp',
      jobTitle: 'Frontend Engineer',
      status: 'applied',
    })).resolves.toEqual(record);
    expect(fetchMock).toHaveBeenCalledWith('/api/applications', expect.objectContaining({
      method: 'POST',
    }));
  });

  it('returns data from update responses', async () => {
    const record = {
      id: 1,
      companyName: 'Acme Corp',
      jobTitle: 'Frontend Engineer',
      status: 'interview',
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: record }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(update(1, { status: 'interview' })).resolves.toEqual(record);
    expect(fetchMock).toHaveBeenCalledWith('/api/applications/1', expect.objectContaining({
      method: 'PATCH',
    }));
  });

  it('returns data from list and detail responses', async () => {
    const records = [{
      id: 1,
      companyName: 'Acme Corp',
      jobTitle: 'Frontend Engineer',
      status: 'applied',
    }];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: records }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: records[0] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getAll()).resolves.toEqual(records);
    await expect(getById(1)).resolves.toEqual(records[0]);
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/applications', expect.objectContaining({
      method: 'GET',
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/applications/1', expect.objectContaining({
      method: 'GET',
    }));
  });

  it('requests archived list responses with the archived view query', async () => {
    const records = [{
      id: 1,
      companyName: 'Archived Co',
      jobTitle: 'Past Role',
      status: 'rejected',
      archived: true,
      archivedDate: '2026-05-26',
    }];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: records }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getAll({ view: 'archived' })).resolves.toEqual(records);
    expect(fetchMock).toHaveBeenCalledWith('/api/applications?view=archived', expect.objectContaining({
      method: 'GET',
    }));
  });

  it('returns data from archive responses', async () => {
    const record = {
      id: 1,
      companyName: 'Acme Corp',
      jobTitle: 'Frontend Engineer',
      status: 'applied',
      archived: true,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: record }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(archive(1)).resolves.toEqual(record);
    expect(fetchMock).toHaveBeenCalledWith('/api/applications/1/archive', expect.objectContaining({
      method: 'POST',
    }));
  });

  it('returns data from unarchive responses', async () => {
    const record = {
      id: 1,
      companyName: 'Acme Corp',
      jobTitle: 'Frontend Engineer',
      status: 'applied',
      archived: false,
      archivedDate: null,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: record }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(unarchive(1)).resolves.toEqual(record);
    expect(fetchMock).toHaveBeenCalledWith('/api/applications/1/unarchive', expect.objectContaining({
      method: 'POST',
    }));
  });

  it('returns data from profile responses', async () => {
    const profile = {
      firstName: 'Ana',
      lastName: 'Rivera',
      skills: ['JavaScript'],
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: profile }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: profile }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getProfile()).resolves.toEqual(profile);
    await expect(saveProfile(profile)).resolves.toEqual(profile);
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/profile', expect.objectContaining({
      method: 'GET',
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/profile', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify(profile),
    }));
  });

  it('deleteAccount sends the hosted password body to DELETE /api/account', async () => {
    vi.spyOn(authStore, 'getAccessToken').mockReturnValue('tok');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { deleted: true } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteAccount({ password: 'pw' })).resolves.toEqual({ deleted: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/account', expect.objectContaining({
      method: 'DELETE',
      body: JSON.stringify({ password: 'pw' }),
    }));
  });

  it('deleteAccount sends the local confirm body to DELETE /api/account', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { cleared: true } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteAccount({ confirm: 'DELETE' })).resolves.toEqual({ cleared: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/account', expect.objectContaining({
      method: 'DELETE',
      body: JSON.stringify({ confirm: 'DELETE' }),
    }));
  });

  it('throws error envelopes for non-2xx responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          fields: { companyName: 'Required' },
        },
      }),
    }));

    await expect(request('POST', '/api/applications', {})).rejects.toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      fields: { companyName: 'Required' },
    });
  });

  it('throws a network error when fetch cannot reach the backend', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(request('GET', '/api/applications')).rejects.toEqual({
      code: 'NETWORK_ERROR',
      message: 'Cannot connect to the backend — is the server running?',
    });
  });

  describe('Authorization header', () => {
    it('omits Authorization when getAccessToken returns null', async () => {
      vi.spyOn(authStore, 'getAccessToken').mockReturnValue(null);
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: null }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await request('GET', '/api/applications');

      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers).not.toHaveProperty('Authorization');
    });

    it('attaches Authorization: Bearer <token> when getAccessToken returns a token', async () => {
      vi.spyOn(authStore, 'getAccessToken').mockReturnValue('abc');
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: null }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await request('GET', '/api/applications');

      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers.Authorization).toBe('Bearer abc');
    });

    it('attaches X-Client-Date alongside Authorization (#43 — client TZ stamping)', async () => {
      vi.spyOn(authStore, 'getAccessToken').mockReturnValue('abc');
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: null }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await request('GET', '/api/applications');

      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers.Authorization).toBe('Bearer abc');
      expect(headers['X-Client-Date']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('attaches X-Client-Date even when no auth token is present', async () => {
      vi.spyOn(authStore, 'getAccessToken').mockReturnValue(null);
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: null }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await request('GET', '/api/applications');

      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers).not.toHaveProperty('Authorization');
      expect(headers['X-Client-Date']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('does not attempt session revalidation on a 401 when no token is present', async () => {
      vi.spyOn(authStore, 'getAccessToken').mockReturnValue(null);
      const spy = vi.spyOn(authStore, 'handleAuthFailure').mockResolvedValue();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { code: 'UNAUTHORIZED', message: 'x' } }),
      }));

      await expect(request('GET', '/api/applications')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
      expect(spy).not.toHaveBeenCalled();
    });

    it('surfaces 401 responses as UNAUTHORIZED error envelopes', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        }),
      }));

      await expect(request('GET', '/api/applications')).rejects.toEqual({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        fields: undefined,
      });
    });
  });

  describe('auth-failure session revalidation (FR-011a)', () => {
    function failWith(status, code) {
      return vi.fn().mockResolvedValue({
        ok: false,
        status,
        json: () => Promise.resolve({ error: { code, message: 'x' } }),
      });
    }

    it.each([
      ['401 UNAUTHORIZED', 401, 'UNAUTHORIZED'],
      ['401 INVALID_PASSWORD (stale-session delete recheck)', 401, 'INVALID_PASSWORD'],
      ['404 NOT_FOUND', 404, 'NOT_FOUND'],
      ['500 INTERNAL_ERROR', 500, 'INTERNAL_ERROR'],
    ])('fires handleAuthFailure on %s when a token is present', async (_label, status, code) => {
      vi.spyOn(authStore, 'getAccessToken').mockReturnValue('tok');
      const spy = vi.spyOn(authStore, 'handleAuthFailure').mockResolvedValue();
      vi.stubGlobal('fetch', failWith(status, code));

      await expect(request('DELETE', '/api/account', {})).rejects.toMatchObject({ code });
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['400 VALIDATION_ERROR', 400, 'VALIDATION_ERROR'],
    ])('does NOT fire handleAuthFailure on %s', async (_label, status, code) => {
      vi.spyOn(authStore, 'getAccessToken').mockReturnValue('tok');
      const spy = vi.spyOn(authStore, 'handleAuthFailure').mockResolvedValue();
      vi.stubGlobal('fetch', failWith(status, code));

      await expect(request('DELETE', '/api/account', {})).rejects.toMatchObject({ code });
      expect(spy).not.toHaveBeenCalled();
    });

    it('does NOT fire handleAuthFailure when no token is present', async () => {
      vi.spyOn(authStore, 'getAccessToken').mockReturnValue(null);
      const spy = vi.spyOn(authStore, 'handleAuthFailure').mockResolvedValue();
      vi.stubGlobal('fetch', failWith(500, 'INTERNAL_ERROR'));

      await expect(request('GET', '/api/applications')).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
