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
import { renderInlineError } from '../utils/asyncUI.js';
import { buildApplicationListSkeleton } from '../utils/skeletons.js';

let _container = null;
let _cardList = null;
let _listStateEl = null;
let _currentPage = 1;
let _paginationEl = null;
let _applications = [];
let _filterState = { ...DEFAULT_FILTER_STATE };
let _sortState = { ...DEFAULT_SORT_STATE };
let _salaryBounds = { min: 0, max: 200000, hasSalaryData: false };
let _toolbarEl = null;
let _fabEl = null;
let _currentView = 'active';
let _viewCounts = { activeCount: 0, archivedCount: 0 };
let _viewBusy = false;
let _navigate = () => {};
let _profile = null;

const FILTER_STORAGE_KEY = 'apptracker_filters';
const APPLICATIONS_LOAD_ERROR_MESSAGE = "Couldn't load your applications. Check your connection or try again.";

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

function isArchivedView() {
  return _currentView === 'archived';
}

function getListOptions() {
  return isArchivedView() ? { view: 'archived' } : {};
}

function updateUrlForView() {
  const url = new URL(window.location.href);
  if (isArchivedView()) {
    url.searchParams.set('view', 'archived');
  } else {
    url.searchParams.delete('view');
  }
  window.history.replaceState({}, '', url.toString());
}

function syncFabVisibility() {
  if (!_container) {
    return;
  }

  if (isArchivedView()) {
    _fabEl?.remove();
    return;
  }

  if (!_fabEl) {
    _fabEl = Fab.render({ onClick: onFabAddApplication });
  }
  if (!_fabEl.isConnected) {
    _container.append(_fabEl);
  }
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
  _listStateEl?.remove();
  _listStateEl = null;
  _cardList = document.createElement('div');
  _cardList.className = 'card-list';
  _cardList.tabIndex = -1;
  _cardList.setAttribute('aria-label', 'Application list');
  _container.append(_cardList);
}

function clearListDecorations() {
  removeEmptyState();
  _paginationEl?.remove();
  _paginationEl = null;
}

function renderApplicationListSkeleton() {
  if (!_container) {
    return null;
  }

  clearListDecorations();
  _cardList?.remove();
  _cardList = null;
  _listStateEl?.remove();
  _listStateEl = buildApplicationListSkeleton();
  _container.append(_listStateEl);
  return _listStateEl;
}

function showApplicationLoadError(onRetry) {
  if (!_container) {
    return;
  }

  clearListDecorations();
  const target = document.createElement('div');
  target.className = 'list-load-state';
  if (_listStateEl?.isConnected) {
    _listStateEl.replaceWith(target);
  } else if (_cardList?.isConnected) {
    _cardList.replaceWith(target);
    _cardList = null;
  } else {
    _container.append(target);
  }
  _listStateEl = target;
  renderInlineError({
    target,
    message: APPLICATIONS_LOAD_ERROR_MESSAGE,
    onRetry,
  });
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
    currentView: _currentView,
    viewCounts: _viewCounts,
    showAddButton: !isArchivedView(),
    viewBusy: _viewBusy,
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

async function loadList({ preserveFilters = false } = {}) {
  _applications = await api.getAll(getListOptions());
  if (!preserveFilters) {
    _filterState = syncDynamicSelections(_filterState, _applications);
  }
  _salaryBounds = getSalaryBounds(_applications);
}

async function loadInitialLists() {
  const [currentList, activeList, archivedList, profile] = await Promise.all([
    api.getAll(getListOptions()),
    isArchivedView() ? api.getAll({}) : Promise.resolve(null),
    isArchivedView() ? Promise.resolve(null) : api.getAll({ view: 'archived' }),
    Promise.resolve(api.getProfile()).catch(() => null),
  ]);

  _applications = currentList;
  _profile = profile;
  _viewCounts = {
    activeCount: (isArchivedView() ? activeList : currentList).length,
    archivedCount: (isArchivedView() ? currentList : archivedList).length,
  };
  _filterState = syncDynamicSelections(_filterState, _applications);
  _salaryBounds = getSalaryBounds(_applications);
}

function setToolbarLoading(loading) {
  if (!_toolbarEl) {
    return;
  }

  if (loading) {
    _toolbarEl.setAttribute('aria-busy', 'true');
    _toolbarEl.setAttribute('aria-disabled', 'true');
  } else {
    _toolbarEl.removeAttribute('aria-busy');
    _toolbarEl.removeAttribute('aria-disabled');
  }
}

async function retryInitialLoad() {
  renderApplicationListSkeleton();
  setToolbarLoading(true);

  try {
    await loadInitialLists();
  } catch {
    setToolbarLoading(false);
    showApplicationLoadError(retryInitialLoad);
    window.scrollTo(0, 0);
    return;
  }

  setToolbarLoading(false);
  updateToolbar();
  ensureCardList();
  renderPage({ moveFocus: true });
}

async function reloadCurrentView({ preserveFilters = true, moveFocus = true } = {}) {
  _viewBusy = true;
  updateToolbar();
  renderApplicationListSkeleton();

  try {
    await loadList({ preserveFilters });
    ensureCardList();
    renderPage({ moveFocus });
  } catch {
    showApplicationLoadError(() => reloadCurrentView({ preserveFilters, moveFocus }));
    window.scrollTo(0, 0);
  } finally {
    _viewBusy = false;
    updateToolbar();
  }
}

async function setView(next) {
  const normalized = next === 'archived' ? 'archived' : 'active';
  if (normalized === _currentView) {
    return;
  }

  _currentView = normalized;
  updateUrlForView();
  _currentPage = 1;
  syncFabVisibility();

  await reloadCurrentView({ preserveFilters: true, moveFocus: true });
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
      _viewCounts = {
        activeCount: Math.max(0, _viewCounts.activeCount - 1),
        archivedCount: _viewCounts.archivedCount + 1,
      };
      _salaryBounds = getSalaryBounds(_applications);
      renderPage();
      updateToolbar();
      focusCardList();
    },
    onUnarchiveSuccess: (updated) => {
      if (isArchivedView()) {
        removeApplication(updated.id);
      } else {
        replaceApplication(updated);
      }
      _viewCounts = {
        activeCount: _viewCounts.activeCount + 1,
        archivedCount: Math.max(0, _viewCounts.archivedCount - 1),
      };
      _salaryBounds = getSalaryBounds(_applications);
      renderPage();
      updateToolbar();
      Toast.show('Unarchived.', 'success');
      focusCardList();
    },
  };
}

