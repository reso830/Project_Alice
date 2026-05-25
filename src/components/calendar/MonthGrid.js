import {
  STATUS_CONFIG,
  STATUS_DISPLAY_PRIORITY,
} from '../../models/application.js';
import { weeksInMonthGrid, YEAR_MAX, YEAR_MIN } from '../../utils/calendar.js';

let _host = null;

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_VISIBLE_CHIPS = 3;

function list(value) {
  return Array.isArray(value) ? value : [];
}

function currentView() {
  const today = new Date();
  return {
    year: today.getFullYear(),
    month: today.getMonth(),
  };
}

function isCurrentView(viewYear, viewMonth) {
  const current = currentView();
  return current.year === viewYear && current.month === viewMonth;
}

function createText(className, text, tagName = 'span') {
  const node = document.createElement(tagName);
  node.className = className;
  node.textContent = text;
  return node;
}

function createButton(className, label, text, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-label', label);
  button.textContent = text;
  button.addEventListener('click', onClick);
  return button;
}

function createSvgIcon(pathData) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('width', '15');
  svg.setAttribute('height', '15');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  path.setAttribute('d', pathData);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);

  return svg;
}

function createNavButton(label, text, disabled, onClick) {
  const button = createButton('cal-nav-btn', label, text, onClick);
  button.disabled = disabled;
  return button;
}

function createTitle(props) {
  const title = document.createElement('div');
  const monthButton = createButton(
    'cal-month-btn',
    'Open month picker',
    MONTH_LABELS[props.viewMonth] ?? '',
    () => props.onOpenMonthPicker?.(title),
  );
  const yearButton = createButton(
    'cal-year-btn',
    'Open year picker',
    `${props.viewYear}`,
    () => props.onOpenYearPicker?.(title),
  );

  title.className = 'cal-title';
  title.append(monthButton, yearButton);
  return title;
}

function createFilterButton(props) {
  const area = document.createElement('div');
  const button = document.createElement('button');

  area.className = 'cal-filter-area';
  button.type = 'button';
  button.className = props.filter
    ? 'cal-status-filter-btn cal-status-filter-btn--active'
    : 'cal-status-filter-btn';
  button.setAttribute('aria-label', props.filter
    ? `Open status filter, ${STATUS_CONFIG[props.filter]?.label ?? props.filter} selected`
    : 'Open status filter');
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    props.onOpenFilter?.(button);
  });

  if (props.filter) {
    const config = STATUS_CONFIG[props.filter] ?? STATUS_CONFIG.wishlisted;
    const swatch = document.createElement('span');
    swatch.className = 'cal-status-filter-btn__swatch';
    swatch.setAttribute('aria-hidden', 'true');
    swatch.style.backgroundColor = config.borderAccent;
    button.append(swatch);

    const clear = createButton('cal-filter-clear', 'Clear status filter', '\u00d7', (event) => {
      event.stopPropagation();
      props.onClearFilter?.();
    });
    area.append(button, clear);
    return area;
  }

  area.append(button);
  button.append(createSvgIcon('M4 5h16l-6 7v5l-4 2v-7L4 5Z'));
  return area;
}

function createHeader(props) {
  const header = document.createElement('div');
  const prevDisabled = props.viewYear === YEAR_MIN && props.viewMonth === 0;
  const nextDisabled = props.viewYear === YEAR_MAX && props.viewMonth === 11;

  header.className = 'cal-grid-header';
  header.append(
    createNavButton('Previous month', '\u2039', prevDisabled, () => props.onNavigatePrev?.()),
    createTitle(props),
    createNavButton('Next month', '\u203a', nextDisabled, () => props.onNavigateNext?.()),
  );

  if (!isCurrentView(props.viewYear, props.viewMonth)) {
    header.append(createButton('cal-today-btn', 'Jump to current month', 'Today', () => props.onJumpToToday?.()));
  }

  header.append(createFilterButton(props));
  return header;
}

function createDowRow() {
  const row = document.createElement('div');
  const cw = createText('dow-cell dow-cell--cw', 'CW');
  row.className = 'dow-row';
  cw.setAttribute('aria-hidden', 'true');
  row.append(cw);
  for (const label of DOW_LABELS) {
    row.append(createText('dow-cell', label));
  }
  return row;
}

function activitiesFor(cell, props) {
  const all = list(props.dayActivities?.[cell.iso]);
  const visible = props.filter
    ? all.filter((activity) => activity.status === props.filter)
    : all;

  return { all, visible };
}

