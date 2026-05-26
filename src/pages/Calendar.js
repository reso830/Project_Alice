import * as api from '../services/api.js';
import * as authStore from '../data/authStore.js';
import { Toast } from '../components/Toast.js';
import { Modal } from '../components/Modal.js';
import { ActionPanel } from '../components/calendar/ActionPanel.js';
import { MonthGrid } from '../components/calendar/MonthGrid.js';
import { DayPanel } from '../components/calendar/DayPanel.js';
import { MonthPicker } from '../components/calendar/MonthPicker.js';
import { YearPicker } from '../components/calendar/YearPicker.js';
import { mountStatusFilterPopup } from '../components/QuickFiltersStatusPopup.js';
import {
  projectTimelineToCalendar,
  todayRowsFor,
  upcomingRowsFor,
} from '../utils/calendarProjection.js';
import { evaluateSuggestions } from '../utils/calendarSuggestions.js';
import * as dismissals from '../utils/calendarDismissals.js';
import { YEAR_MAX, YEAR_MIN } from '../utils/calendar.js';
import { applyStatusChange } from '../models/application.js';
import { toISODate } from '../utils/date.js';

const POOLS = {
  morning: ['Good morning', 'Morning', 'Rise and shine', 'Bright and early'],
  afternoon: ['Good afternoon', 'Afternoon', 'Mid-day check-in'],
  evening: ['Good evening', 'Evening', 'Winding down'],
  lateNight: ['Burning the midnight oil?', 'Late night session', 'Night owl mode'],
};

const NEUTRAL = ['Here\'s what we have today', 'Today at a glance', 'Welcome back'];

let _container = null;
let _panelSlot = null;
let _gridSlot = null;
let _applications = [];
let _viewYear = null;
let _viewMonth = null;
let _filter = null;
let _greeting = '';
let _dateLabel = '';
let _dismissals = [];
let _selectedDate = null;
let _dayActivities = {};
let _activeOverlay = null;
let _statusFilterPopup = null;
let _mountId = 0;

export function chooseGreeting(date, randomFn = Math.random) {
  const hour = date.getHours();
  let pool;

  if (hour >= 5 && hour <= 11) {
    pool = POOLS.morning;
  } else if (hour >= 12 && hour <= 16) {
    pool = POOLS.afternoon;
  } else if (hour >= 17 && hour <= 21) {
    pool = POOLS.evening;
  } else {
    pool = POOLS.lateNight;
  }

  const merged = [...pool, ...NEUTRAL];
  return merged[Math.floor(randomFn() * merged.length)];
}

export function formatGreeting(greeting, name = '') {
  const cleanName = String(name ?? '').trim();
  if (!cleanName) {
    return greeting;
  }

  if (/[?!]$/.test(greeting)) {
    return `${greeting.slice(0, -1)}, ${cleanName}${greeting.at(-1)}`;
  }

  return `${greeting}, ${cleanName}`;
}

