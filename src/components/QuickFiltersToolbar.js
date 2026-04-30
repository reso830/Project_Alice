import { STATUS_CONFIG } from '../models/application.js';
import {
  DEFAULT_SORT_STATE,
  SALARY_STEP,
  getAvailableCompanies,
  getAvailableStatuses,
  isDefaultSort,
  isAnyFilterActive,
} from '../utils/filterSort.js';
import { formatPeso } from '../utils/currency.js';
import { FilterPanel } from './FilterPanel.js';
import { RangeSlider } from './RangeSlider.js';
import { SortPanel } from './SortPanel.js';

let _allApps = [];
let _toolbarEl = null;
let _labelEl = null;
let _countEl = null;
let _actionsEl = null;
let _statusButton = null;
let _salaryButton = null;
let _compatButton = null;
let _companyButton = null;
let _favoritesButton = null;
let _sortButton = null;
let _sortTrigger = null;
let _eraseBtn = null;
let _openPanel = null;
let _openButton = null;
let _openPanelType = null;
let _filterState = null;
let _sortState = null;
let _salaryBounds = null;
let _callbacks = {};

const SALARY_FILTER_MIN = 50000;
const SALARY_FILTER_MAX = 250000;

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
    + (filterState.compatMin === null && filterState.compatMax === null ? 0 : 1)
    + (filterState.favoritesOnly === true ? 1 : 0);
}

