import { STATUS_CONFIG, STATUS_VALUES, getValidTransitions } from '../models/application.js';

let _backdrop = null;
let _panel = null;
let _keydownHandler = null;

export function close() {
  if (_backdrop) {
    _backdrop.remove();
    _backdrop = null;
  }

  if (_panel) {
    _panel.remove();
    _panel = null;
  }

  if (_keydownHandler) {
    document.removeEventListener('keydown', _keydownHandler);
    _keydownHandler = null;
  }
}

function positionPanel(anchorEl, panel) {
  const anchorRect = anchorEl.getBoundingClientRect();
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

function createOption(value, currentStatus, onChange) {
  const config = STATUS_CONFIG[value];
  const option = document.createElement('div');
  const dot = document.createElement('span');
  const label = document.createElement('span');
  const check = document.createElement('span');

  option.className = 'status-option';
  option.dataset.status = value;
  option.tabIndex = 0;
  option.setAttribute('role', 'option');
  option.setAttribute('aria-selected', String(value === currentStatus));
  dot.className = 'status-dot';
  label.textContent = config.label;
  check.className = 'status-option__check';
  check.textContent = value === currentStatus ? '✓' : '';
  dot.style.backgroundColor = config.badgeBg;

  if (value === currentStatus) {
    option.classList.add('status-option--active');
  }

  option.addEventListener('click', () => {
    onChange(value);
    close();
  });

  option.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onChange(value);
      close();
    }
  });

  option.append(dot, label, check);

  return option;
}

function openWithOptions(anchorEl, currentStatus, onChange, values) {
  close();

  const backdrop = document.createElement('div');
  const panel = document.createElement('div');

  backdrop.className = 'status-dropdown-backdrop';
  panel.className = 'status-dropdown';
  panel.setAttribute('role', 'listbox');

  if (anchorEl.closest('.modal-panel')) {
    backdrop.classList.add('status-dropdown-backdrop--modal');
    panel.classList.add('status-dropdown--modal');
  }

  backdrop.addEventListener('click', close);

  for (const value of values) {
    panel.append(createOption(value, currentStatus, onChange));
  }

  document.body.append(backdrop, panel);
  _backdrop = backdrop;
  _panel = panel;
  positionPanel(anchorEl, panel);
  const focusTarget = panel.querySelector('.status-option--active')
    ?? panel.querySelector('.status-option');
  focusTarget?.focus();

  _keydownHandler = (event) => {
    if (event.key === 'Escape') {
      close();
    }
  };
  document.addEventListener('keydown', _keydownHandler);
}

export function open(anchorEl, currentStatus, onChange) {
  openWithOptions(anchorEl, currentStatus, onChange, getValidTransitions(currentStatus));
}

export function openAll(anchorEl, currentStatus, onChange) {
  openWithOptions(anchorEl, currentStatus, onChange, STATUS_VALUES);
}

export const StatusDropdown = { open, openAll, close };
