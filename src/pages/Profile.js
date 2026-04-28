import { getAll, getProfile } from '../services/api.js';
import { computeAppCounts, computeStats } from '../models/profile.js';

let _container = null;
let _dismissTimer = null;

function createElement(tag, className, text) {
  const el = document.createElement(tag);

  if (className) {
    el.className = className;
  }

  if (text !== undefined) {
    el.textContent = text;
  }

  return el;
}

function createButton(label, className, onClick) {
  const button = document.createElement('button');

  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', onClick);

  return button;
}

function renderWelcome(page, profile) {
  const header = createElement('header', 'profile-hero');
  const heading = createElement('h1');

  if (profile) {
    heading.textContent = `Welcome back, ${profile.firstName}.`;
    header.append(heading, createElement('p', 'profile-subline', "Here's where things stand today."));
  } else {
    heading.textContent = 'Welcome back.';
    header.append(heading);
  }

  page.append(header);
}

function createSection(label) {
  const section = createElement('section', 'section-card');
  const header = createElement('div', 'section-card__header');
  const labelEl = createElement('div', 'section-label', label);
  const actions = createElement('div', 'section-card__actions');

  header.append(labelEl, actions);
  section.append(header);

  return { section, actions };
}

function renderStatChip(label, value, modifier) {
  const chip = createElement('div', `stat-chip stat-chip--${modifier}`);

  chip.append(
    createElement('div', 'stat-chip__value', String(value)),
    createElement('div', 'stat-chip__label', label),
  );

  return chip;
}

function renderStatChips(container, applications) {
  const counts = computeAppCounts(applications);
  const stats = computeStats(counts);

  container.replaceChildren(
    renderStatChip('Total', stats.total, 'total'),
    renderStatChip('Active', stats.active, 'active'),
    renderStatChip('Pending', stats.pending, 'pending'),
    renderStatChip('Offer', stats.offer, 'offer'),
  );
}

function renderApplicationsSection(page, navigate) {
  const { section, actions } = createSection('APPLICATIONS');
  const stats = createElement('div', 'stat-chip-row');
  const message = createElement('p', 'apps-empty-message');

  actions.append(createButton('Go to Tracker', 'profile-btn profile-btn--primary', () => navigate('tracker')));
  stats.append(createElement('div', 'profile-loading', 'Loading applications...'));
  section.append(stats, message);
  page.append(section);

  return { stats, message };
}

function renderEmptyProfile(section, navigate) {
  const empty = createElement('div', 'profile-empty');
  const icon = createElement('div', 'profile-empty__icon');
  const iconHead = createElement('span', 'profile-empty__icon-head');
  const iconBody = createElement('span', 'profile-empty__icon-body');

  icon.setAttribute('aria-hidden', 'true');
  icon.append(iconHead, iconBody);
  empty.append(
    icon,
    createElement('p', 'profile-empty__title', 'No profile set up yet.'),
    createElement('p', 'profile-empty__copy', 'Add your background to strengthen your applications.'),
    createButton('Set Up Profile', 'profile-btn profile-btn--primary', () => navigate('profile-edit')),
  );
  section.append(empty);
}

function renderProfileSection(page, profile, navigate) {
  const { section, actions } = createSection('PROFILE');

  if (profile) {
    actions.append(createButton('Edit Profile', 'profile-btn profile-btn--outline', () => navigate('profile-edit')));
  } else {
    renderEmptyProfile(section, navigate);
  }

  page.append(section);
}

function renderProfileError(page, navigate) {
  const { section } = createSection('PROFILE');

  renderEmptyProfile(section, navigate);
  page.append(section);
}

export async function mount(container, { navigate } = {}) {
  const safeNavigate = typeof navigate === 'function' ? navigate : () => {};
  const page = createElement('div', 'profile-page');

  _container = container;
  _container.replaceChildren(page);

  const profilePromise = getProfile().catch(() => null);
  const applicationsPromise = getAll();
  const profile = await profilePromise;

  if (_container !== container) {
    return;
  }

  page.replaceChildren();
  renderWelcome(page, profile);
  const applicationsSection = renderApplicationsSection(page, safeNavigate);

  try {
    const applications = await applicationsPromise;
    const safeApplications = Array.isArray(applications) ? applications : [];

    renderStatChips(applicationsSection.stats, safeApplications);
    applicationsSection.message.textContent = safeApplications.length === 0
      ? 'No applications yet.'
      : '';
  } catch {
    renderStatChips(applicationsSection.stats, []);
    applicationsSection.message.textContent = 'Application data is unavailable right now.';
  }

  if (_container !== container) {
    return;
  }

  if (profile || profile === null) {
    renderProfileSection(page, profile, safeNavigate);
  } else {
    renderProfileError(page, safeNavigate);
  }
}

export function unmount() {
  if (_dismissTimer) {
    clearTimeout(_dismissTimer);
    _dismissTimer = null;
  }

  if (_container) {
    _container.replaceChildren();
  }

  _container = null;
}

export const Profile = { mount, unmount };
