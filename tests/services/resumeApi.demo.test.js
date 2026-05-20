// No-fetch guard for resume parse in demo mode (feature 020). The demo
// has no Supabase session, so the protected `/api/resume/parse` endpoint
// would reject with 401 anyway — but the service throws a clearer
// `DEMO_FEATURE_UNAVAILABLE` error before reaching the network.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authStoreMock = {
  DEMO_STATUS: 'demo',
  getAuthState: vi.fn(() => ({ status: 'demo', user: null, accessToken: null })),
  getAccessToken: vi.fn(() => null),
};

vi.mock('../../src/data/authStore.js', () => authStoreMock);

let fetchSpy;

beforeEach(() => {
  authStoreMock.getAuthState.mockClear();
  authStoreMock.getAccessToken.mockClear();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('services/resumeApi.js — demo mode throws DEMO_FEATURE_UNAVAILABLE', () => {
  it('parseResume(file) rejects with the demo-unavailable shape', async () => {
    const { parseResume } = await import('../../src/services/resumeApi.js');
    await expect(parseResume(new globalThis.File([], 'r.pdf'))).rejects.toEqual({
      code: 'DEMO_FEATURE_UNAVAILABLE',
      message: 'Resume import is available after signing in.',
    });
  });

  it('parseResume(file) does not call fetch', async () => {
    const { parseResume } = await import('../../src/services/resumeApi.js');
    try {
      await parseResume(new globalThis.File([], 'r.pdf'));
    } catch {
      // expected — the demo throw
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
