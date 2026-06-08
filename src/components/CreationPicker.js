// CreationPicker — selection overlay for "New Application".
// Manages the Add-application gate and routes Smart entry to the JD import flow.
// Module pattern mirrors Modal.js (module-level state, no class).

import { getAuthState, subscribe as subscribeAuth } from '../data/authStore.js';
import { canUseJdParser } from '../data/aiSettings.js';
import { createSvgIcon } from '../utils/icons.js';
import { JobPostingImport } from './JobPostingImport.js';
import { Modal } from './Modal.js';

let _backdrop = null;
let _panel = null;
let _keydownHandler = null;
let _callbacks = null;
let _unsubscribeAuth = null;
let _activeImport = null;
let _navigate = () => {};

const PARSER_VISIBLE_STATUSES = new Set(['local-mode', 'authenticated']);

function getFocusableElements(root) {
  return [...root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((el) => !el.disabled && el.offsetParent !== null);
}

function _modalCallbacks(callbacks = {}) {
  const { onApplicationCreate, onApplicationUpdate, onArchiveSuccess } = callbacks;
  return { onApplicationCreate, onApplicationUpdate, onArchiveSuccess };
}

function _isParserVisible() {
  return PARSER_VISIBLE_STATUSES.has(getAuthState()?.status);
}

function _makeCard({
  icon,
  title,
  desc,
  extraClass,
  onClick,
  badge = '',
  cta = '',
  ctaOnClick = null,
  locked = false,
}) {
  const card = document.createElement('div');
  const iconEl = document.createElement('div');
  const titleRow = document.createElement('div');
  const titleEl = document.createElement('p');
  const descEl = document.createElement('p');

  card.className = [
    'creation-picker-card',
    extraClass,
    locked ? 'creation-picker-card--locked' : '',
  ].filter(Boolean).join(' ');
  if (locked) {
    card.setAttribute('aria-disabled', 'true');
  } else {
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
  }
  iconEl.className = 'creation-picker-card__icon';
  titleRow.className = 'creation-picker-card__title-row';
  titleEl.className = 'creation-picker-card__title';
  descEl.className = 'creation-picker-card__desc';
  iconEl.append(icon);
  titleEl.textContent = title;
  descEl.textContent = desc;
  titleRow.append(titleEl);

  if (badge) {
    const badgeEl = document.createElement('span');
    badgeEl.className = 'creation-picker-card__badge';
    badgeEl.textContent = badge;
    titleRow.append(badgeEl);
  }

  card.append(iconEl, titleRow, descEl);

  if (cta) {
    const ctaEl = ctaOnClick ? document.createElement('button') : document.createElement('span');
    ctaEl.className = 'creation-picker-card__cta';
    ctaEl.textContent = cta;
    if (ctaOnClick) {
      ctaEl.type = 'button';
      ctaEl.addEventListener('click', (event) => {
        event.stopPropagation();
        ctaOnClick();
      });
    }
    card.append(ctaEl);
  }

  card.addEventListener('click', () => {
    if (!locked) {
      onClick();
    }
  });
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!locked) {
        onClick();
      }
    }
  });

  return card;
}

function _openManualCreate() {
  const callbacks = _callbacks;

  close();
  Modal.open(null, { mode: 'create', ..._modalCallbacks(callbacks) });
}

function _showSmartInput() {
  const content = _panel.querySelector('.creation-picker-content');
  const callbacks = _callbacks;
  const importRoot = JobPostingImport.create({
    navigate: _navigate,
    onBack: () => _showSelectionScreen(),
    onDismiss: close,
    onSuccess: ({ draft, aiFieldSet, fillSource, notice }) => {
      close();
      Modal.open(null, {
        mode: 'create',
        prefill: draft,
        aiFields: aiFieldSet,
        fillSource,
        notice,
        ..._modalCallbacks(callbacks),
      });
    },
  });

  _activeImport = importRoot;
  content.replaceChildren(importRoot);
  getFocusableElements(importRoot)[0]?.focus();
}

function _showSelectionScreen() {
  const content = _panel.querySelector('.creation-picker-content');
  const aiReady = canUseJdParser();

  if (_activeImport && typeof _activeImport.destroy === 'function') {
    _activeImport.destroy();
  }
  _activeImport = null;
  const cards = document.createElement('div');
  cards.className = 'creation-picker-cards';

  const parserCard = _makeCard({
    icon: createSvgIcon('M12 3l2 6.268L21 12l-7 2.732L12 21l-2-6.268L3 12l7-2.732z'),
    title: 'Smart entry',
    desc: "Paste a job posting and we'll fill in the details automatically.",
    extraClass: 'creation-picker-card--parser',
    badge: aiReady ? 'Fastest' : '',
    cta: aiReady ? 'Paste posting' : 'Enable AI in Settings ->',
    ctaOnClick: aiReady ? null : () => {
      const navigate = _navigate;
      close();
      navigate('profile', { focusSettings: true });
    },
    locked: !aiReady,
    onClick: () => _showSmartInput(),
  });

  const manualCard = _makeCard({
    icon: createSvgIcon('M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z'),
    title: 'Manual entry',
    desc: 'Type the details into the form, field by field.',
    cta: 'Open form',
    extraClass: '',
    onClick: _openManualCreate,
  });

  if (_isParserVisible()) {
    cards.append(parserCard);
  }
  cards.append(manualCard);
  content.replaceChildren(cards);
}

export function close() {
  if (_activeImport && typeof _activeImport.destroy === 'function') {
    _activeImport.destroy();
  }
  _activeImport = null;
  if (_backdrop) {
    _backdrop.remove();
    _backdrop = null;
  }
  if (_keydownHandler) {
    document.removeEventListener('keydown', _keydownHandler);
    _keydownHandler = null;
  }
  if (_unsubscribeAuth) {
    _unsubscribeAuth();
    _unsubscribeAuth = null;
  }
  _panel = null;
  _callbacks = null;
  _navigate = () => {};
}

/**
 * @param {{ onApplicationCreate?: Function, onApplicationUpdate?: Function, onArchiveSuccess?: Function }} [callbacks]
 */
export function open(callbacks) {
  close();

  _callbacks = callbacks ?? {};
  _navigate = typeof callbacks?.navigate === 'function' ? callbacks.navigate : () => {};

  const backdrop = document.createElement('div');
  backdrop.className = 'creation-picker-backdrop';

  const panel = document.createElement('div');
  panel.className = 'creation-picker-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'creation-picker-title');

  const header = document.createElement('div');
  header.className = 'creation-picker-header';

  const titleEl = document.createElement('h2');
  titleEl.id = 'creation-picker-title';
  titleEl.className = 'creation-picker-title';
  titleEl.textContent = "Let's add this application";

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'creation-picker-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.append(createSvgIcon('M6 6l12 12M18 6 6 18'));
  closeBtn.addEventListener('click', close);

  const content = document.createElement('div');
  content.className = 'creation-picker-content';

  header.append(titleEl, closeBtn);
  panel.append(header, content);
  backdrop.append(panel);
  document.body.append(backdrop);

  _backdrop = backdrop;
  _panel = panel;
  _unsubscribeAuth = subscribeAuth(() => {
    if (_panel) {
      _showSelectionScreen();
    }
  });

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });

  _keydownHandler = (event) => {
    if (event.key === 'Escape') {
      close();
      return;
    }

    if (event.key === 'Tab') {
      const focusable = getFocusableElements(panel);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };
  document.addEventListener('keydown', _keydownHandler);

  _showSelectionScreen();
  getFocusableElements(panel)[0]?.focus();
}

export const CreationPicker = { open, close };
