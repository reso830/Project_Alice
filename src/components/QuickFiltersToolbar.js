import { SHIFT_VALUES, STATUS_CONFIG, WORK_SETUP_VALUES } from '../models/application.js';
import {
  DEFAULT_SORT_STATE,
  SALARY_STEP,
  getAvailableCompanies,
  getAvailableLocations,
  getAvailableStatuses,
  isDefaultSort,
  isAnyFilterActive,
} from '../utils/filterSort.js';
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
let _shiftButton = null;
let _workSetupButton = null;
let _locationButton = null;
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
  svg.setAttribute('class', 'icon');
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
    + (filterState.shifts?.length ?? 0)
    + (filterState.workSetups?.length ?? 0)
    + (filterState.locations?.length ?? 0)
    + (filterState.salaryMin === null && filterState.salaryMax === null ? 0 : 1)
    + (filterState.compatMin === null && filterState.compatMax === null ? 0 : 1)
    + (filterState.favoritesOnly === true ? 1 : 0);
}

function updateLabel(totalCount, filteredCount, filterState) {
  const active = isAnyFilterActive(filterState);

  if (_labelEl) {
    _labelEl.textContent = active ? 'Results' : 'Applications';
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

function positionPanel(button, panel) {
  const rect = button.getBoundingClientRect();
  const panelWidth = panel.offsetWidth || 220;
  let top = rect.bottom + 8;
  let left = rect.left;

  if (left + panelWidth > window.innerWidth - 8) {
    left = Math.max(8, rect.right - panelWidth);
  }

  panel.style.top = `${top}px`;
  panel.style.left = `${left}px`;
}

function replaceOpenPanel(panel) {
  _openPanel?.remove();
  _openPanel = panel;
  document.body.append(panel);
  if (_openButton) {
    positionPanel(_openButton, panel);
  }
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
  document.body.append(panel);
  positionPanel(button, panel);
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
      return config ? config.borderAccent : null;
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

function renderShiftPanel() {
  return FilterPanel.render({
    title: 'Shift',
    options: SHIFT_VALUES,
    includeNotSet: true,
    selected: _filterState.shifts,
    onChange: (shifts) => {
      _callbacks.onFilterChange?.({ ..._filterState, shifts });
    },
    onClear: () => {
      _callbacks.onFilterChange?.({ ..._filterState, shifts: [] });
      closePanel();
    },
  });
}

function renderWorkSetupPanel() {
  return FilterPanel.render({
    title: 'Work Setup',
    options: WORK_SETUP_VALUES,
    includeNotSet: true,
    selected: _filterState.workSetups,
    onChange: (workSetups) => {
      _callbacks.onFilterChange?.({ ..._filterState, workSetups });
    },
    onClear: () => {
      _callbacks.onFilterChange?.({ ..._filterState, workSetups: [] });
      closePanel();
    },
  });
}

function renderLocationPanel() {
  return FilterPanel.render({
    title: 'Location',
    options: getAvailableLocations(_allApps, _filterState),
    includeNotSet: true,
    selected: _filterState.locations,
    onChange: (locations) => {
      _callbacks.onFilterChange?.({ ..._filterState, locations });
    },
    onClear: () => {
      _callbacks.onFilterChange?.({ ..._filterState, locations: [] });
      closePanel();
    },
  });
}

function createRangePanel(title, slider, onClear) {
  const panel = document.createElement('div');
  const header = document.createElement('div');
  const titleEl = document.createElement('span');
  const clearBtn = document.createElement('button');

  panel.className = 'filter-panel range-panel';
  header.className = 'filter-panel__header';
  titleEl.className = 'filter-panel__title';
  titleEl.textContent = title;
  clearBtn.type = 'button';
  clearBtn.className = 'filter-panel__clear';
  clearBtn.textContent = 'Clear';
  clearBtn.addEventListener('click', () => {
    onClear();
    closePanel();
  });

  header.append(titleEl, clearBtn);
  panel.append(header, slider);

  return panel;
}

function formatSalary(value) {
  const k = Math.round(value / 1000);
  return value >= SALARY_FILTER_MAX ? `₱${k}k+` : `₱${k}k`;
}

function renderSalaryPanel() {
  return createRangePanel(
    'Salary',
    RangeSlider.render({
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
    }),
    () => _callbacks.onFilterChange?.({ ..._filterState, salaryMin: null, salaryMax: null }),
  );
}

function renderCompatPanel() {
  return createRangePanel(
    'Compatibility',
    RangeSlider.render({
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
    }),
    () => _callbacks.onFilterChange?.({ ..._filterState, compatMin: null, compatMax: null }),
  );
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

  button.className = 'toolbar__add new-app-btn';
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
  setButtonDisabled(_shiftButton, disabled);
  setButtonDisabled(_workSetupButton, disabled);
  setButtonDisabled(_locationButton, disabled);
  setButtonDisabled(_favoritesButton, disabled);
  setButtonDisabled(_sortButton, disabled);
  setButtonDisabled(_eraseBtn, disabled);
  setPressed(_statusButton, (filterState.statuses?.length ?? 0) > 0);
  setPressed(_salaryButton, filterState.salaryMin !== null || filterState.salaryMax !== null);
  setPressed(_compatButton, filterState.compatMin !== null || filterState.compatMax !== null);
  setPressed(_companyButton, (filterState.companies?.length ?? 0) > 0);
  setPressed(_shiftButton, (filterState.shifts?.length ?? 0) > 0);
  setPressed(_workSetupButton, (filterState.workSetups?.length ?? 0) > 0);
  setPressed(_locationButton, (filterState.locations?.length ?? 0) > 0);
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
  } else if (_openPanelType === 'shift') {
    replaceOpenPanel(renderShiftPanel());
  } else if (_openPanelType === 'workSetup') {
    replaceOpenPanel(renderWorkSetupPanel());
  } else if (_openPanelType === 'location') {
    replaceOpenPanel(renderLocationPanel());
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
  const left = document.createElement('div');
  const right = document.createElement('div');
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
  const shift = createFilterButton({
    className: 'filter-btn--shift',
    label: 'Filter by Shift',
    title: 'Shift',
    icon: createSvgIcon('M12 6v6l4 2m4-2a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z'),
    onClick: (button) => openPanel('shift', button, renderShiftPanel()),
  });
  const workSetup = createFilterButton({
    className: 'filter-btn--work-setup',
    label: 'Filter by Work Setup',
    title: 'Work Setup',
    icon: createSvgIcon('M4 19V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11M8 19v-4h8v4M8 10h.01M12 10h.01M16 10h.01'),
    onClick: (button) => openPanel('workSetup', button, renderWorkSetupPanel()),
  });
  const location = createFilterButton({
    className: 'filter-btn--location',
    label: 'Filter by Location',
    title: 'Location',
    icon: createSvgIcon('M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Zm0-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'),
    onClick: (button) => openPanel('location', button, renderLocationPanel()),
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

  toolbar.className = 'toolbar subheader';
  left.className = 'toolbar__left';
  right.className = 'toolbar__right';
  label.className = 'toolbar__label';
  count.className = 'count-badge';
  count.setAttribute('aria-live', 'polite');
  controls.className = 'toolbar__controls';
  filters.className = 'toolbar__filters';
  actions.className = 'toolbar__actions';

  filters.append(
    favorites.trigger,
    status.trigger,
    salary.trigger,
    compat.trigger,
    company.trigger,
    shift.trigger,
    workSetup.trigger,
    location.trigger,
  );
  actions.append(sort.trigger);
  controls.append(filters, actions);
  left.append(label);
  right.append(controls, addButton);
  toolbar.append(left, right);

  _toolbarEl = toolbar;
  _labelEl = label;
  _countEl = count;
  _actionsEl = actions;
  _statusButton = status.button;
  _salaryButton = salary.button;
  _compatButton = compat.button;
  _companyButton = company.button;
  _shiftButton = shift.button;
  _workSetupButton = workSetup.button;
  _locationButton = location.button;
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
