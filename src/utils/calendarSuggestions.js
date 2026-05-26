import { TERMINAL_STATES } from '../models/application.js';
import { businessDaysBetween, daysBetween } from './calendar.js';

export const OFFER_WINDOW_DAYS = 5;
export const OFFER_NEAR_EXPIRY_DAYS = 3;
export const GHOST_RULE_STATUSES = Object.freeze([
  'applied',
  'phone_screen',
  'interview',
  'assessment',
  'offer',
]);

const KIND_PRIORITY = {
  ghost: 0,
  offer_expiry: 1,
  interview_followup: 2,
  feedback: 3,
  followup: 4,
};

function latestTimelineEntry(timeline) {
  if (!Array.isArray(timeline) || timeline.length === 0) {
    return null;
  }

  return [...timeline].sort((a, b) => {
    if (a.date !== b.date) {
      return a.date < b.date ? 1 : -1;
    }
    return b.id - a.id;
  })[0];
}

function latestEntryByStatus(timeline, status) {
  return latestTimelineEntry((Array.isArray(timeline) ? timeline : [])
    .filter((entry) => entry.status === status));
}

function hasFutureEntry(timeline, todayISO) {
  return Array.isArray(timeline) && timeline.some((entry) => entry.date > todayISO);
}

function isDismissed(dismissals, appId, kind) {
  return dismissals.some((dismissal) => dismissal.appId === appId && dismissal.kind === kind);
}

function prettyDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function ruleFollowup(app, todayISO) {
  const latest = latestTimelineEntry(app.timeline);
  if (!latest || latest.status !== 'applied') {
    return null;
  }

  const age = daysBetween(latest.date, todayISO);
  if (age < 7) {
    return null;
  }

  return {
    id: app.id,
    kind: 'followup',
    title: 'Follow up with recruiter?',
    meta: `${age}d since application`,
    primary: 'open',
  };
}

export function ruleFeedback(app, todayISO) {
  const latest = latestTimelineEntry(app.timeline);
  if (!latest || latest.status !== 'phone_screen') {
    return null;
  }

  const age = businessDaysBetween(latest.date, todayISO);
  if (age < 5) {
    return null;
  }

  return {
    id: app.id,
    kind: 'feedback',
    title: 'Check interview feedback status?',
    meta: `${age} business days since phone screen`,
    primary: 'open',
  };
}

export function ruleInterviewFollowup(app, todayISO) {
  const latest = latestTimelineEntry(app.timeline);
  if (!latest || latest.status !== 'interview') {
    return null;
  }

  const age = daysBetween(latest.date, todayISO);
  if (age < 7) {
    return null;
  }

  return {
    id: app.id,
    kind: 'interview_followup',
    title: 'Consider sending a follow-up message',
    meta: `${age}d since interview`,
    primary: 'open',
  };
}

export function ruleOfferExpiry(app, todayISO) {
  if (app.status !== 'offer') {
    return null;
  }

  const offerEntry = latestEntryByStatus(app.timeline, 'offer');
  if (!offerEntry) {
    return null;
  }

  const age = daysBetween(offerEntry.date, todayISO);
  if (age < OFFER_NEAR_EXPIRY_DAYS || age > OFFER_WINDOW_DAYS) {
    return null;
  }

  return {
    id: app.id,
    kind: 'offer_expiry',
    title: 'Offer response may be needed soon',
    meta: `Offer extended ${age}d ago`,
    primary: 'open',
  };
}

export function ruleGhost(app, todayISO) {
  if (!GHOST_RULE_STATUSES.includes(app.status) || hasFutureEntry(app.timeline, todayISO)) {
    return null;
  }

  const latest = latestTimelineEntry(app.timeline);
  if (!latest) {
    return null;
  }

  const age = daysBetween(latest.date, todayISO);
  if (age < 14) {
    return null;
  }

  return {
    id: app.id,
    kind: 'ghost',
    title: 'No updates for 14 days. Mark as Ghosted?',
    meta: `${age}d \u00b7 last touched ${prettyDate(latest.date)}`,
    primary: 'mark_ghosted',
  };
}

export function evaluateSuggestions(apps, todayISO, dismissals) {
  const suggestions = [];

  for (const app of apps) {
    if (TERMINAL_STATES.has(app.status) || hasFutureEntry(app.timeline, todayISO)) {
      continue;
    }

    for (const suggestion of [
      ruleFollowup(app, todayISO),
      ruleFeedback(app, todayISO),
      ruleInterviewFollowup(app, todayISO),
      ruleOfferExpiry(app, todayISO),
      ruleGhost(app, todayISO),
    ]) {
      if (suggestion && !isDismissed(dismissals, app.id, suggestion.kind)) {
        suggestions.push(suggestion);
      }
    }
  }

  return suggestions.sort((a, b) => {
    if (a.id !== b.id) {
      return a.id - b.id;
    }
    return KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind];
  });
}
