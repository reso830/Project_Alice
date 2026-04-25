import { STATUS_CONFIG } from '../models/application.js';
import { toDisplayDate } from '../utils/date.js';
import { CompatBar } from './CompatBar.js';
import { StatusDropdown } from './StatusDropdown.js';

function displayValue(value) {
  return typeof value === 'string' && value.trim() !== '' ? value : '—';
}

function createActionButton(label, className) {
  const button = document.createElement('button');
  button.className = `card-btn ${className}`;
  button.type = 'button';
  button.textContent = label;

  return button;
}

function createStatusBadge(status) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.wishlisted;
  const badge = document.createElement('span');

  badge.className = 'status-badge';
  badge.textContent = config.label;
  badge.style.backgroundColor = config.badgeBg;
  badge.style.color = config.badgeText;

  return badge;
}

function createSkills(skills) {
  const wrapper = document.createElement('div');
  wrapper.className = 'skills';

  if (!Array.isArray(skills) || skills.length === 0) {
    wrapper.textContent = '—';
    return wrapper;
  }

  for (const skill of skills) {
    const tag = document.createElement('span');
    tag.className = 'skill-tag';
    tag.textContent = skill;
    wrapper.append(tag);
  }

  return wrapper;
}

function stopAction(event, callback) {
  event.stopPropagation();
  callback();
}

export function render(application, callbacks = {}) {
  const config = STATUS_CONFIG[application.status] ?? STATUS_CONFIG.wishlisted;
  const card = document.createElement('article');
  const rowOne = document.createElement('div');
  const rowOneMeta = document.createElement('div');
  const rowOneActions = document.createElement('div');
  const rowTwo = document.createElement('div');
  const rowTwoText = document.createElement('div');
  const rowThree = document.createElement('div');
  const idPill = document.createElement('span');
  const date = document.createElement('span');
  const position = document.createElement('span');
  const company = document.createElement('span');
  const responsibilities = document.createElement('div');
  const salary = document.createElement('span');
  const url = document.createElement('span');
  const editButton = createActionButton('✎', 'card-btn--edit');
  const statusButton = createActionButton('⇄', 'card-btn--status');
  const copyButton = createActionButton('🔗', 'card-btn--copy');
  const starButton = createActionButton('★', 'card-btn--star');
  let pointerStart = null;

  editButton.setAttribute('aria-label', 'Open application details');
  statusButton.setAttribute('aria-label', 'Change status');
  copyButton.setAttribute('aria-label', 'Copy job URL');
  starButton.setAttribute('aria-label', 'Star application');

  card.className = 'card';
  card.dataset.id = application.id;
  card.tabIndex = 0;
  card.setAttribute(
    'aria-label',
    `Open details for ${displayValue(application.position)} at ${displayValue(application.company)}`,
  );
  card.style.borderLeft = `4px solid ${config.borderAccent}`;

  if (application._corrupt) {
    card.classList.add('card--corrupt');
  }

  rowOne.className = 'card__row card__row--top';
  rowOneMeta.className = 'card__meta';
  rowOneActions.className = 'card__actions';
  rowTwo.className = 'card__row card__row--middle';
  rowTwoText.className = 'card__title-block';
  rowThree.className = 'card__row card__row--details';

  idPill.className = 'id-pill';
  idPill.textContent = displayValue(application.id);

  date.className = 'date';
  date.textContent = toDisplayDate(application.last_status_update);

  position.className = 'position';
  position.textContent = displayValue(application.position);

  company.className = 'company';
  company.textContent = displayValue(application.company);

  responsibilities.className = 'responsibilities';
  responsibilities.textContent = displayValue(application.responsibilities);

  salary.className = 'salary';
  salary.textContent = displayValue(application.salary);

  url.className = 'url-display';
  url.textContent = displayValue(application.url);

  if (application._corrupt) {
    const warning = document.createElement('span');
    warning.className = 'card-warning';
    warning.textContent = '⚠';
    rowOneMeta.append(warning);
  }

  if (application.fav) {
    starButton.classList.add('card-btn--starred');
  }

  editButton.addEventListener('click', (event) => {
    stopAction(event, () => callbacks.onOpen?.(application.id));
  });
  statusButton.addEventListener('click', (event) => {
    stopAction(event, () => {
      StatusDropdown.open(statusButton, application.status, (newStatus) => {
        callbacks.onStatusChange?.(application.id, newStatus);
      });
    });
  });
  copyButton.addEventListener('click', (event) => {
    stopAction(event, () => callbacks.onCopyUrl?.(application.id));
  });
  starButton.addEventListener('click', (event) => {
    stopAction(event, () => {
      starButton.classList.toggle('card-btn--starred');
      callbacks.onFavToggle?.(application.id);
    });
  });

  card.addEventListener('pointerdown', (event) => {
    pointerStart = { x: event.clientX, y: event.clientY };
  });

  card.addEventListener('pointerup', (event) => {
    if (!pointerStart || event.target.closest('.card-btn')) {
      pointerStart = null;
      return;
    }

    const distance = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
    pointerStart = null;

    if (distance < 5) {
      callbacks.onOpen?.(application.id);
    }
  });

  card.addEventListener('keydown', (event) => {
    if (event.target.closest('.card-btn')) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      callbacks.onOpen?.(application.id);
    }
  });

  rowOneMeta.append(idPill, createStatusBadge(application.status), date);
  rowOneActions.append(editButton, statusButton, copyButton, starButton);
  rowOne.append(rowOneMeta, rowOneActions);
  rowTwoText.append(position, company);
  rowTwo.append(rowTwoText, CompatBar.render(application.compat));
  rowThree.append(responsibilities, createSkills(application.skills), salary, url);
  card.append(rowOne, rowTwo, rowThree);

  return card;
}

export const Card = { render };
