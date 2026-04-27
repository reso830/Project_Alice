import { STATUS_CONFIG } from '../models/application.js';
import {
  getAvailableCompanies,
  getAvailableStatuses,
  isAnyFilterActive,
} from '../utils/filterSort.js';
import { FilterPanel } from './FilterPanel.js';

let _allApps = [];
let _toolbarEl = null;
let _labelEl = null;
let _countEl = null;
let _statusButton = null;
let _companyButton = null;
let _openPanel = null;
let _openButton = null;
let _openPanelType = null;
let _filterState = null;
let _sortState = null;
let _salaryBounds = null;
let _callbacks = {};

function createSvgIcon(pathData) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '15');
  svg.setAttribute('height', '15');
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

function setButtonDisabled(button, disabled) {
  if (!button) {
    return;
  }

  button.disabled = disabled;
  button.setAttribute('aria-disabled', String(disabled));
}

function setPressed(button, pressed) {
  button?.setAttribute('aria-pressed', String(pressed));
}

function getActiveFilterCount(filterState) {
  return (filterState.statuses?.length ?? 0)
    + (filterState.companies?.length ?? 0)
    + (filterState.salaryMin === null && filterState.salaryMax === null ? 0 : 1)
    + (filterState.compatMin === null && filterState.compatMax === null ? 0 : 1);
}

function updateLabel(totalCount, filteredCount, filterState) {
  const active = isAnyFilterActive(filterState);

  if (_labelEl) {
    _labelEl.textContent = active ? 'Results' : 'All Applications';
  }

  if (_countEl) {
    _countEl.textContent = String(active ? filteredCount : totalCount);
  }
}

function handleDocumentKeydown(event) {
  if (event.key === 'Escape') {
    closePanel({ restoreFocus: true });
  }
}

function handleDocumentClick(event) {
  if (
    _openPanel
    && !_openPanel.contains(event.target)
    && !_openButton?.contains(event.target)
  ) {
    closePanel();
  }
}

function attachPanelListeners() {
  document.addEventListener('keydown', handleDocumentKeydown);
  document.addEventListener('click', handleDocumentClick);
}

function detachPanelListeners() {
  document.removeEventListener('keydown', handleDocumentKeydown);
  document.removeEventListener('click', handleDocumentClick);
}

function closePanel({ restoreFocus = false } = {}) {
  const button = _openButton;

  _openPanel?.remove();
  _openPanel = null;
  _openButton = null;
  _openPanelType = null;
  detachPanelListeners();
  _statusButton?.classList.remove('filter-btn--open');
  _companyButton?.classList.remove('filter-btn--open');

  if (restoreFocus) {
    button?.focus();
  }
}

function replaceOpenPanel(panel) {
  _openPanel?.remove();
  _openPanel = panel;
  _openButton?.parentElement?.append(panel);
}

function openPanel(type, button, panel) {
  if (button.disabled) {
    return;
  }

  if (_openButton === button) {
    closePanel();
    return;
  }

  closePanel();
  _openPanelType = type;
  _openButton = button;
  _openPanel = panel;
  button.classList.add('filter-btn--open');
  button.parentElement.append(panel);
  attachPanelListeners();
}

function renderStatusPanel() {
  return FilterPanel.render({
    title: 'Status',
    options: getAvailableStatuses(_allApps, _filterState),
    selected: _filterState.statuses,
    getLabel: (status) => STATUS_CONFIG[status]?.label ?? status,
    getDot: (status) => STATUS_CONFIG[status]?.badgeBg,
    onChange: (statuses) => {
      _callbacks.onFilterChange?.({ ..._filterState, statuses });
    },
    onClear: () => {
      _callbacks.onFilterChange?.({ ..._filterState, statuses: [] });
      closePanel();
    },
  });
}

function renderCompanyPanel() {
  return FilterPanel.render({
    title: 'Company',
    options: getAvailableCompanies(_allApps, _filterState),
    selected: _filterState.companies,
    onChange: (companies) => {
      _callbacks.onFilterChange?.({ ..._filterState, companies });
    },
    onClear: () => {
      _callbacks.onFilterChange?.({ ..._filterState, companies: [] });
      closePanel();
    },
  });
}

