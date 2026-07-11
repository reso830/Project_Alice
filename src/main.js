import './styles/main.css';
import { BottomTabBar } from './components/BottomTabBar.js';
import { Footer } from './components/Footer.js';
import { LegalModal } from './components/LegalModal.js';
import { Navbar } from './components/Navbar.js';
import * as authStore from './data/authStore.js';
import { store } from './data/store.js';
import { resetUpdateControllerForTesting, subscribeUpdateController } from './data/updateController.js';
import { resetUpdateStatusForTesting, subscribeUpdateStatus } from './data/updateStatusStore.js';
import { ConfigError } from './pages/ConfigError.js';
import { Tracker } from './pages/Tracker.js';
import { AuthOverlay } from './pages/welcome/AuthOverlay.js';
import { WelcomePage } from './pages/welcome/WelcomePage.js';
import { getHealth } from './services/healthApi.js';
import { isHostedAuthAvailable } from './services/supabaseClient.js';
import { renderInlineError } from './utils/asyncUI.js';
import { toISODate } from './utils/date.js';
import { buildTrackerBootSkeleton } from './utils/skeletons.js';
import { reportPageview, reportVercelObservability, _resetForTesting as _resetVercelObservabilityForTesting } from './utils/vercelObservability.js';
import { Toast } from './components/Toast.js';
import { UpdateToast } from './components/UpdateToast.js';

// WS4 (044): Calendar/Profile/ProfileEdit are dynamic-imported inside
// navigate() (N5) — Tracker (the landing route) stays statically imported
// above so first navigation to it never pays a chunk fetch.
const DEFAULT_LAZY_PAGE_IMPORTERS = {
  calendar: () => import('./pages/Calendar.js').then((mod) => mod.Calendar),
  profile: () => import('./pages/Profile.js').then((mod) => mod.Profile),
  'profile-edit': () => import('./pages/ProfileEdit.js').then((mod) => mod.ProfileEdit),
};
const LAZY_PAGE_IMPORTERS = { ...DEFAULT_LAZY_PAGE_IMPORTERS };

// Test-only seam: real dynamic import() timing/rejection is impractical to
// control precisely against a `vi.mock`'ed module (ESM module resolution is
// cached per specifier), so tests needing a deferred or rejecting chunk load
// (latest-wins races, chunk-failure fallback) swap the importer here instead.
// Not used by the production entry point.
export function _setLazyPageImporterForTesting(page, importer) {
  LAZY_PAGE_IMPORTERS[page] = importer;
}

const DAY_MS = 86400000;
const STARTUP_LOADER_SELECTOR = '.startup-loader';
const STARTUP_LOADER_STATUS_SELECTOR = '.startup-loader__status';
const STARTUP_LOADER_RETRY_SELECTOR = '.startup-loader__retry';
const STARTUP_LOADER_EXIT_CLASS = 'startup-loader--exiting';
const STARTUP_LOADER_ROOT_ID = 'startup-loader-root';
const STARTUP_LOADER_EXIT_TIMEOUT_MS = 260;
const BOOT_TIMEOUT_MS = 10000;
const BOOT_TIMEOUT_MESSAGE = 'Taking longer than expected…';

let _currentPage = null;
let _currentUnmount = null;
let _shellMounted = false;
let _welcomeMounted = false;
let _configErrorMounted = false;
let _runtimeHealth = null;
let _unsubscribeUpdateStatus = null;
let _unsubscribeUpdateController = null;
let _legalDialog = null; // 'terms' | 'privacy' | null
let _legalDialogNode = null;
let _legalTriggerEl = null;
let _startupLoaderTeardownStarted = false;
let _startupLoaderTeardownTimer = null;
let _healthSettled = false;
let _pendingLocalModeState = null;
let _bootSettled = false;
let _bootTimeoutTimer = null;
let _navToken = 0;
// N2: ProfileEdit.confirmNavigation(page) must run synchronously, before any
// await — but ProfileEdit is now dynamic-imported (WS4), so there's no
// static reference to call it on. _currentPage can only be 'profile-edit'
// after that module has already been imported and mounted once, so caching
// the resolved module here (set on first successful mount) keeps the guard
// synchronous without a static import.
let _profileEditModule = null;

