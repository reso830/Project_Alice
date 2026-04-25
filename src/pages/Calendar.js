import { store } from '../data/store.js';

let _container = null;

function getCurrentMonthMarkerDays(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}-`;

  return new Set(
    store.getAll()
      .filter((application) => application.last_status_update?.startsWith(monthPrefix))
      .map((application) => Number(application.last_status_update.slice(8, 10))),
  );
}

function renderDayCell(day, markerDays) {
  const cell = document.createElement('div');
  const dayNumber = document.createElement('span');

  cell.className = 'day-cell';
  dayNumber.className = 'day-number';
  dayNumber.textContent = String(day);
  cell.append(dayNumber);

  if (markerDays.has(day)) {
    const marker = document.createElement('span');
    marker.className = 'day-dot';
    cell.append(marker);
  }

  return cell;
}

function renderEmptyCell() {
  const cell = document.createElement('div');
  cell.className = 'day-cell day-cell--empty';
  return cell;
}

export function mount(container) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const markerDays = getCurrentMonthMarkerDays(today);
  const page = document.createElement('div');
  const heading = document.createElement('h1');
  const grid = document.createElement('div');
  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(today);

  _container = container;
  _container.replaceChildren();

  page.className = 'calendar-page';
  heading.className = 'calendar-page__heading';
  heading.textContent = `${monthName} ${year}`;
  grid.className = 'month-grid';

  for (let index = 0; index < firstWeekday; index += 1) {
    grid.append(renderEmptyCell());
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    grid.append(renderDayCell(day, markerDays));
  }

  page.append(heading, grid);
  _container.append(page);
}

export function unmount() {
  if (_container) {
    _container.replaceChildren();
  }

  _container = null;
}

export const Calendar = { mount, unmount };
