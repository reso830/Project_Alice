// Forgot Password — Step 1 (email entry), feature 045. Mounted-into-slot
// pattern matching LoginForm.js/SignupForm.js. Renders inside AuthOverlay's
// existing `forgot` view (title/subtitle set by AuthOverlay's paint()); the
// "sent" confirmation is AuthOverlay's own `forgot_sent` view, not part of
// this component — see design_handoff_password_reset_modal/wr-auth.jsx
// (ForgotPasswordModal's form phase) and README.md §"Step 1a — Email entry".
import { emailRedirectUrl, supabase } from '../../services/supabaseClient.js';
import { withRecoveryFlowMarker } from '../../data/authStore.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DELIVERY_ERROR_MESSAGE = "Couldn't send the reset link. Please try again.";

// Code-review finding (2026-07-11): non-enumeration (FR-8/AC-5) requires
// masking anything that could reveal whether an account exists, but it does
// NOT require masking a genuine transport/provider failure — the spec's own
// edge cases call for a retryable inline error there instead (contracts/
// api.md). An earlier version of this function hand-picked two rate-limit
// codes, which a follow-up review correctly flagged as too narrow — GoTrue's
// documented ErrorCode union (node_modules/@supabase/auth-js/dist/main/lib/
// error-codes.d.ts) has dozens of codes for genuine operational failures
// (`unexpected_failure`, `email_provider_disabled`, `request_timeout`,
// hook-related timeouts, etc.) that would all fall through a hand-picked
// list the same way.
//
// Rather than keep enumerating individual codes as new gaps get found,
// this keys off `err.status` — every `AuthError`/`AuthApiError` from
// auth-js carries the real HTTP status GoTrue's server returned
// (errors.js's `AuthError` constructor). By REST convention, `5xx` means
// the server itself failed for some operational reason, and `429` means
// rate-limited — neither has anything to do with whether the account
// exists (that's a `4xx` concern: `user_not_found`/`email_not_confirmed`-
// shaped codes, which stay masked by falling through to `false` below).
// This is deliberately a general rule, not a list, so it doesn't need
// updating every time Supabase adds a new operational error code.
// `AuthRetryableFetchError` (network-level, thrown rather than returned —
// may not reliably carry a `.status`) and the two rate-limit codes are kept
// as an explicit belt-and-suspenders check alongside the general rule.
function isGenuineDeliveryFailure(err) {
  if (!err) {
    return false;
  }
  if (err.name === 'AuthRetryableFetchError') {
    return true;
  }
  if (err.code === 'over_email_send_rate_limit' || err.code === 'over_request_rate_limit') {
    return true;
  }
  return typeof err.status === 'number' && (err.status >= 500 || err.status === 429);
}

// Feature 045, live-verification finding (2026-07-10): a failed/expired
// recovery link's Supabase redirect carries none of Supabase's own success
// markers, so this flow needs its own — see authStore.js's
// RECOVERY_FLOW_MARKER/withRecoveryFlowMarker for the full explanation.
// Computed once at module load (the base URL never changes at runtime), not
// per submit.
const recoveryRedirectUrl = withRecoveryFlowMarker(emailRedirectUrl);

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

function field(name, type, labelText, initialValue, { onChange } = {}) {
  const wrap = el('label', 'auth-form__field');
  const label = el('span', 'auth-form__label', labelText);
  const inputWrap = el('span', 'auth-form__input-wrap');
  const input = document.createElement('input');
  input.type = type;
  input.name = name;
  input.required = true;
  input.value = initialValue ?? '';
  input.className = 'auth-form__input';
  input.autocomplete = 'email';
  if (typeof onChange === 'function') {
    input.addEventListener('input', (event) => onChange(event.target.value));
  }
  inputWrap.append(input);
  const fieldError = el('span', 'auth-form__field-error');
  fieldError.setAttribute('aria-live', 'polite');
  wrap.append(label, inputWrap, fieldError);
  return { wrap, input, fieldError };
}

export function mountForgotPasswordForm(container, { email = '', onEmailChange, onSuccess, onSwitch } = {}) {
  const form = el('form', 'auth-form auth-form--forgot');
  form.setAttribute('novalidate', '');

  const emailField = field('email', 'email', 'Email', email, {
    onChange: (value) => onEmailChange?.(value),
  });

  const errorRegion = el('div', 'auth-form__error');
  errorRegion.setAttribute('aria-live', 'polite');

  const IDLE_LABEL = 'Send reset link';
  const PENDING_LABEL = 'Sending…';

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
  backLink.addEventListener('click', () => onSwitch?.('login'));

  form.append(emailField.wrap, errorRegion, submitBtn, status, backLink);

  let inFlight = false;
  let touched = false;

  function setFieldError(message) {
    emailField.fieldError.textContent = message;
    emailField.input.setAttribute('aria-invalid', message ? 'true' : 'false');
    emailField.wrap.classList.toggle('auth-form__field--error', Boolean(message));
  }

  function validateField() {
    const valid = EMAIL_RE.test(emailField.input.value);
    if (!valid) {
      setFieldError('Enter a valid email address.');
    }
    return valid;
  }

  function validateTouched() {
    if (!touched) return;
    setFieldError(EMAIL_RE.test(emailField.input.value) ? '' : 'Enter a valid email address.');
  }

  function setPending(pending) {
    inFlight = pending;
    submitBtn.disabled = pending;
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

  emailField.input.addEventListener('blur', () => {
    if (emailField.input.value.trim() === '') return;
    touched = true;
    validateTouched();
  });
  emailField.input.addEventListener('input', validateTouched);

  async function handleSubmit(event) {
    event.preventDefault();
    if (inFlight) {
      return;
    }
    errorRegion.textContent = '';
    touched = true;
    setFieldError('');

    if (!validateField()) {
      return;
    }
    setPending(true);

    // Non-enumeration (FR-8/AC-5, contracts/api.md F1): request the recovery
    // email for every syntactically-valid address, and proceed to the sent
    // confirmation regardless of whether Supabase reports success or an
    // account-existence-shaped error — the two must be indistinguishable to
    // the visitor. A genuine transport/provider failure (rate-limited,
    // network down) is a different case — see isGenuineDeliveryFailure's own
    // comment — and gets a retryable inline error instead, per this spec's
    // own edge cases.
    let deliveryError = null;
    try {
      const result = await supabase.auth.resetPasswordForEmail(emailField.input.value, {
        redirectTo: recoveryRedirectUrl,
      });
      deliveryError = result?.error ?? null;
    } catch (err) {
      deliveryError = err;
    }

    setPending(false);

    if (isGenuineDeliveryFailure(deliveryError)) {
      errorRegion.textContent = DELIVERY_ERROR_MESSAGE;
      return;
    }

    onSuccess?.();
  }

  form.addEventListener('submit', handleSubmit);
  container.append(form);

  return function unmount() {
    form.removeEventListener('submit', handleSubmit);
    form.remove();
  };
}
