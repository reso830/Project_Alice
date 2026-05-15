import { emailRedirectUrl, supabase } from '../../services/supabaseClient.js';

const NEUTRAL_ERROR = 'This email cannot sign up right now.';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;

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

function field(name, type, labelText, initialValue, { onChange, autocomplete } = {}) {
  const wrap = el('label', 'auth-form__field');
  const label = el('span', 'auth-form__label', labelText);
  const input = document.createElement('input');
  input.type = type;
  input.name = name;
  input.required = true;
  input.value = initialValue ?? '';
  input.className = 'auth-form__input';
  if (autocomplete) {
    input.autocomplete = autocomplete;
  }
  const fieldError = el('span', 'auth-form__field-error');
  fieldError.setAttribute('aria-live', 'polite');
  if (typeof onChange === 'function') {
    input.addEventListener('input', (event) => onChange(event.target.value));
  }
  wrap.append(label, input, fieldError);
  return { wrap, input, fieldError };
}

export function mountSignupForm(container, { email = '', onEmailChange, onSuccess } = {}) {
  const form = el('form', 'auth-form auth-form--signup');
  form.setAttribute('novalidate', '');

  const emailField = field('email', 'email', 'Email', email, {
    onChange: (value) => onEmailChange?.(value),
    autocomplete: 'email',
  });
  const passwordField = field('password', 'password', 'Password', '', {
    autocomplete: 'new-password',
  });

  const errorRegion = el('div', 'auth-form__error');
  errorRegion.setAttribute('aria-live', 'polite');

  const IDLE_LABEL = 'Create Account';
  const PENDING_LABEL = 'Creating account…';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'auth-form__submit';
  submitBtn.textContent = IDLE_LABEL;

  const status = document.createElement('span');
  status.className = 'auth-form__status';
  status.setAttribute('aria-live', 'polite');

  form.append(emailField.wrap, passwordField.wrap, errorRegion, submitBtn, status);

  let inFlight = false;

  function clearFieldErrors() {
    emailField.fieldError.textContent = '';
    passwordField.fieldError.textContent = '';
  }

  function validateFields() {
    clearFieldErrors();
    let valid = true;
    if (!EMAIL_RE.test(emailField.input.value)) {
      emailField.fieldError.textContent = 'Enter a valid email address.';
      valid = false;
    }
    if (passwordField.input.value.length < PASSWORD_MIN) {
      passwordField.fieldError.textContent = `Password must be at least ${PASSWORD_MIN} characters.`;
      valid = false;
    }
    return valid;
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

  async function handleSubmit(event) {
    event.preventDefault();
    if (inFlight) {
      return;
    }
    errorRegion.textContent = '';

    if (!validateFields()) {
      return;
    }

    setPending(true);

    try {
      const result = await supabase.auth.signUp({
        email: emailField.input.value,
        password: passwordField.input.value,
        options: { emailRedirectTo: emailRedirectUrl },
      });
      if (result?.error) {
        errorRegion.textContent = NEUTRAL_ERROR;
      } else {
        onSuccess?.();
      }
    } catch {
      errorRegion.textContent = NEUTRAL_ERROR;
    } finally {
      setPending(false);
    }
  }

  form.addEventListener('submit', handleSubmit);
  container.append(form);

  return function unmount() {
    form.removeEventListener('submit', handleSubmit);
    form.remove();
  };
}
