import { STATUS_CONFIG } from '../models/application.js';
import { formatPeso } from '../utils/currency.js';
import { toDisplayDate } from '../utils/date.js';
import { createStatusBadge, displayValue } from '../utils/dom.js';
import { CompatBar } from './CompatBar.js';
import { StatusDropdown } from './StatusDropdown.js';

function createActionButton(label, className) {
  const button = document.createElement('button');
  button.className = `card-btn ${className}`;
  button.type = 'button';
  button.textContent = label;

  return button;
}

function createClipboardIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  rect.setAttribute('x', '8');
  rect.setAttribute('y', '8');
  rect.setAttribute('width', '12');
  rect.setAttribute('height', '12');
  rect.setAttribute('rx', '2');
  path.setAttribute('d', 'M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2');

  for (const element of [rect, path]) {
    element.setAttribute('fill', 'none');
    element.setAttribute('stroke', 'currentColor');
    element.setAttribute('stroke-width', '2');
    element.setAttribute('stroke-linecap', 'round');
    element.setAttribute('stroke-linejoin', 'round');
  }

  svg.append(rect, path);
  return svg;
}

function createDetailCell(label, valueEl, modifier) {
  const cell = document.createElement('div');
  const labelEl = document.createElement('span');

  cell.className = modifier ? `card-detail card-detail--${modifier}` : 'card-detail';
  labelEl.className = 'card-detail__label';
  labelEl.textContent = label;
  cell.append(labelEl, valueEl);

  return cell;
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
  const jobTitle = document.createElement('span');
  const company = document.createElement('span');
  const responsibilities = document.createElement('div');
  const salary = document.createElement('span');
  const editButton = createActionButton('✎', 'card-btn--edit');
  const statusButton = createActionButton('⇄', 'card-btn--status');
  const copyButton = createActionButton('', 'card-btn--copy');
  const starButton = createActionButton('★', 'card-btn--star');
  const archiveButton = createActionButton('×', 'card-btn--archive');

  editButton.setAttribute('aria-label', 'Open application details');
  statusButton.setAttribute('aria-label', 'Change status');
  copyButton.setAttribute('aria-label', 'Copy job URL');
  copyButton.append(createClipboardIcon());
  starButton.setAttribute('aria-label', 'Star application');
  archiveButton.setAttribute('aria-label', 'Archive application permanently from active list');

  card.className = 'card';
  card.dataset.id = application.id;
  card.tabIndex = 0;
  card.setAttribute(
    'aria-label',
    `Open details for ${displayValue(application.jobTitle)} at ${displayValue(application.companyName)}`,
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
  idPill.textContent = application.id;

  date.className = 'date';
  date.textContent = toDisplayDate(application.lastStatusUpdate);

  jobTitle.className = 'position';
  jobTitle.textContent = displayValue(application.jobTitle);

  company.className = 'company';
  company.textContent = displayValue(application.companyName);

  responsibilities.className = 'responsibilities';
  responsibilities.textContent = displayValue(application.responsibilities);

  salary.className = 'salary';
  salary.textContent = formatPeso(application.salary);

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
  archiveButton.addEventListener('click', (event) => {
    stopAction(event, () => callbacks.onArchive?.(application.id));
  });

  card.addEventListener('click', (event) => {
    if (!event.target.closest('.card-btn')) {
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
  rowOneActions.append(editButton, statusButton, copyButton, starButton, archiveButton);
  rowOne.append(rowOneMeta, rowOneActions);
  rowTwoText.append(jobTitle, company);
  rowTwo.append(rowTwoText, CompatBar.render(application.compat));
  rowThree.append(
    createDetailCell('Responsibilities', responsibilities, 'resp'),
    createDetailCell('Skills', createSkills(application.skills), 'skills'),
    createDetailCell('Salary', salary, 'salary'),
  );
  card.append(rowOne, rowTwo, rowThree);

  return card;
}

export const Card = { render };