export const SEED_DATA = [
  {
    id: '001',
    jobTitle: 'Design Systems Engineer',
    companyName: 'Northstar Labs',
    status: 'wishlisted',
    lastStatusUpdate: toISODate(new Date(Date.now() - 2 * DAY_MS)),
    compat: 84,
    fav: true,
    responsibilities: 'Shape a shared React design system for a corporate hiring platform, pairing Storybook governance with accessibility reviews.',
    skills: ['React', 'TypeScript', 'Storybook', 'Accessibility'],
    salary: 125000,
    recruiter: 'Maya Chen',
    jobPostingUrl: 'https://jobs.example.com/northstar-frontend',
  },
  {
    id: '002',
    jobTitle: 'Full Stack Product Engineer',
    companyName: 'Clearpath',
    status: 'applied',
    lastStatusUpdate: toISODate(new Date(Date.now() - 5 * DAY_MS)),
    compat: 76,
    fav: false,
    responsibilities: 'Build first-version workflow features for a Series B startup, moving quickly across React, Node.js, and PostgreSQL.',
    skills: ['React', 'Node.js', 'PostgreSQL'],
    salary: 118000,
    recruiter: 'Leo Martin',
    jobPostingUrl: 'https://jobs.example.com/clearpath-product',
  },
  {
    id: '003',
    jobTitle: 'Senior Payments Engineer',
    companyName: 'Helio Finance',
    status: 'interview',
    lastStatusUpdate: toISODate(new Date(Date.now() - 40 * DAY_MS)),
    compat: 82,
    fav: false,
    responsibilities: 'Drive reliability reviews across fintech payment services, mentoring peers on Go tracing, SLO budgets, and database failover.',
    skills: ['Go', 'PostgreSQL', 'Prometheus'],
    salary: 145000,
    recruiter: 'Ana Rivera',
    jobPostingUrl: 'https://jobs.example.com/helio-payments',
  },
];

function clearBody() {
  while (document.body.firstChild) {
    document.body.firstChild.remove();
  }
}

function prefersReducedStartupLoaderMotion() {
  return Boolean(
    globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches,
  );
}

function removeBodyChildrenExcept(nodeToKeep) {
  for (const child of Array.from(document.body.children)) {
    if (child !== nodeToKeep) {
      child.remove();
    }
  }
}

function clearBootTimeout() {
  if (_bootTimeoutTimer) {
    clearTimeout(_bootTimeoutTimer);
    _bootTimeoutTimer = null;
  }
}

function markBootSettled() {
  _bootSettled = true;
  clearBootTimeout();
}

function revealBootTimeoutRetry(reloadPage) {
  const status = document.querySelector(STARTUP_LOADER_STATUS_SELECTOR);
  if (status) {
    status.textContent = BOOT_TIMEOUT_MESSAGE;
  }
  const retry = document.querySelector(STARTUP_LOADER_RETRY_SELECTOR);
  if (retry) {
    retry.hidden = false;
    retry.addEventListener('click', () => reloadPage(), { once: true });
    retry.focus();
  }
}

// C6: if nothing has mounted ~10s after boot starts, reveal the loader's
// Retry affordance instead of leaving an indefinite spinner. Cleared by
// markBootSettled() the moment any destination (shell/Welcome/ConfigError)
// actually mounts.
function startBootTimeout({
  bootTimeoutMs = BOOT_TIMEOUT_MS,
  reloadPage = () => globalThis.location?.reload?.(),
} = {}) {
  clearBootTimeout();
  _bootSettled = false;
  _bootTimeoutTimer = setTimeout(() => {
    _bootTimeoutTimer = null;
    if (_bootSettled) {
      return;
    }
    revealBootTimeoutRetry(reloadPage);
  }, bootTimeoutMs);
}

function prepareBodyForFirstMount() {
  markBootSettled();

  const loader = document.querySelector(STARTUP_LOADER_SELECTOR);
  const loaderRoot = loader?.closest('#app, #startup-loader-root');

  if (!loader || !loaderRoot || _startupLoaderTeardownStarted) {
    clearBody();
    return;
  }

  _startupLoaderTeardownStarted = true;

  if (prefersReducedStartupLoaderMotion()) {
    clearBody();
    return;
  }

  if (loaderRoot.id === 'app') {
    loaderRoot.id = STARTUP_LOADER_ROOT_ID;
  }
  removeBodyChildrenExcept(loaderRoot);
  loader.classList.add(STARTUP_LOADER_EXIT_CLASS);

  const finish = () => {
    loader.removeEventListener('transitionend', finish);
    if (_startupLoaderTeardownTimer) {
      clearTimeout(_startupLoaderTeardownTimer);
      _startupLoaderTeardownTimer = null;
    }
    loaderRoot.remove();
  };

  loader.addEventListener('transitionend', finish, { once: true });
  _startupLoaderTeardownTimer = setTimeout(finish, STARTUP_LOADER_EXIT_TIMEOUT_MS);
}

