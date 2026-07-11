// @vitest-environment jsdom
import fs from 'node:fs';
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

const welcomePageMocks = vi.hoisted(() => ({
  mount: vi.fn(),
  unmount: vi.fn(),
  setAuthView: vi.fn(),
  getAuthView: vi.fn(() => null),
}));

vi.mock('../src/pages/welcome/WelcomePage.js', () => ({
  WelcomePage: welcomePageMocks,
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

import { _resetForTesting, _setLazyPageImporterForTesting, bootstrap, navigate, runtimeHandshake } from '../src/main.js';

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function installStartupLoader() {
  document.body.innerHTML = [
    '<div id="app">',
    '<section class="startup-loader">',
    '<div class="startup-loader__edge-glow" aria-hidden="true"><div class="startup-loader__edge-glow-base"></div></div>',
    '<p class="startup-loader__status" role="status" aria-live="polite">Getting things ready…</p>',
    '<button type="button" class="startup-loader__retry" hidden>Retry</button>',
    '</section>',
    '</div>',
    '<script type="module" src="/src/main.js"></script>',
  ].join('');
}

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
  welcomePageMocks.mount.mockClear();
  welcomePageMocks.unmount.mockClear();
  welcomePageMocks.setAuthView.mockClear();
  welcomePageMocks.getAuthView.mockReset().mockReturnValue(null);
  while (document.body.firstChild) {
    document.body.firstChild.remove();
  }
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  _resetForTesting();
});

afterEach(() => {
  // module-level state inside main.js persists across tests; bootstrap is
  // designed to be re-runnable, but we explicitly clear the DOM each beforeEach.
  vi.unstubAllGlobals();
  vi.useRealTimers();
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
    // Realistic pairing: isHostedAuthAvailable=false means authStore.init()
    // resolves 'local-mode' synchronously (never 'unauthenticated' — that
    // status is only reached via a real getSession() call).
    authMocks.state = { status: 'local-mode', user: null, accessToken: null };
    supabaseClientState.isHostedAuthAvailable = false;
    healthMocks.getHealth.mockResolvedValue({ status: 'ok', runtime: 'hosted' });

    await bootstrap();

    expect(document.querySelector('.config-error')).not.toBeNull();
    expect(document.querySelector('.navbar')).toBeNull();
    expect(document.querySelector('#welcome-root')).toBeNull();
  });

  it('mounts the app shell (navbar) when getHealth says local and state is local-mode', async () => {
    authMocks.state = { status: 'local-mode', user: null, accessToken: null };
    supabaseClientState.isHostedAuthAvailable = false;
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

  it('runs getHealth() and authStore.init() concurrently, but reaches ConfigError with no flash of Welcome/shell (C2, C3)', async () => {
    // isHostedAuthAvailable=false → authStore.init() resolves 'local-mode'
    // synchronously (no network call), while getHealth() is still pending —
    // exactly the plan-review's critical scenario: a misconfigured hosted
    // deploy resolves local-mode faster than health.
    authMocks.state = { status: 'local-mode', user: null, accessToken: null };
    supabaseClientState.isHostedAuthAvailable = false;
    const health = createDeferred();
    healthMocks.getHealth.mockReturnValue(health.promise);

    const boot = bootstrap();
    await Promise.resolve();

    // WS2: subscribe/init run concurrently now (unlike the old sequential
    // design), but nothing mounts yet — local-mode is held behind health.
    expect(authMocks.subscribers.size).toBeGreaterThanOrEqual(1);
    expect(authMocks.init).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.topbar')).toBeNull();
    expect(document.querySelector('#welcome-root')).toBeNull();
    expect(document.querySelector('.config-error')).toBeNull();

    health.resolve({ status: 'ok', runtime: 'hosted' });
    await boot;

    expect(document.querySelector('.config-error')).not.toBeNull();
    expect(document.querySelector('.topbar')).toBeNull();
    expect(document.querySelector('#welcome-root')).toBeNull();
  });

  it('subscribes to authStore and initializes auth concurrently with the health check', async () => {
    authMocks.state = { status: 'local-mode', user: null, accessToken: null };
    supabaseClientState.isHostedAuthAvailable = false;
    healthMocks.getHealth.mockResolvedValue({ status: 'ok', runtime: 'local' });

    await bootstrap();

    // At minimum the main render() callback is subscribed. The real Navbar
    // also subscribes when mounted, so we allow >= 1.
    expect(authMocks.subscribers.size).toBeGreaterThanOrEqual(1);
    expect(authMocks.init).toHaveBeenCalledTimes(1);
  });

  it('mounts the shell immediately for authenticated, without waiting on a pending health call (C1)', async () => {
    authMocks.state = { status: 'authenticated', user: { id: 'u1' }, accessToken: 'tok' };
    supabaseClientState.isHostedAuthAvailable = true;
    const health = createDeferred();
    healthMocks.getHealth.mockReturnValue(health.promise);

    const boot = bootstrap();
    await Promise.resolve();

    expect(document.querySelector('.topbar')).not.toBeNull();
    expect(document.querySelector('.config-error')).toBeNull();

    health.resolve({ status: 'ok', runtime: 'hosted' });
    await boot;
  });

  it('mounts Welcome immediately for unauthenticated, without waiting on a pending health call (C1)', async () => {
    authMocks.state = { status: 'unauthenticated', user: null, accessToken: null };
    supabaseClientState.isHostedAuthAvailable = true;
    const health = createDeferred();
    healthMocks.getHealth.mockReturnValue(health.promise);

    const boot = bootstrap();
    await Promise.resolve();

    expect(document.querySelector('#welcome-root')).not.toBeNull();
    // Issue #139 (Lighthouse "landmark-one-main" audit): the page root the
    // whole app tree rebuilds under <body> on every mount must itself be a
    // <main> landmark — index.html's static <main id="app"> never survives
    // to this point (clearBody() removes it before this root is appended).
    expect(document.querySelector('#welcome-root').tagName).toBe('MAIN');
    expect(document.querySelector('.config-error')).toBeNull();

    health.resolve({ status: 'ok', runtime: 'hosted' });
    await boot;
  });

  it('replaces the Footer element and re-invokes UpdateToast.mount() when health resolves after the authenticated shell already mounted (C5)', async () => {
    authMocks.state = { status: 'authenticated', user: { id: 'u1' }, accessToken: 'tok' };
    supabaseClientState.isHostedAuthAvailable = true;
    const health = createDeferred();
    healthMocks.getHealth.mockReturnValue(health.promise);

    const boot = bootstrap();
    await Promise.resolve();

    const footerBeforeHealth = document.querySelector('.site-footer');
    expect(footerBeforeHealth).not.toBeNull();
    updateToastMocks.mount.mockClear();

    const resolvedHealth = { status: 'ok', runtime: 'hosted', updateSupported: true };
    health.resolve(resolvedHealth);
    await boot;

    const footerAfterHealth = document.querySelector('.site-footer');
    expect(footerAfterHealth).not.toBeNull();
    expect(footerAfterHealth).not.toBe(footerBeforeHealth);
    expect(updateToastMocks.mount).toHaveBeenCalledWith(
      expect.objectContaining({ health: resolvedHealth }),
    );
    expect(updateControllerMocks.subscribeUpdateController).toHaveBeenCalledTimes(1);
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

describe('bootstrap — password recovery routing (feature 045)', () => {
  function emitAuthState(state) {
    authMocks.state = state;
    for (const fn of authMocks.subscribers) {
      fn(state);
    }
  }

  it('mounts Welcome with the reset-password view for a password-recovery status', async () => {
    authMocks.state = { status: 'password-recovery', user: { id: 'u1' }, accessToken: 'tok' };
    supabaseClientState.isHostedAuthAvailable = true;
    healthMocks.getHealth.mockResolvedValue({ status: 'ok', runtime: 'hosted' });

    await bootstrap();

    expect(document.querySelector('#welcome-root')).not.toBeNull();
    expect(welcomePageMocks.mount).toHaveBeenCalledTimes(1);
    expect(welcomePageMocks.mount.mock.calls[0][1]).toEqual(
      expect.objectContaining({ initialAuthView: 'reset-password' }),
    );
  });

  it('mounts Welcome with the recovery-expired view for a recovery-expired status', async () => {
    authMocks.state = { status: 'recovery-expired', user: null, accessToken: null };
    supabaseClientState.isHostedAuthAvailable = true;
    healthMocks.getHealth.mockResolvedValue({ status: 'ok', runtime: 'hosted' });

    await bootstrap();

    expect(document.querySelector('#welcome-root')).not.toBeNull();
    expect(welcomePageMocks.mount.mock.calls[0][1]).toEqual(
      expect.objectContaining({ initialAuthView: 'recovery-expired' }),
    );
  });

  it('routes an ended reset-password session back to login without remounting Welcome, and surfaces the staged notice', async () => {
    authMocks.state = { status: 'password-recovery', user: { id: 'u1' }, accessToken: 'tok' };
    supabaseClientState.isHostedAuthAvailable = true;
    healthMocks.getHealth.mockResolvedValue({ status: 'ok', runtime: 'hosted' });
    welcomePageMocks.getAuthView.mockReturnValue('reset-password');

    await bootstrap();
    expect(welcomePageMocks.mount).toHaveBeenCalledTimes(1);

    authMocks.notice = { message: 'Password updated. Sign in with your new password.', type: 'success' };
    emitAuthState({ status: 'unauthenticated', user: null, accessToken: null });

    expect(welcomePageMocks.setAuthView).toHaveBeenCalledWith('login');
    // The SIGNED_OUT-driven reroute reuses the already-mounted Welcome — it
    // must not tear down and remount it (that would also lose the overlay's
    // own DOM/focus state for no reason).
    expect(welcomePageMocks.mount).toHaveBeenCalledTimes(1);
    const toast = document.querySelector('.toast');
    expect(toast?.textContent).toContain('Password updated');
  });

  it('routes an abandoned recovery-expired view back to login (no notice staged)', async () => {
    authMocks.state = { status: 'recovery-expired', user: null, accessToken: null };
    supabaseClientState.isHostedAuthAvailable = true;
    healthMocks.getHealth.mockResolvedValue({ status: 'ok', runtime: 'hosted' });
    welcomePageMocks.getAuthView.mockReturnValue('recovery-expired');

    await bootstrap();
    emitAuthState({ status: 'unauthenticated', user: null, accessToken: null });

    expect(welcomePageMocks.setAuthView).toHaveBeenCalledWith('login');
    expect(welcomePageMocks.mount).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.toast')).toBeNull();
  });

  it('does not call setAuthView when Welcome is already mounted showing an unrelated view (e.g. login)', async () => {
    authMocks.state = { status: 'unauthenticated', user: null, accessToken: null };
    supabaseClientState.isHostedAuthAvailable = true;
    healthMocks.getHealth.mockResolvedValue({ status: 'ok', runtime: 'hosted' });
    welcomePageMocks.getAuthView.mockReturnValue('login');

    await bootstrap();
    welcomePageMocks.setAuthView.mockClear();

    emitAuthState({ status: 'unauthenticated', user: null, accessToken: null });

    expect(welcomePageMocks.setAuthView).not.toHaveBeenCalled();
    expect(welcomePageMocks.mount).toHaveBeenCalledTimes(1);
  });
});

describe('bootstrap — Local Mode isolation (feature 045, T023)', () => {
  it('never mounts Welcome for local-mode — Forgot/Reset Password (Welcome-only surfaces) stay unreachable', async () => {
    authMocks.state = { status: 'local-mode', user: null, accessToken: null };
    supabaseClientState.isHostedAuthAvailable = false;
    healthMocks.getHealth.mockResolvedValue({ status: 'ok', runtime: 'local' });

    await bootstrap();

    expect(document.querySelector('.topbar')).not.toBeNull();
    expect(document.querySelector('#welcome-root')).toBeNull();
    expect(welcomePageMocks.mount).not.toHaveBeenCalled();
  });
});

describe('startup loader markup', () => {
  it('is inlined with a status line, scoped glow classes, static glow, and reduced-motion CSS', () => {
    const html = fs.readFileSync('index.html', 'utf8');

    expect(html).toContain('<!-- STARTUP-LOADER:START -->');
    expect(html).toContain('<!-- STARTUP-LOADER:END -->');
    expect(html).toContain('class="startup-loader"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('startup-loader__edge-glow');
    expect(html).toContain('startup-loader__edge-glow-base');
    expect(html).not.toContain('class="edge-glow"');
    expect(html).not.toContain('class="edge-glow__base"');
    expect(html).not.toMatch(/animation\s*:/);
    expect(html).toMatch(/transition:\s*none !important/);
    expect(html).toContain('width: 140px');
    expect(html).toContain('width: 120px');
    expect(html).toContain('width: 92px');
  });

  it('embeds the checked-in Project Alice sigil asset', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    const sigil = fs.readFileSync('src/assets/logo/alice-sigil-full.svg', 'utf8');
    const inlineSigil = sigil.replace(
      /^<svg /,
      '<svg class="startup-loader__sigil" aria-hidden="true" focusable="false" ',
    );

    expect(html).toContain(inlineSigil);
  });
});

describe('bootstrap — startup loader lifecycle', () => {
  it('keeps the inlined loader during the runtime handshake and removes it after transition end', async () => {
    // local-mode is the status WS2 still holds behind health (C2) — the
    // status that keeps a pending, unresolved handshake worth testing the
    // loader-persists-while-waiting behavior against. (unauthenticated/
    // authenticated now route immediately per C1, so they no longer exercise
    // this "still waiting" scenario.)
    installStartupLoader();
    authMocks.state = { status: 'local-mode', user: null, accessToken: null };
    supabaseClientState.isHostedAuthAvailable = false;
    const health = createDeferred();
    healthMocks.getHealth.mockReturnValue(health.promise);

    const boot = bootstrap();
    await Promise.resolve();

    expect(document.querySelector('.startup-loader')).not.toBeNull();
    expect(document.querySelector('.topbar')).toBeNull();

    health.resolve({ status: 'ok', runtime: 'local' });
    await boot;

    const loader = document.querySelector('.startup-loader');
    expect(loader).not.toBeNull();
    expect(loader.classList.contains('startup-loader--exiting')).toBe(true);
    expect(document.querySelector('#startup-loader-root')).not.toBeNull();
    expect(document.querySelector('.topbar')).not.toBeNull();

    loader.dispatchEvent(new Event('transitionend'));

    expect(document.querySelector('#startup-loader-root')).toBeNull();
    expect(document.querySelector('.topbar')).not.toBeNull();
  });

  it('removes the inlined loader immediately under reduced motion', async () => {
    installStartupLoader();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    authMocks.state = { status: 'unauthenticated', user: null, accessToken: null };
    healthMocks.getHealth.mockResolvedValue({ status: 'ok', runtime: 'hosted' });

    await bootstrap();

    expect(document.querySelector('.startup-loader')).toBeNull();
    expect(document.querySelector('#startup-loader-root')).toBeNull();
    expect(document.querySelector('#welcome-root')).not.toBeNull();
  });
});

describe('bootstrap — boot timeout retry (C6)', () => {
  it('reveals the Retry affordance ~10s after boot with nothing mounted, and Retry triggers reload', async () => {
    installStartupLoader();
    vi.useFakeTimers();
    authMocks.state = { status: 'local-mode', user: null, accessToken: null };
    supabaseClientState.isHostedAuthAvailable = false;
    // A health call that never resolves simulates a stalled/failed cold start.
    healthMocks.getHealth.mockReturnValue(new Promise(() => {}));
    const reloadPage = vi.fn();

    bootstrap({ reloadPage });

    const status = document.querySelector('.startup-loader__status');
    const retry = document.querySelector('.startup-loader__retry');
    expect(status.textContent).toBe('Getting things ready…');
    expect(retry.hidden).toBe(true);

    await vi.advanceTimersByTimeAsync(10000);

    expect(status.textContent).toBe('Taking longer than expected…');
    expect(retry.hidden).toBe(false);

    retry.click();
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it('does not reveal Retry once a destination has mounted before the timeout fires', async () => {
    installStartupLoader();
    vi.useFakeTimers();
    authMocks.state = { status: 'local-mode', user: null, accessToken: null };
    supabaseClientState.isHostedAuthAvailable = false;
    healthMocks.getHealth.mockResolvedValue({ status: 'ok', runtime: 'local' });

    await bootstrap();
    // The shell mounted, which calls markBootSettled() and clears the boot
    // timeout — advancing well past 10s must not resurrect the loader or
    // its Retry affordance (both are already torn down by this point).
    await vi.advanceTimersByTimeAsync(10000);

    expect(document.querySelector('.topbar')).not.toBeNull();
    expect(document.querySelector('.startup-loader')).toBeNull();
    expect(document.querySelector('.startup-loader__retry')).toBeNull();
  });
});

async function bootIntoShell() {
  authMocks.state = { status: 'local-mode', user: null, accessToken: null };
  supabaseClientState.isHostedAuthAvailable = false;
  healthMocks.getHealth.mockResolvedValue({ status: 'ok', runtime: 'local' });

  await bootstrap();

  expect(document.querySelector('.topbar')).not.toBeNull();
}

describe('navigate() — WS4 lazy routes (Calendar/Profile/ProfileEdit)', () => {
  it('updates the nav highlight and shows a skeleton before the chunk import resolves (N6)', async () => {
    await bootIntoShell();
    const calendarModule = { mount: vi.fn(), unmount: vi.fn() };
    const chunk = createDeferred();
    _setLazyPageImporterForTesting('calendar', () => chunk.promise);

    document.querySelector('.nav-btn[data-page="calendar"]').click();
    await Promise.resolve();

    expect(document.querySelector('.nav-btn[data-page="calendar"]').classList.contains('nav-btn--active')).toBe(true);
    expect(document.querySelector('#app .loading-skeleton--tracker-boot')).not.toBeNull();
    expect(calendarModule.mount).not.toHaveBeenCalled();

    chunk.resolve(calendarModule);
    await Promise.resolve();
    await Promise.resolve();

    expect(calendarModule.mount).toHaveBeenCalledTimes(1);
    expect(document.querySelector('#app .loading-skeleton--tracker-boot')).toBeNull();
  });

  it('is a synchronous no-op when navigating to the already-active page (N1)', async () => {
    await bootIntoShell();
    const calendarModule = { mount: vi.fn(), unmount: vi.fn() };
    _setLazyPageImporterForTesting('calendar', () => Promise.resolve(calendarModule));

    document.querySelector('.nav-btn[data-page="tracker"]').click();
    // Already on tracker — no import(), no skeleton, no state change.
    expect(document.querySelector('#app .loading-skeleton--tracker-boot')).toBeNull();
  });

  it('lets a later eager navigation win over an earlier, still-pending chunk import (N3, latest-wins)', async () => {
    await bootIntoShell();
    const calendarModule = { mount: vi.fn(), unmount: vi.fn() };
    const chunk = createDeferred();
    _setLazyPageImporterForTesting('calendar', () => chunk.promise);

    document.querySelector('.nav-btn[data-page="calendar"]').click();
    await Promise.resolve();

    // Navigate to Tracker (eager) while Calendar's chunk is still pending.
    document.querySelector('.nav-btn[data-page="tracker"]').click();

    expect(document.querySelector('.nav-btn[data-page="tracker"]').classList.contains('nav-btn--active')).toBe(true);
    expect(document.querySelector('.topbar')).not.toBeNull();

    // Calendar's chunk resolves after the fact — must not clobber Tracker.
    chunk.resolve(calendarModule);
    await Promise.resolve();
    await Promise.resolve();

    expect(calendarModule.mount).not.toHaveBeenCalled();
    expect(document.querySelector('.nav-btn[data-page="tracker"]').classList.contains('nav-btn--active')).toBe(true);
  });

  it('reverts to no active tab and offers a Reload affordance when the chunk import rejects (N4)', async () => {
    await bootIntoShell();
    _setLazyPageImporterForTesting('calendar', () => Promise.reject(new Error('chunk load failed')));
    const reloadSpy = vi.fn();
    vi.stubGlobal('location', { ...globalThis.location, reload: reloadSpy });

    document.querySelector('.nav-btn[data-page="calendar"]').click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // No tab is left falsely "active" — the page that was showing before
    // this navigation (Tracker) was already unmounted, so pretending we
    // reverted "back" to it would mislabel the workspace, which now shows
    // only the error.
    expect(document.querySelector('.nav-btn[data-page="tracker"]').classList.contains('nav-btn--active')).toBe(false);
    expect(document.querySelector('.nav-btn[data-page="calendar"]').classList.contains('nav-btn--active')).toBe(false);

    const errorBlock = document.querySelector('#app .inline-error');
    expect(errorBlock).not.toBeNull();
    const retryButton = errorBlock.querySelector('.inline-error__retry');
    expect(retryButton).not.toBeNull();

    retryButton.click();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('does not lock out the previously-active tab after a chunk import rejection — clicking it recovers instead of no-op-ing', async () => {
    await bootIntoShell();
    _setLazyPageImporterForTesting('calendar', () => Promise.reject(new Error('chunk load failed')));

    document.querySelector('.nav-btn[data-page="calendar"]').click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.querySelector('#app .inline-error')).not.toBeNull();

    // Tracker was active before the failed nav. If _currentPage had been
    // reverted back to 'tracker', this click would be treated as a same-page
    // no-op (N1) and do nothing, leaving the user stuck on the error.
    document.querySelector('.nav-btn[data-page="tracker"]').click();

    expect(document.querySelector('.topbar')).not.toBeNull();
    expect(document.querySelector('#app .inline-error')).toBeNull();
    expect(document.querySelector('.nav-btn[data-page="tracker"]').classList.contains('nav-btn--active')).toBe(true);
  });

  it('does not double-invoke the previous page\'s unmount when navigating again while a chunk is still pending', async () => {
    await bootIntoShell();
    const calendarModule = { mount: vi.fn(), unmount: vi.fn() };
    const profileModule = { mount: vi.fn(), unmount: vi.fn() };
    const calendarChunk = createDeferred();
    _setLazyPageImporterForTesting('calendar', () => calendarChunk.promise);
    _setLazyPageImporterForTesting('profile', () => Promise.resolve(profileModule));

    // Start navigating to Calendar (its chunk never resolves in this test),
    // then navigate to Profile before it does. _currentUnmount at that point
    // is still Tracker's unmount (Calendar's own hasn't been set yet, since
    // its module never arrived) — it must not be invoked a second time.
    document.querySelector('.nav-btn[data-page="calendar"]').click();
    await Promise.resolve();
    document.querySelector('.nav-btn[data-page="profile"]').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(profileModule.mount).toHaveBeenCalledTimes(1);
    expect(calendarModule.unmount).not.toHaveBeenCalled();

    // The stale Calendar chunk resolving afterward must not mount either.
    calendarChunk.resolve(calendarModule);
    await Promise.resolve();
    await Promise.resolve();
    expect(calendarModule.mount).not.toHaveBeenCalled();
  });

  it('blocks navigation before any import when ProfileEdit.confirmNavigation() returns false (N2)', async () => {
    await bootIntoShell();
    const confirmNavigation = vi.fn(() => true);
    const profileEditModule = { mount: vi.fn(), unmount: vi.fn(), confirmNavigation };
    const calendarModule = { mount: vi.fn(), unmount: vi.fn() };
    _setLazyPageImporterForTesting('profile-edit', () => Promise.resolve(profileEditModule));
    _setLazyPageImporterForTesting('calendar', () => Promise.resolve(calendarModule));

    // Navigate into profile-edit once so its module gets cached (mirrors
    // production: confirmNavigation can only matter once we're already on
    // profile-edit, which means it was already imported and mounted).
    await navigate('profile-edit');
    expect(profileEditModule.mount).toHaveBeenCalledTimes(1);

    // Now block the next navigation attempt via the dirty-check.
    confirmNavigation.mockReturnValue(false);
    await navigate('calendar');

    expect(confirmNavigation).toHaveBeenCalledWith('calendar');
    expect(profileEditModule.unmount).not.toHaveBeenCalled();
    expect(calendarModule.mount).not.toHaveBeenCalled();
    expect(document.querySelector('#app .loading-skeleton--tracker-boot')).toBeNull();
  });
});
