import { toISODate } from './date.js';

export const YEAR_MIN = 2020;
export const YEAR_MAX = new Date().getFullYear() + 5;

const DAY_MS = 86_400_000;

function parseISODate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

function utcTimeFromISO(value) {
  const { year, month, day } = parseISODate(value);
  return Date.UTC(year, month - 1, day);
}

export function isoWeekNumber(year, month, day) {
  const d = new Date(Date.UTC(year, month, day));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / DAY_MS) + 1) / 7);
}

export function dayOfWeekIso(date) {
  return (date.getDay() + 6) % 7;
}

export function daysBetween(aISO, bISO) {
  const diff = Math.floor((utcTimeFromISO(bISO) - utcTimeFromISO(aISO)) / DAY_MS);
  return Math.max(0, diff);
}

export function businessDaysBetween(aISO, bISO) {
  if (daysBetween(aISO, bISO) === 0) {
    return 0;
  }

  let count = 0;
  const cursor = new Date(utcTimeFromISO(aISO));
  const end = utcTimeFromISO(bISO);

  while (cursor.getTime() < end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      count += 1;
    }
  }

  return count;
}

export function weeksInMonthGrid(viewYear, viewMonth) {
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const firstGridDate = new Date(viewYear, viewMonth, 1 - dayOfWeekIso(firstOfMonth));
  const weeks = [];

  for (let weekIndex = 0; weekIndex < 6; weekIndex += 1) {
    const week = [];
    const monday = new Date(
      firstGridDate.getFullYear(),
      firstGridDate.getMonth(),
      firstGridDate.getDate() + (weekIndex * 7),
    );
    const isoWeek = isoWeekNumber(monday.getFullYear(), monday.getMonth(), monday.getDate());

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = new Date(
        monday.getFullYear(),
        monday.getMonth(),
        monday.getDate() + dayIndex,
      );
      const isoDay = dayOfWeekIso(date);

      week.push({
        year: date.getFullYear(),
        month: date.getMonth(),
        day: date.getDate(),
        iso: toISODate(date),
        isoWeek,
        isCurrentMonth: date.getMonth() === viewMonth && date.getFullYear() === viewYear,
        isWeekend: isoDay >= 5,
        isToday: toISODate(date) === toISODate(),
      });
    }

    weeks.push(week);
  }

  return weeks;
}