function groupedActivities(activities) {
  const byStatus = new Map();

  for (const activity of activities) {
    if (!byStatus.has(activity.status)) {
      byStatus.set(activity.status, []);
    }
    byStatus.get(activity.status).push(activity);
  }

  return STATUS_DISPLAY_PRIORITY
    .filter((status) => byStatus.has(status))
    .map((status) => ({
      status,
      activities: byStatus.get(status),
    }));
}

function selectDate(props, iso, anchor) {
  props.onSelectDate?.(iso, anchor);
}

function createChip(group, cell) {
  const config = STATUS_CONFIG[group.status] ?? STATUS_CONFIG.wishlisted;
  const count = group.activities.length;
  const label = `${count} ${config.label} ${count === 1 ? 'activity' : 'activities'} on ${cell.iso}`;
  const chip = document.createElement('span');

  chip.className = 'num-chip';
  chip.textContent = String(count);
  chip.title = label;
  chip.style.backgroundColor = config.borderAccent;
  chip.style.color = config.badgeText;

  return chip;
}

function createOverflowChip(count, cell) {
  const chip = document.createElement('span');
  const label = `${count} more ${count === 1 ? 'status' : 'statuses'} on ${cell.iso}`;

  chip.className = 'num-more';
  chip.textContent = `+${count}`;
  chip.title = label;

  return chip;
}

function createChipList(cell, props, visibleActivities) {
  const groups = groupedActivities(visibleActivities);
  const chipList = document.createElement('div');

  chipList.className = 'num-chip-list';

  for (const group of groups.slice(0, MAX_VISIBLE_CHIPS)) {
    chipList.append(createChip(group, cell));
  }

  if (groups.length > MAX_VISIBLE_CHIPS) {
    chipList.append(createOverflowChip(groups.length - MAX_VISIBLE_CHIPS, cell));
  }

  return chipList;
}

function createDayCell(cell, props) {
  const { all, visible } = activitiesFor(cell, props);
  const isFilteredHidden = Boolean(props.filter) && visible.length === 0;
  const chipActivities = isFilteredHidden ? all : visible;
  const day = document.createElement('div');
  const classNames = ['cal-cell'];

  if (!cell.isCurrentMonth) {
    classNames.push('cal-cell--out');
  }
  if (cell.isWeekend) {
    classNames.push('cal-cell--weekend');
  }
  if (cell.isToday) {
    classNames.push('cal-cell--today');
  }
  if (all.length > 0) {
    classNames.push('cal-cell--has-activities');
  }
  if (cell.iso === props.selectedDate) {
    classNames.push('cal-cell--selected');
  }
  if (isFilteredHidden) {
    classNames.push('cal-cell--filter-hidden');
  }

  day.className = classNames.join(' ');
  day.dataset.iso = cell.iso;
  day.append(createText('cal-num', String(cell.day)));

  if (cell.isCurrentMonth) {
    day.setAttribute('role', 'button');
    day.tabIndex = 0;
    day.setAttribute('aria-label', all.length > 0
      ? `${cell.iso}, ${all.length} ${all.length === 1 ? 'activity' : 'activities'}`
      : `${cell.iso}, no activity`);
    if (cell.iso === props.selectedDate) {
      day.setAttribute('aria-pressed', 'true');
    }
    day.addEventListener('click', () => selectDate(props, cell.iso, day));
    day.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectDate(props, cell.iso, day);
      }
    });
  }

  if (all.length > 0) {
    day.append(createChipList(cell, props, chipActivities));
  }

  return day;
}

function createCalendarGrid(props) {
  const grid = document.createElement('div');
  grid.className = 'cal-grid';

  for (const week of weeksInMonthGrid(props.viewYear, props.viewMonth)) {
    const cw = createText('cal-cw', String(week[0].isoWeek));
    cw.title = `Week ${week[0].isoWeek}, ${week[0].iso.slice(0, 4)}`;
    cw.setAttribute('aria-hidden', 'true');
    grid.append(cw);

    for (const cell of week) {
      grid.append(createDayCell(cell, props));
    }
  }

  return grid;
}

function render(container, props = {}) {
  destroy();

  _host = container;
  _host.replaceChildren();

  const root = document.createElement('div');
  root.className = 'cal-month-grid';
  root.append(
    createHeader(props),
    createDowRow(),
    createCalendarGrid(props),
  );

  _host.append(root);
}

function destroy() {
  if (_host) {
    _host.replaceChildren();
  }
  _host = null;
}

export const MonthGrid = { render, destroy };
