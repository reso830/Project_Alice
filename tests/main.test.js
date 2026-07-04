// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Side-effect imports that main.js performs at module load.
vi.mock('../src/styles/main.css', () => ({}));
vi.mock('../src/assets/logo/alice-sigil-full-white.svg', () => ({
  default: '/alice-sigil-full-white.svg',
}));

const authMocks = vi.hoisted(() => ({
  state: { status: 'local-mode', user: null, accessToken: null },
  subscribers: new Set(),
  init: vi.fn().mockResolvedValue(undefined),
  signOut: vi.fn(),
  notice: null,
}));

vi.mock('../src/data/authStore.js', () => ({
  getAuthState: () => authMocks.state,
  subscribe: (fn) => {
    authMocks.subscribers.add(fn);
    fn(authMocks.state);
    return () => authMocks.subscribers.delete(fn);
  },
  init: authMocks.init,
  signOut: authMocks.signOut,
  getAccessToken: () => null,
  setAuthNotice: (message, type = 'error') => {
    authMocks.notice = message ? { message, type } : null;
  },
  consumeAuthNotice: () => {
    const n = authMocks.notice;
    authMocks.notice = null;
    return n;
  },
}));

vi.mock('../src/pages/welcome/WelcomePage.js', () => ({
  WelcomePage: { mount: vi.fn(), unmount: vi.fn() },
}));
vi.mock('../src/pages/welcome/AuthOverlay.js', () => ({ AuthOverlay: {} }));

const supabaseClientState = vi.hoisted(() => ({
  isHostedAuthAvailable: true,
}));

vi.mock('../src/services/supabaseClient.js', () => ({
  get supabase() { return null; },
  get isHostedAuthAvailable() { return supabaseClientState.isHostedAuthAvailable; },
  get emailRedirectUrl() { return ''; },
}));

const healthMocks = vi.hoisted(() => ({
  getHealth: vi.fn(),
}));

const updateToastMocks = vi.hoisted(() => ({
  mount: vi.fn(),
  destroy: vi.fn(),
}));
const updateControllerMocks = vi.hoisted(() => ({
  unsubscribe: vi.fn(),
  resetUpdateControllerForTesting: vi.fn(),
  subscribeUpdateController: vi.fn(() => updateControllerMocks.unsubscribe),
}));

vi.mock('../src/services/healthApi.js', () => ({
  getHealth: healthMocks.getHealth,
}));
vi.mock('../src/data/updateController.js', () => updateControllerMocks);

// Heavy page modules — replace with no-op mount/unmount so we can observe
// what main.js mounts at the top level without the pages themselves trying
// to talk to repositories/services.
vi.mock('../src/pages/Tracker.js', () => ({
  Tracker: { mount: vi.fn(), unmount: vi.fn() },
}));
vi.mock('../src/pages/Calendar.js', () => ({
  Calendar: { mount: vi.fn(), unmount: vi.fn() },
}));
vi.mock('../src/pages/Profile.js', () => ({
  Profile: { mount: vi.fn(), unmount: vi.fn() },
}));
vi.mock('../src/pages/ProfileEdit.js', () => ({
  ProfileEdit: { mount: vi.fn(), unmount: vi.fn(), confirmNavigation: () => true },
}));
vi.mock('../src/data/store.js', () => ({
  store: {
    hasStoredApplications: () => true,
    load: vi.fn(),
    save: vi.fn(),
    getAll: () => [],
  },
}));
vi.mock('../src/components/Footer.js', () => ({
  Footer: { render: () => { const f = document.createElement('footer'); f.className = 'site-footer'; return f; } },
}));
vi.mock('../src/components/UpdateToast.js', () => ({
  UpdateToast: updateToastMocks,
}));

import { _resetForTesting, bootstrap, runtimeHandshake } from '../src/main.js';

beforeEach(() => {
  authMocks.state = { status: 'local-mode', user: null, accessToken: null };
  authMocks.subscribers.clear();
  authMocks.init.mockClear();
  authMocks.init.mockResolvedValue(undefined);
  authMocks.signOut.mockClear();
  authMocks.notice = null;
  supabaseClientState.isHostedAuthAvailable = true;
  healthMocks.getHealth.mockReset();
  updateToastMocks.mount.mockReset();
  updateToastMocks.destroy.mockReset();
  updateControllerMocks.unsubscribe.mockReset();
  updateControllerMocks.resetUpdateControllerForTesting.mockReset();
  updateControllerMocks.subscribeUpdateController.mockClear();
  updateControllerMocks.subscribeUpdateController.mockReturnValue(updateControllerMocks.unsubscribe);
  while (document.body.firstChild) {
    document.body.firstChild.remove();
  }
  _resetForTesting();
});

afterEach(() => {
  // module-level state inside main.js persists across tests; bootstrap is
  // designed to be re-runnable, but we explicitly clear the DOM each beforeEach.
});

