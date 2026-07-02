import { describe, expect, it } from 'vitest';

import { createLlmError, mapErrorToReason } from '../../src/services/aiErrors.js';

describe('mapErrorToReason', () => {
  it('maps known error codes to reasons', () => {
    expect(mapErrorToReason({ code: 'NO_TEXT' })).toBe('NO_TEXT');
    expect(mapErrorToReason({ code: 'LLM_EMPTY_RESPONSE' })).toBe('NO_TEXT');
    expect(mapErrorToReason({ code: 'LLM_TIMEOUT' })).toBe('timeout');
    expect(mapErrorToReason({ name: 'AbortError' })).toBe('timeout');
    expect(mapErrorToReason({ code: 'LLM_NETWORK_ERROR' })).toBe('network');
  });

  it('maps recognized HTTP statuses to their reasons', () => {
    expect(mapErrorToReason(401)).toBe('invalid_key');
    expect(mapErrorToReason(403)).toBe('invalid_key');
    expect(mapErrorToReason(402)).toBe('quota');
    expect(mapErrorToReason(408)).toBe('timeout');
    expect(mapErrorToReason(429)).toBe('rate_limit');
    expect(mapErrorToReason(500)).toBe('server');
    expect(mapErrorToReason(503)).toBe('server');
  });

  it('maps unrecognized 4xx client errors to bad_request', () => {
    expect(mapErrorToReason(400)).toBe('bad_request');
    expect(mapErrorToReason(404)).toBe('bad_request');
    expect(mapErrorToReason(422)).toBe('bad_request');
    expect(mapErrorToReason(createLlmError('LLM_PROVIDER_ERROR', 'Bad request', 400))).toBe('bad_request');
  });

  it('falls back to server for unclassified errors', () => {
    expect(mapErrorToReason({})).toBe('server');
    expect(mapErrorToReason(600)).toBe('server');
  });
});
