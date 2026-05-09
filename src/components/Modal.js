import {
  SHIFT_VALUES,
  STATUS_CONFIG,
  WORK_SETUP_VALUES,
  normalizeApplication,
} from '../models/application.js';
import * as api from '../services/api.js';
import { formatPeso, parseSalaryInput } from '../utils/currency.js';
import { toDisplayDate } from '../utils/date.js';
import { createStatusBadge, displayValue } from '../utils/dom.js';
import { createArchiveIcon, createClipboardIcon, createSvgIcon } from '../utils/icons.js';
import { validateUrl } from '../utils/validate.js';
import { CompatBar } from './CompatBar.js';
import { ConfirmDialog } from './ConfirmDialog.js';
import { StatusDropdown } from './StatusDropdown.js';
import { Toast } from './Toast.js';

let _savedScrollY = 0;
let _backdrop = null;
let _keydownHandler = null;
let _draft = null;
let _original = null;
let _body = null;
let _titleRow = null;
let _footer = null;
let _saveButton = null;
let _idPill = null;
let _archiveButton = null;
let _quickActions = null;
let _mode = 'edit';
let _onApplicationUpdate = null;
let _onApplicationCreate = null;

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

function createQuickButton(className, icon) {
  const button = document.createElement('button');

  button.className = `modal-quick-action ${className}`;
  button.type = 'button';
  button.append(icon);
  return button;
}

function applyHeaderStatus(header, status) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.wishlisted;
  header.style.backgroundColor = config.borderAccent;
  header.style.color = config.badgeText;
  header.classList.remove('modal-header--light', 'modal-header--dark');
}

function updateStatusBadge(badge, status) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.wishlisted;

  if (!badge) {
    return;
  }

  badge.textContent = config.label;
  badge.style.backgroundColor = config.badgeBg;
  badge.style.color = config.badgeText;
}

function updateFavoriteButton(button, isFavorite) {
  const icon = createSvgIcon('M12 3.5 14.8 9l6.1.9-4.4 4.3 1 6-5.5-2.9-5.5 2.9 1-6L3.1 9l6.1-.9L12 3.5Z');

  icon.querySelector('path').setAttribute('fill', isFavorite ? 'currentColor' : 'none');
  button.replaceChildren(icon);
  button.setAttribute('aria-pressed', String(isFavorite));
}

function valuesDiffer(first, second) {
  if (Array.isArray(first) || Array.isArray(second)) {
    return JSON.stringify(first ?? []) !== JSON.stringify(second ?? []);
  }

  return first !== second;
}

function _isDirty() {
  if (_mode === 'create') {
    return true;
  }

  if (!_draft || !_original) {
    return false;
  }

  for (const key of Object.keys(_draft)) {
    if (valuesDiffer(_draft[key], _original[key])) {
      return true;
    }
  }

  return false;
}

function _syncFooter() {
  if (!_footer) {
    return;
  }

  if (_saveButton) {
    _saveButton.textContent = _mode === 'create' ? 'Create' : 'Save';
    _saveButton.disabled = false;
  }

  if (_mode === 'create') {
    _footer.hidden = false;
  } else {
    _footer.hidden = !_isDirty();
  }
}

function clearInlineErrors() {
  document.querySelectorAll('.modal-field-error, .modal-title-error')
    .forEach((element) => element.remove());
}

function showFieldError(label, message) {
  const field = [...document.querySelectorAll('.modal-field')]
    .find((element) => element.querySelector('.modal-field__label')?.firstChild?.textContent === label);
  const error = document.createElement('span');

  error.className = 'modal-field-error';
  error.textContent = message;
  field?.append(error);
}

