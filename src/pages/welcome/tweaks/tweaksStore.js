// Tweaks store — design/welcome_page.md §5
//
// Module-level pub/sub mirroring `src/data/authStore.js`. Holds the five
// welcome-page tweaks (layout, theme, copyIntensity, authState, heroScene),
// reads optional overrides from `window.location.search` at `init()`, and
// notifies subscribers on `setTweak`. No persistence (no localStorage / no
// cookies — see Task 16.2 constraint).

const TWEAK_DEFAULTS = Object.freeze({
  layout: 'diagonal',
  theme: 'warm',
  copyIntensity: 'none',
  authState: 'signin',
  heroScene: 'auto',
});

const ALLOWED = Object.freeze({
  layout: ['diagonal', 'split', 'centered', 'hero'],
  theme: ['warm', 'white', 'navy'],
  copyIntensity: ['none', 'minimal', 'pitch'],
  authState: ['signin', 'signup'],
  heroScene: ['auto', 'stack', 'pipeline', 'profile', 'logo'],
});

let _state = { ...TWEAK_DEFAULTS };
let _initialized = false;
const _subscribers = new Set();

function readParams(search) {
  if (typeof search !== 'string') return new globalThis.URLSearchParams();
  const trimmed = search.startsWith('?') ? search.slice(1) : search;
  return new globalThis.URLSearchParams(trimmed);
}

function applyOverlay(search) {
  const params = readParams(search);
  const next = { ...TWEAK_DEFAULTS };
  Object.keys(TWEAK_DEFAULTS).forEach((key) => {
    if (!params.has(key)) return;
    const value = params.get(key);
    if (ALLOWED[key].includes(value)) next[key] = value;
  });
  return next;
}

function notify() {
  const snapshot = { ..._state };
  for (const fn of _subscribers) {
    try {
      fn(snapshot);
    } catch {
      // best-effort: a misbehaving subscriber must not block others.
    }
  }
}

export function init({ search } = {}) {
  let s = '';
  if (typeof search === 'string') {
    s = search;
  } else if (typeof globalThis.location !== 'undefined' && globalThis.location?.search) {
    s = globalThis.location.search;
  }
  _state = applyOverlay(s);
  _initialized = true;
  notify();
}

export function getTweaks() {
  if (!_initialized) init();
  return { ..._state };
}

export function setTweak(key, value) {
  if (!_initialized) init();
  if (!Object.prototype.hasOwnProperty.call(TWEAK_DEFAULTS, key)) return false;
  if (!ALLOWED[key].includes(value)) return false;
  if (_state[key] === value) return true;
  _state = { ..._state, [key]: value };
  notify();
  return true;
}

export function subscribe(fn) {
  if (typeof fn !== 'function') return () => {};
  _subscribers.add(fn);
  return () => _subscribers.delete(fn);
}

// Test-only reset. Not part of the public API but exported so test setup
// can return the module to a known state without juggling `vi.resetModules`.
export function _resetForTests() {
  _state = { ...TWEAK_DEFAULTS };
  _initialized = false;
  _subscribers.clear();
}

export const TWEAK_KEYS = Object.freeze(Object.keys(TWEAK_DEFAULTS));
export const TWEAK_ALLOWED = ALLOWED;
export { TWEAK_DEFAULTS };
