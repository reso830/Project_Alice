import {
  STATUS_CONFIG,
  STATUS_VALUES,
  allocateTimelineEntryId,
  sortTimelineEntries,
} from '../models/application.js';
import { isValidISODate, toDisplayDate, toISODate } from '../utils/date.js';
import { createStatusBadge } from '../utils/dom.js';

let _host = null;
let _draft = null;
let _expanded = false;
let _onChange = null;
let _currentStatus = null;
let _readOnly = false;
let _addDate = toISODate();
let _addStatus = null;
let _addText = '';
let _pickerBackdrop = null;
let _pickerPanel = null;
let _pickerKeydownHandler = null;
let _editingTextEntryId = null;
let _editingDateEntryId = null;

function expand() {
  _expanded = true;
  resetAddRow();
  refresh();
}

function collapse() {
  _expanded = false;
  closeInlineStatusPicker();
  refresh();
}

function createCollapsedRow() {
  const row = document.createElement('div');
  const chevron = document.createElement('span');
  const latest = sortTimelineEntries(_draft?.timeline ?? [])[0];

  row.className = 'tl-collapsed';
  row.setAttribute('role', 'button');
  row.tabIndex = 0;
  chevron.className = 'tl-chev';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.textContent = '›';
  row.append(chevron);

  if (latest) {
    const date = document.createElement('span');
    const dash = document.createElement('span');

    date.className = 'tl-date-text';
    date.textContent = toDisplayDate(latest.date);
    dash.className = 'tl-dash';
    dash.textContent = '—';
    row.append(date, dash, createStatusBadge(latest.status));

    if (latest.text !== '') {
      const text = document.createElement('span');
      text.className = 'tl-text-line';
      text.textContent = latest.text;
      row.append(text);
    }
  } else {
    const empty = document.createElement('span');
    empty.className = 'tl-empty';
    empty.textContent = _readOnly
      ? 'No timeline entries.'
      : 'No entries yet — click to add';
    row.append(empty);
  }

  row.addEventListener('click', expand);
  row.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      expand();
    }
  });

  return row;
}

function resetAddRow() {
  _addDate = toISODate();
  _addStatus = _currentStatus ?? 'wishlisted';
  _addText = '';
}

function createHeader() {
  const header = document.createElement('div');
  const label = document.createElement('span');
  const collapseButton = document.createElement('button');
  const chevron = document.createElement('span');

  header.className = 'tl-header';
  label.className = 'modal-field__label';
  label.textContent = 'Timeline';
  collapseButton.type = 'button';
  collapseButton.className = 'tl-collapse-btn';
  collapseButton.setAttribute('aria-label', 'Collapse timeline');
  chevron.className = 'tl-chev tl-chev-down';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.textContent = '›';
  collapseButton.append(chevron, ' Collapse');
  collapseButton.addEventListener('click', collapse);
  header.append(label, collapseButton);

  return header;
}

function createNode(status, extraClass = '') {
  const node = document.createElement('span');
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.wishlisted;

  node.className = `tl-node${extraClass ? ` ${extraClass}` : ''}`;
  node.setAttribute('aria-hidden', 'true');
  node.style.borderColor = config.borderAccent;

  return node;
}

function createDash() {
  const dash = document.createElement('span');
  dash.className = 'tl-dash';
  dash.textContent = '—';
  return dash;
}

function createAddStatusBadge() {
  const badge = createStatusBadge(_addStatus);

  badge.setAttribute('role', 'button');
  badge.tabIndex = 0;
  badge.setAttribute('aria-label', 'Timeline entry status');
  badge.addEventListener('click', () => {
    openInlineStatusPicker(badge, _addStatus, (newStatus) => {
      _addStatus = newStatus;
      refresh();
    });
  });
  badge.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      badge.click();
    }
  });

  return badge;
}

function findEntry(entryId) {
  return Array.isArray(_draft?.timeline)
    ? _draft.timeline.find((entry) => entry.id === entryId)
    : null;
}

function commitAddEntry(textInput) {
  if (!_addDate) {
    return;
  }

  if (!_draft) {
    return;
  }

  _draft.timeline = Array.isArray(_draft.timeline) ? _draft.timeline : [];
  _draft.timeline.push({
    id: allocateTimelineEntryId(_draft.timeline),
    date: _addDate,
    status: _addStatus,
    text: textInput.value.trim(),
  });

  resetAddRow();
  _onChange?.();
  refresh();
  _host?.querySelector('.tl-text-input')?.focus();
}