function showTitleError(message) {
  const error = document.createElement('span');

  error.className = 'modal-title-error';
  error.textContent = message;
  _titleRow?.append(error);
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

function appendFieldLabel(labelEl, label, required) {
  labelEl.textContent = label;

  if (required) {
    const indicator = document.createElement('span');
    indicator.className = 'modal-field__required';
    indicator.setAttribute('aria-hidden', 'true');
    indicator.textContent = '*';
    labelEl.append(indicator);
  }
}

function createEditableShell(label, fullSpan = false, { required = false } = {}) {
  const row = document.createElement('div');
  const labelEl = document.createElement('span');
  const valueEl = document.createElement('span');

  row.className = fullSpan
    ? 'modal-field modal-field--full modal-field--editable'
    : 'modal-field modal-field--editable';
  labelEl.className = 'modal-field__label';
  valueEl.className = 'modal-field__value';
  appendFieldLabel(labelEl, label, required);
  row.append(labelEl, valueEl);

  return { row, valueEl };
}

async function copyJobPostingUrl(event) {
  event.stopPropagation();

  try {
    await navigator.clipboard.writeText(_draft.jobPostingUrl);
    Toast.show('Link copied', 'success');
  } catch {
    Toast.show('Could not copy link', 'failure');
  }
}

function renderTextDisplay(valueEl, key, formatter) {
  valueEl.replaceChildren();
  valueEl.textContent = formatter ? formatter(_draft[key]) : displayValue(_draft[key]);

  if (key === 'jobPostingUrl' && typeof _draft.jobPostingUrl === 'string' && _draft.jobPostingUrl.trim() !== '') {
    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'modal-inline-copy';
    copyButton.setAttribute('aria-label', 'Copy job posting URL');
    copyButton.append(createClipboardIcon());
    copyButton.addEventListener('click', copyJobPostingUrl);
    valueEl.append(copyButton);
  }
}

function makeInlineText({ label, key, multiline = false, fullSpan = false, required = false }) {
  const { row, valueEl } = createEditableShell(label, fullSpan, { required });
  const formatter = key === 'salary' ? formatPeso : null;
  const displayClass = multiline ? ' modal-field__display--multiline' : '';

  function commit(input) {
    _draft[key] = key === 'salary'
      ? parseSalaryInput(input.value)
      : input.value.trim();
    renderTextDisplay(valueEl, key, formatter);
    row.classList.remove('modal-field--editing');
    _syncFooter();
  }

  row.addEventListener('click', (event) => {
    if (event.target.closest('button') || row.classList.contains('modal-field--editing')) {
      return;
    }

    const previousValue = _draft[key];
    const input = document.createElement(multiline ? 'textarea' : 'input');
    let finished = false;

    input.className = 'modal-inline-control';
    input.value = key === 'salary'
      ? (Number.isInteger(_draft.salary) && _draft.salary > 0 ? String(_draft.salary) : '')
      : (_draft[key] ?? '');
    row.classList.add('modal-field--editing');
    valueEl.replaceChildren(input);
    input.focus();
    input.select();

    input.addEventListener('blur', () => {
      if (!finished) {
        finished = true;
        commit(input);
      }
    });

    input.addEventListener('keydown', (keyboardEvent) => {
      if (keyboardEvent.key === 'Escape') {
        keyboardEvent.preventDefault();
        keyboardEvent.stopPropagation();
        finished = true;
        _draft[key] = previousValue;
        renderTextDisplay(valueEl, key, formatter);
        row.classList.remove('modal-field--editing');
        return;
      }

      const shouldCommit = multiline
        ? keyboardEvent.key === 'Enter' && (keyboardEvent.ctrlKey || keyboardEvent.metaKey)
        : keyboardEvent.key === 'Enter';

      if (shouldCommit) {
        keyboardEvent.preventDefault();
        finished = true;
        commit(input);
      }
    });
  });

  if (multiline) {
    valueEl.className += displayClass;
  }

  renderTextDisplay(valueEl, key, formatter);

  return row;
}

function makeInlineSelect({ label, key, options, fullSpan = false }) {
  const { row, valueEl } = createEditableShell(label, fullSpan);

  function renderDisplay() {
    valueEl.textContent = displayValue(_draft[key]);
  }

  row.addEventListener('click', () => {
    if (row.classList.contains('modal-field--editing')) {
      return;
    }

    const previousValue = _draft[key];
    const select = document.createElement('select');
    const emptyOption = document.createElement('option');

    select.className = 'modal-inline-control';
    emptyOption.value = '';
    emptyOption.textContent = '\u2014';
    select.append(emptyOption);

    for (const optionValue of options) {
      const option = document.createElement('option');
      option.value = optionValue;
      option.textContent = optionValue;
      select.append(option);
    }

    select.value = _draft[key] ?? '';
    row.classList.add('modal-field--editing');
    valueEl.replaceChildren(select);
    select.focus();

    select.addEventListener('change', () => {
      _draft[key] = select.value;
      renderDisplay();
      row.classList.remove('modal-field--editing');
      _syncFooter();
    });

    select.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        _draft[key] = previousValue;
        renderDisplay();
        row.classList.remove('modal-field--editing');
        _syncFooter();
      }
    });
  });

  renderDisplay();

  return row;
}