function onAddApplication() {
  CreationPicker.open({ ...applicationMutationCallbacks(), navigate: _navigate });
}

function onFabAddApplication() {
  onAddApplication();
}


function renderFilterEmptyState() {
  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state empty-state--filter';
  emptyState.append(
    isArchivedView() ? 'No archived items match' : 'No applications match',
    document.createElement('br'),
    'the active filters.',
  );
  return emptyState;
}

function renderArchivedEmptyState() {
  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';
  emptyState.append(
    'Nothing archived yet.',
    document.createElement('br'),
    'Archived applications will appear here.',
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
    _container.append(isArchivedView()
      ? renderArchivedEmptyState()
      : renderMessage('No applications yet. Add your first one!'));
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
          profile: _profile,
          onApplicationUpdate: (updated) => {
            replaceApplication(updated);
            renderPage();
            updateToolbar();
          },
          onArchiveSuccess: (updated) => {
            removeApplication(updated.id);
            _viewCounts = {
              activeCount: Math.max(0, _viewCounts.activeCount - 1),
              archivedCount: _viewCounts.archivedCount + 1,
            };
            _salaryBounds = getSalaryBounds(_applications);
            renderPage();
            updateToolbar();
            focusCardList();
          },
          onUnarchiveSuccess: applicationMutationCallbacks().onUnarchiveSuccess,
          onOpenSettings: () => {
            _navigate('profile', { focusSettings: true });
          },
          onOpenProfile: () => {
            _navigate('profile');
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
        const updated = await api.archive(coerceId(id));
        removeApplication(updated.id);
        _viewCounts = {
          activeCount: Math.max(0, _viewCounts.activeCount - 1),
          archivedCount: _viewCounts.archivedCount + 1,
        };
        _salaryBounds = getSalaryBounds(_applications);
        renderPage();
        updateToolbar();
        focusCardList();
      } catch {
        Toast.show('Archive failed', 'failure');
      }
    },
    onUnarchiveSuccess: applicationMutationCallbacks().onUnarchiveSuccess,
    onError: () => {
      Toast.show('Unarchive failed', 'failure');
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

export async function mount(container, { navigate } = {}) {
  _container = container;
  _container.replaceChildren();
  _cardList = null;
  _listStateEl = null;
  _currentPage = 1;
  _paginationEl = null;
  _applications = [];
  _filterState = loadPersistedFilterState();
  _salaryBounds = { min: 0, max: 200000, hasSalaryData: false };
  _toolbarEl = null;
  _fabEl = null;
  _currentView = new window.URLSearchParams(window.location.search).get('view') === 'archived'
    ? 'archived'
    : 'active';
  _viewCounts = { activeCount: 0, archivedCount: 0 };
  _viewBusy = false;
  _navigate = typeof navigate === 'function' ? navigate : () => {};
  _profile = null;

  const toolbar = QuickFiltersToolbar.render({
    apps: _applications,
    totalCount: 0,
    filteredCount: 0,
    filterState: _filterState,
    sortState: _sortState,
    salaryBounds: _salaryBounds,
    currentView: _currentView,
    viewCounts: _viewCounts,
    showAddButton: !isArchivedView(),
    viewBusy: _viewBusy,
    onFilterChange,
    onSortChange,
    onClearAll,
    onAddApplication,
    onViewChange: setView,
  });
  const fab = isArchivedView() ? null : Fab.render({ onClick: onFabAddApplication });

  _toolbarEl = toolbar;
  _fabEl = fab;
  setToolbarLoading(true);
  _container.append(...[toolbar, fab].filter(Boolean));
  renderApplicationListSkeleton();

  try {
    await loadInitialLists();
  } catch {
    setToolbarLoading(false);
    showApplicationLoadError(retryInitialLoad);

    window.scrollTo(0, 0);
    return;
  }

  if (_container !== container) {
    return;
  }

  setToolbarLoading(false);
  updateToolbar();

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
  _listStateEl = null;
  _currentPage = 1;
  _paginationEl = null;
  _applications = [];
  _filterState = { ...DEFAULT_FILTER_STATE };
  _salaryBounds = { min: 0, max: 200000, hasSalaryData: false };
  _toolbarEl = null;
  _fabEl = null;
  _currentView = 'active';
  _viewCounts = { activeCount: 0, archivedCount: 0 };
  _viewBusy = false;
  _navigate = () => {};
  _profile = null;
}

export const Tracker = { mount, unmount };
