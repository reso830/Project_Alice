import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let llmParser;

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

beforeEach(async () => {
  vi.resetModules();
  llmParser = await import('../../src/services/llmParser.js');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('llmParser', () => {
  it('sends one OpenRouter request and normalises assistant JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({
      content: JSON.stringify({
        firstName: '  Jane ',
        skills: ['JavaScript'],
        experience: [
          {
            role: 'Engineer',
            company: 'Acme',
            responsibilities: 'Built things',
            dateStarted: '01/2022',
            dateEnded: '02/2024',
          },
        ],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await llmParser.parseWithLlm('Resume text', 'sk-or-test');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer sk-or-test',
        'Content-Type': 'application/json',
      },
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe(llmParser.DEFAULT_MODEL);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1]).toEqual({ role: 'user', content: 'Resume text' });
    expect(result).toEqual({
      draft: expect.objectContaining({
        firstName: 'Jane',
        skills: [{ name: 'JavaScript', level: 2 }],
      }),
      truncated: false,
    });
  });

  it('uses a caller-provided model slug while preserving the default model fallback', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({
      content: JSON.stringify({ firstName: 'Jane' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await llmParser.parseWithLlm('Resume text', 'sk-or-test', 'anthropic/claude-sonnet-4');
    await llmParser.parseWithLlm('Resume text', 'sk-or-test');

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe('anthropic/claude-sonnet-4');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).model).toBe(llmParser.DEFAULT_MODEL);
  });

  it('truncates over-length input and reports truncation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({
      content: JSON.stringify({ firstName: 'Jane' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await llmParser.parseWithLlm('x'.repeat(llmParser.MAX_INPUT_CHARS + 10), 'key');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[1].content).toHaveLength(llmParser.MAX_INPUT_CHARS);
    expect(result.truncated).toBe(true);
  });

  it('throws a typed error for non-2xx provider responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({
      ok: false,
      status: 401,
      content: '{}',
    })));

    await expect(llmParser.parseWithLlm('Resume text', 'bad-key')).rejects.toMatchObject({
      code: 'LLM_PROVIDER_ERROR',
    });
  });

  it('throws a typed error for invalid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({
      content: 'not json',
    })));

    await expect(llmParser.parseWithLlm('Resume text', 'key')).rejects.toMatchObject({
      code: 'LLM_INVALID_RESPONSE',
    });
  });

  it('throws a typed error when normalised output is empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({
      content: JSON.stringify({ unknown: 'value' }),
    })));

    await expect(llmParser.parseWithLlm('Resume text', 'key')).rejects.toMatchObject({
      code: 'LLM_EMPTY_RESPONSE',
    });
  });

  it('aborts at the timeout constant', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        reject(error);
      });
    }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = llmParser.parseWithLlm('Resume text', 'key');
    const expectation = expect(promise).rejects.toMatchObject({
      code: 'LLM_TIMEOUT',
    });
    await vi.advanceTimersByTimeAsync(llmParser.LLM_TIMEOUT_MS);

    await expectation;
  });

  it('validates a key without issuing a resume parse request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeValidationResponse());
    vi.stubGlobal('fetch', fetchMock);

    await expect(llmParser.validateKey('sk-or-test', 'openai/gpt-4o-mini')).resolves.toEqual({
      ok: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).not.toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      headers: {
        Authorization: 'Bearer sk-or-test',
      },
    });
  });

  it.each([
    [429, 'rate_limit'],
    [408, 'timeout'],
    [503, 'server'],
    [401, 'invalid_key'],
    [403, 'invalid_key'],
    [402, 'quota'],
    [418, 'rate_limit'],
  ])('maps validation HTTP %s to %s', async (status, reason) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeValidationResponse({
      ok: false,
      status,
    })));

    await expect(llmParser.validateKey('sk-or-test')).resolves.toEqual({
      ok: false,
      reason,
    });
  });

  it('maps validation network and timeout failures to reason codes', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValueOnce(new TypeError('Network failed'))
      .mockRejectedValueOnce(Object.assign(new Error('Aborted'), { name: 'AbortError' })));

    await expect(llmParser.validateKey('sk-or-test')).resolves.toEqual({
      ok: false,
      reason: 'network',
    });
    await expect(llmParser.validateKey('sk-or-test')).resolves.toEqual({
      ok: false,
      reason: 'timeout',
    });
  });

  it.each([
    [429, 'rate_limit'],
    [408, 'timeout'],
    [503, 'server'],
    [401, 'invalid_key'],
    [403, 'invalid_key'],
    [402, 'quota'],
    ['NO_TEXT', 'NO_TEXT'],
    ['LLM_EMPTY_RESPONSE', 'NO_TEXT'],
    ['LLM_TIMEOUT', 'timeout'],
    ['LLM_NETWORK_ERROR', 'network'],
    [418, 'rate_limit'],
  ])('maps %s to shared reason %s', (input, reason) => {
    expect(llmParser.mapErrorToReason(input)).toBe(reason);
  });
});