function closeLegalDialog() {
  _legalDialog = null;
  _legalDialogNode = null;
  if (_legalTriggerEl && typeof _legalTriggerEl.focus === 'function') {
    _legalTriggerEl.focus();
  }
  _legalTriggerEl = null;
}

// Shell-level dialog state (design_handoffs/Alice_Legal): the global Footer's
// LICENSE links are reachable from every authenticated page, so the state
// lives here rather than inside Footer.js itself (a stateless renderer).
function setLegalDialog(type) {
  if ((type !== 'terms' && type !== 'privacy') || _legalDialog) {
    return;
  }
  _legalTriggerEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  _legalDialog = type;
  _legalDialogNode = LegalModal.render(type, closeLegalDialog);
}

function mountAppShell() {
  if (_shellMounted) {
    return;
  }
  if (_welcomeMounted) {
    WelcomePage.unmount();
    _welcomeMounted = false;
  }

  // Skip the legacy `store` warm-up entirely in demo (feature 020). The
  // legacy localStorage store is deprecated and is not the data source
  // for demo — `src/data/demoStore.js` is, via the service-layer switch
  // in `src/services/api.js`. Reading/writing `apptracker_applications`
  // during a demo session would create persistent client-side state for
  // the visitor, which FR-004 forbids.
  if (authStore.getAuthState().status !== 'demo') {
    const hasStoredApplications = store.hasStoredApplications();
    store.load();

    if (!hasStoredApplications && store.getAll().length === 0) {
      store.save(SEED_DATA);
    }
  }

  prepareBodyForFirstMount();

  const main = document.createElement('main');
  main.id = 'app';
  const navbar = Navbar.render('tracker', _runtimeHealth);
  const footer = Footer.render({ runtime: _runtimeHealth?.runtime, onLegalLink: setLegalDialog });
  const bottomTabBar = BottomTabBar.render({ onSelect: navigate });
  BottomTabBar.setActive('tracker');
  document.body.append(navbar, main, footer, bottomTabBar);
  _unsubscribeUpdateStatus = subscribeUpdateStatus((status) => {
    const nextStatus = status?.status ?? 'idle';
    Navbar.setUpdateStatus(nextStatus);
    BottomTabBar.setUpdateStatus(nextStatus);
  }, { emit: true });
  _unsubscribeUpdateController = _runtimeHealth?.updateSupported
    ? subscribeUpdateController()
    : null;
  UpdateToast.mount({
    health: _runtimeHealth,
    onManageInSettings: () => {
      navigate('profile');
      scrollToUpdatesSettings();
    },
  });

  for (const button of navbar.querySelectorAll('.nav-btn')) {
    button.addEventListener('click', () => navigate(button.dataset.page));
  }

  _shellMounted = true;
  navigate('tracker');
}

// C5: the authenticated fast path mounts the shell before getHealth()
// resolves (mountAppShell() above already tolerates _runtimeHealth being
// null). When health arrives afterward, Footer and UpdateToast must pick up
// the resolved value — neither exposes an in-place patch API, so this
// replaces the Footer element and re-invokes UpdateToast.mount() /
// subscribeUpdateController() instead.
function refreshHealthDependentChrome() {
  // refreshHealthDependentChrome runs only on the authenticated hosted fast-path.
  // In hosted mode, the Navbar renders the email and signout button (never the
  // local-mode badge), so updating the health payload here is a harmless no-op.
  Navbar.setHealth(_runtimeHealth);
  const oldFooter = document.querySelector('.site-footer');
  const newFooter = Footer.render({ runtime: _runtimeHealth?.runtime, onLegalLink: setLegalDialog });
  if (oldFooter) {
    oldFooter.replaceWith(newFooter);
  } else {
    document.body.append(newFooter);
  }

  _unsubscribeUpdateController?.();
  _unsubscribeUpdateController = _runtimeHealth?.updateSupported
    ? subscribeUpdateController()
    : null;

  UpdateToast.mount({
    health: _runtimeHealth,
    onManageInSettings: () => {
      navigate('profile');
      scrollToUpdatesSettings();
    },
  });
}

