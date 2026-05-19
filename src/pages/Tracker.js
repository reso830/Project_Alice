import { Card } from '../components/Card.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { CreationPicker } from '../components/CreationPicker.js';
import { Fab } from '../components/Fab.js';
import { Modal } from '../components/Modal.js';
import { Pagination } from '../components/Pagination.js';
import { QuickFiltersToolbar } from '../components/QuickFiltersToolbar.js';
import { Toast } from '../components/Toast.js';
import { STATUS_VALUES } from '../../shared/constants.js';
import * as authStore from '../data/authStore.js';
import { SHIFT_VALUES, WORK_SETUP_VALUES } from '../models/application.js';
import * as api from '../services/api.js';
import {
  DEFAULT_FILTER_STATE,
  DEFAULT_SORT_STATE,
  applyFilters,
  getSalaryBounds,
  isAnyFilterActive,
  sortApplications,
  syncDynamicSelections,
} from '../utils/filterSort.js';
import { PAGE_SIZE, getPaginationModel } from '../utils/pagination.js';

let _container = null;
let _cardList = null;
let _currentPage = 1;
let _paginationEl = null;
let _applications = [];
let _filterState = { ...DEFAULT_FILTER_STATE };
let _sortState = { ...DEFAULT_SORT_STATE };
let _salaryBounds = { min: 0, max: 200000, hasSalaryData: false };
let _toolbarEl = null;

const FILTER_STORAGE_KEY = 'apptracker_filters';

function coerceId(id) {
  return typeof id === 'number' ? id : parseInt(id, 10);
}

function findApplication(id) {
  const numericId = coerceId(id);
  return _applications.find((application) => application.id === numericId);
}

function replaceApplication(application) {
  _applications = _applications.map((current) => (
    current.id === application.id ? application : current
  ));
}

function removeApplication(id) {
  const numericId = coerceId(id);
  _applications = _applications.filter((application) => application.id !== numericId);
}

function normalizeIntegerOrNull(value, { min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY } = {}) {
  if (!Number.isInteger(value) || value < min || value > max) {
    return null;
  }

  return value;
}

export function normalizeStoredFilterState(value) {
  const stored = value && typeof value === 'object' ? value : {};
  const statuses = Array.isArray(stored.statuses)
    ? stored.statuses.filter((status) => STATUS_VALUES.includes(status))
    : [];
  const salaryMin = normalizeIntegerOrNull(stored.salaryMin);
  const salaryMax = normalizeIntegerOrNull(stored.salaryMax);
  const compatMin = normalizeIntegerOrNull(stored.compatMin, { min: 0, max: 100 });
  const compatMax = normalizeIntegerOrNull(stored.compatMax, { min: 0, max: 100 });
  const shifts = Array.isArray(stored.shifts)
    ? stored.shifts.filter((shift) => SHIFT_VALUES.includes(shift))
    : [];
  const workSetups = Array.isArray(stored.workSetups)
    ? stored.workSetups.filter((workSetup) => WORK_SETUP_VALUES.includes(workSetup))
    : [];
  const locations = Array.isArray(stored.locations)
    ? stored.locations.filter((location) => typeof location === 'string')
    : [];

  return {
    ...DEFAULT_FILTER_STATE,
    statuses,
    companies: Array.isArray(stored.companies)
      ? stored.companies.filter((company) => typeof company === 'string')
      : [],
    shifts,
    workSetups,
    locations,
    salaryMin: salaryMin !== null && salaryMax !== null && salaryMin > salaryMax ? null : salaryMin,
    salaryMax: salaryMin !== null && salaryMax !== null && salaryMin > salaryMax ? null : salaryMax,
    compatMin: compatMin !== null && compatMax !== null && compatMin > compatMax ? null : compatMin,
    compatMax: compatMin !== null && compatMax !== null && compatMin > compatMax ? null : compatMax,
    favoritesOnly: stored.favoritesOnly === true,
  };
}

function loadPersistedFilterState() {
  // Feature 020: demo sessions start from the default filter state and
  // never read a prior authenticated session's persisted filters. Pairs
  // with the persist gate below so the demo never reads or writes
  // `apptracker_filters` (see Task 05.4 / data-model §5).
  if (authStore.getAuthState().status === 'demo') {
    return { ...DEFAULT_FILTER_STATE };
  }

  try {
    const raw = window.localStorage?.getItem(FILTER_STORAGE_KEY);

    return raw ? normalizeStoredFilterState(JSON.parse(raw)) : { ...DEFAULT_FILTER_STATE };
  } catch {
    return { ...DEFAULT_FILTER_STATE };
  }
}

