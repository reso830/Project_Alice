import {
  SHIFT_VALUES,
  STATUS_CONFIG,
  TERMINAL_STATES,
  WORK_SETUP_VALUES,
  normalizeApplication,
} from '../models/application.js';
import { computeCompatibility } from '../models/compatibility.js';
import aiSparkle from '../assets/AI_sparkle.png';
import * as api from '../services/api.js';
import { bindBusyButton } from '../utils/asyncUI.js';
import { formatPeso, parseSalaryInput } from '../utils/currency.js';
import { createStatusBadge, displayValue } from '../utils/dom.js';
import { createArchiveIcon, createClipboardIcon, createSvgIcon } from '../utils/icons.js';
import { resolveSkillLevel } from '../utils/skillProficiency.js';
import { validateUrl } from '../utils/validate.js';
import { valuesDiffer } from '../../shared/compatFields.js';
import { CompatibilityModule } from './CompatibilityModule.js';
import { ConfirmDialog } from './ConfirmDialog.js';
import { StatusDropdown } from './StatusDropdown.js';
import { Timeline, appendStatusChangeTimelineEntry } from './Timeline.js';
import { Toast } from './Toast.js';

let _savedScrollY = 0;
let _backdrop = null;
let _keydownHandler = null;
let _draft = null;
let _original = null;
let _profile = null;
let _compatibilityField = null;
let _body = null;
let _titleRow = null;
let _footer = null;
let _saveButton = null;
let _saveBinding = null;
let _saveStatusPeer = null;
let _saveStatusPeerDisabled = null;
let _savePending = false;
let _busyBindings = [];
let _idPill = null;
let _archiveButton = null;
let _quickActions = null;
let _header = null;
let _statusBadge = null;
let _resetStatusChrome = null;
let _mode = 'edit';
let _saveController = null;
let _onApplicationUpdate = null;
let _onApplicationCreate = null;
let _onUnarchiveSuccess = null;
let _onOpenSettings = null;
let _onOpenProfile = null;
let _aiFields = new Set();
let _fillSource = null;
let _flashFields = new Set();
let _fillNotice = '';

function trackBusyBinding(binding) {
  _busyBindings.push(binding);
  return binding;
}

function disposeBusyBindings() {
  _saveBinding?.dispose();
  for (const binding of _busyBindings) {
    binding.dispose();
  }
  _saveBinding = null;
  _saveStatusPeer = null;
  _saveStatusPeerDisabled = null;
  _savePending = false;
  _busyBindings = [];
}

function canEdit() {
  return _mode !== 'archived';
}

function hasProvenance(field) {
  return _mode === 'create' && (_fillSource === 'ai' || _fillSource === 'basic') && _aiFields.has(field);
}

function createProvenanceTag() {
  const tag = document.createElement('span');
  const isAi = _fillSource === 'ai';
  const label = document.createElement('span');

  tag.className = `modal-field-provenance modal-field-provenance--${_fillSource}`;
  tag.setAttribute('aria-label', isAi ? 'AI-filled field' : 'Auto-filled field');
  label.className = 'modal-field-provenance__label';
  label.textContent = isAi ? 'AI' : 'Auto';

  if (isAi) {
    const icon = document.createElement('img');

    icon.className = 'modal-field-provenance__icon';
    icon.src = aiSparkle;
    icon.alt = '';
    icon.setAttribute('aria-hidden', 'true');
    tag.append(icon, label);
  } else {
    const icon = document.createElement('span');

    icon.className = 'modal-field-provenance__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '\u2699';
    tag.append(icon, label);
  }

  return tag;
}

function appendProvenance(labelEl, field, row = null) {
  if (!hasProvenance(field)) {
    return;
  }

  labelEl.append(createProvenanceTag());
  row?.classList.add('has-modal-provenance');
  if (_flashFields.has(field)) {
    row?.classList.add('modal-provenance-flash');
  }
}

function clearProvenance(field, row = null) {
  if (!field) {
    return;
  }

  _aiFields.delete(field);
  _flashFields.delete(field);
  row?.classList.remove('has-modal-provenance', 'modal-provenance-flash');
  row?.querySelector('.modal-field-provenance')?.remove();
  if (field === 'jobTitle') {
    _titleRow?.querySelector('.modal-title-provenance')?.remove();
    _titleRow?.classList.remove('has-modal-provenance', 'modal-provenance-flash');
  }
}

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
  header.classList.add(getHeaderContrastClass(config.borderAccent));
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