function unmountAppShell() {
  if (!_shellMounted) {
    return;
  }
  if (_currentUnmount) {
    _currentUnmount();
  }
  _currentUnmount = null;
  _currentPage = null;
  _unsubscribeUpdateStatus?.();
  _unsubscribeUpdateStatus = null;
  _unsubscribeUpdateController?.();
  _unsubscribeUpdateController = null;
  Navbar.destroy();
  BottomTabBar.destroy();
  UpdateToast.destroy();
  if (_legalDialogNode) {
    _legalDialogNode.querySelector('.legal-modal__close')?.click();
  }
  _legalDialog = null;
  _legalDialogNode = null;
  _legalTriggerEl = null;
  clearBody();
  _shellMounted = false;
}

// Surface a one-shot notice after a sign-out reroute (feature 030): the
// involuntary deleted-account message (FR-011a), the voluntary
// account-deletion success confirmation (FR-013), or (feature 045) the
// password-updated confirmation after a reset session ends. Called both from
// a fresh Welcome mount (reroute cleared document.body, so a toast staged
// before sign-out survives) and from the already-mounted-Welcome recovery
// teardown path below (render()'s `unauthenticated` branch), which clears no
// DOM but still needs to surface the same staged notice.
function surfacePendingNotice() {
  const notice = authStore.consumeAuthNotice();
  if (notice) {
    Toast.show(notice.message, notice.type);
  }
}

function mountWelcome({ initialAuthView } = {}) {
  if (_welcomeMounted) {
    return;
  }
  unmountAppShell();
  prepareBodyForFirstMount();

  // Issue #139 (Lighthouse audit): a real <main> landmark, not a plain
  // <div> — matches the pattern mountAppShell() already uses for its own
  // root (this app rebuilds page roots fresh under <body> on every
  // mount/unmount rather than reusing the static index.html shell, so each
  // one needs its own landmark).
  const root = document.createElement('main');
  root.id = 'welcome-root';
  document.body.append(root);

  WelcomePage.mount(root, { authOverlay: AuthOverlay, initialAuthView });
  _welcomeMounted = true;

  surfacePendingNotice();
}

function unmountWelcome() {
  if (!_welcomeMounted) {
    return;
  }
  WelcomePage.unmount();
  clearBody();
  _welcomeMounted = false;
}

function mountConfigError() {
  if (_configErrorMounted) {
    return;
  }
  unmountAppShell();
  unmountWelcome();
  prepareBodyForFirstMount();

  const root = document.createElement('main');
  root.id = 'config-error-root';
  document.body.append(root);
  ConfigError.mount(root);
  _configErrorMounted = true;
}

function render(state) {
  if (_configErrorMounted) {
    return;
  }
  if (state.status === 'initializing') {
    unmountAppShell();
    unmountWelcome();
    return;
  }
  // C2: `local-mode` resolves synchronously (no network call) and is the one
  // outcome ambiguous between "genuine local/portable build" and "hosted
  // deploy missing its env vars" — it must not mount before getHealth() also
  // resolves (see bootstrap()'s health handler, which re-renders this
  // pending state once health settles). `authenticated`/`unauthenticated`
  // are both reached only via a real getSession() call and are safe to route
  // immediately (C1).
  if (state.status === 'local-mode' && !_healthSettled) {
    _pendingLocalModeState = state;
    return;
  }
  if (
    state.status === 'local-mode'
    || state.status === 'authenticated'
    || state.status === 'demo'
  ) {
    mountAppShell();
    return;
  }
  if (state.status === 'unauthenticated') {
    // Feature 045: a recovery session that just ended (password-update
    // success, T020; or an abandoned reset/expired-link view, T021) reroutes
    // here via authStore's SIGNED_OUT-driven status flip, but Welcome is
    // already mounted (still showing the reset-password/recovery-expired
    // overlay) — mountWelcome()'s own `if (_welcomeMounted) return;` guard
    // would otherwise silently no-op and leave that stale view on screen.
    // Detect that specific case and return the overlay to `login` instead of
    // a fresh Welcome mount.
    if (_welcomeMounted) {
      const currentView = WelcomePage.getAuthView();
      if (currentView === 'reset-password' || currentView === 'recovery-expired') {
        WelcomePage.setAuthView('login');
        surfacePendingNotice();
      }
      return;
    }
    mountWelcome();
    return;
  }
  if (state.status === 'password-recovery') {
    mountWelcome({ initialAuthView: 'reset-password' });
    return;
  }
  if (state.status === 'recovery-expired') {
    mountWelcome({ initialAuthView: 'recovery-expired' });
  }
}

