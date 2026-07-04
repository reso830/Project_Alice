import { STATUS_CONFIG, TERMINAL_STATES } from '../models/application.js';
import { formatPeso } from '../utils/currency.js';
import { toDisplayDate } from '../utils/date.js';
import { createStatusBadge, displayValue } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { bindBusyButton } from '../utils/asyncUI.js';
import * as api from '../services/api.js';
import { CompatBar } from './CompatBar.js';
import { StatusDropdown } from './StatusDropdown.js';

const CARD_SKILL_SUMMARY_LIMIT = 6;

function createActionButton(className, icon) {
  const button = document.createElement('button');
  button.className = `card-btn ${className}`;
  button.type = 'button';
  button.append(icon);

  return button;
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

  const visibleSkills = skills.slice(0, CARD_SKILL_SUMMARY_LIMIT);
  const hiddenCount = skills.length - visibleSkills.length;

  wrapper.title = hiddenCount > 0
    ? `${skills.length} required skills. Open details to view all.`
    : skills.join(', ');

  for (const skill of visibleSkills) {
    const tag = document.createElement('span');
    tag.className = 'skill-tag';
    tag.textContent = skill;
    wrapper.append(tag);
  }

  if (hiddenCount > 0) {
    const more = document.createElement('span');
    more.className = 'skill-tag skill-tag--more';
    more.textContent = `+${hiddenCount} more`;
    more.setAttribute('aria-label', `${hiddenCount} more required skills`);
    wrapper.append(more);
  }

  return wrapper;
}

function stopAction(event, callback) {
  event.stopPropagation();
  return callback();
}

export function render(application, callbacks = {}, { selected = false } = {}) {
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
  const editButton = createActionButton(
    'card-btn--edit',
    icon('edit'),
  );
  const statusButton = createActionButton(
    'card-btn--status',
    icon('changeStatus'),
  );
  const copyButton = createActionButton('card-btn--copy', icon('copyUrl'));
  const starButton = createActionButton(
    'card-btn--star',
    icon('star'),
  );
  const archiveButton = createActionButton(
    'card-btn--archive',
    icon('archive'),
  );
  const unarchiveButton = createActionButton(
    'card-btn--unarchive',
    icon('unarchive'),
  );

  editButton.setAttribute('aria-label', 'Open application details');
  statusButton.setAttribute('aria-label', 'Change status');
  copyButton.setAttribute('aria-label', 'Copy job URL');
  starButton.setAttribute('aria-label', 'Star application');
  archiveButton.setAttribute('aria-label', 'Archive application permanently from active list');
  unarchiveButton.setAttribute('aria-label', 'Unarchive application');
  unarchiveButton.title = 'Unarchive';

  card.className = application.archived === true ? 'card card-archived' : 'card';
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

  if (selected) {
    card.classList.add('card--selected');
    card.setAttribute('aria-selected', 'true');
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
  date.textContent = application.archived === true
    ? `Archived ${toDisplayDate(application.archivedDate ?? application.lastStatusUpdate)}`
    : toDisplayDate(application.lastStatusUpdate);

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
  if (TERMINAL_STATES.has(application.status)) {
    statusButton.disabled = true;
    statusButton.title = 'Workflow complete';
  } else {
    statusButton.addEventListener('click', (event) => {
      stopAction(event, () => {
        StatusDropdown.open(statusButton, application.status, (newStatus) => {
          callbacks.onStatusChange?.(application.id, newStatus);
        });
      });
    });
  }
  copyButton.addEventListener('click', (event) => {
    stopAction(event, () => callbacks.onCopyUrl?.(application.id));
  });
  starButton.addEventListener('click', (event) => {
    stopAction(event, () => {
      starButton.classList.toggle('card-btn--starred');
      callbacks.onFavToggle?.(application.id);
    });
  });
  const archiveBinding = bindBusyButton({
    button: archiveButton,
    action: () => callbacks.onArchive?.(application.id),
    errorMessage: () => "Couldn't archive.",
  });
  archiveButton.addEventListener('click', (event) => {
    stopAction(event, () => {
      archiveBinding.run().catch(() => {});
    });
  });
  const unarchiveBinding = bindBusyButton({
    button: unarchiveButton,
    action: async () => {
      try {
        const updated = await api.unarchive(application.id);
        callbacks.onUnarchiveSuccess?.(updated);
        return updated;
      } catch (error) {
        callbacks.onError?.(error);
        return null;
      }
    },
    silent: true,
  });
  unarchiveButton.addEventListener('click', (event) => {
    event.stopPropagation();
    unarchiveBinding.run();
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

  rowOneMeta.append(idPill, createStatusBadge(application.status));
  if (application.archived === true) {
    const stamp = document.createElement('span');
    stamp.className = 'card-archived-stamp';
    stamp.textContent = 'Archived';
    rowOneMeta.append(stamp);
  }
  rowOneMeta.append(date);
  if (application.archived === true) {
    rowOneActions.append(unarchiveButton);
  } else {
    rowOneActions.append(editButton, statusButton, copyButton, starButton, archiveButton);
  }
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