function lockStatusControlsIfTerminal() {
  if (!_draft || !TERMINAL_STATES.has(_draft.status)) {
    return;
  }

  const button = document.querySelector('.modal-quick-action--status');
  const badge = document.querySelector('#modal-status-badge');

  if (button) {
    button.disabled = true;
    button.title = 'Workflow complete';
  }

  if (badge) {
    badge.removeAttribute('role');
    badge.removeAttribute('tabindex');
    badge.setAttribute('aria-disabled', 'true');
    badge.setAttribute('aria-label', 'Status locked — workflow complete');
  }
}

function setStatusBadgeSaveLocked(locked) {
  const badge = document.querySelector('#modal-status-badge');

  if (!badge || TERMINAL_STATES.has(_draft?.status)) {
    return;
  }

  if (locked) {
    badge.setAttribute('aria-disabled', 'true');
  } else {
    badge.removeAttribute('aria-disabled');
  }
}

function _isDirty() {
  if (_mode === 'archived') {
    return false;
  }

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

  CompatibilityModule.setDirty(_isDirty());
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

  row.className = fullSpan ? 'modal-field modal-field--full' : 'modal-field';
  if (canEdit()) {
    row.classList.add('modal-field--editable');
    row.setAttribute('tabindex', '0');
  }
  labelEl.className = 'modal-field__label';
  valueEl.className = 'modal-field__value modal-field__display';
  appendFieldLabel(labelEl, label, required);
  row.append(labelEl, valueEl);

  return { row, labelEl, valueEl };
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
  const value = formatter ? formatter(_draft[key]) : _draft[key];
  valueEl.textContent = displayValue(value);

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

function parseMinYearsInput(value) {
  const trimmed = String(value ?? '').trim();

  if (trimmed === '') {
    return null;
  }

  return /^\d+$/u.test(trimmed) ? Number(trimmed) : trimmed;
}

function recomputeDraftCompatibility() {
  if (!_draft || !_profile) {
    return;
  }

  _draft.compat = computeCompatibility(_profile, _draft).score;
}

function refreshCompatibilityField() {
  recomputeDraftCompatibility();

  if (!_compatibilityField?.isConnected) {
    return;
  }

  const currentField = _compatibilityField;
  const nextField = createCompatibilityField();
  currentField.replaceWith(nextField);
}

function renderMinYearsDisplay(valueEl) {
  if (Number.isInteger(_draft.minYearsExperience)) {
    valueEl.textContent = String(_draft.minYearsExperience);
    return;
  }

  valueEl.textContent = typeof _draft.minYearsExperience === 'string'
    ? _draft.minYearsExperience
    : displayValue(null);
}

function makeMinYearsField() {
  const { row, labelEl, valueEl } = createEditableShell('Min Years');

  appendProvenance(labelEl, 'minYearsExperience', row);

  function commit(input) {
    _draft.minYearsExperience = parseMinYearsInput(input.value);
    clearProvenance('minYearsExperience', row);
    renderMinYearsDisplay(valueEl);
    row.classList.remove('modal-field--editing');
    refreshCompatibilityField();
    _syncFooter();
  }

  if (!canEdit()) {
    renderMinYearsDisplay(valueEl);
    return row;
  }

  row.addEventListener('click', (event) => {
    if (event.target.closest('button') || row.classList.contains('modal-field--editing')) {
      return;
    }

    const previousValue = _draft.minYearsExperience;
    const input = document.createElement('input');
    let finished = false;

    input.className = 'modal-inline-control';
    input.type = 'text';
    input.pattern = '\\d*';
    input.inputMode = 'numeric';
    input.value = Number.isInteger(_draft.minYearsExperience)
      ? String(_draft.minYearsExperience)
      : (typeof _draft.minYearsExperience === 'string' ? _draft.minYearsExperience : '');
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
        _draft.minYearsExperience = previousValue;
        renderMinYearsDisplay(valueEl);
        row.classList.remove('modal-field--editing');
        return;
      }

      if (keyboardEvent.key === 'Enter') {
        keyboardEvent.preventDefault();
        keyboardEvent.stopPropagation();
        finished = true;
        commit(input);
      }
    });
  });

  row.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && !row.classList.contains('modal-field--editing')) {
      event.preventDefault();
      row.click();
    }
  });

  renderMinYearsDisplay(valueEl);

  return row;
}

