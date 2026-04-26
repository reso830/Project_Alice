import './styles/main.css';
import { Footer } from './components/Footer.js';
import { Navbar } from './components/Navbar.js';
import { store } from './data/store.js';
import { Calendar } from './pages/Calendar.js';
import { Profile } from './pages/Profile.js';
import { Tracker } from './pages/Tracker.js';
import { toISODate } from './utils/date.js';

const DAY_MS = 86400000;

let _currentPage = null;
let _currentUnmount = null;

const SEED_DATA = [
  {
    id: '001',
    jobTitle: 'Frontend Engineer',
    companyName: 'Northstar Labs',
    status: 'wishlisted',
    lastStatusUpdate: toISODate(new Date(Date.now() - 2 * DAY_MS)),
    compat: 84,
    fav: true,
    responsibilities: 'Build responsive web interfaces and maintain shared UI patterns.',
    skills: ['JavaScript', 'CSS', 'Accessibility'],
    salary: '$110k-$130k',
    recruiter: 'Maya Chen',
    jobPostingUrl: 'https://jobs.example.com/northstar-frontend',
  },
  {
    id: '002',
    jobTitle: 'Product Engineer',
    companyName: 'Clearpath',
    status: 'applied',
    lastStatusUpdate: toISODate(new Date(Date.now() - 5 * DAY_MS)),
    compat: 72,
    fav: false,
    responsibilities: '',
    skills: [],
    salary: '',
    recruiter: '',
    jobPostingUrl: '',
  },
  {
    id: '003',
    jobTitle: 'UI Developer',
    companyName: 'Helio Works',
    status: 'interview',
    lastStatusUpdate: toISODate(new Date(Date.now() - 40 * DAY_MS)),
    compat: 66,
    fav: false,
    responsibilities: 'Own customer-facing dashboard views and partner with design.',
    skills: ['HTML', 'JavaScript'],
    salary: '$95k-$115k',
    recruiter: '',
    jobPostingUrl: 'https://jobs.example.com/helio-ui',
  },
  {
    id: '004',
    jobTitle: 'Design Systems Engineer',
    companyName: 'Prism Studio',
    status: 'offer',
    lastStatusUpdate: toISODate(new Date(Date.now() - DAY_MS)),
    compat: 91,
    fav: false,
    responsibilities: 'Maintain component standards and documentation.',
    skills: ['Design Systems', 'CSS'],
    salary: '$125k-$145k',
    recruiter: 'Ana Rivera',
    jobPostingUrl: 'https://jobs.example.com/prism-design-systems',
  },
  {
    id: '005',
    jobTitle: 'Web Application Developer',
    companyName: 'MetroGrid',
    status: 'rejected',
    lastStatusUpdate: toISODate(new Date(Date.now() - 18 * DAY_MS)),
    compat: 48,
    fav: false,
    responsibilities: 'Implement internal operations tooling.',
    skills: ['Vanilla JS'],
    salary: '',
    recruiter: '',
    jobPostingUrl: '',
  },
  {
    id: '',
    jobTitle: 'Corrupt Demo Record',
    companyName: 'Unknown Company',
    status: 'applied',
    lastStatusUpdate: toISODate(),
    compat: 12,
    fav: false,
    responsibilities: '',
    skills: [],
    salary: '',
    recruiter: '',
    jobPostingUrl: '',
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
