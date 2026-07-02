import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadProvider() {
  vi.resetModules();
  const { openrouterProvider } = await import('../../../src/services/providers/openrouter.js');
  const { mapErrorToReason } = await import('../../../src/services/aiErrors.js');
  return { openrouterProvider, mapErrorToReason };
}

function makeResponse({ ok = true, status = 200, content }) {
  return {
    ok,
    status,
    json: () => Promise.resolve({
      choices: [
        {
          message: {
            content,
          },
        },
      ],
    }),
  };
}

function makeValidationResponse({ ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: () => Promise.resolve({ data: [] }),
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('openrouterProvider', () => {
  it('completes with parsed assistant JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({
      content: JSON.stringify({ firstName: 'Jane' }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { openrouterProvider } = await loadProvider();

    const result = await openrouterProvider.complete({
      systemPrompt: 'Return JSON',
      userContent: 'Resume text',
      key: 'sk-or-test',
      model: 'openai/gpt-4o-mini',
    });

    expect(result).toEqual({
      parsed: { firstName: 'Jane' },
      truncated: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({
      model: 'openai/gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Return JSON' },
        { role: 'user', content: 'Resume text' },
      ],
    });
  });

  it('reports truncation and clips over-limit content', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({
      content: JSON.stringify({ ok: true }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { openrouterProvider } = await loadProvider();

    const result = await openrouterProvider.complete({
      systemPrompt: 'Return JSON',
      userContent: 'x'.repeat(24_010),
      key: 'sk-or-test',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[1].content).toHaveLength(24_000);
    expect(result.truncated).toBe(true);
  });

  it('falls back to the default model for a blank model', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({
      content: JSON.stringify({ ok: true }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { openrouterProvider } = await loadProvider();

    await openrouterProvider.complete({
      systemPrompt: 'Return JSON',
      userContent: 'Text',
      key: 'sk-or-test',
      model: '   ',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe(openrouterProvider.defaultModel);
  });

  it('maps timeout failures to timeout', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        reject(error);
      });
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { openrouterProvider, mapErrorToReason } = await loadProvider();

    const promise = openrouterProvider.complete({
      systemPrompt: 'Return JSON',
      userContent: 'Text',
      key: 'sk-or-test',
    });
    const expectation = expect(promise).rejects.toSatisfy((error) => (
      mapErrorToReason(error) === 'timeout'
    ));
    await vi.advanceTimersByTimeAsync(30_000);

    await expectation;
  });

  it('maps network failures to network', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network failed')));
    const { openrouterProvider, mapErrorToReason } = await loadProvider();

    await expect(openrouterProvider.complete({
      systemPrompt: 'Return JSON',
      userContent: 'Text',
      key: 'sk-or-test',
    })).rejects.toSatisfy((error) => mapErrorToReason(error) === 'network');
  });

  it.each([
    [401, 'invalid_key'],
    [402, 'quota'],
    [429, 'rate_limit'],
    [500, 'server'],
  ])('maps HTTP %s completion failures to %s', async (status, reason) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({
      ok: false,
      status,
      content: '{}',
    })));
    const { openrouterProvider, mapErrorToReason } = await loadProvider();

    await expect(openrouterProvider.complete({
      systemPrompt: 'Return JSON',
      userContent: 'Text',
      key: 'sk-or-test',
    })).rejects.toSatisfy((error) => mapErrorToReason(error) === reason);
  });

  it('rejects when response content is not valid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({
      content: 'not json',
    })));
    const { openrouterProvider } = await loadProvider();

    await expect(openrouterProvider.complete({
      systemPrompt: 'Return JSON',
      userContent: 'Text',
      key: 'sk-or-test',
    })).rejects.toMatchObject({ code: 'LLM_INVALID_RESPONSE' });
  });

  it('validates an accepted key against the auth-enforcing endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeValidationResponse());
    vi.stubGlobal('fetch', fetchMock);
    const { openrouterProvider } = await loadProvider();

    await expect(openrouterProvider.validateKey('sk-or-test')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/key');
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      Authorization: 'Bearer sk-or-test',
    });
  });

  it('maps rejected key validation to invalid_key', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeValidationResponse({
      ok: false,
      status: 401,
    })));
    const { openrouterProvider } = await loadProvider();

    await expect(openrouterProvider.validateKey('sk-or-test')).resolves.toEqual({
      ok: false,
      reason: 'invalid_key',
    });
  });

  it('maps validation network failures to network', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network failed')));
    const { openrouterProvider } = await loadProvider();

    await expect(openrouterProvider.validateKey('sk-or-test')).resolves.toEqual({
      ok: false,
      reason: 'network',
    });
  });

  it('maps validation AbortError to timeout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(
      Object.assign(new Error('Aborted'), { name: 'AbortError' }),
    ));
    const { openrouterProvider } = await loadProvider();

    await expect(openrouterProvider.validateKey('sk-or-test')).resolves.toEqual({
      ok: false,
      reason: 'timeout',
    });
  });
});
