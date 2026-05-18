import { describe, expect, it, vi } from 'vitest';

// Factory-tracking mocks: each `vi.mock` factory is invoked exactly when the
// corresponding module is loaded. The dispatcher's lazy `await import(...)`
// for the Supabase modules MUST stay lazy — local-mode and demo-mode boot
// loading any of these files would invoke the factories and fail the
// assertions below.
//
// Tests are ordered intentionally: local + demo tests run before hosted
// tests, so the cumulative call counts on the module-level factories tell
// the truth about which runtime branch loaded Supabase. We deliberately
// avoid `vi.resetModules()` here — once a lazy-import lands in Node's ESM
// cache for the file, re-importing returns the cached binding without
// re-firing the mock factory. The cumulative-counts approach is robust to
// that caching.

const supabaseClientFactory = vi.fn(() => ({
  createSupabaseClientForRequest: vi.fn(() => ({})),
}));
const supabaseAppsFactory = vi.fn(() => ({
  createSupabaseApplicationsRepository: vi.fn(() => ({ __kind: 'apps' })),
}));
const supabaseProfileFactory = vi.fn(() => ({
  createSupabaseProfileRepository: vi.fn(() => ({ __kind: 'profile' })),
}));

vi.mock('../../../server/repositories/supabase/client.js', () =>
  supabaseClientFactory(),
);
vi.mock('../../../server/repositories/supabase/applications.js', () =>
  supabaseAppsFactory(),
);
vi.mock('../../../server/repositories/supabase/profile.js', () =>
  supabaseProfileFactory(),
);

// Run the local + demo lazy-import discipline tests first, then hosted.
// This is the order vitest executes `it` blocks in a `describe`.

describe('createRepositories lazy-import discipline (order-sensitive)', () => {
  it('local-mode createRepositories does NOT load Supabase modules', async () => {
    const { createRepositories } = await import(
      '../../../server/repositories/index.js'
    );
    await createRepositories({
      isLocal: true,
      isHosted: false,
      isDemo: false,
    });

    expect(supabaseClientFactory).not.toHaveBeenCalled();
    expect(supabaseAppsFactory).not.toHaveBeenCalled();
    expect(supabaseProfileFactory).not.toHaveBeenCalled();
  });

  it('demo-mode createRepositories does NOT load Supabase modules', async () => {
    const { createRepositories } = await import(
      '../../../server/repositories/index.js'
    );
    await createRepositories({ isDemo: true });

    expect(supabaseClientFactory).not.toHaveBeenCalled();
    expect(supabaseAppsFactory).not.toHaveBeenCalled();
    expect(supabaseProfileFactory).not.toHaveBeenCalled();
  });

  it('hosted-mode createRepositories DOES load Supabase modules (one-time)', async () => {
    const { createRepositories } = await import(
      '../../../server/repositories/index.js'
    );
    await createRepositories({ isHosted: true });

    // Each module is loaded exactly once for the lifetime of the test file
    // (Node's ESM cache). The mock factory fires on that single load.
    expect(supabaseClientFactory).toHaveBeenCalledTimes(1);
    expect(supabaseAppsFactory).toHaveBeenCalledTimes(1);
    expect(supabaseProfileFactory).toHaveBeenCalledTimes(1);
  });
});

describe('createRepositories dispatcher — uniform forRequest contract', () => {
  it('demo runtime returns { forRequest } that yields demo stubs', async () => {
    const { createRepositories, DemoRepositoryNotImplementedError } =
      await import('../../../server/repositories/index.js');
    const dispatcher = await createRepositories({ isDemo: true });

    expect(typeof dispatcher.forRequest).toBe('function');
    const repos = dispatcher.forRequest({});
    expect(() => repos.applications.getAll()).toThrow(
      DemoRepositoryNotImplementedError,
    );
    expect(() => repos.profile.get()).toThrow(
      DemoRepositoryNotImplementedError,
    );
  });

  it('hosted runtime returns { forRequest } that constructs per-request Supabase repos', async () => {
    const { createRepositories } = await import(
      '../../../server/repositories/index.js'
    );
    const dispatcher = await createRepositories({ isHosted: true });

    expect(typeof dispatcher.forRequest).toBe('function');

    const mockReq = {
      user: { id: 'user-1' },
      headers: { authorization: 'Bearer x' },
    };
    const repos = dispatcher.forRequest(mockReq);
    expect(repos).toHaveProperty('applications');
    expect(repos).toHaveProperty('profile');
  });

  it('hosted forRequest constructs a fresh adapter bundle per call (per-request, not cached)', async () => {
    const { createRepositories } = await import(
      '../../../server/repositories/index.js'
    );
    const dispatcher = await createRepositories({ isHosted: true });

    // The inner factory (returned by the module-level mock factory) is the
    // function dispatcher calls to construct per-request adapters. Each
    // forRequest(req) call should invoke it once.
    const innerAppsFactory =
      supabaseAppsFactory.mock.results[0].value
        .createSupabaseApplicationsRepository;
    innerAppsFactory.mockClear();

    const mockReq = {
      user: { id: 'user-1' },
      headers: { authorization: 'Bearer x' },
    };
    dispatcher.forRequest(mockReq);
    dispatcher.forRequest(mockReq);

    expect(innerAppsFactory).toHaveBeenCalledTimes(2);
  });

  it('local runtime returns { forRequest } that yields the same SQLite bundle every call', async () => {
    const { createRepositories } = await import(
      '../../../server/repositories/index.js'
    );
    const dispatcher = await createRepositories({
      isLocal: true,
      isHosted: false,
      isDemo: false,
    });

    expect(typeof dispatcher.forRequest).toBe('function');

    const a = dispatcher.forRequest({});
    const b = dispatcher.forRequest({});
    // Local mode returns the same long-lived bundle (const captured at
    // dispatcher creation).
    expect(a).toBe(b);

    // Smoke-functional: SQLite adapter (not a stub) returns an array
    // for getAll(). A stub would throw.
    expect(Array.isArray(a.applications.getAll())).toBe(true);
  });

  it('demo takes precedence over hosted when both flags are set', async () => {
    const { createRepositories, DemoRepositoryNotImplementedError } =
      await import('../../../server/repositories/index.js');
    const dispatcher = await createRepositories({
      isDemo: true,
      isHosted: true,
    });

    const repos = dispatcher.forRequest({});
    expect(() => repos.applications.getAll()).toThrow(
      DemoRepositoryNotImplementedError,
    );
  });
});
