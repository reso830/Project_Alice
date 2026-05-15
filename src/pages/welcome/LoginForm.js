import { supabase } from '../../services/supabaseClient.js';

const ERROR_MESSAGE =
  "Sign-in failed. Check your email and password, or confirm your email if you haven't yet.";

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
  const input = document.createElement('input');
  input.type = type;
  input.name = name;
  input.required = true;
  input.value = initialValue ?? '';
  input.className = 'auth-form__input';
  input.autocomplete = type === 'password' ? 'current-password' : 'email';
  if (typeof onChange === 'function') {
    input.addEventListener('input', (event) => onChange(event.target.value));
  }
  wrap.append(label, input);
  return { wrap, input };
}

export function mountLoginForm(container, { email = '', onEmailChange } = {}) {
  const form = el('form', 'auth-form auth-form--login');
  form.setAttribute('novalidate', '');

  const emailField = field('email', 'email', 'Email', email, {
    onChange: (value) => onEmailChange?.(value),
  });
  const passwordField = field('password', 'password', 'Password', '');

  const errorRegion = el('div', 'auth-form__error');
  errorRegion.setAttribute('aria-live', 'polite');

  const IDLE_LABEL = 'Sign In';
  const PENDING_LABEL = 'Signing in…';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'auth-form__submit';
  submitBtn.textContent = IDLE_LABEL;

  const status = document.createElement('span');
  status.className = 'auth-form__status';
  status.setAttribute('aria-live', 'polite');

  form.append(emailField.wrap, passwordField.wrap, errorRegion, submitBtn, status);

  let inFlight = false;

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
    setPending(true);

    try {
      const result = await supabase.auth.signInWithPassword({
        email: emailField.input.value,
        password: passwordField.input.value,
      });
      if (result?.error) {
        errorRegion.textContent = ERROR_MESSAGE;
      }
      // Success path: authStore's onAuthStateChange triggers main.js to swap
      // to the app shell; the form does not navigate.
    } catch {
      errorRegion.textContent = ERROR_MESSAGE;
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
