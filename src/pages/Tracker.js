import { Card } from '../components/Card.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { CreationPicker } from '../components/CreationPicker.js';
import { EmptyPane } from '../components/EmptyPane.js';
import { ErrorPane } from '../components/ErrorPane.js';
import { Fab } from '../components/Fab.js';
import { Modal } from '../components/Modal.js';
import { PaneLoading } from '../components/PaneLoading.js';
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
import { buildApplicationListSkeleton, buildTrackerBootSkeleton } from '../utils/skeletons.js';

let _container = null;
let _workspaceEl = null;
let _masterEl = null;
let _detailPaneEl = null;
let _paginationHostEl = null;
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
let _isDesktop = false;
let _desktopMql = null;
let _desktopMqlHandler = null;
let _selectedId = null;
let _modalApplicationId = null;
let _pendingModalApplicationId = null;
let _pendingSelectionId = null;
let _mountGeneration = 0;
let _suppressPaneClosed = false;
let _footerMeasureFrame = null;
let _footerMeasureHandler = null;

const FILTER_STORAGE_KEY = 'apptracker_filters';
const APPLICATIONS_LOAD_ERROR_TITLE = "Couldn't load your applications";
const APPLICATIONS_LOAD_ERROR_MESSAGE = 'Something went wrong while loading your applications. This is usually temporary — your data is safe and nothing was lost.';
const DESKTOP_WORKSPACE_QUERY = '(min-width: 1100px)';

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

function getVisibleFooterHeight() {
  if (!_isDesktop) {
    return 0;
  }

  const footer = document.querySelector('.site-footer');

  if (!(footer instanceof HTMLElement)) {
    return 0;
  }

  const rect = footer.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

  if (viewportHeight <= 0) {
    return 0;
  }

  const actualVisible = rect.top >= viewportHeight || rect.bottom <= 0
    ? 0
    : Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));

  if (!(_masterEl instanceof HTMLElement)) {
    return actualVisible;
  }

  const masterRect = _masterEl.getBoundingClientRect();
  const naturalVisible = Math.max(
    0,
    Math.min(rect.height, viewportHeight - Math.max(masterRect.bottom, 0)),
  );

  return Math.max(actualVisible, naturalVisible);
}

function updateFooterVisibleHeight() {
  if (!_workspaceEl) {
    return;
  }

  _workspaceEl.style.setProperty('--footer-visible-h', `${Math.round(getVisibleFooterHeight())}px`);
}

function scheduleFooterVisibleHeightUpdate() {
  if (_footerMeasureFrame !== null) {
    return;
  }

  if (typeof window.requestAnimationFrame === 'function') {
    _footerMeasureFrame = window.requestAnimationFrame(() => {
      _footerMeasureFrame = null;
      updateFooterVisibleHeight();
    });
    return;
  }

  updateFooterVisibleHeight();
}

function openApplicationPane(application) {
  const numericId = coerceId(application.id);

  _suppressPaneClosed = true;
  try {
    Modal.open(application, {
      variant: 'pane',
      target: _detailPaneEl,
      profile: _profile ?? null,
      ...detailCallbacks(numericId),
      onClosed: () => {
        if (_suppressPaneClosed) {
          return;
        }
        if (_selectedId === numericId) {
          clearSelectedPane();
        }
      },
    });
  } finally {
    _suppressPaneClosed = false;
  }

  _modalApplicationId = null;
  _selectedId = numericId;
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
  getListHost()?.querySelector('.empty-state')?.remove();
}

function getListHost() {
  return _isDesktop ? _masterEl : _container;
}

function getPaginationHost() {
  return _isDesktop ? _paginationHostEl : _container;
}

function renderEmptyPane() {
  if (!_detailPaneEl || _selectedId !== null) {
    return;
  }

  _detailPaneEl.replaceChildren(EmptyPane.render());
}

function hasOpenPane() {
  return Boolean(_detailPaneEl?.querySelector('.modal-panel--pane'));
}

function clearSelectedPane() {
  _selectedId = null;
  renderPage();
  renderEmptyPane();
}

function moveListSurface(target) {
  if (!target) {
    return;
  }

  const emptyState = _masterEl?.querySelector('.empty-state')
    ?? _container?.querySelector(':scope > .empty-state');

  if (_listStateEl?.isConnected) {
    target.append(_listStateEl);
  }
  if (_cardList?.isConnected) {
    target.append(_cardList);
  }
  if (emptyState) {
    target.append(emptyState);
  }
}

function movePaginationSurface(target) {
  if (target && _paginationEl?.isConnected) {
    target.append(_paginationEl);
  }
}

