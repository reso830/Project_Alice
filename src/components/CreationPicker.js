// CreationPicker — selection overlay for "New Application".
// Manages two views: selection screen (Smart Parser vs Manual Entry) and paste step.
// Module pattern mirrors Modal.js (module-level state, no class).

import { parseJobPost } from '../utils/jobPostParser.js';
import { createSvgIcon } from '../utils/icons.js';
import { Modal } from './Modal.js';

let _backdrop = null;
let _panel = null;
let _keydownHandler = null;
let _callbacks = null;

function getFocusableElements(root) {
  return [...root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((el) => !el.disabled && el.offsetParent !== null);
}

function _modalCallbacks(callbacks = {}) {
  const { onApplicationCreate, onApplicationUpdate, onArchiveSuccess } = callbacks;
  return { onApplicationCreate, onApplicationUpdate, onArchiveSuccess };
}

function _showErrorState(savedText, callbacks) {
  const content = _panel.querySelector('.creation-picker-content');

  const errorView = document.createElement('div');
  errorView.className = 'parser-error';

  const message = document.createElement('p');
  message.className = 'parser-error__message';
  message.textContent = 'Unable to extract application details. Please review the pasted content or enter details manually.';

  const actions = document.createElement('div');
  actions.className = 'parser-error__actions';

  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.textContent = 'Retry';
  retryBtn.addEventListener('click', () => _showPasteStep(savedText));

  const manualBtn = document.createElement('button');
  manualBtn.type = 'button';
  manualBtn.textContent = 'Enter manually';
  manualBtn.addEventListener('click', () => {
    close();
    Modal.open(null, { mode: 'create', ..._modalCallbacks(callbacks) });
  });

  actions.append(retryBtn, manualBtn);
  errorView.append(message, actions);
  content.replaceChildren(errorView);
  getFocusableElements(errorView)[0]?.focus();
}

function _runParser(textarea, processBtn, loading) {
  processBtn.disabled = true;
  textarea.disabled = true;
  loading.hidden = false;

  const parsed = parseJobPost(textarea.value);
  const hasFields = Boolean(
    parsed.companyName
    || parsed.jobTitle
    || parsed.location
    || parsed.responsibilities
    || parsed.recruiter
    || parsed.jobPostingUrl
    || (parsed.salary !== null && parsed.salary !== undefined)
    || parsed.workSetup
    || parsed.shift
    || (Array.isArray(parsed.skills) && parsed.skills.length > 0)
    || (Array.isArray(parsed.preferredSkills) && parsed.preferredSkills.length > 0),
  );

  if (!hasFields) {
    loading.hidden = true;
    _showErrorState(textarea.value, _callbacks);
    return;
  }

  const callbacks = _callbacks;
  close();
  Modal.open(null, { mode: 'create', prefill: parsed, ..._modalCallbacks(callbacks) });
}

function _showPasteStep(initialValue = '') {
  const content = _panel.querySelector('.creation-picker-content');

  const step = document.createElement('div');
  step.className = 'parser-step';

  const textarea = document.createElement('textarea');
  textarea.className = 'parser-textarea';
  textarea.setAttribute('aria-label', 'Paste job posting text');
  textarea.setAttribute('placeholder', 'Paste the job posting text here…');
  textarea.value = initialValue;

  const loading = document.createElement('div');
  loading.className = 'parser-loading';
  loading.textContent = 'Analyzing job post…';
  loading.hidden = true;

  const processBtn = document.createElement('button');
  processBtn.type = 'button';
  processBtn.className = 'parser-process-btn';
  processBtn.textContent = 'Process';
  processBtn.disabled = initialValue.trim().length < 20;

  textarea.addEventListener('input', () => {
    processBtn.disabled = textarea.value.trim().length < 20;
  });

  textarea.addEventListener('paste', () => {
    setTimeout(() => {
      processBtn.disabled = textarea.value.trim().length < 20;
    }, 0);
  });

  processBtn.addEventListener('click', () => {
    _runParser(textarea, processBtn, loading);
  });

  step.append(textarea, loading, processBtn);
  content.replaceChildren(step);
  textarea.focus();
}

function _makeCard({ icon, title, desc, extraClass, onClick }) {
  const card = document.createElement('div');
  const iconEl = document.createElement('div');
  const titleEl = document.createElement('p');
  const descEl = document.createElement('p');

  card.className = ['creation-picker-card', extraClass].filter(Boolean).join(' ');
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  iconEl.className = 'creation-picker-card__icon';
  titleEl.className = 'creation-picker-card__title';
  descEl.className = 'creation-picker-card__desc';
  iconEl.append(icon);
  titleEl.textContent = title;
  descEl.textContent = desc;
  card.append(iconEl, titleEl, descEl);

  card.addEventListener('click', onClick);
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  });

  return card;
}

function _showSelectionScreen() {
  const content = _panel.querySelector('.creation-picker-content');

  const cards = document.createElement('div');
  cards.className = 'creation-picker-cards';

  const parserCard = _makeCard({
    icon: createSvgIcon('M12 3l2 6.268L21 12l-7 2.732L12 21l-2-6.268L3 12l7-2.732z'),
    title: 'Smart Parser',
    desc: 'Paste the job post and the app will parse it for you',
    extraClass: 'creation-picker-card--parser',
    onClick: () => _showPasteStep(),
  });

  const parserNote = document.createElement('p');
  parserNote.className = 'creation-picker-card__note';
  parserNote.textContent = 'Experimental — results may vary.';
  parserCard.append(parserNote);

  const manualCard = _makeCard({
    icon: createSvgIcon('M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z'),
    title: 'Manual Entry',
    desc: 'Enter application details manually instead',
    extraClass: '',
    onClick: () => {
      const callbacks = _callbacks;
      close();
      Modal.open(null, { mode: 'create', ..._modalCallbacks(callbacks) });
    },
  });

  cards.append(parserCard, manualCard);
  content.replaceChildren(cards);
}

export function close() {
  if (_backdrop) {
    _backdrop.remove();
    _backdrop = null;
  }
  if (_keydownHandler) {
    document.removeEventListener('keydown', _keydownHandler);
    _keydownHandler = null;
  }
  _panel = null;
  _callbacks = null;
}

/**
 * @param {{ onApplicationCreate: Function, onApplicationUpdate: Function, onArchiveSuccess: Function }} callbacks
 */
export function open(callbacks) {
  close();

  _callbacks = callbacks ?? {};

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
  titleEl.textContent = 'New Application';

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