function makeInlineText({ label, key, multiline = false, fullSpan = false, required = false }) {
  const { row, labelEl, valueEl } = createEditableShell(label, fullSpan, { required });
  const formatter = key === 'salary' ? formatPeso : null;
  const displayClass = multiline ? ' modal-field__display--multiline' : '';

  appendProvenance(labelEl, key, row);

  function commit(input) {
    _draft[key] = key === 'salary'
      ? parseSalaryInput(input.value)
      : input.value.trim();
    clearProvenance(key, row);
    renderTextDisplay(valueEl, key, formatter);
    row.classList.remove('modal-field--editing');
    _syncFooter();
  }

  if (!canEdit()) {
    if (multiline) {
      valueEl.className += displayClass;
    }
    renderTextDisplay(valueEl, key, formatter);
    return row;
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
        keyboardEvent.stopPropagation();
        finished = true;
        commit(input);
      }
    });
  });

  row.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && !row.classList.contains('modal-field--editing')) {
      event.preventDefault();
      row.click();
    }
  });

  if (multiline) {
    valueEl.className += displayClass;
  }

  renderTextDisplay(valueEl, key, formatter);

  return row;
}

function makeInlineSelect({ label, key, options, fullSpan = false }) {
  const { row, labelEl, valueEl } = createEditableShell(label, fullSpan);

  appendProvenance(labelEl, key, row);

  function renderDisplay() {
    valueEl.textContent = displayValue(_draft[key]);
  }

  if (!canEdit()) {
    renderDisplay();
    return row;
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
      clearProvenance(key, row);
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

  row.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && !row.classList.contains('modal-field--editing')) {
      event.preventDefault();
      row.click();
    }
  });

  renderDisplay();

  return row;
}

function makeSkillLegend(profileSkills) {
  if (!Array.isArray(profileSkills)) {
    return null;
  }

  const legend = document.createElement('div');
  legend.className = 'skills-legend modal-field--full';

  for (const [glyph, label, className] of [
    ['✓', 'Proficient', 'lvl-high'],
    ['●', 'Learning', 'lvl-low'],
    ['✕', 'Missing', 'miss'],
  ]) {
    const item = document.createElement('span');
    const icon = document.createElement('span');

    item.className = 'skills-legend__item';
    icon.className = `ck ${className}`;
    icon.textContent = glyph;
    item.append(icon, ` ${label}`);
    legend.append(item);
  }

  return legend;
}

function applyProficiencyToChip(tag, skill, profileSkills) {
  if (!Array.isArray(profileSkills)) {
    tag.append(skill);
    return;
  }

  const level = resolveSkillLevel(skill, profileSkills);
  const glyphByLevel = {
    proficient: '✓',
    learning: '●',
    missing: '✕',
  };
  const classByLevel = {
    proficient: 'lvl-high',
    learning: 'lvl-low',
    missing: 'miss',
  };
  const icon = document.createElement('span');

  tag.classList.add(classByLevel[level]);
  icon.className = 'ck';
  icon.textContent = glyphByLevel[level];
  icon.setAttribute('aria-hidden', 'true');
  tag.append(icon, skill);
}

