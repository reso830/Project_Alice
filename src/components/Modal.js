import { STATUS_CONFIG } from '../models/application.js';
import { toDisplayDate, toISODate } from '../utils/date.js';
import { StatusDropdown } from './StatusDropdown.js';

let _savedScrollY = 0;
let _backdrop = null;
let _keydownHandler = null;

function getFocusableElements(root) {
  return [...root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.disabled && element.offsetParent !== null);
}

function displayValue(value) {
  return typeof value === 'string' && value.trim() !== '' ? value : '—';
}

function createStatusBadge(status) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.wishlisted;
  const badge = document.createElement('span');

  badge.id = 'modal-status-badge';
  badge.className = 'status-badge';
  badge.textContent = config.label;
  badge.style.backgroundColor = config.badgeBg;
  badge.style.color = config.badgeText;

  return badge;
}

function updateStatusBadge(status) {
  const badge = document.querySelector('#modal-status-badge');
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.wishlisted;

  if (!badge) {
    return;
  }

  badge.textContent = config.label;
  badge.style.backgroundColor = config.badgeBg;
  badge.style.color = config.badgeText;
}

function updateStatusDate() {
  const dateValue = document.querySelector('[data-modal-field="last-status-update"] .modal-field__value');

  if (dateValue) {
    dateValue.textContent = toDisplayDate(toISODate());
  }
}

function createField(label, value, fullSpan = false) {
  const row = document.createElement('div');
  const labelEl = document.createElement('span');
  const valueEl = document.createElement('span');

  row.className = fullSpan ? 'modal-field modal-field--full' : 'modal-field';
  labelEl.className = 'modal-field__label';
  valueEl.className = 'modal-field__value';
  labelEl.textContent = label;
  valueEl.textContent = displayValue(value);

  row.append(labelEl, valueEl);

  return row;
}

function createSkills(skills) {
  const row = document.createElement('div');
  const labelEl = document.createElement('span');
  const valueEl = document.createElement('div');

  row.className = 'modal-field modal-field--full';
  labelEl.className = 'modal-field__label';
  valueEl.className = 'modal-field__value modal-skills';
  labelEl.textContent = 'Skills';

  if (!Array.isArray(skills) || skills.length === 0) {
    valueEl.textContent = '—';
  } else {
    for (const skill of skills) {
      const tag = document.createElement('span');
      tag.className = 'skill-tag';
      tag.textContent = skill;
      valueEl.append(tag);
    }
  }

  row.append(labelEl, valueEl);

  return row;
}

export function close() {
  const hadOpenModal = Boolean(_backdrop);

  document.body.style.overflow = '';

  if (_backdrop) {
    _backdrop.remove();
    _backdrop = null;
  }

  if (_keydownHandler) {
    document.removeEventListener('keydown', _keydownHandler);
    _keydownHandler = null;
  }

  if (hadOpenModal) {
    window.scrollTo(0, _savedScrollY);
  }
}

export function open(application, { onStatusChange } = {}) {
  if (!application) {
    return;
  }

  close();

  _savedScrollY = window.scrollY;
  document.body.style.overflow = 'hidden';

  const backdrop = document.createElement('div');
  const panel = document.createElement('div');
  const header = document.createElement('div');
  const headerMeta = document.createElement('div');
  const titleRow = document.createElement('div');
  const idPill = document.createElement('span');
  const title = document.createElement('h2');
  const statusButton = document.createElement('button');
  const body = document.createElement('div');
  let currentStatus = application.status;

  backdrop.className = 'modal-backdrop';
  panel.className = 'modal-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'modal-title');
  if (window.innerWidth < 640) {
    panel.classList.add('modal-panel--bottom-sheet');
  }
  header.className = 'modal-header';
  headerMeta.className = 'modal-header__meta';
  titleRow.className = 'modal-header__title-row';
  idPill.className = 'id-pill';
  statusButton.className = 'card-btn modal-status-btn';
  statusButton.type = 'button';
  body.className = 'modal-body';

  idPill.textContent = displayValue(application.id);
  title.id = 'modal-title';
  title.textContent = displayValue(application.position);
  statusButton.textContent = '⇄';

  statusButton.setAttribute('aria-label', 'Change status');

  statusButton.addEventListener('click', () => {
    StatusDropdown.open(statusButton, currentStatus, (newStatus) => {
      onStatusChange?.(application.id, newStatus);
      currentStatus = newStatus;
      updateStatusBadge(newStatus);
      updateStatusDate();
    });
  });

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      close();
    }
  });

  _keydownHandler = (event) => {
    if (event.key === 'Escape') {
      close();
      return;
    }

    if (event.key === 'Tab') {
      const focusableElements = getFocusableElements(panel);

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  };
  document.addEventListener('keydown', _keydownHandler);

  headerMeta.append(idPill, createStatusBadge(application.status));
  titleRow.append(title, statusButton);
  header.append(headerMeta, titleRow);
  body.append(
    createField('Company', application.company),
    createField('Recruiter', application.recruiter),
    createField('Salary', application.salary),
    createField('Compatibility', `${application.compat}%`),
    createField('Last status update', toDisplayDate(application.last_status_update)),
    createField('Responsibilities', application.responsibilities, true),
    createSkills(application.skills),
    createField('URL', application.url, true),
  );
  body.querySelectorAll('.modal-field')[4].dataset.modalField = 'last-status-update';
  panel.append(header, body);
  backdrop.append(panel);
  document.body.append(backdrop);
  _backdrop = backdrop;
  getFocusableElements(panel)[0]?.focus();
}

export const Modal = { open, close };