function ensureTrackerLayout() {
  if (!_container) {
    return;
  }

  if (_isDesktop) {
    if (!_workspaceEl) {
      _workspaceEl = document.createElement('div');
      _workspaceEl.className = 'tracker-split';
      _masterEl = document.createElement('section');
      _masterEl.className = 'tracker-master';
      _detailPaneEl = document.createElement('aside');
      _detailPaneEl.className = 'tracker-detail';
      _detailPaneEl.setAttribute('aria-label', 'Application details');
      _workspaceEl.append(_masterEl, _detailPaneEl);
      _container.append(_workspaceEl);
    }

    if (!_paginationHostEl) {
      _paginationHostEl = document.createElement('div');
      _paginationHostEl.className = 'split-pagination';
      _container.append(_paginationHostEl);
    }

    moveListSurface(_masterEl);
    movePaginationSurface(_paginationHostEl);
    renderEmptyPane();
    updateFooterVisibleHeight();
    return;
  }

  moveListSurface(_container);
  movePaginationSurface(_container);
  _workspaceEl?.remove();
  _paginationHostEl?.remove();
  _workspaceEl = null;
  _masterEl = null;
  _detailPaneEl = null;
  _paginationHostEl = null;
  updateFooterVisibleHeight();
}

function setupDesktopQuery() {
  _footerMeasureHandler = () => scheduleFooterVisibleHeightUpdate();
  window.addEventListener('scroll', _footerMeasureHandler, { passive: true });
  window.addEventListener('resize', _footerMeasureHandler);

  _desktopMql = typeof window.matchMedia === 'function'
    ? window.matchMedia(DESKTOP_WORKSPACE_QUERY)
    : null;
  _isDesktop = Boolean(_desktopMql?.matches);

  if (!_desktopMql) {
    return;
  }

  _desktopMqlHandler = async (event) => {
    const wasDesktop = _isDesktop;
    const nextIsDesktop = Boolean(event.matches);

    if (!nextIsDesktop && wasDesktop && hasOpenPane()) {
      _suppressPaneClosed = true;
      const canClosePane = await Modal.requestClose();
      _suppressPaneClosed = false;
      if (!canClosePane) {
        return;
      }
    }

    _isDesktop = nextIsDesktop;
    ensureTrackerLayout();
    ensureCardList();
    renderPage();

    if (_isDesktop && _modalApplicationId !== null) {
      const pendingId = _modalApplicationId;

      if (!document.querySelector('.modal-backdrop')) {
        _modalApplicationId = null;
        renderEmptyPane();
      } else if (!await Modal.requestClose()) {
        return;
      } else {
        _modalApplicationId = null;
        await selectApplication(pendingId, { skipGuard: true });
        return;
      }
    }

    if (_isDesktop && _selectedId !== null && !_detailPaneEl?.querySelector('.modal-panel')) {
      await selectApplication(_selectedId, { skipGuard: true });
      return;
    }

    if (!_isDesktop && wasDesktop && _selectedId !== null && hasOpenPane()) {
      _suppressPaneClosed = true;
      Modal.close();
      _suppressPaneClosed = false;
      ensureTrackerLayout();
      ensureCardList();
      renderPage();
    }
  };

  if (typeof _desktopMql.addEventListener === 'function') {
    _desktopMql.addEventListener('change', _desktopMqlHandler);
  } else if (typeof _desktopMql.addListener === 'function') {
    _desktopMql.addListener(_desktopMqlHandler);
  }
}

function teardownDesktopQuery() {
  if (_footerMeasureHandler) {
    window.removeEventListener('scroll', _footerMeasureHandler);
    window.removeEventListener('resize', _footerMeasureHandler);
  }
  if (_footerMeasureFrame !== null && typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(_footerMeasureFrame);
  }

  _footerMeasureHandler = null;
  _footerMeasureFrame = null;

  if (_desktopMql && _desktopMqlHandler) {
    if (typeof _desktopMql.removeEventListener === 'function') {
      _desktopMql.removeEventListener('change', _desktopMqlHandler);
    } else if (typeof _desktopMql.removeListener === 'function') {
      _desktopMql.removeListener(_desktopMqlHandler);
    }
  }

  _desktopMql = null;
  _desktopMqlHandler = null;
  _isDesktop = false;
}

function ensureCardList() {
  if (_cardList || !_container) {
    return;
  }

  ensureTrackerLayout();
  removeEmptyState();
  _listStateEl?.remove();
  _listStateEl = null;
  _cardList = document.createElement('div');
  _cardList.className = 'card-list';
  _cardList.tabIndex = -1;
  _cardList.setAttribute('aria-label', 'Application list');
  getListHost()?.append(_cardList);
}

function clearListDecorations() {
  removeEmptyState();
  _paginationEl?.remove();
  _paginationEl = null;
}

