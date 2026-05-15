import './styles/main.css';
import { Footer } from './components/Footer.js';
import { Navbar } from './components/Navbar.js';
import * as authStore from './data/authStore.js';
import { store } from './data/store.js';
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

const DAY_MS = 86400000;

let _currentPage = null;
let _currentUnmount = null;
let _shellMounted = false;
let _welcomeMounted = false;
let _configErrorMounted = false;

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

function mountAppShell() {
  if (_shellMounted) {
    return;
  }
  if (_welcomeMounted) {
    WelcomePage.unmount();
    _welcomeMounted = false;
  }

  const hasStoredApplications = store.hasStoredApplications();
  store.load();

  if (!hasStoredApplications && store.getAll().length === 0) {
    store.save(SEED_DATA);
  }

  clearBody();

  const main = document.createElement('main');
  main.id = 'app';
  const navbar = Navbar.render('tracker');
  const footer = Footer.render();
  document.body.append(navbar, main, footer);

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
  Navbar.destroy();
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
  if (state.status === 'local-mode' || state.status === 'authenticated') {
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
      return { configError: true };
    }
  } catch {
    // Network failure during the runtime check is non-fatal: the build-time
    // assertion in Task 01.3 is the primary line of defense, and the user
    // will still see either the welcome page or the app shell. The runtime
    // check only catches the case where the build-time assertion was bypassed.
  }
  return { configError: false };
}

// Test-only helper — resets module-scoped state so individual `bootstrap()`
// runs are independent. Not used by the production entry point.
export function _resetForTesting() {
  _currentPage = null;
  _currentUnmount = null;
  _shellMounted = false;
  _welcomeMounted = false;
  _configErrorMounted = false;
}

export async function bootstrap(deps = {}) {
  const existingRoot = document.querySelector('#app');
  const existingFooter = document.querySelector('.site-footer');
  existingRoot?.remove();
  existingFooter?.remove();

  // Run the runtime handshake BEFORE subscribing to authStore so a hosted
  // deployment with missing Vite env vars never flashes the welcome page or
  // app shell before ConfigError takes over (Task 08.3, finding from review).
  const result = await runtimeHandshake(deps);
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
    Profile.mount(appRoot, { navigate });
    _currentUnmount = Profile.unmount;
  } else if (page === 'profile-edit') {
    ProfileEdit.mount(appRoot, { navigate, ...options });
    _currentUnmount = ProfileEdit.unmount;
    activePage = 'profile';
  } else {
    Tracker.mount(appRoot);
    _currentUnmount = Tracker.unmount;
  }

  _currentPage = page;
  Navbar.setActive(activePage);
}