function createFilterButton({ className, label, title, icon, onClick }) {
  const trigger = document.createElement('span');
  const button = document.createElement('button');

  trigger.className = 'filter-trigger';
  button.className = `filter-btn ${className}`;
  button.type = 'button';
  button.title = title;
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-disabled', 'false');
  button.append(icon);
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick(button);
  });

  trigger.append(button);

  return { trigger, button };
}

function updateButtons(totalCount, filterState) {
  const disabled = totalCount === 0;

  setButtonDisabled(_statusButton, disabled);
  setButtonDisabled(_companyButton, disabled);
  setPressed(_statusButton, (filterState.statuses?.length ?? 0) > 0);
  setPressed(_companyButton, (filterState.companies?.length ?? 0) > 0);

  if (disabled) {
    closePanel();
  }
}

function refreshOpenPanel() {
  if (_openPanelType === 'status') {
    replaceOpenPanel(renderStatusPanel());
  } else if (_openPanelType === 'company') {
    replaceOpenPanel(renderCompanyPanel());
  }
}

export function render(options = {}) {
  closePanel();

  _allApps = options.apps ?? [];
  _filterState = options.filterState;
  _sortState = options.sortState;
  _salaryBounds = options.salaryBounds;
  _callbacks = {
    onFilterChange: options.onFilterChange,
    onSortChange: options.onSortChange,
    onClearAll: options.onClearAll,
    onAddApplication: options.onAddApplication,
  };

  const toolbar = document.createElement('div');
  const label = document.createElement('span');
  const count = document.createElement('span');
  const filters = document.createElement('div');
  const actions = document.createElement('div');
  const status = createFilterButton({
    className: 'filter-btn--status',
    label: 'Filter by Status',
    title: 'Status',
    icon: createSvgIcon('M12 8v5l3 2m5-3a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z'),
    onClick: (button) => openPanel('status', button, renderStatusPanel()),
  });
  const company = createFilterButton({
    className: 'filter-btn--company',
    label: 'Filter by Company',
    title: 'Company',
    icon: createSvgIcon('M3 21h18M5 21V5a2 2 0 0 1 2-2h7v18M14 8h5a2 2 0 0 1 2 2v11M9 7h1M9 11h1M9 15h1'),
    onClick: (button) => openPanel('company', button, renderCompanyPanel()),
  });

  toolbar.className = 'toolbar';
  label.className = 'toolbar__label';
  count.className = 'count-badge';
  count.setAttribute('aria-live', 'polite');
  filters.className = 'toolbar__filters';
  actions.className = 'toolbar__actions';

  filters.append(status.trigger, company.trigger);
  toolbar.append(label, count, filters, actions);

  _toolbarEl = toolbar;
  _labelEl = label;
  _countEl = count;
  _statusButton = status.button;
  _companyButton = company.button;

  update(toolbar, {
    apps: _allApps,
    totalCount: options.totalCount ?? _allApps.length,
    filteredCount: options.filteredCount ?? _allApps.length,
    filterState: _filterState,
    sortState: _sortState,
  });

  return toolbar;
}

export function update(el, options = {}) {
  if (!el || el !== _toolbarEl) {
    return;
  }

  _allApps = options.apps ?? _allApps;
  _filterState = options.filterState ?? _filterState;
  _sortState = options.sortState ?? _sortState;

  const totalCount = options.totalCount ?? _allApps.length;
  const filteredCount = options.filteredCount ?? totalCount;

  updateLabel(totalCount, filteredCount, _filterState);
  updateButtons(totalCount, _filterState);
  refreshOpenPanel();

  el.dataset.activeFilterCount = String(getActiveFilterCount(_filterState));
  el.dataset.sortField = _sortState?.field ?? '';
  el.dataset.salaryHasData = String(_salaryBounds?.hasSalaryData ?? false);
}

export const QuickFiltersToolbar = { render, update };
