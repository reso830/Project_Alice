import { STATUS_CONFIG } from '../models/application.js';
import * as api from '../services/api.js';
import { formatPeso } from '../utils/currency.js';
import { toDisplayDate } from '../utils/date.js';
import { createStatusBadge, displayValue } from '../utils/dom.js';
import { StatusDropdown } from './StatusDropdown.js';
import { Toast } from './Toast.js';

let _savedScrollY = 0;
let _backdrop = null;
let _keydownHandler = null;

function getFocusableElements(root) {
  return [...root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.disabled && element.offsetParent !== null);
}

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return {
    red: Number.parseInt(value.slice(0, 2), 16),
    green: Number.parseInt(value.slice(2, 4), 16),
    blue: Number.parseInt(value.slice(4, 6), 16),
  };
}

function relativeLuminance({ red, green, blue }) {
  return [red, green, blue]
    .map((channel) => {
      const value = channel / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrastRatio(first, second) {
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

export function getHeaderContrastClass(hexColor) {
  const background = relativeLuminance(hexToRgb(hexColor));
  const white = relativeLuminance({ red: 255, green: 255, blue: 255 });
  const dark = relativeLuminance({ red: 0, green: 0, blue: 0 });

  return contrastRatio(background, white) >= contrastRatio(background, dark)
    ? 'modal-header--light'
    : 'modal-header--dark';
}

export function getHeaderContrastRatio(hexColor) {
  const background = relativeLuminance(hexToRgb(hexColor));
  const text = getHeaderContrastClass(hexColor) === 'modal-header--light'
    ? relativeLuminance({ red: 255, green: 255, blue: 255 })
    : relativeLuminance({ red: 0, green: 0, blue: 0 });

  return contrastRatio(background, text);
}

function createClipboardIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icon');
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

function createSvgIcon(pathData) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  path.setAttribute('d', pathData);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);

  return svg;
}

function createQuickButton(label, className, icon) {
  const button = document.createElement('button');
  const text = document.createElement('span');

  button.className = `modal-quick-action ${className}`;
  button.type = 'button';
  text.className = 'modal-quick-action__label';
  text.textContent = label;
  button.append(icon, text);
  return button;
}

function applyHeaderStatus(header, status) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.wishlisted;
  header.style.backgroundColor = config.borderAccent;
  header.classList.remove('modal-header--light', 'modal-header--dark');
  header.classList.add(getHeaderContrastClass(config.borderAccent));
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

function updateStatusDate(lastStatusUpdate) {
  const dateValue = document.querySelector('[data-modal-field="last-status-update"] .modal-field__value');

  if (dateValue) {
    dateValue.textContent = toDisplayDate(lastStatusUpdate);
  }
}

function updateFavoriteButton(button, isFavorite) {
  const text = document.createElement('span');
  const icon = createSvgIcon('M12 3.5 14.8 9l6.1.9-4.4 4.3 1 6-5.5-2.9-5.5 2.9 1-6L3.1 9l6.1-.9L12 3.5Z');

  text.className = 'modal-quick-action__label';
  text.textContent = 'Favorite';
  icon.querySelector('path').setAttribute('fill', isFavorite ? 'currentColor' : 'none');
  button.replaceChildren(icon, text);
  button.setAttribute('aria-pressed', String(isFavorite));
}

function createField(label, value, fullSpan = false, { preserveEmpty = false } = {}) {
  const row = document.createElement('div');
  const labelEl = document.createElement('span');
  const valueEl = document.createElement('span');

  row.className = fullSpan ? 'modal-field modal-field--full' : 'modal-field';
  labelEl.className = 'modal-field__label';
  valueEl.className = 'modal-field__value';
  labelEl.textContent = label;
  valueEl.textContent = preserveEmpty ? value : displayValue(value);

  row.append(labelEl, valueEl);

  return row;
}

function createLinkField(value, onCopy) {
  const row = document.createElement('button');
  const labelEl = document.createElement('span');
  const valueEl = document.createElement('span');
  const hasUrl = typeof value === 'string' && value.trim() !== '';

  row.className = 'modal-field modal-field--full modal-link-field';
  row.type = 'button';
  row.disabled = !hasUrl;
  row.setAttribute('aria-label', hasUrl ? 'Copy job posting URL' : 'No job posting URL');

  if (!hasUrl) {
    row.classList.add('modal-link-field--disabled');
  }

  labelEl.className = 'modal-field__label';
  valueEl.className = 'modal-field__value modal-link-field__value';
  labelEl.textContent = 'URL';
  valueEl.textContent = displayValue(value);
  row.append(labelEl, valueEl);

  if (hasUrl) {
    valueEl.append(createClipboardIcon());
    row.addEventListener('click', onCopy);
  }

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

export function open(application, {
  onApplicationUpdate,
  onArchiveSuccess,
} = {}) {
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
  const quickActions = document.createElement('div');
  const favoriteButton = createQuickButton(
    'Favorite',
    'modal-quick-action--favorite',
    createSvgIcon('M12 3.5 14.8 9l6.1.9-4.4 4.3 1 6-5.5-2.9-5.5 2.9 1-6L3.1 9l6.1-.9L12 3.5Z'),
  );
  const statusButton = createQuickButton(
    'Change Status',
    'modal-quick-action--status',
    createSvgIcon('M7 7h11m0 0-3-3m3 3-3 3M17 17H6m0 0 3 3m-3-3 3-3'),
  );
  const archiveButton = createQuickButton(
    'Archive',
    'modal-quick-action--archive',
    createSvgIcon('M5 5l14 14M19 5 5 19'),
  );
  const body = document.createElement('div');
  let currentStatus = application.status;
  let currentFavorite = application.fav === true;

  backdrop.className = 'modal-backdrop';
  panel.className = 'modal-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'modal-title');
  header.className = 'modal-header';
  headerMeta.className = 'modal-header__meta';
  titleRow.className = 'modal-header__title-row';
  quickActions.className = 'modal-quick-actions';
  idPill.className = 'id-pill';
  body.className = 'modal-body';
  applyHeaderStatus(header, currentStatus);
  updateFavoriteButton(favoriteButton, currentFavorite);

  idPill.textContent = application.id;
  title.id = 'modal-title';
  title.textContent = displayValue(application.jobTitle);
  favoriteButton.setAttribute('aria-label', 'Toggle favorite');
  statusButton.setAttribute('aria-label', 'Change status');
  archiveButton.setAttribute('aria-label', 'Archive application');

  favoriteButton.addEventListener('click', async () => {
    try {
      const updated = await api.update(application.id, { fav: !currentFavorite });
      currentFavorite = updated.fav === true;
      updateFavoriteButton(favoriteButton, currentFavorite);
      onApplicationUpdate?.(updated);
    } catch {
      Toast.show('Favorite update failed', 'failure');
    }
  });

  statusButton.addEventListener('click', () => {
    StatusDropdown.open(statusButton, currentStatus, async (newStatus) => {
      let updated;

      try {
        updated = await api.update(application.id, { status: newStatus });
      } catch {
        Toast.show('Status update failed', 'failure');
        return;
      }

      currentStatus = updated.status ?? newStatus;
      applyHeaderStatus(header, currentStatus);
      updateStatusBadge(currentStatus);
      updateStatusDate(updated.lastStatusUpdate);
      onApplicationUpdate?.(updated);
    });
  });

  archiveButton.addEventListener('click', async () => {
    if (!window.confirm('Archive this application?')) {
      return;
    }

    try {
      const updated = await api.update(application.id, { archived: true, fav: false });
      onArchiveSuccess?.(updated);
      close();
    } catch {
      Toast.show('Archive failed', 'failure');
    }
  });

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(application.jobPostingUrl);
      Toast.show('Link copied', 'success');
    } catch {
      Toast.show('Could not copy link', 'error');
    }
  }

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

  const statusDateField = createField('Last status update', toDisplayDate(application.lastStatusUpdate));
  statusDateField.dataset.modalField = 'last-status-update';

  headerMeta.append(idPill, createStatusBadge(application.status, { id: 'modal-status-badge' }));
  titleRow.append(title);
  quickActions.append(favoriteButton, statusButton, archiveButton);
  header.append(headerMeta, titleRow, quickActions);
  body.append(
    createField('Company', application.companyName),
    createField('Recruiter', application.recruiter),
    createField('Salary', formatPeso(application.salary), false, { preserveEmpty: true }),
    createField('Compatibility', `${application.compat}%`),
    statusDateField,
    createField('Responsibilities', application.responsibilities, true),
    createSkills(application.skills),
    createLinkField(application.jobPostingUrl, copyUrl),
  );
  panel.append(header, body);
  backdrop.append(panel);
  document.body.append(backdrop);
  _backdrop = backdrop;
  getFocusableElements(panel)[0]?.focus();
}

export const Modal = { open, close };
