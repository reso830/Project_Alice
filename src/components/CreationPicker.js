// CreationPicker — selection overlay for "New Application".
// Manages the Add-application gate and routes Smart entry to the JD import flow.
// Module pattern mirrors Modal.js (module-level state, no class).

import { getAuthState, subscribe as subscribeAuth } from '../data/authStore.js';
import aiSparkle from '../assets/AI_sparkle.png';
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
  const { onApplicationCreate, onApplicationUpdate, onArchiveSuccess, profile } = callbacks;
  return { onApplicationCreate, onApplicationUpdate, onArchiveSuccess, profile };
}

function _isParserVisible() {
  return PARSER_VISIBLE_STATUSES.has(getAuthState()?.status);
}

function createAiSparkleIcon() {
  const icon = document.createElement('img');

  icon.src = aiSparkle;
  icon.alt = '';
  icon.setAttribute('aria-hidden', 'true');

  return icon;
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
  bullets = [],
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

  if (bullets.length > 0) {
    const list = document.createElement('ul');

    list.className = 'creation-picker-card__bullets';
    for (const bullet of bullets) {
      const item = document.createElement('li');
      item.textContent = bullet;
      list.append(item);
    }
    card.append(list);
  }

  if (cta) {
    const ctaEl = document.createElement('button');
    ctaEl.className = 'creation-picker-card__cta';
    ctaEl.type = 'button';
    ctaEl.textContent = cta;
    ctaEl.addEventListener('click', (event) => {
      event.stopPropagation();
      if (ctaOnClick) {
        ctaOnClick();
        return;
      }
      onClick();
    });
    card.append(ctaEl);
  }

  card.addEventListener('click', () => {
    if (!locked) {
      onClick();
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
  const header = _panel.querySelector('.creation-picker-header');
  const callbacks = _callbacks;
  const importRoot = JobPostingImport.create({
    navigate: _navigate,
    onBack: () => _showSelectionScreen(),
    onDismiss: close,
    onManual: _openManualCreate,
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
  _panel.classList.add('creation-picker-panel--smart-input');
  _panel.setAttribute('aria-labelledby', importRoot.querySelector('.job-posting-import__title')?.id || 'creation-picker-title');
  if (header) {
    header.hidden = true;
  }
  content.replaceChildren(importRoot);
  getFocusableElements(importRoot)[0]?.focus();
}

function _showSelectionScreen() {
  const content = _panel.querySelector('.creation-picker-content');
  const header = _panel.querySelector('.creation-picker-header');
  const aiReady = canUseJdParser();

  if (_activeImport && typeof _activeImport.destroy === 'function') {
    _activeImport.destroy();
  }
  _activeImport = null;
  _panel.classList.remove('creation-picker-panel--smart-input');
  _panel.setAttribute('aria-labelledby', 'creation-picker-title');
  if (header) {
    header.hidden = false;
  }
  const cards = document.createElement('div');
  cards.className = 'creation-picker-cards';

  const parserCard = _makeCard({
    icon: createAiSparkleIcon(),
    title: 'Smart entry',
    desc: "Paste a job posting and we'll fill in the details automatically.",
    extraClass: 'creation-picker-card--parser',
    badge: aiReady ? 'Fastest' : '',
    cta: aiReady ? 'Choose →' : 'Enable AI in Settings →',
    ctaOnClick: aiReady ? null : () => {
      const navigate = _navigate;
      close();
      navigate('profile', { focusSettings: true });
    },
    bullets: [
      'Pulls title, company, skills & more',
      'Review before saving',
    ],
    locked: !aiReady,
    onClick: () => _showSmartInput(),
  });

  const manualCard = _makeCard({
    icon: createSvgIcon('M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z'),
    title: 'Manual entry',
    desc: 'Type the details into the form, field by field.',
    cta: 'Choose →',
    bullets: [
      'Full control over every field',
      'No posting needed',
    ],
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
  const intro = document.createElement('div');
  const subtitleEl = document.createElement('p');
  titleEl.id = 'creation-picker-title';
  titleEl.className = 'creation-picker-title';
  titleEl.textContent = "Let's add this application";
  intro.className = 'creation-picker-intro';
  subtitleEl.className = 'creation-picker-subtitle';
  subtitleEl.textContent = 'Start from a job posting, or fill it in yourself. You can edit everything afterward.';
  intro.append(titleEl, subtitleEl);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'creation-picker-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.append(createSvgIcon('M6 6l12 12M18 6 6 18'));
  closeBtn.addEventListener('click', close);

  const content = document.createElement('div');
  content.className = 'creation-picker-content';

  header.append(intro, closeBtn);
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