export function formatDateLabel(date) {
  const day = date.toLocaleDateString('en-US', { weekday: 'short' });
  const rest = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${day} \u00b7 ${rest}`;
}

function closeOverlays() {
  MonthPicker.close();
  YearPicker.close();
  _statusFilterPopup?.close();
  _statusFilterPopup = null;
  _activeOverlay = null;
}

function toggleOverlay(kind) {
  if (_activeOverlay === kind) {
    closeOverlays();
    return false;
  }

  closeOverlays();
  _activeOverlay = kind;
  return true;
}

function padId(id) {
  return String(id).padStart(3, '0');
}

function clampView(year, month) {
  if (year < YEAR_MIN) {
    return { year: YEAR_MIN, month: 0 };
  }
  if (year > YEAR_MAX) {
    return { year: YEAR_MAX, month: 11 };
  }
  return { year, month };
}

function setView(year, month) {
  const next = clampView(year, month);
  _viewYear = next.year;
  _viewMonth = next.month;
}

function monthDelta(delta) {
  const date = new Date(_viewYear, _viewMonth + delta, 1);
  setView(date.getFullYear(), date.getMonth());
  _render();
}

function currentAuthState() {
  return authStore.getAuthState();
}

function profileName(profile, authState = currentAuthState()) {
  const profileFirst = String(profile?.firstName ?? '').trim();
  if (profileFirst) {
    return profileFirst;
  }

  const meta = authState?.user?.user_metadata ?? authState?.user?.userMetadata ?? {};
  return String(meta.firstName ?? meta.first_name ?? meta.name ?? meta.full_name ?? '').trim().split(/\s+/)[0] ?? '';
}

function isCurrentMount(mountId) {
  return _container !== null && _mountId === mountId;
}

function createShell() {
  const page = document.createElement('div');
  _panelSlot = document.createElement('section');
  _gridSlot = document.createElement('section');

  page.className = 'calendar-page';
  _panelSlot.className = 'calendar-page__panel';
  _gridSlot.className = 'calendar-page__grid';
  _panelSlot.textContent = 'Loading\u2026';
  _gridSlot.textContent = 'Loading\u2026';

  page.append(_panelSlot, _gridSlot);
  _container.append(page);
}

function _render() {
  if (!_panelSlot || !_gridSlot) {
    return;
  }

  const todayISO = toISODate();
  _dayActivities = projectTimelineToCalendar(_applications);
  const today = todayRowsFor(_applications, todayISO);
  const upcoming = upcomingRowsFor(_applications, todayISO);
  const suggestions = evaluateSuggestions(_applications, todayISO, _dismissals);

  ActionPanel.render(_panelSlot, {
    greeting: _greeting,
    todayISO,
    dateLabel: _dateLabel,
    today,
    suggestions,
    upcoming,
    onOpenApp: _onOpenApp,
    onDismiss: _onDismiss,
    onMarkGhosted: _onMarkGhosted,
  });

  MonthGrid.render(_gridSlot, {
    viewYear: _viewYear,
    viewMonth: _viewMonth,
    dayActivities: _dayActivities,
    filter: _filter,
    selectedDate: _selectedDate,
    onNavigatePrev: () => monthDelta(-1),
    onNavigateNext: () => monthDelta(1),
    onJumpToToday: () => {
      const todayDate = new Date();
      setView(todayDate.getFullYear(), todayDate.getMonth());
      _render();
    },
    onOpenMonthPicker: _onOpenMonthPicker,
    onOpenYearPicker: _onOpenYearPicker,
    onOpenFilter: _onOpenFilter,
    onClearFilter: () => {
      _filter = null;
      _render();
    },
    onSelectDate: _onSelectDate,
  });

  DayPanel.render(_gridSlot, {
    selectedDate: _selectedDate,
    activities: _selectedDate ? (_dayActivities[_selectedDate] ?? []) : [],
    todayISO,
    onOpenApp: _onOpenApp,
  });
}

function syncSelectedCell() {
  if (!_gridSlot) {
    return;
  }

  for (const node of _gridSlot.querySelectorAll('.cal-cell--selected')) {
    node.classList.remove('cal-cell--selected');
    node.removeAttribute('aria-pressed');
  }

  if (!_selectedDate) {
    return;
  }

  const selected = _gridSlot.querySelector(`.cal-cell[data-iso="${_selectedDate}"]`);
  if (selected?.getAttribute('role') === 'button') {
    selected.classList.add('cal-cell--selected');
    selected.setAttribute('aria-pressed', 'true');
  }
}

function _onOpenMonthPicker(anchor) {
  if (!toggleOverlay('month')) {
    return;
  }

  MonthPicker.open({
    anchor,
    viewYear: _viewYear,
    viewMonth: _viewMonth,
    onSelect: (monthIndex) => {
      _viewMonth = monthIndex;
      _render();
    },
    onClose: () => {
      MonthPicker.close();
      _activeOverlay = null;
    },
  });
}

function _onOpenYearPicker(anchor) {
  if (!toggleOverlay('year')) {
    return;
  }

  YearPicker.open({
    anchor,
    viewYear: _viewYear,
    onSelect: (year) => {
      _viewYear = year;
      _render();
    },
    onClose: () => {
      YearPicker.close();
      _activeOverlay = null;
    },
  });
}

function _onOpenFilter(anchor) {
  if (!toggleOverlay('filter')) {
    return;
  }

  _statusFilterPopup = mountStatusFilterPopup({
    anchor,
    value: _filter,
    onSelect: (status) => {
      _filter = status;
      _render();
    },
    onClose: () => {
      _statusFilterPopup = null;
      _activeOverlay = null;
    },
  });
}

function _onSelectDate(selectedDate) {
  _selectedDate = selectedDate;
  syncSelectedCell();
  DayPanel.update({
    selectedDate,
    activities: _dayActivities[selectedDate] ?? [],
    todayISO: toISODate(),
  });
}

async function _onMarkGhosted(applicationId) {
  const mountId = _mountId;
  const app = _applications.find((item) => item.id === applicationId);
  if (!app) {
    console.warn(`Calendar: missing application ${applicationId}`);
    return;
  }

  const next = applyStatusChange(app, 'ghosted', {
    text: 'Marked as ghosted after prolonged inactivity.',
  });

  try {
    const updated = await api.update(applicationId, {
      status: next.status,
      lastStatusUpdate: next.lastStatusUpdate,
      timeline: next.timeline,
    });
    if (!isCurrentMount(mountId)) {
      return;
    }
    _applications = _applications.map((item) => (item.id === applicationId ? updated : item));
    _render();
    Toast.show(`Marked #${padId(applicationId)} as Ghosted`, 'success');
  } catch {
    if (isCurrentMount(mountId)) {
      Toast.show('Could not mark as ghosted', 'failure');
    }
  }
}