// WS3 (044) hydrate seam: mount()'s first, pre-load render uses the
// boot-specific skeleton (buildTrackerBootSkeleton) so the signed-in
// handoff is distinguishable from a later in-page reload/retry, which keep
// using the default buildApplicationListSkeleton.
function renderApplicationListSkeleton(buildSkeleton = buildApplicationListSkeleton) {
  if (!_container) {
    return null;
  }

  ensureTrackerLayout();
  clearListDecorations();
  _cardList?.remove();
  _cardList = null;
  _listStateEl?.remove();
  _listStateEl = buildSkeleton();
  getListHost()?.append(_listStateEl);
  return _listStateEl;
}

function showApplicationLoadError(onRetry) {
  if (!_container) {
    return;
  }

  ensureTrackerLayout();
  clearListDecorations();
  const target = document.createElement('div');
  target.className = 'list-load-state';
  if (_listStateEl?.isConnected) {
    _listStateEl.replaceWith(target);
  } else if (_cardList?.isConnected) {
    _cardList.replaceWith(target);
    _cardList = null;
  } else {
    getListHost()?.append(target);
  }
  _listStateEl = target;
  const pane = ErrorPane.render({
    title: APPLICATIONS_LOAD_ERROR_TITLE,
    message: APPLICATIONS_LOAD_ERROR_MESSAGE,
    code: 'LOAD_FAILED',
    onRetry,
  });

  target.replaceChildren(pane);
  target.removeAttribute('aria-busy');
  pane.querySelector('.error-pane__retry')?.focus();
}

function focusCardList() {
  if (_cardList) {
    _cardList.focus({ preventScroll: true });
  }
}

