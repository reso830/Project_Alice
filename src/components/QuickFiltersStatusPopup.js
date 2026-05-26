import { STATUS_CONFIG, STATUS_DISPLAY_PRIORITY } from '../models/application.js';
import { FilterPanel } from './FilterPanel.js';

const VIEWPORT_MARGIN = 8;
const PANEL_GAP = 8;

function getLabel(status) {
  return STATUS_CONFIG[status]?.label ?? status;
}

function getDot(status) {
  return STATUS_CONFIG[status]?.borderAccent ?? null;
}

function statusOptions(options) {
  return Array.isArray(options) && options.length > 0 ? options : STATUS_DISPLAY_PRIORITY;
}

function positionPanel(anchor, panel) {
  const rect = anchor.getBoundingClientRect();
  const panelWidth = panel.offsetWidth || 220;
  const panelHeight = panel.offsetHeight || 0;
  let left = rect.left;
  let top = rect.bottom + PANEL_GAP;

  if (left + panelWidth > window.innerWidth - VIEWPORT_MARGIN) {
    left = Math.max(VIEWPORT_MARGIN, rect.right - panelWidth);
  }

  if (top + panelHeight > window.innerHeight - VIEWPORT_MARGIN) {
    top = Math.max(VIEWPORT_MARGIN, rect.top - panelHeight - PANEL_GAP);
  }

  panel.style.top = `${top}px`;
  panel.style.left = `${left}px`;
}

export function renderStatusFilterPanel({
  options = STATUS_DISPLAY_PRIORITY,
  selected = [],
  onChange,
  onClear,
} = {}) {
  const panel = FilterPanel.render({
    title: 'Status',
    options: statusOptions(options),
    selected,
    getLabel,
    getDot,
    onChange,
    onClear,
  });

  panel.dataset.surface = 'quick-status-filter';
  return panel;
}

export function mountStatusFilterPopup({
  anchor,
  value = null,
  options = STATUS_DISPLAY_PRIORITY,
  onSelect,
  onClose,
} = {}) {
  let active = true;
  const selected = value ? [value] : [];
  const panel = renderStatusFilterPanel({
    options,
    selected,
    onChange: (statuses) => {
      onSelect?.(statuses.at(-1) ?? null);
      close();
    },
    onClear: () => {
      onSelect?.(null);
      close();
    },
  });

  function detachListeners() {
    document.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('mousedown', handleDocumentPointer);
    window.removeEventListener('scroll', handleScroll, true);
    window.removeEventListener('resize', handleResize);
  }

  function close() {
    if (!active) {
      return;
    }

    active = false;
    detachListeners();
    panel.remove();
    onClose?.();
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      close();
    }
  }

  function handleDocumentPointer(event) {
    if (
      !panel.contains(event.target)
      && !anchor?.contains(event.target)
      && document.contains(event.target)
    ) {
      close();
    }
  }

  function handleResize() {
    if (anchor?.isConnected) {
      positionPanel(anchor, panel);
    }
  }

  function handleScroll() {
    handleResize();
  }

  document.body.append(panel);
  if (anchor) {
    positionPanel(anchor, panel);
  }

  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('mousedown', handleDocumentPointer);
  window.addEventListener('scroll', handleScroll, true);
  window.addEventListener('resize', handleResize);

  return { close };
}

export const QuickFiltersStatusPopup = {
  mount: mountStatusFilterPopup,
  renderPanel: renderStatusFilterPanel,
};