function persistFilterState(filterState) {
  // Feature 020: skip the write when the visitor is in the portfolio
  // demo. Zero project-namespaced localStorage writes during a demo
  // session is the canonical FR-004 invariant verified by Task 08.2's
  // storage audit.
  if (authStore.getAuthState().status === 'demo') {
    return;
  }

  try {
    window.localStorage?.setItem(FILTER_STORAGE_KEY, JSON.stringify(filterState));
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }
}

function renderMessage(message, className = 'empty-state') {
  const messageEl = document.createElement('div');
  messageEl.className = className;
  messageEl.textContent = message;
  return messageEl;
}

function clampCurrentPage(filteredCount) {
  const maxPage = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  _currentPage = Math.min(_currentPage, maxPage);
}

function removeEmptyState() {
  _container?.querySelector('.empty-state')?.remove();
}

function ensureCardList() {
  if (_cardList || !_container) {
    return;
  }

  removeEmptyState();
  _cardList = document.createElement('div');
  _cardList.className = 'card-list';
  _cardList.tabIndex = -1;
  _cardList.setAttribute('aria-label', 'Application list');
  _container.append(_cardList);
}

function focusCardList() {
  if (_cardList) {
    _cardList.focus({ preventScroll: true });
  }
}

function onPageChange(page) {
  _currentPage = page;
  renderPage({ moveFocus: true });
}

function updateToolbar() {
  if (!_toolbarEl) {
    return;
  }

  const filteredApplications = applyFilters(_applications, _filterState);

  QuickFiltersToolbar.update(_toolbarEl, {
    apps: _applications,
    totalCount: _applications.length,
    filteredCount: filteredApplications.length,
    filterState: _filterState,
    sortState: _sortState,
    salaryBounds: _salaryBounds,
  });
}

function onFilterChange(newFilterState) {
  _filterState = syncDynamicSelections(newFilterState, _applications);
  _currentPage = 1;
  persistFilterState(_filterState);
  renderPage();
  updateToolbar();
}

function onSortChange(newSortState) {
  _sortState = newSortState;
  _currentPage = 1;
  renderPage();
  updateToolbar();
}

function onClearAll() {
  _filterState = { ...DEFAULT_FILTER_STATE };
  _currentPage = 1;
  persistFilterState(_filterState);
  renderPage();
  updateToolbar();
}

function applicationMutationCallbacks() {
  return {
    onApplicationCreate: (newRecord) => {
      _applications = [newRecord, ..._applications];
      _salaryBounds = getSalaryBounds(_applications);
      ensureCardList();
      renderPage();
      updateToolbar();
    },
    onApplicationUpdate: (updated) => {
      replaceApplication(updated);
      renderPage();
      updateToolbar();
    },
    onArchiveSuccess: (updated) => {
      removeApplication(updated.id);
      _salaryBounds = getSalaryBounds(_applications);
      renderPage();
      updateToolbar();
      focusCardList();
    },
  };
}

function onAddApplication() {
  CreationPicker.open(applicationMutationCallbacks());
}

function onFabAddApplication() {
  Modal.open(null, { mode: 'create', ...applicationMutationCallbacks() });
}


function renderFilterEmptyState() {
  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state empty-state--filter';
  emptyState.append(
    'No applications match',
    document.createElement('br'),
    'the active filters.',
  );
  return emptyState;
}

