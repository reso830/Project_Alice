import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  archive,
  create,
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
});