export async function runtimeHandshake({
  healthFn = getHealth,
  hostedAuthAvailable = isHostedAuthAvailable,
} = {}) {
  try {
    const health = await healthFn();
    if (health?.runtime === 'hosted' && !hostedAuthAvailable) {
      return { configError: true, health };
    }
    return { configError: false, health };
  } catch {
    // Network failure during the runtime check is non-fatal: the build-time
    // assertion in Task 01.3 is the primary line of defense, and the user
    // will still see either the welcome page or the app shell. The runtime
    // check only catches the case where the build-time assertion was bypassed.
  }
  return { configError: false, health: null };
}

// Test-only helper — resets module-scoped state so individual `bootstrap()`
// runs are independent. Not used by the production entry point.
export function _resetForTesting() {
  _currentPage = null;
  _currentUnmount = null;
  _shellMounted = false;
  _welcomeMounted = false;
  _configErrorMounted = false;
  _runtimeHealth = null;
  _unsubscribeUpdateStatus?.();
  _unsubscribeUpdateStatus = null;
  _unsubscribeUpdateController?.();
  _unsubscribeUpdateController = null;
  _startupLoaderTeardownStarted = false;
  if (_startupLoaderTeardownTimer) {
    clearTimeout(_startupLoaderTeardownTimer);
    _startupLoaderTeardownTimer = null;
  }
  _healthSettled = false;
  _pendingLocalModeState = null;
  _bootSettled = false;
  clearBootTimeout();
  _navToken += 1; // invalidate any in-flight import() from a prior test
  _profileEditModule = null;
  Object.assign(LAZY_PAGE_IMPORTERS, DEFAULT_LAZY_PAGE_IMPORTERS);
  resetUpdateStatusForTesting();
  resetUpdateControllerForTesting();
  _resetVercelObservabilityForTesting();
}

export async function bootstrap(deps = {}) {
  const existingRoot = document.querySelector('#app');
  const existingFooter = document.querySelector('.site-footer');
  if (!existingRoot?.querySelector(STARTUP_LOADER_SELECTOR)) {
    existingRoot?.remove();
  }
  existingFooter?.remove();

  startBootTimeout(deps);
  _healthSettled = false;
  _pendingLocalModeState = null;

  // WS2: run getHealth() and authStore.init() CONCURRENTLY instead of
  // sequentially. `authenticated`/`unauthenticated` (both reached only via a
  // real getSession() call) route in render() as soon as the session
  // resolves, without waiting on health (C1). `local-mode` — the one outcome
  // ambiguous between a genuine local build and a misconfigured hosted
  // deploy — is held by render() until health also resolves (C2), handled
  // below once this promise settles.
  const healthPromise = runtimeHandshake(deps).then((result) => {
    _runtimeHealth = result.health;
    _healthSettled = true;
    const pendingState = _pendingLocalModeState;
    _pendingLocalModeState = null;

    // Gate Vercel observability on the resolved runtime rather than each
    // package's own dev/prod detection (see src/utils/vercelObservability.js).
    // health and authStore.init() run concurrently (WS2), so this is not a
    // guarantee that the auth-callback URL has already been scrubbed by the
    // time this fires — vercelObservability's beforeSend redacts it
    // regardless of that race.
    reportVercelObservability({ runtime: result.health?.runtime });

    if (result.configError) {
      // C3/C4: mountConfigError() sets _configErrorMounted, which render()
      // checks first — this overrides an already-mounted Welcome/shell and
      // discards any pending local-mode render.
      mountConfigError();
      return;
    }

    if (pendingState) {
      render(pendingState);
      return;
    }

    // C5: the authenticated fast path may have already mounted the shell
    // with null health; refresh Footer/UpdateToast now that health resolved.
    if (_shellMounted) {
      refreshHealthDependentChrome();
    }
  });

  authStore.subscribe(render);
  const authInitPromise = authStore.init();

  await Promise.all([healthPromise, authInitPromise]);
}