function focusDetailPane() {
  const panePanel = _detailPaneEl?.querySelector('.modal-panel--pane');

  if (!(panePanel instanceof HTMLElement)) {
    return;
  }

  panePanel.tabIndex = -1;
  panePanel.focus({ preventScroll: true });
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
      if (_selectedId === coerceId(updated.id)) {
        _selectedId = null;
      }
      _viewCounts = {
        activeCount: Math.max(0, _viewCounts.activeCount - 1),
        archivedCount: _viewCounts.archivedCount + 1,
      };
      _salaryBounds = getSalaryBounds(_applications);
      renderPage();
      updateToolbar();
      renderEmptyPane();
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

async function onAddApplication() {
  if (_isDesktop && _detailPaneEl) {
    if (hasOpenPane()) {
      const canOpenCreate = await Modal.requestClose();
      if (!canOpenCreate) {
        return;
      }
    }

    clearSelectedPane();
    CreationPicker.open({
      ...applicationMutationCallbacks(),
      navigate: _navigate,
      profile: _profile ?? null,
      createOptions: {
        variant: 'pane',
        target: _detailPaneEl,
        onClosed: renderEmptyPane,
      },
    });
    return;
  }

  CreationPicker.open({ ...applicationMutationCallbacks(), navigate: _navigate, profile: _profile });
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

  ensureTrackerLayout();
  const filteredApplications = applyFilters(_applications, _filterState);
  const sortedApplications = sortApplications(filteredApplications, _sortState);
  const listHost = getListHost();
  const paginationHost = getPaginationHost();

  clampCurrentPage(sortedApplications.length);
  removeEmptyState();
  _paginationEl?.remove();
  _paginationEl = null;
  _cardList.replaceChildren();

  const startIndex = (_currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const visibleApplications = sortedApplications.slice(startIndex, endIndex);

  for (const application of visibleApplications) {
    _cardList.append(Card.render(application, createCallbacks(), {
      selected: application.id === _selectedId,
      pending: application.id === _pendingModalApplicationId,
    }));
  }

  if (sortedApplications.length === 0 && isAnyFilterActive(_filterState)) {
    listHost?.append(renderFilterEmptyState());
  } else if (sortedApplications.length === 0) {
    listHost?.append(isArchivedView()
      ? renderArchivedEmptyState()
      : renderMessage('No applications yet. Add your first one!'));
  }

  const model = getPaginationModel(_currentPage, sortedApplications.length, PAGE_SIZE);

  if (model.hasPagination) {
    _paginationEl = Pagination.render(_currentPage, sortedApplications.length, onPageChange);
    paginationHost?.append(_paginationEl);
  }

  renderEmptyPane();
  scheduleFooterVisibleHeightUpdate();

  if (moveFocus) {
    window.scrollTo(0, 0);
    focusCardList();
  }
}

function detailCallbacks(applicationId) {
  return {
    onApplicationUpdate: (updated) => {
      replaceApplication(updated);
      renderPage();
      updateToolbar();
    },
    onArchiveSuccess: (updated) => {
      removeApplication(updated.id);
      if (_selectedId === coerceId(applicationId) || _selectedId === coerceId(updated.id)) {
        _selectedId = null;
      }
      _viewCounts = {
        activeCount: Math.max(0, _viewCounts.activeCount - 1),
        archivedCount: _viewCounts.archivedCount + 1,
      };
      _salaryBounds = getSalaryBounds(_applications);
      renderPage();
      updateToolbar();
      renderEmptyPane();
      focusCardList();
    },
    onUnarchiveSuccess: applicationMutationCallbacks().onUnarchiveSuccess,
    onOpenSettings: () => {
      _navigate('profile', { focusSettings: true });
    },
    onOpenProfile: () => {
      _navigate('profile');
    },
  };
}

async function openModalApplication(id) {
  const numericId = coerceId(id);

  if (_pendingModalApplicationId !== null) {
    return;
  }

  _pendingModalApplicationId = numericId;
  renderPage();

  const mountedGeneration = _mountGeneration;

  try {
    const application = await api.getById(numericId);

    if (_mountGeneration !== mountedGeneration || _isDesktop || _pendingModalApplicationId !== numericId) {
      return;
    }

    _modalApplicationId = numericId;
    Modal.open(application, {
      profile: _profile ?? null,
      ...detailCallbacks(numericId),
    });
  } finally {
    if (_mountGeneration === mountedGeneration && _pendingModalApplicationId === numericId) {
      _pendingModalApplicationId = null;
      renderPage();
    }
  }
}

async function selectApplication(id, { skipGuard = false } = {}) {
  const numericId = coerceId(id);

  if (!_isDesktop) {
    await openModalApplication(numericId);
    return;
  }

  if (_selectedId === numericId && _detailPaneEl?.querySelector('.modal-panel')) {
    return;
  }

  if (_pendingSelectionId !== null) {
    return;
  }

  if (hasOpenPane() && !skipGuard) {
    const canSwitch = await Modal.requestClose();
    if (!canSwitch) {
      return;
    }
  }

  _pendingSelectionId = numericId;
  _selectedId = numericId;
  renderPage();
  _detailPaneEl?.replaceChildren(PaneLoading.render());

  const mountedGeneration = _mountGeneration;
  let application;

  try {
    application = await api.getById(numericId);
  } catch (error) {
    // The dirty-pane guard above (Modal.requestClose) already destroyed any
    // previously open pane and rendered the empty state, so reverting to the
    // previous card here would show it selected in the list with no matching
    // pane content. Clear the selection instead to keep list/pane consistent.
    _selectedId = null;
    renderPage();
    renderEmptyPane();
    throw error;
  } finally {
    if (_mountGeneration === mountedGeneration && _pendingSelectionId === numericId) {
      _pendingSelectionId = null;
    }
  }

  if (_mountGeneration !== mountedGeneration || !_isDesktop) {
    return;
  }

  openApplicationPane(application);
  renderPage();
  focusDetailPane();
}

function createCallbacks() {
  return {
    onOpen: async (id) => {
      try {
        await (_isDesktop ? selectApplication(id) : openModalApplication(id));
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
        if (_isDesktop && _selectedId === coerceId(id) && _detailPaneEl?.querySelector('.modal-panel--pane')) {
          Modal.syncApplication(updated);
        }
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

  currentCard.replaceWith(Card.render(application, createCallbacks(), {
    selected: application.id === _selectedId,
  }));
}

export async function mount(container, { navigate } = {}) {
  _mountGeneration += 1;
  _container = container;
  _container.replaceChildren();
  _cardList = null;
  _listStateEl = null;
  _currentPage = 1;
  _paginationEl = null;
  _workspaceEl = null;
  _masterEl = null;
  _detailPaneEl = null;
  _paginationHostEl = null;
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
  _selectedId = null;
  _modalApplicationId = null;
  _pendingModalApplicationId = null;
  _pendingSelectionId = null;
  _suppressPaneClosed = false;
  teardownDesktopQuery();
  setupDesktopQuery();

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
  ensureTrackerLayout();
  renderApplicationListSkeleton(buildTrackerBootSkeleton);

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
  _mountGeneration += 1;
  teardownDesktopQuery();

  if (_container) {
    _container.replaceChildren();
  }

  _container = null;
  _workspaceEl = null;
  _masterEl = null;
  _detailPaneEl = null;
  _paginationHostEl = null;
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
  _selectedId = null;
  _modalApplicationId = null;
  _pendingModalApplicationId = null;
  _pendingSelectionId = null;
  _suppressPaneClosed = false;
}

export const Tracker = { mount, unmount };
