// Confirmation modal for the destructive account-deletion / clear-all-data
// flows (feature 030). Modeled on ConfirmDialog.js (backdrop + alertdialog +
// Esc/backdrop close), extended with a confirmation input, an inline error
// region, a loading state, and a focus trap.
//
// The modal collects the gate value and reports loading/error only — it
// performs NO deletion itself. The caller passes `onConfirm(value)` (which
// runs the network call). Contract:
//   - onConfirm resolves        → modal closes (success).
//   - onConfirm rejects with
//       err.code === 'INVALID_PASSWORD' → modal stays open, shows the inline
//                                          error, re-enables the input.
//     any other rejection       → modal closes (the caller surfaces its own
//                                  error toast before re-throwing).

const COPY = {
  hosted: {
    title: 'Delete account',
    body: 'This permanently deletes your account and all of your data — applications, profile, and history. This cannot be undone.',
    inputLabel: 'Enter your password to confirm',
    inputType: 'password',
    autocomplete: 'current-password',
    confirmLabel: 'Delete account',
    busyLabel: 'Deleting…',
  },
  local: {
    title: 'Clear all data',
    body: 'This permanently removes all of your locally stored applications and profile data. This cannot be undone.',
    inputLabel: 'Type DELETE to confirm',
    inputType: 'text',
    autocomplete: 'off',
    confirmLabel: 'Clear all data',
    busyLabel: 'Clearing…',
  },
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function isGateSatisfied(mode, value) {
  if (mode === 'local') {
    return value === 'DELETE';
  }
  return value.trim().length > 0;
}

function getFocusable(container) {
  return [...container.querySelectorAll('button, input')].filter((node) => !node.disabled);
}

export function open({ mode = 'hosted', onConfirm } = {}) {
  const copy = COPY[mode] ?? COPY.hosted;
  const previouslyFocused = document.activeElement;

  // Lock background scroll while the modal is open (matches the Application
  // Overlay). Restored on close.
  const savedScrollY = window.scrollY;
  document.body.style.overflow = 'hidden';

  const backdrop = el('div', 'delete-modal-backdrop');
  const dialog = el('div', 'delete-modal');
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'delete-modal-title');
  dialog.setAttribute('aria-describedby', 'delete-modal-body');

  const heading = el('h2', 'delete-modal__title', copy.title);
  heading.id = 'delete-modal-title';
  const icon = el('span', 'delete-modal__icon', '⚠'); // ⚠ — non-color destructive signal
  icon.setAttribute('aria-hidden', 'true');
  heading.prepend(icon);

  const body = el('p', 'delete-modal__body', copy.body);
  body.id = 'delete-modal-body';

  const field = el('label', 'delete-modal__field');
  const labelText = el('span', 'delete-modal__label', copy.inputLabel);
  const input = document.createElement('input');
  input.type = copy.inputType;
  input.className = 'delete-modal__input';
  input.autocomplete = copy.autocomplete;
  field.append(labelText, input);

  const error = el('p', 'delete-modal__error');
  error.setAttribute('role', 'alert');
  error.hidden = true;

  const actions = el('div', 'delete-modal__actions');
  const cancelBtn = el('button', 'delete-modal__btn delete-modal__btn--cancel', 'Cancel');
  cancelBtn.type = 'button';
  const confirmBtn = el('button', 'delete-modal__btn delete-modal__btn--danger', copy.confirmLabel);
  confirmBtn.type = 'button';
  confirmBtn.disabled = true;
  actions.append(cancelBtn, confirmBtn);

  dialog.append(heading, body, field, error, actions);
  backdrop.append(dialog);
  document.body.append(backdrop);

  let loading = false;
  let closed = false;

  function setError(message) {
    error.textContent = message;
    error.hidden = false;
  }

  function clearError() {
    error.textContent = '';
    error.hidden = true;
  }

  function updateGate() {
    confirmBtn.disabled = loading || !isGateSatisfied(mode, input.value);
  }

  function setLoading(value) {
    loading = value;
    cancelBtn.disabled = value;
    input.disabled = value;
    confirmBtn.textContent = value ? copy.busyLabel : copy.confirmLabel;
    confirmBtn.setAttribute('aria-busy', String(value));
    updateGate();
  }

  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeydown, true);
    backdrop.remove();
    document.body.style.overflow = '';
    window.scrollTo(0, savedScrollY);
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    }
  }

  async function attemptConfirm() {
    if (loading || !isGateSatisfied(mode, input.value)) return;
    clearError();
    setLoading(true);
    try {
      await onConfirm?.(input.value);
      close();
    } catch (err) {
      setLoading(false);
      if (err && err.code === 'INVALID_PASSWORD') {
        setError(err.message || 'Incorrect password.');
        input.focus();
        input.select?.();
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
      const focusable = getFocusable(dialog);
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

  input.addEventListener('input', () => {
    clearError();
    updateGate();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      attemptConfirm();
    }
  });
  cancelBtn.addEventListener('click', () => {
    if (!loading) close();
  });
  confirmBtn.addEventListener('click', attemptConfirm);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop && !loading) close();
  });
  document.addEventListener('keydown', onKeydown, true);

  input.focus();

  return { close };
}

export const DeleteAccountModal = { open };