document.addEventListener('DOMContentLoaded', () => {
  bootstrap();
});

// Scroll the Profile page to the Updates settings sub-group after navigating
// there from the toast's "Manage in Settings" link. Profile.mount is async
// (it awaits profile/applications data), so poll briefly for the group to
// appear before scrolling it into view.
function scrollToUpdatesSettings() {
  let tries = 0;
  const attempt = () => {
    const group = document.querySelector('.update-settings')?.closest('.set-group');
    if (group) {
      group.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (tries < 40) {
      tries += 1;
      setTimeout(attempt, 50);
    }
  };
  attempt();
}

export async function navigate(page, options = {}) {
  const appRoot = document.querySelector('#app');
  const activePage = page === 'profile-edit' ? 'profile' : page;

  // N1: no-op navigations stay synchronous, before any await.
  if (!appRoot || page === _currentPage) {
    return;
  }

  // N2: the dirty-check guard must also run before any await.
  if (_currentPage === 'profile-edit' && !(_profileEditModule?.confirmNavigation(page) ?? true)) {
    return;
  }

  // N3: latest-wins token, established synchronously — any earlier in-flight
  // import() that resolves after a newer navigate() call must no-op.
  const token = ++_navToken;

  if (_currentUnmount) {
    _currentUnmount();
    _currentUnmount = null;
  }

  appRoot.replaceChildren();

  // N6: nav highlight updates before the import() is awaited, not after.
  // Web Analytics' own auto-track only ever sees this app's very first load
  // (this router never touches the History API — see reportPageview's own
  // comment), so the first navigate() call is left to auto-track and every
  // later one is reported manually here, to avoid double-counting the first.
  const isFirstNavigation = _currentPage === null;
  _currentPage = page;
  Navbar.setActive(activePage);
  BottomTabBar.setActive(activePage);
  if (!isFirstNavigation) {
    reportPageview(page);
  }

  if (page === 'tracker') {
    // N5: Tracker stays eagerly imported — no chunk fetch on landing.
    Tracker.mount(appRoot, { navigate });
    _currentUnmount = Tracker.unmount;
    return;
  }

  // N6: show a skeleton in the workspace immediately, before awaiting the
  // chunk — the target page's own layout doesn't exist yet (its module isn't
  // loaded), so this reuses the WS3 boot skeleton as a generic placeholder.
  appRoot.append(buildTrackerBootSkeleton());

  let PageModule;
  try {
    PageModule = await LAZY_PAGE_IMPORTERS[page]();
  } catch {
    // N4: a stale/failed chunk — no newer navigation to defer to, so revert
    // the optimistic highlight and offer a reload (a redeploy invalidates
    // hashed chunks; only a fresh load fetches the current ones). Reverting
    // to `null` rather than the previous page: that page's DOM was already
    // torn down above, so pretending we're "back" on it would leave its nav
    // tab marked active while the workspace shows only this error — and
    // clicking that tab again would then no-op (N1 sees it as already
    // current), locking the user out of it. `null` never matches a real
    // page, so any tab — including the one that was active before — works.
    if (token !== _navToken) {
      return;
    }
    _currentUnmount = null;
    _currentPage = null;
    Navbar.setActive(null);
    BottomTabBar.setActive(null);
    renderInlineError({
      target: appRoot,
      message: "This page couldn't load. Check your connection or reload the page.",
      onRetry: () => globalThis.location?.reload?.(),
      retryLabel: 'Reload',
    });
    return;
  }

  // N3: a newer navigation superseded this one while the chunk was loading.
  if (token !== _navToken) {
    return;
  }

  appRoot.replaceChildren();

  if (page === 'calendar') {
    PageModule.mount(appRoot);
    _currentUnmount = PageModule.unmount;
  } else if (page === 'profile') {
    PageModule.mount(appRoot, { navigate, health: _runtimeHealth, ...options });
    _currentUnmount = PageModule.unmount;
  } else if (page === 'profile-edit') {
    _profileEditModule = PageModule;
    PageModule.mount(appRoot, { navigate, ...options });
    _currentUnmount = PageModule.unmount;
  }
}
