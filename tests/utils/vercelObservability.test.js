import { afterEach, describe, expect, it, vi } from 'vitest';

const injectWebAnalytics = vi.fn();
const pageview = vi.fn();
const injectSpeedInsights = vi.fn();
let mockedAuthState = { status: 'authenticated' };

vi.mock('@vercel/analytics', () => ({
  inject: (...args) => injectWebAnalytics(...args),
  pageview: (...args) => pageview(...args),
}));
vi.mock('@vercel/speed-insights', () => ({
  injectSpeedInsights: (...args) => injectSpeedInsights(...args),
}));
vi.mock('../../src/data/authStore.js', () => ({
  DEMO_STATUS: 'demo',
  getAuthState: () => mockedAuthState,
}));

const {
  reportVercelObservability,
  reportPageview,
  _resetForTesting,
} = await import('../../src/utils/vercelObservability.js');

function getBeforeSend() {
  // Both packages are called with the same beforeSend; read it off whichever
  // mock was invoked (injectSpeedInsights is called first).
  return injectSpeedInsights.mock.calls.at(-1)[0].beforeSend;
}

describe('vercelObservability', () => {
  afterEach(() => {
    injectWebAnalytics.mockClear();
    pageview.mockClear();
    injectSpeedInsights.mockClear();
    mockedAuthState = { status: 'authenticated' };
    _resetForTesting();
  });

  describe('reportVercelObservability', () => {
    it('does not inject either package when runtime is local', () => {
      reportVercelObservability({ runtime: 'local' });
      expect(injectSpeedInsights).not.toHaveBeenCalled();
      expect(injectWebAnalytics).not.toHaveBeenCalled();
    });

    it('does not inject either package when runtime is missing', () => {
      reportVercelObservability({});
      expect(injectSpeedInsights).not.toHaveBeenCalled();
      expect(injectWebAnalytics).not.toHaveBeenCalled();
    });

    it('injects both packages when runtime is hosted', () => {
      reportVercelObservability({ runtime: 'hosted' });
      expect(injectSpeedInsights).toHaveBeenCalledTimes(1);
      expect(injectWebAnalytics).toHaveBeenCalledTimes(1);
    });
  });

  describe('beforeSend', () => {
    it('drops every event while auth state is demo', () => {
      reportVercelObservability({ runtime: 'hosted' });
      const beforeSend = getBeforeSend();

      mockedAuthState = { status: 'demo' };
      expect(beforeSend({ type: 'pageview', url: '/tracker' })).toBeNull();
    });

    it('passes through non-demo events unchanged when the url has no auth artifacts', () => {
      reportVercelObservability({ runtime: 'hosted' });
      const beforeSend = getBeforeSend();

      const event = { type: 'pageview', url: '/calendar' };
      expect(beforeSend(event)).toEqual({ type: 'pageview', url: '/calendar' });
    });

    it('strips the access_token hash from the url', () => {
      reportVercelObservability({ runtime: 'hosted' });
      const beforeSend = getBeforeSend();

      const event = { type: 'pageview', url: '/welcome#access_token=abc123&type=email' };
      expect(beforeSend(event).url).toBe('/welcome');
    });

    it('strips the auth=callback query param and preserves sibling params', () => {
      reportVercelObservability({ runtime: 'hosted' });
      const beforeSend = getBeforeSend();

      expect(beforeSend({ type: 'pageview', url: '/welcome?auth=callback' }).url).toBe('/welcome');
      expect(beforeSend({ type: 'pageview', url: '/welcome?auth=callback&foo=bar' }).url).toBe('/welcome?foo=bar');
      expect(beforeSend({ type: 'pageview', url: '/welcome?foo=bar&auth=callback' }).url).toBe('/welcome?foo=bar');
    });

    it('strips both the query param and the hash together', () => {
      reportVercelObservability({ runtime: 'hosted' });
      const beforeSend = getBeforeSend();

      const event = { type: 'pageview', url: '/welcome?auth=callback#access_token=abc&type=email' };
      expect(beforeSend(event).url).toBe('/welcome');
    });
  });

  describe('reportPageview', () => {
    it('no-ops when observability was never enabled (local mode)', () => {
      reportPageview('calendar');
      expect(pageview).not.toHaveBeenCalled();
    });

    it('reports the mapped path for known pages once enabled', () => {
      reportVercelObservability({ runtime: 'hosted' });

      reportPageview('tracker');
      expect(pageview).toHaveBeenLastCalledWith({ path: '/' });

      reportPageview('calendar');
      expect(pageview).toHaveBeenLastCalledWith({ path: '/calendar' });

      reportPageview('profile');
      expect(pageview).toHaveBeenLastCalledWith({ path: '/profile' });

      reportPageview('profile-edit');
      expect(pageview).toHaveBeenLastCalledWith({ path: '/profile/edit' });
    });

    it('falls back to /{page} for an unmapped page name', () => {
      reportVercelObservability({ runtime: 'hosted' });
      reportPageview('something-new');
      expect(pageview).toHaveBeenLastCalledWith({ path: '/something-new' });
    });
  });
});