function updateLabel(totalCount, filteredCount, filterState) {
  const active = isAnyFilterActive(filterState);

  if (_labelEl) {
    _labelEl.textContent = active ? 'Results' : 'All Applications';
    _labelEl.append(' ', _countEl);
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
    && document.contains(event.target)
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
  _openButton?.classList.remove('filter-btn--open');
  _openPanel = null;
  _openButton = null;
  _openPanelType = null;
  detachPanelListeners();

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
    getDot: (status) => {
      const config = STATUS_CONFIG[status];
      return config ? { backgroundColor: config.badgeBg, borderColor: config.borderAccent } : null;
    },
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

function createRangePanel(slider) {
  const panel = document.createElement('div');

  panel.className = 'filter-panel range-panel';
  panel.append(slider);

  return panel;
}

function formatSalary(value) {
  const formatted = formatPeso(value);
  return value >= SALARY_FILTER_MAX ? `${formatted}+` : formatted;
}

function renderSalaryPanel() {
  return createRangePanel(RangeSlider.render({
    min: SALARY_FILTER_MIN,
    max: SALARY_FILTER_MAX,
    valueMin: _filterState.salaryMin ?? SALARY_FILTER_MIN,
    valueMax: _filterState.salaryMax ?? SALARY_FILTER_MAX,
    step: SALARY_STEP,
    formatValue: formatSalary,
    ariaLabelMin: 'Minimum salary',
    ariaLabelMax: 'Maximum salary',
    onCommit: (min, max) => {
      _callbacks.onFilterChange?.({
        ..._filterState,
        salaryMin: min === SALARY_FILTER_MIN ? null : min,
        salaryMax: max === SALARY_FILTER_MAX ? null : max,
      });
    },
  }));
}

function renderCompatPanel() {
  return createRangePanel(RangeSlider.render({
    min: 0,
    max: 100,
    valueMin: _filterState.compatMin ?? 0,
    valueMax: _filterState.compatMax ?? 100,
    step: 1,
    formatValue: (value) => `${Math.round(value)}%`,
    ariaLabelMin: 'Minimum compatibility',
    ariaLabelMax: 'Maximum compatibility',
    onCommit: (min, max) => {
      _callbacks.onFilterChange?.({
        ..._filterState,
        compatMin: min === 0 ? null : min,
        compatMax: max === 100 ? null : max,
      });
    },
  }));
}

function renderSortPanel() {
  return SortPanel.render({
    sortState: _sortState,
    onChange: (sortState) => {
      _callbacks.onSortChange?.(sortState);
    },
    onRestoreDefault: () => {
      _callbacks.onSortChange?.({ ...DEFAULT_SORT_STATE });
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

function createEraseButton() {
  const button = document.createElement('button');

  button.className = 'filter-btn erase-btn';
  button.type = 'button';
  button.title = 'Clear all filters';
  button.setAttribute('aria-label', 'Clear all filters');
  button.setAttribute('aria-disabled', 'false');
  button.append(createSvgIcon('M5 5l14 14M19 5 5 19'));
  button.addEventListener('click', () => {
    _callbacks.onClearAll?.();
  });

  return button;
}

function createAddButton() {
  const button = document.createElement('button');

  button.className = 'toolbar__add';
  button.type = 'button';
  button.textContent = '+ New application';
  button.addEventListener('click', () => {
    _callbacks.onAddApplication?.();
  });

  return button;
}

function updateEraseButton(activeFilters) {
  if (!_actionsEl || !_eraseBtn || !_sortTrigger) {
    return;
  }

  if (activeFilters && !_eraseBtn.isConnected) {
    _actionsEl.insertBefore(_eraseBtn, _sortTrigger);
  } else if (!activeFilters) {
    _eraseBtn.remove();
  }
}

function updateButtons(totalCount, filterState) {
  const disabled = totalCount === 0;
  const salaryDisabled = disabled || !_salaryBounds?.hasSalaryData;
  const activeFilters = isAnyFilterActive(filterState);

  setButtonDisabled(_statusButton, disabled);
  setButtonDisabled(_salaryButton, salaryDisabled);
  setButtonDisabled(_compatButton, disabled);
  setButtonDisabled(_companyButton, disabled);
  setButtonDisabled(_favoritesButton, disabled);
  setButtonDisabled(_sortButton, disabled);
  setButtonDisabled(_eraseBtn, disabled);
  setPressed(_statusButton, (filterState.statuses?.length ?? 0) > 0);
  setPressed(_salaryButton, filterState.salaryMin !== null || filterState.salaryMax !== null);
  setPressed(_compatButton, filterState.compatMin !== null || filterState.compatMax !== null);
  setPressed(_companyButton, (filterState.companies?.length ?? 0) > 0);
  setPressed(_favoritesButton, filterState.favoritesOnly === true);
  setPressed(_sortButton, !isDefaultSort(_sortState));
  _salaryButton?.setAttribute(
    'aria-label',
    _salaryBounds?.hasSalaryData ? 'Filter by Salary' : 'Filter by Salary (no salary data)',
  );
  updateEraseButton(activeFilters && !disabled);

  if (
    disabled
    || (_openPanelType === 'salary' && salaryDisabled)
  ) {
    closePanel();
  }
}

function refreshOpenPanel() {
  if (_openPanelType === 'status') {
    replaceOpenPanel(renderStatusPanel());
  } else if (_openPanelType === 'company') {
    replaceOpenPanel(renderCompanyPanel());
  } else if (_openPanelType === 'salary') {
    replaceOpenPanel(renderSalaryPanel());
  } else if (_openPanelType === 'compat') {
    replaceOpenPanel(renderCompatPanel());
  } else if (_openPanelType === 'sort') {
    replaceOpenPanel(renderSortPanel());
  }
}

export function render(options = {}) {
  closePanel();

  _allApps = options.apps ?? [];
  _filterState = options.filterState;
  _sortState = options.sortState;
  _salaryBounds = options.salaryBounds ?? { min: 0, max: 200000, hasSalaryData: false };
  _callbacks = {
    onFilterChange: options.onFilterChange,
    onSortChange: options.onSortChange,
    onClearAll: options.onClearAll,
    onAddApplication: options.onAddApplication,
  };

  const toolbar = document.createElement('div');
  const label = document.createElement('span');
  const count = document.createElement('span');
  const controls = document.createElement('div');
  const filters = document.createElement('div');
  const actions = document.createElement('div');
  const status = createFilterButton({
    className: 'filter-btn--status',
    label: 'Filter by Status',
    title: 'Status',
    icon: createSvgIcon('M12 8v5l3 2m5-3a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z'),
    onClick: (button) => openPanel('status', button, renderStatusPanel()),
  });
  const salary = createFilterButton({
    className: 'filter-btn--salary',
    label: 'Filter by Salary',
    title: 'Salary',
    icon: createSvgIcon('M6 7h12M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M5 7h14v12H5V7Zm7 3v6M9.5 12h4'),
    onClick: (button) => openPanel('salary', button, renderSalaryPanel()),
  });
  const compat = createFilterButton({
    className: 'filter-btn--compat',
    label: 'Filter by Compatibility',
    title: 'Compatibility',
    icon: createSvgIcon('M4 19V5m0 14h16M7 15l3-3 3 2 4-6'),
    onClick: (button) => openPanel('compat', button, renderCompatPanel()),
  });
  const company = createFilterButton({
    className: 'filter-btn--company',
    label: 'Filter by Company',
    title: 'Company',
    icon: createSvgIcon('M3 21h18M5 21V5a2 2 0 0 1 2-2h7v18M14 8h5a2 2 0 0 1 2 2v11M9 7h1M9 11h1M9 15h1'),
    onClick: (button) => openPanel('company', button, renderCompanyPanel()),
  });
  const favorites = createFilterButton({
    className: 'filter-btn--favorites',
    label: 'Favorites only',
    title: 'Favorites only',
    icon: createSvgIcon('M12 3.5 14.8 9l6.1.9-4.4 4.3 1 6-5.5-2.9-5.5 2.9 1-6L3.1 9l6.1-.9L12 3.5Z'),
    onClick: () => {
      _callbacks.onFilterChange?.({
        ..._filterState,
        favoritesOnly: _filterState.favoritesOnly !== true,
      });
    },
  });
  const sort = createFilterButton({
    className: 'filter-btn--sort',
    label: 'Sort',
    title: 'Sort',
    icon: createSvgIcon('M7 6h10M7 12h7M7 18h4m7-2 3 3 3-3m-3 3V5'),
    onClick: (button) => openPanel('sort', button, renderSortPanel()),
  });
  const erase = createEraseButton();
  const addButton = createAddButton();

  toolbar.className = 'toolbar';
  label.className = 'toolbar__label';
  count.className = 'count-badge';
  count.setAttribute('aria-live', 'polite');
  controls.className = 'toolbar__controls';
  filters.className = 'toolbar__filters';
  actions.className = 'toolbar__actions';

  filters.append(favorites.trigger, status.trigger, salary.trigger, compat.trigger, company.trigger);
  actions.append(sort.trigger);
  controls.append(filters, actions);
  toolbar.append(label, controls, addButton);

  _toolbarEl = toolbar;
  _labelEl = label;
  _countEl = count;
  _actionsEl = actions;
  _statusButton = status.button;
  _salaryButton = salary.button;
  _compatButton = compat.button;
  _companyButton = company.button;
  _favoritesButton = favorites.button;
  _sortButton = sort.button;
  _sortTrigger = sort.trigger;
  _eraseBtn = erase;

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
  _salaryBounds = options.salaryBounds ?? _salaryBounds;

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
