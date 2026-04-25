import './styles/main.css';
import { Navbar } from './components/Navbar.js';
import { store } from './data/store.js';
import { Calendar } from './pages/Calendar.js';
import { Profile } from './pages/Profile.js';
import { Tracker } from './pages/Tracker.js';
import { toISODate } from './utils/date.js';

const DAY_MS = 86400000;
const SEED_SESSION_KEY = 'apptracker_seed_initialized';

let _currentPage = null;
let _currentUnmount = null;

const SEED_DATA = [
  {
    id: '001',
    position: 'Frontend Engineer',
    company: 'Northstar Labs',
    status: 'wishlisted',
    last_status_update: toISODate(new Date(Date.now() - 2 * DAY_MS)),
    compat: 84,
    fav: true,
    responsibilities: 'Build responsive web interfaces and maintain shared UI patterns.',
    skills: ['JavaScript', 'CSS', 'Accessibility'],
    salary: '$110k-$130k',
    recruiter: 'Maya Chen',
    url: 'https://jobs.example.com/northstar-frontend',
  },
  {
    id: '002',
    position: 'Product Engineer',
    company: 'Clearpath',
    status: 'applied',
    last_status_update: toISODate(new Date(Date.now() - 5 * DAY_MS)),
    compat: 72,
    fav: false,
    responsibilities: '',
    skills: [],
    salary: '',
    recruiter: '',
    url: '',
  },
  {
    id: '003',
    position: 'UI Developer',
    company: 'Helio Works',
    status: 'interview',
    last_status_update: toISODate(new Date(Date.now() - 40 * DAY_MS)),
    compat: 66,
    fav: false,
    responsibilities: 'Own customer-facing dashboard views and partner with design.',
    skills: ['HTML', 'JavaScript'],
    salary: '$95k-$115k',
    recruiter: '',
    url: 'https://jobs.example.com/helio-ui',
  },
  {
    id: '004',
    position: 'Design Systems Engineer',
    company: 'Prism Studio',
    status: 'offer',
    last_status_update: toISODate(new Date(Date.now() - DAY_MS)),
    compat: 91,
    fav: false,
    responsibilities: 'Maintain component standards and documentation.',
    skills: ['Design Systems', 'CSS'],
    salary: '$125k-$145k',
    recruiter: 'Ana Rivera',
    url: 'https://jobs.example.com/prism-design-systems',
  },
  {
    id: '005',
    position: 'Web Application Developer',
    company: 'MetroGrid',
    status: 'rejected',
    last_status_update: toISODate(new Date(Date.now() - 18 * DAY_MS)),
    compat: 48,
    fav: false,
    responsibilities: 'Implement internal operations tooling.',
    skills: ['Vanilla JS'],
    salary: '',
    recruiter: '',
    url: '',
  },
  {
    id: '',
    position: 'Corrupt Demo Record',
    company: 'Unknown Company',
    status: 'applied',
    last_status_update: toISODate(),
    compat: 12,
    fav: false,
    responsibilities: '',
    skills: [],
    salary: '',
    recruiter: '',
    url: '',
  },
];

document.addEventListener('DOMContentLoaded', () => {
  store.load();

  if (store.getAll().length === 0 && sessionStorage.getItem(SEED_SESSION_KEY) !== 'true') {
    store.save(SEED_DATA);
    sessionStorage.setItem(SEED_SESSION_KEY, 'true');
  } else if (store.getAll().length > 0) {
    sessionStorage.setItem(SEED_SESSION_KEY, 'true');
  }

  const existingRoot = document.querySelector('#app');
  const main = document.createElement('main');
  const navbar = Navbar.render('tracker');

  main.id = 'app';

  if (existingRoot) {
    existingRoot.remove();
  }

  document.body.append(navbar, main);

  for (const button of navbar.querySelectorAll('.nav-btn')) {
    button.addEventListener('click', () => navigate(button.dataset.page));
  }

  navigate('tracker');
});

function navigate(page) {
  const appRoot = document.querySelector('#app');

  if (!appRoot || page === _currentPage) {
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
    Profile.mount(appRoot);
    _currentUnmount = Profile.unmount;
  } else {
    Tracker.mount(appRoot);
    _currentUnmount = Tracker.unmount;
  }

  _currentPage = page;
  Navbar.setActive(page);
}