function makeChipEditor({ label, key }) {
  const row = document.createElement('div');
  const labelEl = document.createElement('span');
  const valueEl = document.createElement('div');

  row.className = 'modal-field modal-field--full modal-field--editable';
  labelEl.className = 'modal-field__label';
  valueEl.className = 'modal-field__value modal-skills modal-chip-editor';
  labelEl.textContent = label;

  function values() {
    return Array.isArray(_draft[key]) ? _draft[key] : [];
  }

  function renderChips() {
    valueEl.replaceChildren();

    for (const skill of values()) {
      const tag = document.createElement('span');
      const removeButton = document.createElement('button');

      tag.className = 'skill-tag';
      tag.append(skill);
      removeButton.type = 'button';
      removeButton.className = 'skill-tag__remove';
      removeButton.setAttribute('aria-label', `Remove ${skill}`);
      removeButton.textContent = '\u00d7';
      removeButton.addEventListener('click', () => {
        _draft[key] = values().filter((value) => value !== skill);
        renderChips();
        _syncFooter();
      });
      tag.append(removeButton);
      valueEl.append(tag);
    }

    const input = document.createElement('input');
    input.className = 'modal-chip-input';
    input.setAttribute('aria-label', `Add ${label}`);

    function addChip() {
      if (!input.isConnected) {
        return;
      }

      const value = input.value.trim();

      if (value !== '' && !values().includes(value)) {
        _draft[key] = [...values(), value];
        _syncFooter();
      }

      input.value = '';
      renderChips();
    }

    input.addEventListener('blur', addChip);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault();
        addChip();
      } else if (event.key === 'Backspace' && input.value === '') {
        _draft[key] = values().slice(0, -1);
        renderChips();
        _syncFooter();
      }
    });

    valueEl.append(input);
  }

  renderChips();
  row.append(labelEl, valueEl);

  return row;
}

function createCompatField(score) {
  const row = document.createElement('div');
  const labelEl = document.createElement('span');
  const valueEl = document.createElement('div');

  row.className = 'modal-field';
  labelEl.className = 'modal-field__label';
  valueEl.className = 'modal-field__value';
  labelEl.textContent = 'Compatibility';
  valueEl.append(CompatBar.render(score));
  row.append(labelEl, valueEl);

  return row;
}

function renderTitle() {
  const title = document.createElement('h2');
  const required = document.createElement('span');
  title.id = 'modal-title';
  title.textContent = displayValue(_draft.jobTitle);
  required.className = 'modal-field__required modal-title-required';
  required.setAttribute('aria-hidden', 'true');
  required.textContent = '*';

  title.addEventListener('click', () => {
    const previousValue = _draft.jobTitle;
    const input = document.createElement('input');
    let finished = false;

    input.id = 'modal-title';
    input.className = 'modal-title-input';
    input.value = _draft.jobTitle ?? '';
      _titleRow.replaceChildren(input);
    input.focus();
    input.select();

    function finish(commit) {
      if (finished) {
        return;
      }

      finished = true;
      _draft.jobTitle = commit ? input.value.trim() : previousValue;
      renderTitle();
      if (commit) {
        _syncFooter();
      }
    }

    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        finish(false);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        finish(true);
      }
    });
  });

  _titleRow.replaceChildren(title, required);
}

