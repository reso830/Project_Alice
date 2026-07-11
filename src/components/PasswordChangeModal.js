// Change Password modal (Settings, feature 045). Modeled structurally on
// DeleteAccountModal.js (backdrop + dialog + focus trap + ESC/backdrop-close
// disabled while loading; INVALID_PASSWORD keeps the modal open with an
// inline error, any other rejection closes it and the caller toasts) with
// the three-field form + in-modal success card from the design handoff
// (Alice_Change_ForgotPwd.zip -> design_handoff_password_reset_modal/
// password-change-form.jsx, .pcf-* styles in src/styles/main.css). Unlike
// DeleteAccountModal, a successful onConfirm does not close immediately —
// it shows a success card first; "Done" closes the modal (no navigation,
// the user is already signed in).
//
// Contract: caller passes `onConfirm({ currentPassword, newPassword })`.
//   - resolves                 -> success card shown; "Done" closes the modal.
//   - rejects INVALID_PASSWORD -> inline error under Current password, stays open.
//   - rejects (other)          -> modal closes; caller surfaces its own toast.

import { createSvgIcon } from '../utils/icons.js';
import { validatePassword } from '../utils/validate.js';

const EYE_PATHS = [
  'M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z',
  'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
];
const EYE_OFF_PATHS = [
  'M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19',
  'M6.61 6.61A18.5 18.5 0 0 0 2 12s3 8 10 8a9.12 9.12 0 0 0 5.39-1.61',
  'M2 2 22 22',
];
const CLOSE_PATH = 'M18 6 6 18M6 6l12 12';
const CHECK_PATH = 'M20 6 9 17l-5-5';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function getFocusable(container) {
  return [...container.querySelectorAll('button, input')].filter((node) => !node.disabled);
}

function createField({ idPrefix, name, label, autocomplete }) {
  const field = el('div', 'pcf-field');
  const id = `${idPrefix}-${name}`;
  const labelEl = el('label', 'pcf-label', label);
  labelEl.htmlFor = id;

  const inputWrap = el('div', 'pcf-input-wrap');
  const input = document.createElement('input');
  input.type = 'password';
  input.id = id;
  input.className = 'pcf-input';
  input.autocomplete = autocomplete;

  const peekBtn = document.createElement('button');
  peekBtn.type = 'button';
  peekBtn.className = 'pcf-peek';
  peekBtn.setAttribute('aria-label', 'Show password');
  peekBtn.append(createSvgIcon(EYE_PATHS));
  peekBtn.addEventListener('click', () => {
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    peekBtn.replaceChildren(createSvgIcon(showing ? EYE_PATHS : EYE_OFF_PATHS));
    peekBtn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  });

  inputWrap.append(input, peekBtn);

  const errorEl = el('div', 'pcf-err-msg');
  errorEl.hidden = true;
  errorEl.setAttribute('aria-live', 'polite');

  field.append(labelEl, inputWrap, errorEl);

  return { field, input, errorEl };
}

function setFieldError(fieldRefs, message) {
  fieldRefs.errorEl.textContent = message || '';
  fieldRefs.errorEl.hidden = !message;
  fieldRefs.field.classList.toggle('pcf-err', Boolean(message));
}

