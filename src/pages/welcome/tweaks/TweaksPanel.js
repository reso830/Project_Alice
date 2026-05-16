// Tweaks panel — design/welcome_page.md §5
//
// Floating control panel anchored top-right of the viewport. A `◆` toggle
// button opens a small panel with one labeled select per tweak key. Each
// select reflects `tweaksStore.getTweaks()` and calls `setTweak(key, value)`
// on change. ESC and outside-click close the panel.
// Hidden entirely at `<760px` (mobile) per design constraint.

import * as defaultTweaksStore from './tweaksStore.js';
import { TWEAK_KEYS, TWEAK_ALLOWED } from './tweaksStore.js';

const FIELD_LABELS = Object.freeze({
  layout: 'Layout',
  theme: 'Theme',
  copyIntensity: 'Copy',
  authState: 'Auth state',
  heroScene: 'Hero scene',
});

let _state = null;

function prefersMobile() {
  if (typeof globalThis.matchMedia !== 'function') return false;
  try {
    return globalThis.matchMedia('(max-width: 759px)').matches === true;
  } catch {
    return false;
  }
}

function buildSelect(key, value, onChange) {
  const wrap = document.createElement('label');
  wrap.className = 'tweaks-panel__field';
  wrap.dataset.tweakField = key;

  const labelText = document.createElement('span');
  labelText.className = 'tweaks-panel__label';
  labelText.textContent = FIELD_LABELS[key] ?? key;

  const select = document.createElement('select');
  select.className = 'tweaks-panel__select';
  select.name = key;
  select.dataset.tweakKey = key;
  TWEAK_ALLOWED[key].forEach((opt) => {
    const option = document.createElement('option');
    option.value = opt;
    option.textContent = opt;
    if (opt === value) option.selected = true;
    select.append(option);
  });
  select.addEventListener('change', (event) => {
    onChange(key, event.target.value);
  });

  wrap.append(labelText, select);
  return { wrap, select };
}

function setOpen(state, open) {
  state.open = open;
  if (open) {
    state.panel.hidden = false;
    state.toggle.setAttribute('aria-expanded', 'true');
  } else {
    state.panel.hidden = true;
    state.toggle.setAttribute('aria-expanded', 'false');
  }
}

function syncSelects(state, snapshot) {
  state.selects.forEach((select, key) => {
    if (select.value !== snapshot[key]) {
      select.value = snapshot[key];
    }
  });
}

export function mount(container, { tweaksStore } = {}) {
  unmount();
  if (prefersMobile()) {
    _state = { mobile: true };
    return;
  }

  const store = tweaksStore ?? defaultTweaksStore;
  const root = document.createElement('div');
  root.className = 'tweaks-panel';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'tweaks-panel__toggle';
  toggle.setAttribute('aria-label', 'Open Tweaks panel');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.textContent = '◆';

  const panel = document.createElement('div');
  panel.className = 'tweaks-panel__body';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Tweaks');
  panel.hidden = true;

  const snapshot = store.getTweaks();
  const selects = new Map();
  TWEAK_KEYS.forEach((key) => {
    const { wrap, select } = buildSelect(key, snapshot[key], (k, v) => {
      store.setTweak(k, v);
    });
    selects.set(key, select);
    panel.append(wrap);
  });

  const state = {
    mobile: false,
    root,
    toggle,
    panel,
    selects,
    open: false,
    unsubscribe: null,
    onDocClick: null,
    onKeyDown: null,
  };

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen(state, !state.open);
  });

  state.onDocClick = (event) => {
    if (!state.open) return;
    if (root.contains(event.target)) return;
    setOpen(state, false);
  };
  state.onKeyDown = (event) => {
    if (event.key === 'Escape' && state.open) {
      setOpen(state, false);
    }
  };
  document.addEventListener('click', state.onDocClick);
  document.addEventListener('keydown', state.onKeyDown);

  state.unsubscribe = store.subscribe((next) => syncSelects(state, next));

  root.append(toggle, panel);
  container.append(root);
  _state = state;
}

export function unmount() {
  if (!_state) return;
  if (_state.unsubscribe) _state.unsubscribe();
  if (_state.onDocClick) document.removeEventListener('click', _state.onDocClick);
  if (_state.onKeyDown) document.removeEventListener('keydown', _state.onKeyDown);
  if (_state.root) _state.root.remove();
  _state = null;
}

export const TweaksPanel = { mount, unmount };
