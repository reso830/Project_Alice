import { beforeEach, describe, expect, it, vi } from 'vitest';

let supabaseMock = null;
let isHostedAuthAvailableMock = false;

vi.mock('../../src/services/supabaseClient.js', () => ({
  get supabase() {
    return supabaseMock;
  },
  get isHostedAuthAvailable() {
    return isHostedAuthAvailableMock;
  },
}));

beforeEach(() => {
  supabaseMock = null;
  isHostedAuthAvailableMock = false;
  vi.resetModules();
});

function makeAuthMock({ session = null } = {}) {
  let onChangeCallback = null;
  const mock = {
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
  return mock;
}

describe('authStore', () => {
  it('resolves to local-mode state when supabase is unavailable', async () => {
    isHostedAuthAvailableMock = false;
    const store = await import('../../src/data/authStore.js');

    await store.init();

    expect(store.getAuthState()).toEqual({
      status: 'local-mode',
      user: null,
      accessToken: null,
    });
    expect(store.getAccessToken()).toBeNull();
  });

  it('initialises to authenticated when a session is present', async () => {
    const session = {
      user: { id: 'user-1', email: 'jane@example.com' },
      access_token: 'tok-1',
    };
    supabaseMock = makeAuthMock({ session });
    isHostedAuthAvailableMock = true;

    const store = await import('../../src/data/authStore.js');
    await store.init();

    expect(store.getAuthState()).toEqual({
      status: 'authenticated',
      user: { id: 'user-1', email: 'jane@example.com' },
      accessToken: 'tok-1',
    });
    expect(store.getAccessToken()).toBe('tok-1');
  });

  it('initialises to unauthenticated when no session is present', async () => {
    supabaseMock = makeAuthMock({ session: null });
    isHostedAuthAvailableMock = true;

    const store = await import('../../src/data/authStore.js');
    await store.init();

    expect(store.getAuthState()).toEqual({
      status: 'unauthenticated',
      user: null,
      accessToken: null,
    });
  });

  it('updates state when onAuthStateChange fires with a new session', async () => {
    supabaseMock = makeAuthMock({ session: null });
    isHostedAuthAvailableMock = true;

    const store = await import('../../src/data/authStore.js');
    await store.init();

    supabaseMock.fire('SIGNED_IN', {
      user: { id: 'user-2', email: 'mary@example.com' },
      access_token: 'tok-2',
    });

    expect(store.getAuthState().status).toBe('authenticated');
    expect(store.getAccessToken()).toBe('tok-2');
  });

  it('subscribe returns an unsubscribe that prevents further notifications', async () => {
    supabaseMock = makeAuthMock({ session: null });
    isHostedAuthAvailableMock = true;

    const store = await import('../../src/data/authStore.js');
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    await store.init();
    expect(listener).toHaveBeenCalled();

    listener.mockClear();
    unsubscribe();

    supabaseMock.fire('SIGNED_IN', {
      user: { id: 'user-3', email: 'x@y.com' },
      access_token: 'tok-3',
    });

    expect(listener).not.toHaveBeenCalled();
  });

  it('signOut calls the client; subsequent SIGNED_OUT event flips to unauthenticated', async () => {
    const session = {
      user: { id: 'user-1', email: 'jane@example.com' },
      access_token: 'tok-1',
    };
    supabaseMock = makeAuthMock({ session });
    isHostedAuthAvailableMock = true;

    const store = await import('../../src/data/authStore.js');
    await store.init();
    expect(store.getAuthState().status).toBe('authenticated');

    await store.signOut();
    expect(supabaseMock.auth.signOut).toHaveBeenCalledTimes(1);

    supabaseMock.fire('SIGNED_OUT', null);
    expect(store.getAuthState()).toEqual({
      status: 'unauthenticated',
      user: null,
      accessToken: null,
    });
  });

  it('signOut is a safe no-op when supabase is null', async () => {
    isHostedAuthAvailableMock = false;
    supabaseMock = null;

    const store = await import('../../src/data/authStore.js');
    await expect(store.signOut()).resolves.toBeUndefined();
  });
});