function _renderBody() {
  const statusDateField = createField('Last Updated', toDisplayDate(_draft.lastStatusUpdate));
  statusDateField.dataset.modalField = 'last-status-update';

  _body.replaceChildren(
    makeInlineText({ label: 'Company', key: 'companyName', required: true }),
    makeInlineText({ label: 'Recruiter', key: 'recruiter' }),
    makeInlineText({ label: 'Location', key: 'location' }),
    makeInlineText({ label: 'Salary', key: 'salary' }),
    makeInlineSelect({ label: 'Shift', key: 'shift', options: SHIFT_VALUES }),
    makeInlineSelect({ label: 'Work Setup', key: 'workSetup', options: WORK_SETUP_VALUES }),
    createCompatField(_draft.compat),
    makeInlineText({ label: 'Compat Notes', key: 'compatNotes', multiline: true }),
    statusDateField,
    makeInlineText({ label: 'Responsibilities', key: 'responsibilities', multiline: true, fullSpan: true, required: true }),
    makeChipEditor({ label: 'Required Skills', key: 'skills' }),
    makeChipEditor({ label: 'Preferred Skills', key: 'preferredSkills' }),
    makeInlineText({ label: 'URL', key: 'jobPostingUrl', fullSpan: true }),
    makeInlineText({ label: 'General Notes', key: 'generalNotes', multiline: true, fullSpan: true }),
  );
}

function copyApplication(application) {
  const normalized = normalizeApplication(application);

  return {
    ...normalized,
    skills: [...(normalized.skills ?? [])],
    preferredSkills: [...(normalized.preferredSkills ?? [])],
  };
}

function buildFooter() {
  const footer = document.createElement('div');
  const discardButton = document.createElement('button');
  const saveButton = document.createElement('button');

  footer.className = 'modal-footer';
  discardButton.type = 'button';
  discardButton.dataset.action = 'discard';
  discardButton.className = 'modal-footer__button modal-footer__button--secondary';
  discardButton.textContent = 'Discard';
  saveButton.type = 'button';
  saveButton.dataset.action = 'save';
  saveButton.className = 'modal-footer__button modal-footer__button--primary';

  discardButton.addEventListener('click', _attemptDiscardDraft);
  saveButton.addEventListener('click', saveDraft);
  footer.append(discardButton, saveButton);
  footer.hidden = true;
  _footer = footer;
  _saveButton = saveButton;
  _syncFooter();

  return footer;
}

function validateDraft() {
  clearInlineErrors();
  let isValid = true;

  if (typeof _draft.jobTitle !== 'string' || _draft.jobTitle.trim() === '') {
    showTitleError('Job Title is required.');
    isValid = false;
  }

  if (typeof _draft.companyName !== 'string' || _draft.companyName.trim() === '') {
    showFieldError('Company', 'Company is required.');
    isValid = false;
  }

  if (typeof _draft.responsibilities !== 'string' || _draft.responsibilities.trim() === '') {
    showFieldError('Responsibilities', 'Responsibilities is required.');
    isValid = false;
  }

  if (typeof _draft.jobPostingUrl === 'string' && _draft.jobPostingUrl.trim() !== '') {
    const urlError = validateUrl(_draft.jobPostingUrl);

    if (urlError) {
      showFieldError('URL', urlError);
      isValid = false;
    }
  }

  return isValid;
}