describe('runtimeHandshake', () => {
  it('returns { configError: true } when hosted runtime + isHostedAuthAvailable=false', async () => {
    const healthFn = vi.fn().mockResolvedValue({ status: 'ok', runtime: 'hosted' });
    const result = await runtimeHandshake({ healthFn, hostedAuthAvailable: false });
    expect(result).toEqual({ configError: true, health: { status: 'ok', runtime: 'hosted' } });
  });

  it('returns { configError: false } when hosted runtime + isHostedAuthAvailable=true', async () => {
    const healthFn = vi.fn().mockResolvedValue({ status: 'ok', runtime: 'hosted' });
    const result = await runtimeHandshake({ healthFn, hostedAuthAvailable: true });
    expect(result).toEqual({ configError: false, health: { status: 'ok', runtime: 'hosted' } });
  });

  it('returns { configError: false } when local runtime', async () => {
    const healthFn = vi.fn().mockResolvedValue({ status: 'ok', runtime: 'local' });
    const result = await runtimeHandshake({ healthFn, hostedAuthAvailable: false });
    expect(result).toEqual({ configError: false, health: { status: 'ok', runtime: 'local' } });
  });

  it('swallows network failures and returns { configError: false }', async () => {
    const healthFn = vi.fn().mockRejectedValue({ code: 'NETWORK_ERROR', message: 'down' });
    const result = await runtimeHandshake({ healthFn, hostedAuthAvailable: false });
    expect(result).toEqual({ configError: false, health: null });
  });
});

describe('bootstrap — ConfigError handshake wiring', () => {
  it('mounts ConfigError when getHealth says hosted and isHostedAuthAvailable is false', async () => {
    authMocks.state = { status: 'unauthenticated', user: null, accessToken: null };
    supabaseClientState.isHostedAuthAvailable = false;
    healthMocks.getHealth.mockResolvedValue({ status: 'ok', runtime: 'hosted' });

    await bootstrap();

    expect(document.querySelector('.config-error')).not.toBeNull();
    expect(document.querySelector('.navbar')).toBeNull();
    expect(document.querySelector('#welcome-root')).toBeNull();
  });

  it('mounts the app shell (navbar) when getHealth says local and state is local-mode', async () => {
    authMocks.state = { status: 'local-mode', user: null, accessToken: null };
    supabaseClientState.isHostedAuthAvailable = true;
    healthMocks.getHealth.mockResolvedValue({ status: 'ok', runtime: 'local' });

    await bootstrap();

    expect(document.querySelector('.config-error')).toBeNull();
    expect(document.querySelector('.topbar')).not.toBeNull();
  });

  it('passes update capability into the global update toast', async () => {
    authMocks.state = { status: 'local-mode', user: null, accessToken: null };
    const health = { status: 'ok', runtime: 'local', updateSupported: true };
    healthMocks.getHealth.mockResolvedValue(health);

    await bootstrap();

    expect(updateToastMocks.mount).toHaveBeenCalledWith(expect.objectContaining({ health }));
    expect(updateControllerMocks.subscribeUpdateController).toHaveBeenCalledTimes(1);
  });

  it('runs the runtime handshake BEFORE subscribing to authStore and never initialises auth on the config-error path', async () => {
    authMocks.state = { status: 'unauthenticated', user: null, accessToken: null };
    supabaseClientState.isHostedAuthAvailable = false;
    healthMocks.getHealth.mockResolvedValue({ status: 'ok', runtime: 'hosted' });

    await bootstrap();

    // No subscriber registered, auth never initialised → no possibility of a
    // brief welcome/app-shell flash before ConfigError takes over.
    expect(authMocks.subscribers.size).toBe(0);
    expect(authMocks.init).not.toHaveBeenCalled();
    expect(document.querySelector('.config-error')).not.toBeNull();
  });

  it('subscribes to authStore only after the handshake passes', async () => {
    authMocks.state = { status: 'local-mode', user: null, accessToken: null };
    supabaseClientState.isHostedAuthAvailable = true;
    healthMocks.getHealth.mockResolvedValue({ status: 'ok', runtime: 'local' });

    await bootstrap();

    // At minimum the main render() callback is subscribed. The real Navbar
    // also subscribes when mounted, so we allow >= 1.
    expect(authMocks.subscribers.size).toBeGreaterThanOrEqual(1);
    expect(authMocks.init).toHaveBeenCalledTimes(1);
  });

  it('shows the deleted-account notice as a toast when rerouting to Welcome (FR-011a)', async () => {
    authMocks.state = { status: 'unauthenticated', user: null, accessToken: null };
    authMocks.notice = { message: 'Your account no longer exists.', type: 'error' };
    supabaseClientState.isHostedAuthAvailable = true;
    healthMocks.getHealth.mockResolvedValue({ status: 'ok', runtime: 'hosted' });

    await bootstrap();

    expect(document.querySelector('#welcome-root')).not.toBeNull();
    const toast = document.querySelector('.toast');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toContain('Your account no longer exists.');
  });

  it('shows the account-deleted success confirmation as a toast on the Welcome reroute (FR-013)', async () => {
    authMocks.state = { status: 'unauthenticated', user: null, accessToken: null };
    authMocks.notice = { message: 'Account deleted.', type: 'success' };
    supabaseClientState.isHostedAuthAvailable = true;
    healthMocks.getHealth.mockResolvedValue({ status: 'ok', runtime: 'hosted' });

    await bootstrap();

    const toast = document.querySelector('.toast');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toContain('Account deleted.');
  });

  it('shows no toast on a normal sign-out to Welcome (no notice)', async () => {
    authMocks.state = { status: 'unauthenticated', user: null, accessToken: null };
    authMocks.notice = null;
    supabaseClientState.isHostedAuthAvailable = true;
    healthMocks.getHealth.mockResolvedValue({ status: 'ok', runtime: 'hosted' });

    await bootstrap();

    expect(document.querySelector('#welcome-root')).not.toBeNull();
    expect(document.querySelector('.toast')).toBeNull();
  });
});
