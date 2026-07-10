// Reset Password — Step 2 (set a new password), feature 045. Mounted-into-
// slot pattern matching LoginForm.js. Only reachable via main.js's
// initial-view threading of a confirmed `password-recovery` authStore
// status — never via a click, unlike every other AuthOverlay view. On
// success, explicitly ends the recovery session (spec Clarification,
// 2026-07-10) rather than showing an in-overlay success card; the success
// notification survives the resulting reroute via authStore's existing
// one-shot notice mechanism (see main.js render()). See
// design_handoff_password_reset_modal/wr-auth.jsx's NewPasswordModal (form
// phase only — the "done" phase is replaced by the sign-out reroute) and
// README.md §"Step 2 — Set a new password".
import { supabase } from '../../services/supabaseClient.js';
import { setAuthNotice, signOut } from '../../data/authStore.js';
import { createSvgIcon } from '../../utils/icons.js';
import { validatePassword } from '../../utils/validate.js';

const ERROR_MESSAGE = "Couldn't update your password. Please try again.";
const EYE_PATHS = [
  'M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z',
  'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
];
const EYE_OFF_PATHS = [
  'M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19',
  'M6.61 6.61A18.5 18.5 0 0 0 2 12s3 8 10 8a9.12 9.12 0 0 0 5.39-1.61',
  'M2 2 22 22',
];

// GoTrue's documented server error codes for an invalid/expired session
// (node_modules/@supabase/auth-js/dist/main/lib/error-codes.d.ts — the
// ErrorCode union) plus the client-side AuthSessionMissingError thrown when
// no session exists in storage at all (updateUser()'s own `_updateUser`,
// GoTrueClient.js). Both mean "this recovery link is no longer usable"
// (FR-11's runtime re-check), distinct from a generic network/provider
// failure that should just show a retryable inline error instead.
const EXPIRED_SESSION_ERROR_CODES = new Set(['session_not_found', 'session_expired', 'bad_jwt']);

