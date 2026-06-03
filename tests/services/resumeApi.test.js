import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractText, parseResume, parseText } from '../../src/services/resumeApi.js';
import * as authStore from '../../src/data/authStore.js';

class FormDataStub {
  constructor() {
    this.entries = [];
  }
  append(key, value) {
    this.entries.push([key, value]);
  }
}

function stubFormData() {
  vi.stubGlobal('FormData', FormDataStub);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('resumeApi', () => {
  it('returns data from a successful resume parse', async () => {
    stubFormData();
    vi.spyOn(authStore, 'getAccessToken').mockReturnValue(null);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { name: 'Jane' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(parseResume(new Blob(['x']))).resolves.toEqual({ name: 'Jane' });
    expect(fetchMock).toHaveBeenCalledWith('/api/resume/parse', expect.objectContaining({
      method: 'POST',
    }));
  });

  it('omits Authorization header when getAccessToken returns null', async () => {
    stubFormData();
    vi.spyOn(authStore, 'getAccessToken').mockReturnValue(null);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: null }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await parseResume(new Blob(['x']));

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers).not.toHaveProperty('Authorization');
  });

  it('attaches Authorization: Bearer <token> when getAccessToken returns a token', async () => {
    stubFormData();
    vi.spyOn(authStore, 'getAccessToken').mockReturnValue('abc');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: null }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await parseResume(new Blob(['x']));

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe('Bearer abc');
  });

  it('surfaces error envelope on non-2xx responses', async () => {
    stubFormData();
    vi.spyOn(authStore, 'getAccessToken').mockReturnValue(null);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      }),
    }));

    await expect(parseResume(new Blob(['x']))).rejects.toEqual({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  });

  it('throws a network error when fetch cannot reach the backend', async () => {
    stubFormData();
    vi.spyOn(authStore, 'getAccessToken').mockReturnValue(null);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(parseResume(new Blob(['x']))).rejects.toEqual({
      code: 'NETWORK_ERROR',
      message: 'Cannot connect to the backend — is the server running?',
    });
  });

  it('extractText posts a file to /api/resume/extract and returns text', async () => {
    stubFormData();
    vi.spyOn(authStore, 'getAccessToken').mockReturnValue(null);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { text: 'Jane Smith' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(extractText(new Blob(['x']))).resolves.toBe('Jane Smith');

    expect(fetchMock).toHaveBeenCalledWith('/api/resume/extract', expect.objectContaining({
      method: 'POST',
      body: expect.any(FormDataStub),
    }));
    expect(fetchMock.mock.calls[0][1].body.entries).toHaveLength(1);
    expect(fetchMock.mock.calls[0][1].body.entries[0][0]).toBe('resume');
  });

  it('parseText posts JSON text to /api/resume/parse and returns parsed data', async () => {
    vi.spyOn(authStore, 'getAccessToken').mockReturnValue('abc');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { firstName: 'Jane' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(parseText('Jane Smith')).resolves.toEqual({ firstName: 'Jane' });

    expect(fetchMock).toHaveBeenCalledWith('/api/resume/parse', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer abc',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: 'Jane Smith' }),
    });
  });

  it('extractText and parseText surface backend error envelopes', async () => {
    stubFormData();
    vi.spyOn(authStore, 'getAccessToken').mockReturnValue(null);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({
        error: { code: 'VALIDATION_ERROR', message: 'No resume file provided.' },
      }),
    }));

    await expect(extractText(new Blob(['x']))).rejects.toEqual({
      code: 'VALIDATION_ERROR',
      message: 'No resume file provided.',
    });
  });
});