function _onDismiss(applicationId, kind) {
  const authState = currentAuthState();
  dismissals.add(authState, applicationId, kind);
  _dismissals = dismissals.load(authState);
  _render();
  Toast.show('Suggestion dismissed', 'success');
}

async function _onOpenApp(applicationId) {
  const mountId = _mountId;
  closeOverlays();
  _activeOverlay = null;

  let application;
  try {
    application = await api.getById(applicationId);
  } catch {
    if (isCurrentMount(mountId)) {
      Toast.show('Application details failed to load', 'failure');
    }
    return;
  }

  if (!isCurrentMount(mountId)) {
    return;
  }

  Modal.open(application, {
    onApplicationUpdate: (updated) => {
      _applications = _applications.map((item) => (item.id === updated.id ? updated : item));
      _render();
    },
    onArchiveSuccess: (updated) => {
      _applications = _applications.filter((item) => item.id !== updated.id);
      _render();
    },
  });
}

export async function mount(container) {
  unmount();

  const today = new Date();
  _container = container;
  _mountId += 1;
  const mountId = _mountId;
  _applications = [];
  _viewYear = today.getFullYear();
  _viewMonth = today.getMonth();
  _filter = null;
  _selectedDate = null;
  _greeting = chooseGreeting(today);
  _dateLabel = formatDateLabel(today);
  _dismissals = [];
  _dayActivities = {};
  _container.replaceChildren();
  createShell();

  try {
    const [applications, profile] = await Promise.all([
      api.getAll(),
      api.getProfile().catch(() => null),
    ]);
    if (!isCurrentMount(mountId)) {
      return;
    }
    _applications = applications;
    _greeting = formatGreeting(_greeting, profileName(profile));
    _dismissals = dismissals.load(currentAuthState());
  } catch {
    if (!isCurrentMount(mountId)) {
      return;
    }
    _applications = [];
    _dismissals = [];
    Toast.show('Could not load calendar', 'failure');
  }

  if (!isCurrentMount(mountId)) {
    return;
  }

  _render();
}

export function unmount() {
  _mountId += 1;
  ActionPanel.destroy();
  MonthGrid.destroy();
  DayPanel.destroy();
  closeOverlays();

  if (_container) {
    _container.replaceChildren();
  }

  _container = null;
  _panelSlot = null;
  _gridSlot = null;
  _applications = [];
  _filter = null;
  _greeting = '';
  _dateLabel = '';
  _dismissals = [];
  _selectedDate = null;
  _dayActivities = {};
  _statusFilterPopup = null;
  _activeOverlay = null;
}

export const Calendar = { mount, unmount };