function makeChipEditor({ label, key, profileSkills = null }) {
  const row = document.createElement('div');
  const labelEl = document.createElement('span');
  const valueEl = document.createElement('div');

  row.className = canEdit()
    ? 'modal-field modal-field--editable'
    : 'modal-field';
  labelEl.className = 'modal-field__label';
  valueEl.className = 'modal-field__value modal-skills modal-chip-editor';
  labelEl.textContent = label;
  appendProvenance(labelEl, key, row);

  function values() {
    return Array.isArray(_draft[key]) ? _draft[key] : [];
  }

  function renderChips() {
    valueEl.replaceChildren();

    for (const skill of values()) {
      const tag = document.createElement('span');
      const removeButton = document.createElement('button');

      tag.className = 'skill-tag';
      applyProficiencyToChip(tag, skill, profileSkills);
      removeButton.type = 'button';
      removeButton.className = 'skill-tag__remove';
      removeButton.setAttribute('aria-label', `Remove ${skill}`);
      removeButton.textContent = '\u00d7';
      removeButton.addEventListener('click', () => {
        _draft[key] = values().filter((value) => value !== skill);
        clearProvenance(key, row);
        renderChips();
        refreshCompatibilityField();
        _syncFooter();
      });
      if (canEdit()) {
        tag.append(removeButton);
      }
      valueEl.append(tag);
    }

    if (!canEdit()) {
      return;
    }

    const input = document.createElement('input');
    let committingByKeyboard = false;
    input.className = 'modal-chip-input';
    input.setAttribute('aria-label', `Add ${label}`);

    function addChip() {
      const value = input.value.trim();

      if (value !== '' && !values().includes(value)) {
        _draft[key] = [...values(), value];
        clearProvenance(key, row);
        refreshCompatibilityField();
        _syncFooter();
      }

      input.value = '';
      renderChips();
    }

    input.addEventListener('blur', () => {
      if (committingByKeyboard) {
        return;
      }

      addChip();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault();
        committingByKeyboard = true;
        addChip();
        committingByKeyboard = false;
      } else if (event.key === 'Backspace' && input.value === '') {
        _draft[key] = values().slice(0, -1);
        clearProvenance(key, row);
        renderChips();
        refreshCompatibilityField();
        _syncFooter();
      }
    });

    valueEl.append(input);
  }

  renderChips();
  row.append(labelEl, valueEl);

  return row;
}

function createCompatibilityField() {
  const row = document.createElement('div');
  const labelEl = document.createElement('span');

  row.className = 'modal-field modal-field--full';
  labelEl.className = 'modal-field__label';
  labelEl.textContent = 'Compatibility';
  row.append(
    labelEl,
    CompatibilityModule.render({
      application: _draft,
      profile: _profile,
      onNotesGenerated: _handleNotesGenerated,
      onOpenSettings: _handleOpenSettings,
      onOpenProfile: _handleOpenProfile,
    }),
  );
  _compatibilityField = row;

  return row;
}

function _handleNotesGenerated(updatedNotes) {
  _draft = {
    ..._draft,
    compatAnalysis: updatedNotes,
  };
  if (_original) {
    _original = {
      ..._original,
      compatAnalysis: updatedNotes,
    };
  }
  _syncFooter();
}

async function _handleOpenSettings() {
  const onOpenSettings = _onOpenSettings;
  const closed = await _attemptClose();

  if (closed) {
    onOpenSettings?.();
  }
}

async function _handleOpenProfile() {
  const onOpenProfile = _onOpenProfile;
  const closed = await _attemptClose();

  if (closed) {
    onOpenProfile?.();
  }
}

function renderTitle() {
  const title = document.createElement('h2');
  const required = document.createElement('span');
  const provenance = hasProvenance('jobTitle') ? createProvenanceTag() : null;
  title.id = 'modal-title';
  title.textContent = displayValue(_draft.jobTitle);
  required.className = 'modal-field__required modal-title-required';
  required.setAttribute('aria-hidden', 'true');
  required.textContent = '*';

  if (!canEdit()) {
    _titleRow.replaceChildren(title);
    return;
  }

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
      if (commit) {
        clearProvenance('jobTitle');
      }
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

  if (provenance) {
    provenance.classList.add('modal-title-provenance');
    _titleRow.classList.add('has-modal-provenance');
    if (_flashFields.has('jobTitle')) {
      _titleRow.classList.add('modal-provenance-flash');
    }
    _titleRow.replaceChildren(title, required, provenance);
  } else {
    _titleRow.classList.remove('has-modal-provenance', 'modal-provenance-flash');
    _titleRow.replaceChildren(title, required);
  }
}