function createAddRow() {
  const row = document.createElement('div');
  const dateInput = document.createElement('input');
  const textInput = document.createElement('input');
  const addButton = document.createElement('button');

  row.className = 'tl-row tl-row--add';
  dateInput.type = 'date';
  dateInput.className = 'tl-date-input';
  dateInput.value = _addDate;
  textInput.className = 'tl-text-input';
  textInput.placeholder = 'What happened? (optional)';
  textInput.value = _addText;
  addButton.type = 'button';
  addButton.className = 'tl-add';
  addButton.textContent = '+ Add';
  addButton.disabled = _addDate === '';

  dateInput.addEventListener('input', () => {
    _addDate = dateInput.value;
    addButton.disabled = _addDate === '';
  });
  textInput.addEventListener('input', () => {
    _addText = textInput.value;
  });
  textInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitAddEntry(textInput);
    }
  });
  addButton.addEventListener('click', () => commitAddEntry(textInput));

  row.append(createNode(_addStatus, 'tl-node-new'), dateInput, createDash(), createAddStatusBadge(), textInput, addButton);

  return row;
}

function createEntryStatusBadge(entry) {
  const badge = createStatusBadge(entry.status);

  if (_readOnly) {
    return badge;
  }

  badge.setAttribute('role', 'button');
  badge.tabIndex = 0;
  badge.setAttribute('aria-label', 'Timeline entry status');
  badge.addEventListener('click', () => {
    openInlineStatusPicker(badge, entry.status, (newStatus) => {
      const target = findEntry(entry.id);

      if (!target) {
        return;
      }

      target.status = newStatus;
      _onChange?.();
      refresh();
    });
  });
  badge.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      badge.click();
    }
  });

  return badge;
}

function createEntryTextDisplay(entry) {
  const text = document.createElement('span');

  text.className = 'tl-text-line';
  text.textContent = entry.text === '' ? '—' : entry.text;

  if (_readOnly) {
    return text;
  }

  text.tabIndex = 0;
  text.addEventListener('click', () => {
    _editingTextEntryId = entry.id;
    refresh();
    _host?.querySelector('.tl-entry-text-input')?.focus();
  });
  text.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      text.click();
    }
  });

  return text;
}

function createEntryTextInput(entry) {
  const input = document.createElement('input');
  let finished = false;

  input.className = 'tl-text-input tl-entry-text-input';
  input.value = entry.text;

  function finish(commit) {
    if (finished) {
      return;
    }

    finished = true;
    _editingTextEntryId = null;

    if (commit) {
      const target = findEntry(entry.id);

      if (target) {
        target.text = input.value;
        _onChange?.();
      }
    }

    refresh();
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

  return input;
}

function createEntryDateDisplay(entry) {
  const date = document.createElement('span');

  date.className = 'tl-date-text';
  date.textContent = toDisplayDate(entry.date);

  if (_readOnly) {
    return date;
  }

  date.tabIndex = 0;
  date.addEventListener('click', () => {
    _editingDateEntryId = entry.id;
    refresh();
    _host?.querySelector('.tl-entry-date-input')?.focus();
  });
  date.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      date.click();
    }
  });

  return date;
}

