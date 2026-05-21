// Auth modal — docs/design/welcome_page.md §4.6
//
// Phase 17 restyle: drops the tab strip; adds a header row (40px Alice
// mark + title + close), a footer block (submit lives in the form, then
// "or" divider, demo button wired to `demoStub.enterDemo` (feature 020
// entry), swap-mode link, and signup-only legal copy). Mode swap is
// in-place — overlay does not remount, focus stays inside the modal,
// entered email persists. No Forgot-password affordance (spec FR "no
// custom in-app reset UI"; password reset stays operator-driven).

import aliceColored from '../../assets/Alice_Colored.png';
import { mountLoginForm } from './LoginForm.js';
import { mountSignupForm } from './SignupForm.js';
import { enterDemo } from './demoStub.js';

const VALID_VIEWS = new Set(['login', 'signup', 'verification_sent']);

const SWAP_LABEL = {
  login: { prompt: "Don't have an account?", action: 'Create one', target: 'signup' },
  signup: { prompt: 'Already have one?', action: 'Sign in', target: 'login' },
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
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

function buildHeader() {
  const header = el('div', 'auth-overlay__header');

  const logo = document.createElement('img');
  logo.className = 'auth-overlay__header-logo';
  logo.src = aliceColored;
  logo.alt = '';
  logo.width = 40;
  logo.height = 40;

  const title = el('h2', 'auth-overlay__title');
  title.id = 'auth-overlay-title';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'auth-overlay__close';
  closeBtn.textContent = 'Close';
  closeBtn.setAttribute('aria-label', 'Close authentication overlay');

  header.append(logo, title, closeBtn);
  return { header, title, closeBtn };
}

function buildFooter({ onDemo, onSwap }) {
  const footer = el('div', 'auth-overlay__footer');

  const divider = el('div', 'auth-overlay__divider');
  divider.setAttribute('aria-hidden', 'true');
  const dividerText = el('span', 'auth-overlay__divider-text', 'or');
  divider.append(dividerText);

  const demo = document.createElement('button');
  demo.type = 'button';
  demo.className = 'auth-overlay__demo';
  const demoDot = el('span', 'auth-overlay__demo-dot');
  demoDot.setAttribute('aria-hidden', 'true');
  const demoText = el('span', 'auth-overlay__demo-text', 'Try the demo');
  demo.append(demoDot, demoText);
  demo.addEventListener('click', () => onDemo?.());

  const swap = document.createElement('button');
  swap.type = 'button';
  swap.className = 'auth-overlay__swap';
  const swapPrompt = el('span', 'auth-overlay__swap-prompt');
  const swapAction = el('span', 'auth-overlay__swap-action');
  swap.append(swapPrompt, document.createTextNode(' '), swapAction);
  swap.addEventListener('click', () => {
    const target = swap.dataset.authSwapTarget;
    if (target) onSwap?.(target);
  });

  const legal = el('p', 'auth-overlay__legal');
  legal.hidden = true;
  legal.textContent = 'By creating an account, you agree to the terms of use and privacy policy.';

  footer.append(divider, demo, swap, legal);
  return { footer, swap, swapPrompt, swapAction, legal };
}

function applySwap({ swap, swapPrompt, swapAction }, view) {
  const labels = SWAP_LABEL[view];
  if (!labels) {
    swap.hidden = true;
    return;
  }
  swap.hidden = false;
  swap.dataset.authSwapTarget = labels.target;
  swap.setAttribute('aria-label', `${labels.prompt} ${labels.action}`);
  swapPrompt.textContent = labels.prompt;
  swapAction.textContent = labels.action;
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

  const { header, title, closeBtn } = buildHeader();
  const formSlot = el('div', 'auth-overlay__form-slot');
  const body = el('div', 'auth-overlay__body');
  body.append(formSlot);

  let formUnmount = null;
  let closed = false;

  const footerBuilt = buildFooter({
    onDemo: () => enterDemo(),
    onSwap: (target) => setView(target),
  });

  panel.append(header, body, footerBuilt.footer);
  root.append(backdrop, panel);

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
    const isVerification = state.view === 'verification_sent';

    unmountActiveForm();
    formSlot.replaceChildren();

    // Header + footer chrome is hidden in the verification_sent view; the
    // body shows the inline check-your-email panel instead.
    footerBuilt.footer.hidden = isVerification;
    footerBuilt.legal.hidden = state.view !== 'signup';

    if (state.view === 'login') {
      title.textContent = 'Sign in to Project Alice';
      formUnmount = mountLoginForm(formSlot, {
        email: state.email,
        onEmailChange: (value) => {
          state.email = value;
        },
      });
      applySwap(footerBuilt, 'login');
    } else if (state.view === 'signup') {
      title.textContent = 'Create your Project Alice account';
      formUnmount = mountSignupForm(formSlot, {
        email: state.email,
        onEmailChange: (value) => {
          state.email = value;
        },
        onSuccess: () => setView('verification_sent'),
      });
      applySwap(footerBuilt, 'signup');
    } else if (isVerification) {
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
