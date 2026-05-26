import { toISODate } from './date.js';

const KEY_PREFIX = 'alice:calendar:dismissals:';
const _memoryFallback = new Map();
let _warned = false;

function tokenFor(authState) {
  if (authState?.status === 'authenticated' && authState.user?.id) {
    return authState.user.id;
  }
  if (authState?.status === 'demo') {
    return 'demo';
  }
  return 'local';
}

function keyFor(authState) {
  return `${KEY_PREFIX}${tokenFor(authState)}`;
}

function isDemoSession(authState) {
  return authState?.status === 'demo';
}

function warnOnce() {
  if (!_warned) {
    console.warn('Calendar dismissals: localStorage unavailable; suggestions will reappear next session.');
    _warned = true;
  }
}

function replaceDismissal(list, appId, kind) {
  return [
    ...list.filter((dismissal) => !(dismissal.appId === appId && dismissal.kind === kind)),
    { appId, kind, dismissedAt: toISODate() },
  ];
}

export function load(authState) {
  const key = keyFor(authState);

  if (isDemoSession(authState)) {
    return _memoryFallback.get(key) ?? [];
  }

  try {
    const value = localStorage.getItem(key);
    if (value === null) {
      return _memoryFallback.get(key) ?? [];
    }

    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : (_memoryFallback.get(key) ?? []);
  } catch {
    warnOnce();
    return _memoryFallback.get(key) ?? [];
  }
}

export function add(authState, appId, kind) {
  const key = keyFor(authState);
  const current = isDemoSession(authState)
    ? (_memoryFallback.get(key) ?? [])
    : load(authState);
  const next = replaceDismissal(current, appId, kind);
  _memoryFallback.set(key, next);

  if (isDemoSession(authState)) {
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    warnOnce();
  }
}

export function isDismissed(list, appId, kind) {
  return list.some((dismissal) => dismissal.appId === appId && dismissal.kind === kind);
}

export function _resetForTesting() {
  _warned = false;
  _memoryFallback.clear();
}