function createEntryDateInput(entry) {
  const input = document.createElement('input');
  let finished = false;

  input.type = 'date';
  input.className = 'tl-date-input tl-entry-date-input';
  input.value = entry.date;

  function finish(commit) {
    if (finished) {
      return;
    }

    finished = true;
    _editingDateEntryId = null;

    if (commit && input.value !== '' && isValidISODate(input.value)) {
      const target = findEntry(entry.id);

      if (target) {
        target.date = input.value;
        _onChange?.();
      }
    }

    refresh();
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

  return input;
}

function deleteEntry(entryId) {
  if (!_draft || !Array.isArray(_draft.timeline)) {
    return;
  }

  _draft.timeline = _draft.timeline.filter((entry) => entry.id !== entryId);

  if (_editingTextEntryId === entryId) {
    _editingTextEntryId = null;
  }

  if (_editingDateEntryId === entryId) {
    _editingDateEntryId = null;
  }

  closeInlineStatusPicker();
  _onChange?.();
  refresh();
}

function createDeleteButton(entry) {
  const button = document.createElement('button');

  button.className = 'tl-del';
  button.type = 'button';
  button.setAttribute('aria-label', 'Delete entry');
  button.textContent = '\u00d7';
  button.addEventListener('click', () => deleteEntry(entry.id));

  return button;
}

function createEntryRow(entry) {
  const row = document.createElement('div');

  row.className = 'tl-row tl-row--entry';
  row.append(
    createNode(entry.status),
    _editingDateEntryId === entry.id ? createEntryDateInput(entry) : createEntryDateDisplay(entry),
    createDash(),
    createEntryStatusBadge(entry),
    _editingTextEntryId === entry.id ? createEntryTextInput(entry) : createEntryTextDisplay(entry),
  );
  if (!_readOnly) {
    row.append(createDeleteButton(entry));
  }

  return row;
}

function createExpandedContents() {
  const contents = [createHeader()];
  if (!_readOnly) {
    contents.push(createAddRow());
  }

  for (const entry of sortTimelineEntries(_draft?.timeline ?? [])) {
    contents.push(createEntryRow(entry));
  }

  return contents;
}

function renderContents() {
  if (_expanded) {
    return createExpandedContents();
  }

  const label = document.createElement('span');
  label.className = 'modal-field__label';
  label.textContent = 'Timeline';

  return [label, createCollapsedRow()];
}

function positionInlinePicker(anchor, panel) {
  const anchorRect = anchor.getBoundingClientRect();
  const panelWidth = 196;
  const panelHeight = panel.offsetHeight;
  let top = anchorRect.bottom + 6;
  let left = anchorRect.left;

  if (top + panelHeight > window.innerHeight) {
    top = Math.max(6, anchorRect.top - panelHeight - 6);
  }

  if (left + panelWidth > window.innerWidth) {
    left = Math.max(6, anchorRect.right - panelWidth);
  }

  panel.style.top = `${top}px`;
  panel.style.left = `${left}px`;
}

function closeInlineStatusPicker() {
  _pickerBackdrop?.remove();
  _pickerPanel?.remove();
  _pickerBackdrop = null;
  _pickerPanel = null;

  if (_pickerKeydownHandler) {
    document.removeEventListener('keydown', _pickerKeydownHandler, true);
    _pickerKeydownHandler = null;
  }
}

function createStatusOption(value, currentValue, onPick) {
  const config = STATUS_CONFIG[value];
  const option = document.createElement('div');
  const dot = document.createElement('span');
  const label = document.createElement('span');
  const check = document.createElement('span');

  option.className = 'status-option';
  option.dataset.status = value;
  option.tabIndex = 0;
  option.setAttribute('role', 'option');
  option.setAttribute('aria-selected', String(value === currentValue));
  dot.className = 'status-dot';
  dot.style.backgroundColor = config.badgeBg;
  label.textContent = config.label;
  check.className = 'status-option__check';
  check.textContent = value === currentValue ? '✓' : '';

  if (value === currentValue) {
    option.classList.add('status-option--active');
  }

  option.addEventListener('click', () => {
    onPick(value);
    closeInlineStatusPicker();
  });
  option.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onPick(value);
      closeInlineStatusPicker();
    }
  });
  option.append(dot, label, check);

  return option;
}

function openInlineStatusPicker(anchor, currentValue, onPick) {
  closeInlineStatusPicker();

  const backdrop = document.createElement('div');
  const panel = document.createElement('div');

  backdrop.className = 'status-dropdown-backdrop status-dropdown-backdrop--modal';
  panel.className = 'status-dropdown status-dropdown--modal';
  panel.setAttribute('role', 'listbox');
  backdrop.addEventListener('click', closeInlineStatusPicker);

  for (const value of STATUS_VALUES) {
    panel.append(createStatusOption(value, currentValue, onPick));
  }

  document.body.append(backdrop, panel);
  _pickerBackdrop = backdrop;
  _pickerPanel = panel;
  positionInlinePicker(anchor, panel);
  panel.querySelector('.status-option--active')?.focus();

  _pickerKeydownHandler = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeInlineStatusPicker();
    }
  };
  document.addEventListener('keydown', _pickerKeydownHandler, true);
}

export function render(draft, { currentStatus, onChange, readOnly = false } = {}) {
  _draft = draft;
  _currentStatus = currentStatus;
  _onChange = onChange;
  _readOnly = readOnly === true;
  _addStatus = currentStatus || 'wishlisted';

  const wrapper = document.createElement('div');
  wrapper.className = 'modal-field modal-field--full';
  wrapper.replaceChildren(...renderContents());
  _host = wrapper;

  return wrapper;
}

export function refresh(draft = _draft) {
  _draft = draft;

  if (!_host) {
    return;
  }

  _host.replaceChildren(...renderContents());
}

export function appendStatusChangeTimelineEntry(draft, newStatus) {
  if (!Array.isArray(draft.timeline)) {
    draft.timeline = [];
  }

  draft.timeline.push({
    id: allocateTimelineEntryId(draft.timeline),
    date: toISODate(),
    status: newStatus,
    text: '',
  });
}

export function reset() {
  closeInlineStatusPicker();
  _expanded = false;
  _host = null;
  _draft = null;
  _onChange = null;
  _currentStatus = null;
  _readOnly = false;
  _editingTextEntryId = null;
  _editingDateEntryId = null;
  resetAddRow();
}

export const Timeline = {
  appendStatusChangeTimelineEntry,
  render,
  refresh,
  reset,
};
