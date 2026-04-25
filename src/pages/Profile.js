import { store } from '../data/store.js';

const INACTIVE_STATUSES = new Set(['rejected', 'withdrawn', 'ghosted']);

let _container = null;

function createStatCard(label, value) {
  const card = document.createElement('div');
  const valueEl = document.createElement('div');
  const labelEl = document.createElement('div');

  card.className = 'stat-card';
  valueEl.className = 'stat-card__value';
  labelEl.className = 'stat-card__label';
  valueEl.textContent = String(value);
  labelEl.textContent = label;

  card.append(valueEl, labelEl);
  return card;
}

export function mount(container) {
  const applications = store.getAll();
  const page = document.createElement('div');
  const cards = document.createElement('div');
  const stats = [
    ['Total', applications.length],
    ['Active', applications.filter((application) => !INACTIVE_STATUSES.has(application.status)).length],
    ['Offers', applications.filter((application) => application.status === 'offer').length],
    ['Rejections', applications.filter((application) => application.status === 'rejected').length],
  ];

  _container = container;
  _container.replaceChildren();

  page.className = 'profile-page';
  cards.className = 'stat-cards';

  for (const [label, value] of stats) {
    cards.append(createStatCard(label, value));
  }

  page.append(cards);
  _container.append(page);
}

export function unmount() {
  if (_container) {
    _container.replaceChildren();
  }

  _container = null;
}

export const Profile = { mount, unmount };