function isExpiredSessionError(err) {
  if (!err) {
    return false;
  }
  if (err.name === 'AuthSessionMissingError') {
    return true;
  }
  return EXPIRED_SESSION_ERROR_CODES.has(err.code);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function createPasswordToggle(input) {
  const button = document.createElement('button');

  button.type = 'button';
  button.className = 'auth-form__password-toggle';
  button.setAttribute('aria-label', 'Show password');
  button.append(createSvgIcon(EYE_PATHS));
  button.addEventListener('click', () => {
    const showing = input.type === 'text';

    input.type = showing ? 'password' : 'text';
    button.replaceChildren(createSvgIcon(showing ? EYE_PATHS : EYE_OFF_PATHS));
    button.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  });

  return button;
}

function field(name, labelText) {
  const wrap = el('label', 'auth-form__field');
  const label = el('span', 'auth-form__label', labelText);
  const inputWrap = el('span', 'auth-form__input-wrap');
  const input = document.createElement('input');
  input.type = 'password';
  input.name = name;
  input.required = true;
  input.className = 'auth-form__input';
  input.autocomplete = 'new-password';
  inputWrap.append(input, createPasswordToggle(input));
  const fieldError = el('span', 'auth-form__field-error');
  fieldError.setAttribute('aria-live', 'polite');
  wrap.append(label, inputWrap, fieldError);
  return { wrap, input, fieldError };
}

export function mountResetPasswordForm(container, { onExpired, onClose, onPendingChange } = {}) {
  const form = el('form', 'auth-form auth-form--reset');
  form.setAttribute('novalidate', '');

  const newField = field('new-password', 'New password');
  const confirmField = field('confirm-password', 'Confirm new password');

  const errorRegion = el('div', 'auth-form__error');
  errorRegion.setAttribute('aria-live', 'polite');

  const IDLE_LABEL = 'Update password';
  const PENDING_LABEL = 'Updating…';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'auth-form__submit';
  submitBtn.textContent = IDLE_LABEL;

  const status = document.createElement('span');
  status.className = 'auth-form__status';
  status.setAttribute('aria-live', 'polite');

  const backLink = document.createElement('button');
  backLink.type = 'button';
  backLink.className = 'auth-overlay__back-link';
  backLink.textContent = 'Back to sign in';
  // Not a plain view-swap (unlike ForgotPasswordForm's "Back to sign in"):
  // abandoning an active recovery session must also end it. onClose is
  // AuthOverlay's own close() for the reset-password view, which already
  // owns that sign-out — see AuthOverlay.js.
  backLink.addEventListener('click', () => onClose?.());

  form.append(newField.wrap, confirmField.wrap, errorRegion, submitBtn, status, backLink);

  let inFlight = false;
  let touched = false;

  function setFieldError(fieldRefs, message) {
    fieldRefs.fieldError.textContent = message;
    fieldRefs.input.setAttribute('aria-invalid', message ? 'true' : 'false');
    fieldRefs.wrap.classList.toggle('auth-form__field--error', Boolean(message));
  }

  function validateFields() {
    let valid = true;
    const newError = validatePassword(newField.input.value);
    if (newError) {
      setFieldError(newField, newError);
      valid = false;
    } else {
      setFieldError(newField, '');
    }
    if (confirmField.input.value !== newField.input.value) {
      setFieldError(confirmField, "Passwords don't match.");
      valid = false;
    } else {
      setFieldError(confirmField, '');
    }
    return valid;
  }

  function validateTouched() {
    if (!touched) {
      return;
    }
    setFieldError(newField, validatePassword(newField.input.value) ?? '');
    setFieldError(
      confirmField,
      confirmField.input.value === newField.input.value ? '' : "Passwords don't match.",
    );
  }

  function setPending(pending) {
    inFlight = pending;
    onPendingChange?.(pending);
    submitBtn.disabled = pending;
    backLink.disabled = pending;
    submitBtn.setAttribute('aria-busy', pending ? 'true' : 'false');
    submitBtn.textContent = pending ? PENDING_LABEL : IDLE_LABEL;
    if (pending) {
      submitBtn.dataset.state = 'pending';
      status.textContent = PENDING_LABEL;
      form.setAttribute('aria-busy', 'true');
    } else {
      delete submitBtn.dataset.state;
      status.textContent = '';
      form.removeAttribute('aria-busy');
    }
  }

  newField.input.addEventListener('input', validateTouched);
  confirmField.input.addEventListener('input', validateTouched);

  async function handleSubmit(event) {
    event.preventDefault();
    if (inFlight) {
      return;
    }
    errorRegion.textContent = '';
    touched = true;

    if (!validateFields()) {
      return;
    }
    setPending(true);

    let updateError = null;
    try {
      const result = await supabase.auth.updateUser({ password: newField.input.value });
      updateError = result?.error ?? null;
    } catch (err) {
      updateError = err;
    }

    if (!updateError) {
      // Stage the notice before signing out — the reroute this triggers
      // clears document.body, which would wipe a toast shown now (matches
      // the delete-account precedent, main.js mountWelcome()).
      setAuthNotice('Password updated. Sign in with your new password.', 'success');
      try {
        await signOut();
      } catch {
        // The password update already succeeded — a sign-out hiccup here
        // must not be reported as if the update itself failed. authStore's
        // SIGNED_OUT-driven reroute may simply be delayed or may never
        // arrive at all (e.g. this signOut() call itself failed outright) —
        // either way, swallow it here rather than showing an error for an
        // update that already succeeded.
      } finally {
        // Release the pending gate regardless of outcome. If the reroute
        // already fired, this form is already unmounted and the following
        // calls are harmless no-ops on detached nodes. If it didn't (a
        // rejected/never-resolved signOut() left the recovery session
        // intact), this is what stops the user from being stranded in a
        // permanently disabled overlay: AuthOverlay's close() gates on this
        // same pending signal, so releasing it re-enables ×/Escape/backdrop/
        // "Back to sign in" — and AuthOverlay's own close() retries
        // signOut() on that path (see its comment).
        setPending(false);
      }
      // main.js's render() picks up the resulting 'unauthenticated' status
      // and returns Welcome to the login view — no further action needed.
      return;
    }

    setPending(false);
    if (isExpiredSessionError(updateError)) {
      onExpired?.();
      return;
    }
    errorRegion.textContent = ERROR_MESSAGE;
  }

  form.addEventListener('submit', handleSubmit);
  container.append(form);

  return function unmount() {
    form.removeEventListener('submit', handleSubmit);
    form.remove();
  };
}
