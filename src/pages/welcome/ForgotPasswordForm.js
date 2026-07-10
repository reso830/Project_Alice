// Forgot Password — Step 1 (email entry), feature 045. Mounted-into-slot
// pattern matching LoginForm.js/SignupForm.js. Renders inside AuthOverlay's
// existing `forgot` view (title/subtitle set by AuthOverlay's paint()); the
// "sent" confirmation is AuthOverlay's own `forgot_sent` view, not part of
// this component — see design_handoff_password_reset_modal/wr-auth.jsx
// (ForgotPasswordModal's form phase) and README.md §"Step 1a — Email entry".
import { emailRedirectUrl, supabase } from '../../services/supabaseClient.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    // error (e.g. "user not found") — the two must be indistinguishable to
    // the visitor. A genuine network/provider failure is swallowed the same
    // way, not surfaced as a distinct error state.
    try {
      await supabase.auth.resetPasswordForEmail(emailField.input.value, {
        redirectTo: emailRedirectUrl,
      });
    } catch {
      // intentionally ignored — see comment above.
    }

    setPending(false);
    onSuccess?.();
  }

  form.addEventListener('submit', handleSubmit);
  container.append(form);

  return function unmount() {
    form.removeEventListener('submit', handleSubmit);
    form.remove();
  };
}