async function saveDraft() {
  if (!_isDirty() || !_draft) {
    return;
  }

  if (!validateDraft()) {
    return;
  }

  if (_mode === 'create') {
    try {
      const newRecord = await api.create(_draft);

      if (!_body || !_titleRow) {
        return newRecord;
      }

      _onApplicationCreate?.(newRecord);
      Toast.show('Application created.', 'success');
      _mode = 'edit';
      _draft = copyApplication(newRecord);
      _original = copyApplication(newRecord);
      _idPill.textContent = newRecord.id;

      if (_archiveButton && !_archiveButton.isConnected) {
        _quickActions?.insertBefore(_archiveButton, _quickActions.querySelector('.modal-quick-action--close'));
      }

      renderTitle();
      _renderBody();
      _syncFooter();
      return newRecord;
    } catch {
      Toast.show('Failed to create application', 'failure');
      _syncFooter();
      return null;
    }
  }

  try {
    const updated = await api.update(_draft.id, _draft);

    if (!_body || !_titleRow) {
      return updated;
    }

    _draft = copyApplication({ ..._draft, ...updated });
    _original = copyApplication(_draft);
    renderTitle();
    _renderBody();
    _syncFooter();
    Toast.show('Saved.', 'success');
    _onApplicationUpdate?.(updated);
    return updated;
  } catch {
    Toast.show('Failed to save', 'failure');
    _syncFooter();
    return null;
  }
}

async function _attemptDiscardDraft() {
  const confirmed = await ConfirmDialog.show('Discard changes?\nYour edits will be lost.', {
    confirmLabel: 'Discard',
    cancelLabel: 'Keep editing',
  });

  if (!confirmed) {
    return;
  }

  if (_mode === 'create') {
    close();
    return;
  }

  if (!_body || !_titleRow || !_original) {
    return;
  }

  _draft = copyApplication(_original);
  clearInlineErrors();
  renderTitle();
  _renderBody();
  _syncFooter();
}

async function _attemptClose() {
  if (!_isDirty()) {
    close();
    return;
  }

  const confirmed = await ConfirmDialog.show('Discard changes?\nYour edits will be lost.', {
    confirmLabel: 'Discard',
    cancelLabel: 'Keep editing',
  });

  if (confirmed) {
    close();
  }
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

  _draft = null;
  _original = null;
  _body = null;
  _titleRow = null;
  _footer = null;
  _saveButton = null;
  _idPill = null;
  _archiveButton = null;
  _quickActions = null;
  _mode = 'edit';
  _onApplicationUpdate = null;
  _onApplicationCreate = null;
}

