import { STATUS_CONFIG } from '../models/application.js';
import { dayOfWeekIso } from './calendar.js';
import { toISODate } from './date.js';

function parseISODate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(iso, count) {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + count);
  return toISODate(date);
}

function endOfIsoWeek(todayISO) {
  const today = parseISODate(todayISO);
  return addDays(todayISO, 6 - dayOfWeekIso(today));
}

function panelRowFromEntry(app, entry) {
  return {
    id: app.id,
    title: deriveActivityTitle(entry, app),
    company: app.companyName,
    role: app.jobTitle,
    date: entry.date,
  };
}

function sortPanelRows(rows) {
  return rows
    .sort((a, b) => {
      if (a.date !== b.date) {
        return a.date < b.date ? -1 : 1;
      }
      return a.id - b.id;
    })
    .map((row) => ({
      id: row.id,
      title: row.title,
      company: row.company,
      role: row.role,
    }));
}

export function deriveActivityTitle(entry, app) {
  const trimmed = (entry.text ?? '').trim();
  if (trimmed.length > 80) {
    return `${trimmed.slice(0, 77)}\u2026`;
  }
  if (trimmed.length > 0) {
    return trimmed;
  }

  const jobTitle = (app.jobTitle ?? '').trim();
  return STATUS_CONFIG[entry.status]?.label ?? (jobTitle || 'Activity');
}

export function projectTimelineToCalendar(apps) {
  const out = {};

  for (const app of apps) {
    if (!Array.isArray(app.timeline)) {
      continue;
    }

    for (const entry of app.timeline) {
      if (!out[entry.date]) {
        out[entry.date] = [];
      }

      out[entry.date].push({
        id: app.id,
        title: deriveActivityTitle(entry, app),
        company: app.companyName,
        jobTitle: app.jobTitle,
        status: entry.status,
      });
    }
  }

  return out;
}

export function todayRowsFor(apps, todayISO) {
  const rows = [];

  for (const app of apps) {
    if (!Array.isArray(app.timeline)) {
      continue;
    }

    for (const entry of app.timeline) {
      if (entry.date === todayISO) {
        rows.push(panelRowFromEntry(app, entry));
      }
    }
  }

  return sortPanelRows(rows);
}

export function upcomingRowsFor(apps, todayISO) {
  const tomorrowISO = addDays(todayISO, 1);
  const endOfWeekISO = endOfIsoWeek(todayISO);
  const tomorrow = [];
  const restOfWeek = [];

  for (const app of apps) {
    if (!Array.isArray(app.timeline)) {
      continue;
    }

    for (const entry of app.timeline) {
      if (entry.date === tomorrowISO) {
        tomorrow.push(panelRowFromEntry(app, entry));
      } else if (entry.date > tomorrowISO && entry.date <= endOfWeekISO) {
        restOfWeek.push(panelRowFromEntry(app, entry));
      }
    }
  }

  return {
    tomorrow: sortPanelRows(tomorrow),
    restOfWeek: sortPanelRows(restOfWeek),
  };
}
