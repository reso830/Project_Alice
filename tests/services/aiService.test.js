import { afterEach, describe, expect, it, vi } from 'vitest';

const providerMock = vi.hoisted(() => ({
  complete: vi.fn(),
  validateKey: vi.fn(),
}));

vi.mock('../../src/services/aiProvider.js', () => ({
  getActiveProvider: () => providerMock,
}));

afterEach(() => {
  providerMock.complete.mockReset();
  providerMock.validateKey.mockReset();
});

describe('aiService', () => {
  it('delegates complete to the active provider', async () => {
    providerMock.complete.mockResolvedValue({ parsed: { ok: true }, truncated: false });
    const { complete } = await import('../../src/services/aiService.js');
    const params = {
      systemPrompt: 'Return JSON',
      userContent: 'Text',
      key: 'sk-or-test',
      model: 'openai/gpt-4o-mini',
    };

    await expect(complete(params)).resolves.toEqual({
      parsed: { ok: true },
      truncated: false,
    });
    expect(providerMock.complete).toHaveBeenCalledWith(params);
  });

  it('delegates validateKey to the active provider', async () => {
    providerMock.validateKey.mockResolvedValue({ ok: true });
    const { validateKey } = await import('../../src/services/aiService.js');

    await expect(validateKey('sk-or-test')).resolves.toEqual({ ok: true });
    expect(providerMock.validateKey).toHaveBeenCalledWith('sk-or-test');
  });

  it('exports the default model and reason-code copy', async () => {
    const { DEFAULT_MODEL, REASON_CODES } = await import('../../src/services/aiService.js');

    expect(DEFAULT_MODEL).toBeTypeOf('string');
    expect(DEFAULT_MODEL.length).toBeGreaterThan(0);
    expect(REASON_CODES).toEqual(expect.objectContaining({
      rate_limit: expect.any(Object),
      timeout: expect.any(Object),
      server: expect.any(Object),
      network: expect.any(Object),
      invalid_key: expect.any(Object),
      quota: expect.any(Object),
      NO_TEXT: expect.any(Object),
    }));
  });

  it('exports shared error helpers', async () => {
    const { createLlmError, mapErrorToReason } = await import('../../src/services/aiService.js');

    expect(mapErrorToReason({ code: 'LLM_TIMEOUT' })).toBe('timeout');
    expect(mapErrorToReason({ status: 401 })).toBe('invalid_key');
    expect(mapErrorToReason({ status: 402 })).toBe('quota');
    expect(mapErrorToReason({ code: 'LLM_INVALID_RESPONSE' })).toBe('server');

    const timeoutError = createLlmError('LLM_TIMEOUT', 'msg');
    expect(timeoutError).toBeInstanceOf(Error);
    expect(timeoutError).toMatchObject({ code: 'LLM_TIMEOUT' });
    expect(timeoutError.status).toBeUndefined();

    const providerError = createLlmError('LLM_PROVIDER_ERROR', 'msg', 429);
    expect(providerError).toBeInstanceOf(Error);
    expect(providerError).toMatchObject({
      code: 'LLM_PROVIDER_ERROR',
      status: 429,
    });
  });
});
