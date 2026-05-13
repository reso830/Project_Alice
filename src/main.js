import './styles/main.css';
import { Footer } from './components/Footer.js';
import { Navbar } from './components/Navbar.js';
import { store } from './data/store.js';
import { Calendar } from './pages/Calendar.js';
import { Profile } from './pages/Profile.js';
import { ProfileEdit } from './pages/ProfileEdit.js';
import { Tracker } from './pages/Tracker.js';
import { toISODate } from './utils/date.js';

const DAY_MS = 86400000;

let _currentPage = null;
let _currentUnmount = null;

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

document.addEventListener('DOMContentLoaded', () => {
  const hasStoredApplications = store.hasStoredApplications();

  store.load();

  if (!hasStoredApplications && store.getAll().length === 0) {
    store.save(SEED_DATA);
  }

  const existingRoot = document.querySelector('#app');
  const existingFooter = document.querySelector('.site-footer');
  const main = document.createElement('main');
  const navbar = Navbar.render('tracker');
  const footer = Footer.render();

  main.id = 'app';

  if (existingRoot) {
    existingRoot.remove();
  }

  existingFooter?.remove();
  document.body.append(navbar, main, footer);

  for (const button of navbar.querySelectorAll('.nav-btn')) {
    button.addEventListener('click', () => navigate(button.dataset.page));
  }

  navigate('tracker');
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