function _renderBody() {
  const profileSkills = _profile?.skills ?? null;
  const skillsLegend = makeSkillLegend(profileSkills);
  const fields = [
    makeInlineText({ label: 'Company', key: 'companyName', required: true }),
    makeInlineText({ label: 'Recruiter', key: 'recruiter' }),
    makeInlineText({ label: 'Location', key: 'location' }),
    makeInlineText({ label: 'Salary', key: 'salary' }),
    makeInlineSelect({ label: 'Shift', key: 'shift', options: SHIFT_VALUES }),
    makeInlineSelect({ label: 'Work Setup', key: 'workSetup', options: WORK_SETUP_VALUES }),
    makeMinYearsField(),
    makeInlineText({ label: 'Responsibilities', key: 'responsibilities', multiline: true, fullSpan: true, required: true }),
    makeChipEditor({ label: 'Required Skills', key: 'skills', profileSkills }),
    makeChipEditor({ label: 'Preferred Skills', key: 'preferredSkills', profileSkills }),
    ...(skillsLegend ? [skillsLegend] : []),
    createCompatibilityField(),
    Timeline.render(_draft, {
      currentStatus: _draft.status,
      onChange: _syncFooter,
      readOnly: _mode === 'archived',
    }),
    makeInlineText({ label: 'URL', key: 'jobPostingUrl', fullSpan: true }),
    makeInlineText({ label: 'General Notes', key: 'generalNotes', multiline: true, fullSpan: true }),
  ];

  if (_mode === 'create' && _fillNotice) {
    const notice = document.createElement('p');

    notice.className = 'modal-fill-notice';
    notice.textContent = _fillNotice;
    notice.setAttribute('role', 'status');
    fields.unshift(notice);
  }

  if (_mode === 'create' && (_fillSource === 'ai' || _fillSource === 'basic') && _aiFields.size > 0) {
    const banner = document.createElement('div');
    const content = document.createElement('div');
    const iconFrame = document.createElement('span');
    const copy = document.createElement('span');
    const title = document.createElement('span');
    const detail = document.createElement('span');
    const dismiss = document.createElement('button');
    const isAi = _fillSource === 'ai';

    banner.className = `modal-fill-banner modal-fill-banner--${_fillSource}`;
    content.className = 'modal-fill-banner__content';
    iconFrame.className = 'modal-fill-banner__icon';
    copy.className = 'modal-fill-banner__copy';
    title.className = 'modal-fill-banner__title';
    detail.className = 'modal-fill-banner__detail';
    title.textContent = isAi ? 'Filled from the job posting' : 'Filled by the basic parser';
    detail.textContent = "Review the details before saving — nothing's saved until you hit Create.";

    if (isAi) {
      const icon = document.createElement('img');

      icon.src = aiSparkle;
      icon.alt = '';
      icon.setAttribute('aria-hidden', 'true');
      iconFrame.append(icon);
    } else {
      iconFrame.textContent = '\u2699';
      iconFrame.setAttribute('aria-hidden', 'true');
    }

    dismiss.type = 'button';
    dismiss.className = 'modal-fill-banner__dismiss';
    dismiss.setAttribute('aria-label', 'Dismiss fill banner');
    dismiss.textContent = '\u00d7';
    dismiss.addEventListener('click', () => banner.remove());
    copy.append(title, detail);
    content.append(iconFrame, copy);
    banner.append(content, dismiss);
    fields.unshift(banner);
  }

  _body.replaceChildren(...fields);
}

function copyApplication(application) {
  const normalized = normalizeApplication(application);

  return {
    ...normalized,
    skills: [...(normalized.skills ?? [])],
    preferredSkills: [...(normalized.preferredSkills ?? [])],
    timeline: (normalized.timeline ?? []).map((entry) => ({ ...entry })),
  };
}

function savePayload(record) {
  const payload = { ...record };

  delete payload.compat;
  delete payload.compatAnalysis;
  delete payload.compatScoredAt;
  return payload;
}

