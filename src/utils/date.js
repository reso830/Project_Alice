export function toISODate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function isValidISODate(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return false;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(year, month - 1, day);

  return (
    parsed.getFullYear() === year
    && parsed.getMonth() === month - 1
    && parsed.getDate() === day
  );
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
