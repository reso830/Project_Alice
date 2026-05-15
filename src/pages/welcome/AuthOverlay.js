import { mountLoginForm } from './LoginForm.js';
import { mountSignupForm } from './SignupForm.js';

const VALID_VIEWS = new Set(['login', 'signup', 'verification_sent']);

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

function focusableElements(panel) {
  const selector =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
    'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(panel.querySelectorAll(selector)).filter((node) => !node.hidden);
}

function trapFocus(panel, event) {
  const focusable = focusableElements(panel);
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

export function render({ view = 'login', onClose, onSwitch } = {}) {
  const initialView = VALID_VIEWS.has(view) ? view : 'login';
  const state = { view: initialView, email: '' };

  const previousFocus =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const root = el('div', 'auth-overlay');
  root.dataset.view = state.view;

  const backdrop = el('div', 'auth-overlay__backdrop');

  const panel = el('div', 'auth-overlay__panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'auth-overlay-title');

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'auth-overlay__close';
  closeBtn.textContent = 'Close';
  closeBtn.setAttribute('aria-label', 'Close authentication overlay');

  const tabs = el('div', 'auth-overlay__tabs');
  tabs.setAttribute('role', 'tablist');

  const loginTab = document.createElement('button');
  loginTab.type = 'button';
  loginTab.className = 'auth-overlay__tab';
  loginTab.textContent = 'Sign In';
  loginTab.dataset.tab = 'login';
  loginTab.setAttribute('role', 'tab');

  const signupTab = document.createElement('button');
  signupTab.type = 'button';
  signupTab.className = 'auth-overlay__tab';
  signupTab.textContent = 'Create Account';
  signupTab.dataset.tab = 'signup';
  signupTab.setAttribute('role', 'tab');

  tabs.append(loginTab, signupTab);

  const title = el('h2', 'auth-overlay__title');
  title.id = 'auth-overlay-title';

  const formSlot = el('div', 'auth-overlay__form-slot');

  panel.append(closeBtn, tabs, title, formSlot);
  root.append(backdrop, panel);

  let formUnmount = null;
  let closed = false;

  function unmountActiveForm() {
    if (typeof formUnmount === 'function') {
      try {
        formUnmount();
      } catch {
        // best-effort cleanup
      }
      formUnmount = null;
    }
  }

  function paint() {
    root.dataset.view = state.view;
    loginTab.classList.toggle('auth-overlay__tab--active', state.view === 'login');
    signupTab.classList.toggle('auth-overlay__tab--active', state.view === 'signup');
    loginTab.setAttribute('aria-selected', state.view === 'login' ? 'true' : 'false');
    signupTab.setAttribute('aria-selected', state.view === 'signup' ? 'true' : 'false');
    tabs.hidden = state.view === 'verification_sent';

    unmountActiveForm();
    formSlot.replaceChildren();

    if (state.view === 'login') {
      title.textContent = 'Sign in to Project Alice';
      formUnmount = mountLoginForm(formSlot, {
        email: state.email,
        onEmailChange: (value) => {
          state.email = value;
        },
      });
    } else if (state.view === 'signup') {
      title.textContent = 'Create your Project Alice account';
      formUnmount = mountSignupForm(formSlot, {
        email: state.email,
        onEmailChange: (value) => {
          state.email = value;
        },
        onSuccess: () => setView('verification_sent'),
      });
    } else if (state.view === 'verification_sent') {
      title.textContent = 'Check your email';
      const message = el(
        'p',
        'auth-overlay__verification-text',
        'We sent you a verification link. Open it from this device to finish signing up.',
      );
      const doneBtn = document.createElement('button');
      doneBtn.type = 'button';
      doneBtn.className = 'auth-overlay__done';
      doneBtn.textContent = 'Done';
      doneBtn.addEventListener('click', close);
      formSlot.append(message, doneBtn);
    }

    // Focus the first focusable element inside the panel after the next tick
    // so the newly-rendered content is in the DOM.
    queueMicrotask(() => {
      if (closed || !panel.isConnected) {
        return;
      }
      const focusable = focusableElements(panel);
      const firstInput = focusable.find((node) => node.tagName === 'INPUT');
      (firstInput ?? focusable[0])?.focus();
    });
  }

  function setView(nextView) {
    if (!VALID_VIEWS.has(nextView) || state.view === nextView) {
      return;
    }
    state.view = nextView;
    onSwitch?.(nextView);
    paint();
  }

  function close() {
    if (closed) {
      return;
    }
    closed = true;
    document.removeEventListener('keydown', onKeydown);
    unmountActiveForm();
    if (previousFocus && typeof previousFocus.focus === 'function') {
      previousFocus.focus();
    }
    onClose?.();
  }

  function dispose() {
    if (closed) {
      return;
    }
    closed = true;
    document.removeEventListener('keydown', onKeydown);
    unmountActiveForm();
  }

  function onKeydown(event) {
    if (closed) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      trapFocus(panel, event);
    }
  }

  loginTab.addEventListener('click', () => setView('login'));
  signupTab.addEventListener('click', () => setView('signup'));
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      close();
    }
  });

  document.addEventListener('keydown', onKeydown);

  paint();

  // Expose a minimal API on the returned node for testing and orchestrators.
  // `dispose()` is the tear-down path used by parent unmount logic — it does
  // not restore focus or invoke onClose, so it won't recursively re-enter the
  // parent state machine.
  root.__authOverlay = {
    setView,
    close,
    dispose,
    getState: () => ({ ...state }),
  };

  return root;
}

export const AuthOverlay = { render };
