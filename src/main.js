import './styles/main.css';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { BottomTabBar } from './components/BottomTabBar.js';
import { Footer } from './components/Footer.js';
import { LegalModal } from './components/LegalModal.js';
import { Navbar } from './components/Navbar.js';
import * as authStore from './data/authStore.js';
import { store } from './data/store.js';
import { resetUpdateControllerForTesting, subscribeUpdateController } from './data/updateController.js';
import { resetUpdateStatusForTesting, subscribeUpdateStatus } from './data/updateStatusStore.js';
import { Calendar } from './pages/Calendar.js';
import { ConfigError } from './pages/ConfigError.js';
import { Profile } from './pages/Profile.js';
import { ProfileEdit } from './pages/ProfileEdit.js';
import { Tracker } from './pages/Tracker.js';
import { AuthOverlay } from './pages/welcome/AuthOverlay.js';
import { WelcomePage } from './pages/welcome/WelcomePage.js';
import { getHealth } from './services/healthApi.js';
import { isHostedAuthAvailable } from './services/supabaseClient.js';
import { toISODate } from './utils/date.js';
import { Toast } from './components/Toast.js';
import { UpdateToast } from './components/UpdateToast.js';

const DAY_MS = 86400000;

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

  clearBody();

  const main = document.createElement('main');
  main.id = 'app';
  const navbar = Navbar.render('tracker');
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

function mountWelcome() {
  if (_welcomeMounted) {
    return;
  }
  unmountAppShell();
  clearBody();

  const root = document.createElement('div');
  root.id = 'welcome-root';
  document.body.append(root);

  WelcomePage.mount(root, { authOverlay: AuthOverlay });
  _welcomeMounted = true;

  // Surface a one-shot notice after a sign-out reroute (feature 030): the
  // involuntary deleted-account message (FR-011a) or the voluntary
  // account-deletion success confirmation (FR-013). Shown here because the
  // reroute cleared document.body, so a toast staged before sign-out survives.
  const notice = authStore.consumeAuthNotice();
  if (notice) {
    Toast.show(notice.message, notice.type);
  }
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
  clearBody();

  const root = document.createElement('div');
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
  if (
    state.status === 'local-mode'
    || state.status === 'authenticated'
    || state.status === 'demo'
  ) {
    mountAppShell();
    return;
  }
  if (state.status === 'unauthenticated') {
    mountWelcome();
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
  resetUpdateStatusForTesting();
  resetUpdateControllerForTesting();
}

export async function bootstrap(deps = {}) {
  // Report Core Web Vitals to Vercel Speed Insights. The package only sends
  // data from the production Vercel deployment; in local/dev (e.g. a GitHub
  // checkout) it no-ops and logs to the console, preserving the local-first
  // principle. It measures page-level performance only — never application
  // data — and was explicitly enabled per the constitution's privacy clause.
  injectSpeedInsights();

  const existingRoot = document.querySelector('#app');
  const existingFooter = document.querySelector('.site-footer');
  existingRoot?.remove();
  existingFooter?.remove();

  // Run the runtime handshake BEFORE subscribing to authStore so a hosted
  // deployment with missing Vite env vars never flashes the welcome page or
  // app shell before ConfigError takes over (Task 08.3, finding from review).
  const result = await runtimeHandshake(deps);
  _runtimeHealth = result.health;
  if (result.configError) {
    mountConfigError();
    return;
  }

  authStore.subscribe(render);
  await authStore.init();
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

function navigate(page, options = {}) {
  const appRoot = document.querySelector('#app');
  let activePage = page;

  if (!appRoot || page === _currentPage) {
    return;
  }

  if (_currentPage === 'profile-edit' && !ProfileEdit.confirmNavigation(page)) {
    return;
  }

  if (_currentUnmount) {
    _currentUnmount();
  }

  appRoot.replaceChildren();

  if (page === 'calendar') {
    Calendar.mount(appRoot);
    _currentUnmount = Calendar.unmount;
  } else if (page === 'profile') {
    Profile.mount(appRoot, { navigate, health: _runtimeHealth, ...options });
    _currentUnmount = Profile.unmount;
  } else if (page === 'profile-edit') {
    ProfileEdit.mount(appRoot, { navigate, ...options });
    _currentUnmount = ProfileEdit.unmount;
    activePage = 'profile';
  } else {
    Tracker.mount(appRoot, { navigate });
    _currentUnmount = Tracker.unmount;
  }

  _currentPage = page;
  Navbar.setActive(activePage);
  BottomTabBar.setActive(activePage);
}
