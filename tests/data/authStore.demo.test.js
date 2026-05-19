import { beforeEach, describe, expect, it, vi } from 'vitest';

let supabaseMock = null;
let isHostedAuthAvailableMock = false;
const demoStoreMock = {
  loadSeed: vi.fn(),
  clear: vi.fn(),
};

vi.mock('../../src/services/supabaseClient.js', () => ({
  get supabase() {
    return supabaseMock;
  },
  get isHostedAuthAvailable() {
    return isHostedAuthAvailableMock;
  },
}));

vi.mock('../../src/data/demoStore.js', () => demoStoreMock);

beforeEach(() => {
  supabaseMock = null;
  isHostedAuthAvailableMock = false;
  demoStoreMock.loadSeed.mockClear();
  demoStoreMock.clear.mockClear();
  vi.resetModules();
});

function makeAuthMock({ session = null } = {}) {
  let onChangeCallback = null;
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session } }),
      onAuthStateChange: vi.fn((cb) => {
        onChangeCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    fire(evt, nextSession) {
      onChangeCallback?.(evt, nextSession);
    },
  };
}

describe('authStore demo transitions', () => {
  it('enterDemo() transitions to {status: demo, user: null, accessToken: null}', async () => {
    supabaseMock = makeAuthMock({ session: null });
    isHostedAuthAvailableMock = true;

    const store = await import('../../src/data/authStore.js');
    await store.init();

    store.enterDemo();

    expect(store.getAuthState()).toEqual({
      status: 'demo',
      user: null,
      accessToken: null,
    });
  });

  it('enterDemo() calls demoStore.loadSeed()', async () => {
    supabaseMock = makeAuthMock({ session: null });
    isHostedAuthAvailableMock = true;

    const store = await import('../../src/data/authStore.js');
    await store.init();

    store.enterDemo();

    expect(demoStoreMock.loadSeed).toHaveBeenCalledTimes(1);
  });

  it('enterDemo() notifies subscribers exactly once', async () => {
    supabaseMock = makeAuthMock({ session: null });
    isHostedAuthAvailableMock = true;

    const store = await import('../../src/data/authStore.js');
    await store.init();

    const listener = vi.fn();
    store.subscribe(listener);
    listener.mockClear(); // ignore any post-subscribe replay

    store.enterDemo();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'demo' }),
    );
  });

  it('exitDemo() transitions demo → unauthenticated and calls demoStore.clear()', async () => {
    supabaseMock = makeAuthMock({ session: null });
    isHostedAuthAvailableMock = true;

    const store = await import('../../src/data/authStore.js');
    await store.init();

    store.enterDemo();
    expect(store.getAuthState().status).toBe('demo');

    store.exitDemo();

    expect(store.getAuthState()).toEqual({
      status: 'unauthenticated',
      user: null,
      accessToken: null,
    });
    expect(demoStoreMock.clear).toHaveBeenCalledTimes(1);
  });

  it('exitDemo() notifies subscribers exactly once', async () => {
    supabaseMock = makeAuthMock({ session: null });
    isHostedAuthAvailableMock = true;

    const store = await import('../../src/data/authStore.js');
    await store.init();
    store.enterDemo();

    const listener = vi.fn();
    store.subscribe(listener);

    store.exitDemo();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'unauthenticated' }),
    );
  });

  it('init() with isHostedAuthAvailable=false resolves to local-mode regardless of prior demo state', async () => {
    isHostedAuthAvailableMock = false;
    const store = await import('../../src/data/authStore.js');

    store.enterDemo();
    expect(store.getAuthState().status).toBe('demo');

    await store.init();

    expect(store.getAuthState().status).toBe('local-mode');
  });

  it('init() in hosted mode with no Supabase session resolves to unauthenticated, not demo', async () => {
    supabaseMock = makeAuthMock({ session: null });
    isHostedAuthAvailableMock = true;

    const store = await import('../../src/data/authStore.js');
    await store.init();

    expect(store.getAuthState().status).toBe('unauthenticated');
  });

  it('getAccessToken() returns null while status is demo', async () => {
    supabaseMock = makeAuthMock({ session: null });
    isHostedAuthAvailableMock = true;

    const store = await import('../../src/data/authStore.js');
    await store.init();
    store.enterDemo();

    expect(store.getAccessToken()).toBeNull();
  });

  it('exports DEMO_STATUS as the string "demo"', async () => {
    const store = await import('../../src/data/authStore.js');
    expect(store.DEMO_STATUS).toBe('demo');
  });
});
