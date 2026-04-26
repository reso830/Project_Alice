import { afterEach, describe, expect, it, vi } from 'vitest';
import { archive, create, getAll, getById, request, update } from '../../src/services/api.js';

afterEach(() => {
  vi.unstubAllGlobals();
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
});