export function open(application, {
  mode,
  prefill,
  onApplicationUpdate,
  onApplicationCreate,
  onArchiveSuccess,
} = {}) {
  const nextMode = mode === 'create' || application === null ? 'create' : 'edit';

  if (nextMode === 'edit' && !application) {
    return;
  }

  close();
  _mode = nextMode;
  _draft = nextMode === 'create'
    ? { ...normalizeApplication({}), status: 'wishlisted', compat: 0, ...(prefill ?? {}) }
    : copyApplication(application);
  _original = nextMode === 'create' ? null : copyApplication(application);
  _onApplicationUpdate = onApplicationUpdate;
  _onApplicationCreate = onApplicationCreate;

  _savedScrollY = window.scrollY;
  document.body.style.overflow = 'hidden';

  const backdrop = document.createElement('div');
  const panel = document.createElement('div');
  const header = document.createElement('div');
  const headerMeta = document.createElement('div');
  const titleRow = document.createElement('div');
  const idPill = document.createElement('span');
  const quickActions = document.createElement('div');
  const favoriteButton = createQuickButton(
    'modal-quick-action--favorite',
    createSvgIcon('M12 3.5 14.8 9l6.1.9-4.4 4.3 1 6-5.5-2.9-5.5 2.9 1-6L3.1 9l6.1-.9L12 3.5Z'),
  );
  const statusButton = createQuickButton(
    'modal-quick-action--status',
    createSvgIcon('M7 7h11m0 0-3-3m3 3-3 3M17 17H6m0 0 3 3m-3-3 3-3'),
  );
  const archiveButton = createQuickButton(
    'modal-quick-action--archive',
    createArchiveIcon(),
  );
  const closeButton = createQuickButton(
    'modal-quick-action--close',
    createSvgIcon('M6 6l12 12M18 6 6 18'),
  );
  const body = document.createElement('div');
  _body = body;
  _titleRow = titleRow;
  _idPill = idPill;
  _archiveButton = archiveButton;
  _quickActions = quickActions;
  let currentStatus = _draft.status;
  let currentFavorite = _draft.fav === true;
  const statusBadge = createStatusBadge(_draft.status, { id: 'modal-status-badge' });

  function openStatusDropdown(anchorEl) {
    StatusDropdown.open(anchorEl, currentStatus, (newStatus) => {
      currentStatus = newStatus;
      _draft.status = newStatus;
      applyHeaderStatus(header, newStatus);
      updateStatusBadge(statusBadge, newStatus);
      _syncFooter();
    });
  }

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

  idPill.textContent = _mode === 'create' ? '#\u2014' : application.id;
  favoriteButton.setAttribute('aria-label', 'Toggle favorite');
  statusButton.setAttribute('aria-label', 'Change status');
  archiveButton.setAttribute('aria-label', 'Archive application');
  closeButton.setAttribute('aria-label', 'Close');
  favoriteButton.title = 'Star / Unstar';
  statusButton.title = 'Change status';
  archiveButton.title = 'Archive';
  closeButton.title = 'Close';
  statusBadge.setAttribute('role', 'button');
  statusBadge.setAttribute('tabindex', '0');
  statusBadge.setAttribute('aria-label', 'Change status');

  favoriteButton.addEventListener('click', async () => {
    if (_mode === 'create') {
      currentFavorite = !currentFavorite;
      _draft.fav = currentFavorite;
      updateFavoriteButton(favoriteButton, currentFavorite);
      _syncFooter();
      return;
    }

    try {
      const updated = await api.update(_draft.id, { fav: !currentFavorite });
      currentFavorite = updated.fav === true;
      _draft.fav = currentFavorite;
      _original.fav = currentFavorite;
      updateFavoriteButton(favoriteButton, currentFavorite);
      onApplicationUpdate?.(updated);
    } catch {
      Toast.show('Favorite update failed', 'failure');
    }
  });

  statusButton.addEventListener('click', () => {
    openStatusDropdown(statusButton);
  });

  statusBadge.addEventListener('click', () => {
    openStatusDropdown(statusBadge);
  });

  statusBadge.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openStatusDropdown(statusBadge);
    }
  });

  archiveButton.addEventListener('click', async () => {
    if (!await ConfirmDialog.show('Archive this application?')) {
      return;
    }

    try {
      const updated = await api.archive(_draft.id);
      onArchiveSuccess?.(updated);
      close();
    } catch {
      Toast.show('Archive failed', 'failure');
    }
  });

  closeButton.addEventListener('click', _attemptClose);

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      _attemptClose();
    }
  });

  _keydownHandler = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (document.activeElement && document.activeElement !== document.body) {
        document.activeElement.blur();
      }
      saveDraft();
      return;
    }

    if (event.key === 'Escape') {
      if (event.target && typeof event.target.closest === 'function'
        && event.target.closest('input, select, textarea')) {
        return;
      }

      if (document.querySelector('.confirm-backdrop')) {
        return;
      }

      _attemptClose();
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

  headerMeta.append(idPill, statusBadge, quickActions);
  renderTitle();
  quickActions.append(favoriteButton, statusButton);

  if (_mode !== 'create') {
    quickActions.append(archiveButton);
  }

  quickActions.append(closeButton);
  header.append(headerMeta, titleRow);
  _renderBody();
  panel.append(header, body, buildFooter());
  _syncFooter();
  backdrop.append(panel);
  document.body.append(backdrop);
  _backdrop = backdrop;
  getFocusableElements(panel)[0]?.focus();
}

export const Modal = { open, close };
