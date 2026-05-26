export { isValidISODate } from '../../shared/util/date.js';
import { isValidISODate } from '../../shared/util/date.js';

export function toISODate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function toDisplayDate(isoString) {
  if (!isValidISODate(isoString)) {
    return '—';
  }

  const [yearText, monthText, dayText] = isoString.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);
  const monthName = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date);
  const display = `${monthName} ${day}`;

  if (year === new Date().getFullYear()) {
    return display;
  }

  return `${display}, ${year}`;
}
