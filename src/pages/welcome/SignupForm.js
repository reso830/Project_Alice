import { emailRedirectUrl, supabase } from '../../services/supabaseClient.js';
import { createSvgIcon } from '../../utils/icons.js';

const NEUTRAL_ERROR = 'This email cannot sign up right now.';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;
const EYE_PATHS = [
  'M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z',
  'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
];
const EYE_OFF_PATHS = [
  'M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19',
  'M6.61 6.61A18.5 18.5 0 0 0 2 12s3 8 10 8a9.12 9.12 0 0 0 5.39-1.61',
  'M2 2 22 22',
];

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

function field(name, type, labelText, initialValue, { onChange, autocomplete } = {}) {
  const wrap = el('label', 'auth-form__field');
  const label = el('span', 'auth-form__label', labelText);
  const inputWrap = el('span', 'auth-form__input-wrap');
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
  inputWrap.append(input);
  if (type === 'password') {
    inputWrap.append(createPasswordToggle(input));
  }
  wrap.append(label, inputWrap, fieldError);
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
  const touched = { email: false, password: false };

  function clearFieldErrors() {
    setFieldError(emailField, '');
    setFieldError(passwordField, '');
  }

  function setFieldError(formField, message) {
    formField.fieldError.textContent = message;
    formField.input.setAttribute('aria-invalid', message ? 'true' : 'false');
    formField.wrap.classList.toggle('auth-form__field--error', Boolean(message));
  }

  function validateFields() {
    clearFieldErrors();
    let valid = true;
    if (!EMAIL_RE.test(emailField.input.value)) {
      setFieldError(emailField, 'Enter a valid email address.');
      valid = false;
    }
    if (passwordField.input.value.length < PASSWORD_MIN) {
      setFieldError(passwordField, `Password must be at least ${PASSWORD_MIN} characters.`);
      valid = false;
    }
    return valid;
  }

  function validateTouched() {
    if (touched.email) {
      setFieldError(
        emailField,
        EMAIL_RE.test(emailField.input.value) ? '' : 'Enter a valid email address.',
      );
    }
    if (touched.password) {
      setFieldError(
        passwordField,
        passwordField.input.value.length >= PASSWORD_MIN
          ? ''
          : `Password must be at least ${PASSWORD_MIN} characters.`,
      );
    }
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

  // Only validate on blur once the field has content, so navigating away from
  // an empty field (closing the modal, swapping mode, hitting the demo button)
  // never fires the "enter a valid email" warning. Real submits still validate.
  emailField.input.addEventListener('blur', () => {
    if (emailField.input.value.trim() === '') return;
    touched.email = true;
    validateTouched();
  });
  emailField.input.addEventListener('input', validateTouched);
  passwordField.input.addEventListener('blur', () => {
    if (passwordField.input.value === '') return;
    touched.password = true;
    validateTouched();
  });
  passwordField.input.addEventListener('input', validateTouched);

  async function handleSubmit(event) {
    event.preventDefault();
    if (inFlight) {
      return;
    }
    errorRegion.textContent = '';
    touched.email = true;
    touched.password = true;

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