async function runSave() {
  if (!_isDirty() || !_draft) {
    return null;
  }

  if (!validateDraft()) {
    return null;
  }

  if (_saveBinding) {
    _savePending = true;
    setStatusBadgeSaveLocked(true);
    const shouldManageStatusPeer = _saveStatusPeer && _saveStatusPeerDisabled === null;
    if (shouldManageStatusPeer) {
      _saveStatusPeerDisabled = _saveStatusPeer.disabled;
      _saveStatusPeer.disabled = true;
    }

    try {
      const result = await _saveBinding.run();
      _syncFooter();
      if (shouldManageStatusPeer) {
        if (TERMINAL_STATES.has(_draft?.status)) {
          lockStatusControlsIfTerminal();
        } else if (_saveStatusPeer) {
          _saveStatusPeer.disabled = _saveStatusPeerDisabled;
        }
        _saveStatusPeerDisabled = null;
      }
      lockStatusControlsIfTerminal();
      return result;
    } finally {
      _savePending = false;
      setStatusBadgeSaveLocked(false);
    }
  }

  return saveDraft({ skipValidation: true });
}

function buildFooter(savePeers = []) {
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
  _saveStatusPeer = savePeers.find((peer) => peer?.classList?.contains('modal-quick-action--status')) ?? null;
  const bindingPeers = savePeers.filter((peer) => peer !== _saveStatusPeer);
  _saveBinding = bindBusyButton({
    button: saveButton,
    action: () => saveDraft({ skipValidation: true }),
    busyLabel: 'Saving…',
    peers: [discardButton, ...bindingPeers.filter(Boolean)],
    silent: true,
  });
  saveButton.addEventListener('click', () => {
    runSave();
  });
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

  if (
    _draft.minYearsExperience !== null
    && _draft.minYearsExperience !== undefined
    && !Number.isInteger(_draft.minYearsExperience)
  ) {
    showFieldError('Min Years', 'Min Years must be a whole number or blank.');
    isValid = false;
  }

  return isValid;
}

