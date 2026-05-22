import {
  STATUS_CONFIG,
  STATUS_DISPLAY_PRIORITY,
} from '../../models/application.js';
import { mountAnchoredDropdown } from './anchoredDropdown.js';

let _mounted = null;

function createCheck(active) {
  const check = document.createElement('span');
  check.className = 'filter-dd-check';
  check.setAttribute('aria-hidden', 'true');
  check.textContent = active ? '✓' : '';
  return check;
}

function createNoneGlyph() {
  const glyph = document.createElement('span');
  glyph.className = 'none-glyph';
  glyph.setAttribute('aria-hidden', 'true');
  return glyph;
}

function createSwatch(status) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.wishlisted;
  const swatch = document.createElement('span');
  swatch.className = 'filter-dd-swatch';
  swatch.setAttribute('aria-hidden', 'true');
  swatch.style.backgroundColor = config.badgeBg;

  if (status === 'ghosted') {
    swatch.style.border = '1px solid var(--border)';
  }

  return swatch;
}

function createRow({ status, label, active, onSelect, onClose }) {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'filter-dd-row';
  row.dataset.status = status ?? 'all';

  const text = document.createElement('span');
  text.className = 'filter-dd-label';
  text.textContent = label;

  row.append(
    createCheck(active),
    status === null ? createNoneGlyph() : createSwatch(status),
    text,
  );

  row.addEventListener('click', () => {
    onSelect?.(status);
    onClose?.();
  });

  return row;
}

function createDropdown(props) {
  const dropdown = document.createElement('div');
  dropdown.className = 'filter-dd';

  dropdown.append(createRow({
    status: null,
    label: 'All statuses',
    active: props.filter === null,
    onSelect: props.onSelect,
    onClose: props.onClose,
  }));

  STATUS_DISPLAY_PRIORITY.forEach((status) => {
    const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.wishlisted;
    dropdown.append(createRow({
      status,
      label: config.label,
      active: props.filter === status,
      onSelect: props.onSelect,
      onClose: props.onClose,
    }));
  });

  return dropdown;
}

function open(props) {
  close();

  _mounted = mountAnchoredDropdown({
    anchorEl: props.anchor,
    contentEl: createDropdown(props),
    align: 'end',
    asBottomSheet: true,
    scrim: false,
    ariaLabel: 'Status filter',
    onClose: props.onClose,
  });
}

function close() {
  _mounted?.unmount();
  _mounted = null;
}

export const StatusFilterDropdown = { open, close };
