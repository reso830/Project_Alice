import { afterEach, describe, expect, it, vi } from 'vitest';
import { create, request, update } from '../../src/services/api.js';

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