export function open({ onConfirm } = {}) {
  const previouslyFocused = document.activeElement;

  // Lock background scroll while the modal is open (matches DeleteAccountModal
  // / the Application Overlay). Restored on close.
  const savedScrollY = window.scrollY;
  document.body.style.overflow = 'hidden';

  const scrim = el('div', 'pcf-scrim');
  const modal = el('div', 'pcf-modal');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'pcf-title');

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'pcf-x';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.append(createSvgIcon(CLOSE_PATH));

  const head = el('div', 'pcf-head');
  const headCopy = el('div');
  const title = el('div', 'pcf-title', 'Change password');
  title.id = 'pcf-title';
  const subtitle = el('div', 'pcf-subtitle', 'Choose a new password for your account.');
  headCopy.append(title, subtitle);
  head.append(headCopy);

  const form = document.createElement('form');
  form.className = 'pcf-body';
  form.setAttribute('novalidate', '');

  const current = createField({
    idPrefix: 'pcf', name: 'cur', label: 'Current password', autocomplete: 'current-password',
  });
  const next = createField({
    idPrefix: 'pcf', name: 'new', label: 'New password', autocomplete: 'new-password',
  });
  const confirm = createField({
    idPrefix: 'pcf', name: 'confirm', label: 'Confirm new password', autocomplete: 'new-password',
  });

  const actions = el('div', 'pcf-actions');
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'pcf-btn pcf-btn-outline';
  cancelBtn.textContent = 'Cancel';
  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'pcf-btn pcf-btn-primary';
  submitBtn.textContent = 'Update password';
  actions.append(cancelBtn, submitBtn);

  form.append(current.field, next.field, confirm.field, actions);
  modal.append(closeBtn, head, form);
  scrim.append(modal);
  document.body.append(scrim);

  let loading = false;
  let touched = false;
  let closed = false;

  function validate() {
    const curErr = current.input.value.length === 0 ? 'Enter your current password.' : '';
    const newErr = validatePassword(next.input.value) ?? '';
    const confirmErr = confirm.input.value !== next.input.value ? "Passwords don't match." : '';

    if (touched) {
      setFieldError(current, curErr);
      setFieldError(next, newErr);
      setFieldError(confirm, confirmErr);
    }

    return !curErr && !newErr && !confirmErr;
  }

  function setLoading(value) {
    loading = value;
    current.input.disabled = value;
    next.input.disabled = value;
    confirm.input.disabled = value;
    cancelBtn.disabled = value;
    submitBtn.disabled = value;
    submitBtn.textContent = value ? 'Updating…' : 'Update password';
    submitBtn.setAttribute('aria-busy', String(value));
  }

  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeydown, true);
    scrim.remove();
    document.body.style.overflow = '';
    window.scrollTo(0, savedScrollY);
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    }
  }

  function showDone() {
    // closeBtn stays — only the head/form (phase-specific content) is swapped,
    // matching the design handoff's DOM shape (the × button is not part of
    // the phase-conditional block there either).
    head.remove();
    form.remove();

    const center = el('div', 'pcf-center');
    const check = el('div', 'pcf-check');
    check.append(createSvgIcon(CHECK_PATH));
    const doneTitle = document.createElement('h3');
    // Re-anchor the dialog's aria-labelledby target: the original #pcf-title
    // (in `head`) was just removed above, which would otherwise leave the
    // scrim's `aria-labelledby="pcf-title"` pointing at nothing once the
    // success card is showing.
    doneTitle.id = 'pcf-title';
    doneTitle.textContent = 'Password updated';
    const doneMessage = document.createElement('p');
    doneMessage.textContent = 'Your password has been changed successfully.';
    const doneBtn = document.createElement('button');
    doneBtn.type = 'button';
    doneBtn.className = 'pcf-btn pcf-btn-primary';
    doneBtn.style.marginTop = '8px';
    doneBtn.textContent = 'Done';
    doneBtn.addEventListener('click', close);

    center.append(check, doneTitle, doneMessage, doneBtn);
    modal.append(center);
    doneBtn.focus();
  }

  async function attemptSubmit(event) {
    event.preventDefault();
    if (loading) return;
    touched = true;
    if (!validate()) return;

    setLoading(true);
    try {
      await onConfirm?.({
        currentPassword: current.input.value,
        newPassword: next.input.value,
      });
      loading = false;
      showDone();
    } catch (err) {
      setLoading(false);
      if (err && err.code === 'INVALID_PASSWORD') {
        setFieldError(current, err.message || 'Incorrect password.');
        current.input.focus();
        current.input.select?.();
      } else {
        close();
      }
    }
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      if (!loading) {
        event.stopPropagation();
        close();
      }
      return;
    }
    if (event.key === 'Tab') {
      const focusable = getFocusable(modal);
      if (focusable.length === 0) return;
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
  }

  for (const f of [current, next, confirm]) {
    f.input.addEventListener('input', () => {
      if (touched) validate();
    });
  }

  form.addEventListener('submit', attemptSubmit);
  closeBtn.addEventListener('click', () => {
    if (!loading) close();
  });
  cancelBtn.addEventListener('click', () => {
    if (!loading) close();
  });
  scrim.addEventListener('click', (event) => {
    if (event.target === scrim && !loading) close();
  });
  document.addEventListener('keydown', onKeydown, true);

  current.input.focus();

  return { close };
}

export const PasswordChangeModal = { open };