async function saveDraft({ skipValidation = false } = {}) {
  if (!_isDirty() || !_draft) {
    return;
  }

  if (!skipValidation && !validateDraft()) {
    return;
  }

  if (_mode === 'create') {
    try {
      const newRecord = await api.create(savePayload(_draft));

      if (!_body || !_titleRow) {
        return newRecord;
      }

      _onApplicationCreate?.(newRecord);
      Toast.show('Application created.', 'success');
      _mode = 'edit';
      _draft = copyApplication(newRecord);
      _original = copyApplication(newRecord);
      _idPill.textContent = newRecord.id;

      if (TERMINAL_STATES.has(_draft.status)) {
        lockStatusControlsIfTerminal();
      } else {
        setStatusBadgeSaveLocked(false);
      }

      if (TERMINAL_STATES.has(_draft.status)) {
        const btn = document.querySelector('.modal-quick-action--status');
        const badge = document.querySelector('#modal-status-badge');

        if (btn) {
          btn.disabled = true;
          btn.title = 'Workflow complete';
        }

        if (badge) {
          badge.removeAttribute('role');
          badge.removeAttribute('tabindex');
          badge.setAttribute('aria-disabled', 'true');
          badge.setAttribute('aria-label', 'Status locked — workflow complete');
        }
      }

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
    _saveController = new globalThis.AbortController();
    const updated = await api.update(_draft.id, savePayload(_draft), { signal: _saveController.signal });
    _saveController = null;

    if (!_body || !_titleRow) {
      return updated;
    }

    _draft = copyApplication({ ..._draft, ...updated });
    _original = copyApplication(_draft);

    if (TERMINAL_STATES.has(_draft.status)) {
      lockStatusControlsIfTerminal();
    } else {
      setStatusBadgeSaveLocked(false);
    }

    if (TERMINAL_STATES.has(_draft.status)) {
      const btn = document.querySelector('.modal-quick-action--status');
      const badge = document.querySelector('#modal-status-badge');

      if (btn) {
        btn.disabled = true;
        btn.title = 'Workflow complete';
      }

      if (badge) {
        badge.removeAttribute('role');
        badge.removeAttribute('tabindex');
        badge.setAttribute('aria-disabled', 'true');
        badge.setAttribute('aria-label', 'Status locked — workflow complete');
      }
    }

    renderTitle();
    _renderBody();
    _syncFooter();
    Toast.show('Saved.', 'success');
    _onApplicationUpdate?.(updated);
    return updated;
  } catch (error) {
    _saveController = null;
    if (error?.name === 'AbortError') {
      return null;
    }
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
  _resetStatusChrome?.();
  renderTitle();
  _renderBody();
  _syncFooter();
}

async function _attemptClose() {
  if (_saveController) {
    close();
    return true;
  }

  if (!_isDirty()) {
    close();
    return true;
  }

  const confirmed = await ConfirmDialog.show('Discard changes?\nYour edits will be lost.', {
    confirmLabel: 'Discard',
    cancelLabel: 'Keep editing',
  });

  if (confirmed) {
    close();
    return true;
  }

  return false;
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

  CompatibilityModule.setDirty(false);

  // During an in-flight save, close paths abort the save rather than blocking the user.
  // See specs/029-loading-async-states/research.md § 3.4.
  disposeBusyBindings();
  _saveController?.abort();
  _saveController = null;
  _draft = null;
  _original = null;
  _body = null;
  _titleRow = null;
  _profile = null;
  _compatibilityField = null;
  _footer = null;
  _saveButton = null;
  _saveBinding = null;
  _saveStatusPeer = null;
  _saveStatusPeerDisabled = null;
  _savePending = false;
  _busyBindings = [];
  _idPill = null;
  _archiveButton = null;
  _quickActions = null;
  _header = null;
  _statusBadge = null;
  _resetStatusChrome = null;
  _mode = 'edit';
  _onApplicationUpdate = null;
  _onApplicationCreate = null;
  _onUnarchiveSuccess = null;
  _onOpenSettings = null;
  _onOpenProfile = null;
  _aiFields = new Set();
  _fillSource = null;
  _flashFields = new Set();
  _fillNotice = '';
  Timeline.reset();
}

export function open(application, {
  mode,
  profile,
  prefill,
  aiFields,
  fillSource,
  notice,
  onApplicationUpdate,
  onApplicationCreate,
  onArchiveSuccess,
  onUnarchiveSuccess,
  onOpenSettings,
  onOpenProfile,
} = {}) {
  const nextMode = mode === 'create' || application === null
    ? 'create'
    : (application.archived === true ? 'archived' : 'edit');

  if (nextMode === 'edit' && !application) {
    return;
  }

  close();
  _mode = nextMode;
  _fillSource = nextMode === 'create' && (fillSource === 'ai' || fillSource === 'basic')
    ? fillSource
    : null;
  _aiFields = _fillSource && aiFields instanceof Set
    ? new Set(aiFields)
    : new Set();
  _flashFields = new Set(_aiFields);
  _fillNotice = nextMode === 'create' && typeof notice === 'string'
    ? notice.trim()
    : '';
  _draft = nextMode === 'create'
    ? { ...normalizeApplication({}), status: 'wishlisted', compat: 0, ...(prefill ?? {}) }
    : copyApplication(application);
  _original = nextMode === 'create' ? null : copyApplication(application);
  _profile = profile ?? null;
  _onApplicationUpdate = onApplicationUpdate;
  _onApplicationCreate = onApplicationCreate;
  _onUnarchiveSuccess = onUnarchiveSuccess;
  _onOpenSettings = typeof onOpenSettings === 'function' ? onOpenSettings : null;
  _onOpenProfile = typeof onOpenProfile === 'function' ? onOpenProfile : null;

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
  const unarchiveButton = createQuickButton(
    'modal-quick-action--unarchive',
    createSvgIcon('M3 12a9 9 0 0 0 15 6.7M3 12H1m2 0 3 3m-3-3 3-3M21 12A9 9 0 0 0 6 5.3'),
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
  const isTerminal = TERMINAL_STATES.has(currentStatus);
  let currentFavorite = _draft.fav === true;
  const statusBadge = createStatusBadge(_draft.status, { id: 'modal-status-badge' });
  _header = header;
  _statusBadge = statusBadge;
  _resetStatusChrome = () => {
    currentStatus = _draft.status;
    applyHeaderStatus(_header, _draft.status);
    updateStatusBadge(_statusBadge, _draft.status);
  };

  function openStatusDropdown(anchorEl) {
    if (_savePending) return;
    if (_mode === 'edit' && TERMINAL_STATES.has(_draft.status)) return;

    const openDropdown = _mode === 'create' ? StatusDropdown.openAll : StatusDropdown.open;

    openDropdown(anchorEl, currentStatus, (newStatus) => {
      currentStatus = newStatus;
      _draft.status = newStatus;
      appendStatusChangeTimelineEntry(_draft, newStatus);
      applyHeaderStatus(header, newStatus);
      updateStatusBadge(statusBadge, newStatus);
      Timeline.refresh();
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
  unarchiveButton.setAttribute('aria-label', 'Unarchive application');
  closeButton.setAttribute('aria-label', 'Close');
  favoriteButton.title = 'Star / Unstar';
  statusButton.title = 'Change status';
  archiveButton.title = 'Archive';
  unarchiveButton.title = 'Unarchive';
  closeButton.title = 'Close';
  if (canEdit()) {
    statusBadge.setAttribute('role', 'button');
    statusBadge.setAttribute('tabindex', '0');
    statusBadge.setAttribute('aria-label', 'Change status');
  }

  if (isTerminal && canEdit()) {
    statusButton.disabled = true;
    statusButton.title = 'Workflow complete';
    statusBadge.removeAttribute('role');
    statusBadge.removeAttribute('tabindex');
    statusBadge.setAttribute('aria-disabled', 'true');
    statusBadge.setAttribute('aria-label', 'Status locked — workflow complete');
  }

  const favoriteBinding = trackBusyBinding(bindBusyButton({
    button: favoriteButton,
    action: async () => {
      try {
        const updated = await api.update(_draft.id, { fav: !currentFavorite });
        currentFavorite = updated.fav === true;
        _draft.fav = currentFavorite;
        _original.fav = currentFavorite;
        updateFavoriteButton(favoriteButton, currentFavorite);
        onApplicationUpdate?.(updated);
        return updated;
      } catch {
        Toast.show('Favorite update failed', 'failure');
        return null;
      }
    },
    silent: true,
  }));
  const archiveBinding = trackBusyBinding(bindBusyButton({
    button: archiveButton,
    action: async () => {
      try {
        const updated = await api.archive(_draft.id);
        onArchiveSuccess?.(updated);
        close();
        return updated;
      } catch {
        Toast.show('Archive failed', 'failure');
        return null;
      }
    },
    silent: true,
  }));
  const unarchiveBinding = trackBusyBinding(bindBusyButton({
    button: unarchiveButton,
    action: async () => {
      try {
        const updated = await api.unarchive(_draft.id);
        _onUnarchiveSuccess?.(updated);
        close();
        return updated;
      } catch {
        Toast.show('Unarchive failed', 'failure');
        return null;
      }
    },
    silent: true,
  }));

  favoriteButton.addEventListener('click', () => {
    if (_mode === 'create') {
      currentFavorite = !currentFavorite;
      _draft.fav = currentFavorite;
      updateFavoriteButton(favoriteButton, currentFavorite);
      _syncFooter();
      return;
    }

    favoriteBinding.run();
  });

  if (!isTerminal && canEdit()) {
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
  }

  archiveButton.addEventListener('click', async () => {
    if (!await ConfirmDialog.show('Archive this application?')) {
      return;
    }

    archiveBinding.run();
  });

  unarchiveButton.addEventListener('click', () => {
    unarchiveBinding.run();
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
      if (_mode === 'archived') {
        return;
      }
      if (document.activeElement && document.activeElement !== document.body) {
        document.activeElement.blur();
      }
      runSave();
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

  headerMeta.append(idPill, statusBadge);
  if (_mode === 'archived') {
    const archivedStamp = document.createElement('span');
    archivedStamp.className = 'archived-stamp';
    archivedStamp.textContent = 'Archived';
    headerMeta.append(archivedStamp);
  }
  headerMeta.append(quickActions);
  renderTitle();
  if (_mode === 'archived') {
    quickActions.append(unarchiveButton);
  } else {
    quickActions.append(favoriteButton, statusButton);
    if (_mode !== 'create') {
      quickActions.append(archiveButton);
    }
  }

  quickActions.append(closeButton);
  header.append(headerMeta, titleRow);
  _renderBody();
  panel.append(header, body);
  if (_mode !== 'archived') {
    panel.append(buildFooter([favoriteButton, archiveButton, statusButton]));
  }
  _syncFooter();
  backdrop.append(panel);
  document.body.append(backdrop);
  _backdrop = backdrop;
  getFocusableElements(panel)[0]?.focus();
}

export const Modal = { open, close };