function renderPage({ moveFocus = false } = {}) {
  if (!_container || !_cardList) {
    return;
  }

  const filteredApplications = applyFilters(_applications, _filterState);
  const sortedApplications = sortApplications(filteredApplications, _sortState);

  clampCurrentPage(sortedApplications.length);
  removeEmptyState();
  _paginationEl?.remove();
  _paginationEl = null;
  _cardList.replaceChildren();

  const startIndex = (_currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const visibleApplications = sortedApplications.slice(startIndex, endIndex);

  for (const application of visibleApplications) {
    _cardList.append(Card.render(application, createCallbacks()));
  }

  if (sortedApplications.length === 0 && isAnyFilterActive(_filterState)) {
    _container.append(renderFilterEmptyState());
  } else if (sortedApplications.length === 0) {
    _container.append(renderMessage('No applications yet. Add your first one!'));
  }

  const model = getPaginationModel(_currentPage, sortedApplications.length, PAGE_SIZE);

  if (model.hasPagination) {
    _paginationEl = Pagination.render(_currentPage, sortedApplications.length, onPageChange);
    _container.append(_paginationEl);
  }

  if (moveFocus) {
    window.scrollTo(0, 0);
    focusCardList();
  }
}

function createCallbacks() {
  return {
    onOpen: async (id) => {
      try {
        const application = await api.getById(coerceId(id));
        Modal.open(application, {
          onApplicationUpdate: (updated) => {
            replaceApplication(updated);
            renderPage();
            updateToolbar();
          },
          onArchiveSuccess: (updated) => {
            removeApplication(updated.id);
            _salaryBounds = getSalaryBounds(_applications);
            renderPage();
            updateToolbar();
            focusCardList();
          },
        });
      } catch {
        Toast.show('Application details failed to load', 'failure');
      }
    },
    onStatusChange: async (id, newStatus) => {
      try {
        const updated = await api.update(coerceId(id), { status: newStatus });
        replaceApplication(updated);
        renderPage();
        updateToolbar();
      } catch {
        Toast.show('Status update failed', 'failure');
      }
    },
    onFavToggle: async (id) => {
      const application = findApplication(id);

      if (!application) {
        return;
      }

      try {
        const updated = await api.update(coerceId(id), { fav: !application.fav });
        replaceApplication(updated);
        renderPage();
        updateToolbar();
      } catch {
        Toast.show('Star update failed', 'failure');
        refreshCard(id);
      }
    },
    onArchive: async (id) => {
      if (!await ConfirmDialog.show('Archive this application?')) {
        return;
      }

      try {
        await api.archive(coerceId(id));
        removeApplication(id);
        _salaryBounds = getSalaryBounds(_applications);
        renderPage();
        updateToolbar();
        focusCardList();
      } catch {
        Toast.show('Archive failed', 'failure');
      }
    },
    onCopyUrl: async (id) => {
      let application;

      try {
        application = await api.getById(coerceId(id));
      } catch {
        Toast.show('Application details failed to load', 'failure');
        return;
      }

      if (!application?.jobPostingUrl) {
        Toast.show('No URL on file', 'failure');
        return;
      }

      if (!navigator.clipboard) {
        Toast.show('Copy failed — clipboard not available', 'failure');
        return;
      }

      navigator.clipboard.writeText(application.jobPostingUrl)
        .then(() => Toast.show('URL copied to clipboard', 'success'))
        .catch(() => Toast.show('Copy failed — check browser permissions', 'failure'));
    },
  };
}

export function refreshCard(id) {
  if (!_cardList) {
    return;
  }

  const numericId = coerceId(id);
  const application = findApplication(numericId);
  const currentCard = [..._cardList.querySelectorAll('.card')]
    .find((card) => parseInt(card.dataset.id, 10) === numericId);

  if (!application || !currentCard) {
    return;
  }

  currentCard.replaceWith(Card.render(application, createCallbacks()));
}

export async function mount(container) {
  _container = container;
  _container.replaceChildren();
  _cardList = null;
  _currentPage = 1;
  _paginationEl = null;
  _applications = [];
  _filterState = loadPersistedFilterState();
  _salaryBounds = { min: 0, max: 200000, hasSalaryData: false };
  _toolbarEl = null;

  const toolbar = QuickFiltersToolbar.render({
    apps: _applications,
    totalCount: 0,
    filteredCount: 0,
    filterState: _filterState,
    sortState: _sortState,
    salaryBounds: _salaryBounds,
    onFilterChange,
    onSortChange,
    onClearAll,
    onAddApplication,
  });
  const fab = Fab.render({ onClick: onFabAddApplication });

  _toolbarEl = toolbar;
  toolbar.setAttribute('aria-busy', 'true');
  toolbar.setAttribute('aria-disabled', 'true');
  _container.append(toolbar, fab);

  try {
    _applications = await api.getAll();
    _filterState = syncDynamicSelections(_filterState, _applications);
    _salaryBounds = getSalaryBounds(_applications);
  } catch (error) {
    toolbar.removeAttribute('aria-busy');
    toolbar.removeAttribute('aria-disabled');

    if (error.code === 'NETWORK_ERROR') {
      _container.append(renderMessage(
        'Cannot connect to the backend — is the server running?',
        'empty-state empty-state--error',
      ));
    } else {
      Toast.show('Applications failed to load', 'failure');
      _container.append(renderMessage('Applications failed to load', 'empty-state empty-state--error'));
    }

    window.scrollTo(0, 0);
    return;
  }

  if (_container !== container) {
    return;
  }

  toolbar.removeAttribute('aria-busy');
  toolbar.removeAttribute('aria-disabled');
  updateToolbar();

  if (_applications.length === 0) {
    _container.append(renderMessage('No applications yet. Add your first one!'));
    window.scrollTo(0, 0);
    return;
  }

  ensureCardList();
  renderPage();
  window.scrollTo(0, 0);
}

export function unmount() {
  if (_container) {
    _container.replaceChildren();
  }

  _container = null;
  _cardList = null;
  _currentPage = 1;
  _paginationEl = null;
  _applications = [];
  _filterState = { ...DEFAULT_FILTER_STATE };
  _salaryBounds = { min: 0, max: 200000, hasSalaryData: false };
  _toolbarEl = null;
}

export const Tracker = { mount, unmount };
