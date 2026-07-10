// Auth modal — docs/design/welcome_page.md §4.6
//
// Phase 17 restyle: drops the tab strip; adds a header row (40px Alice
// mark + title + close), a footer block (submit lives in the form, then
// "or" divider, demo button wired to `demoStub.enterDemo` (feature 020
// entry), swap-mode link, and signup-only legal copy). Mode swap is
// in-place — overlay does not remount, focus stays inside the modal,
// entered email persists.
//
// Feature 045 reverses this file's former "no Forgot-password affordance"
// decision (spec FR 018 "no custom in-app reset UI" — password reset was
// operator-driven; see specs/045-auth-password-reset/spec.md Problem
// Statement). `forgot`/`forgot_sent` are two new views, reached from the
// login form's "Forgot password?" link and via ForgotPasswordForm's
// onSuccess respectively, following the exact precedent `verification_sent`
// already set. `reset-password`/`recovery-expired` are two more (Phase 04)
// — both reachable ONLY via main.js's initial-view threading of a confirmed
// recovery session, never via a click. Unlike every other view, abandoning
// `reset-password` (× / Escape / backdrop / its own "Back to sign in") must
// also end the recovery session — see close() below and research.md D5.

import aliceColored from '../../assets/logo/alice-sigil-full.svg';
import { mountLoginForm } from './LoginForm.js';
import { mountSignupForm } from './SignupForm.js';
import { mountForgotPasswordForm } from './ForgotPasswordForm.js';
import { mountResetPasswordForm } from './ResetPasswordForm.js';
import { enterDemo } from './demoStub.js';
import { signOut } from '../../data/authStore.js';

const VALID_VIEWS = new Set([
  'login', 'signup', 'verification_sent', 'forgot', 'forgot_sent', 'reset-password', 'recovery-expired',
]);
const SVGNS = 'http://www.w3.org/2000/svg';

// design_handoff_password_reset_modal/wr-auth.jsx's mail glyph (rounded rect
// + envelope-flap path) — createSvgIcon (utils/icons.js) is path-only, so
// this is built directly rather than approximating the rounded rect as a
// square-cornered path.
function createMailIcon() {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const rect = document.createElementNS(SVGNS, 'rect');
  rect.setAttribute('x', '3');
  rect.setAttribute('y', '5');
  rect.setAttribute('width', '18');
  rect.setAttribute('height', '14');
  rect.setAttribute('rx', '2');
  const flap = document.createElementNS(SVGNS, 'path');
  flap.setAttribute('d', 'm3 7 9 6 9-6');
  svg.append(rect, flap);
  return svg;
}

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
  const subtitle = el('p', 'auth-overlay__subtitle');

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'auth-overlay__close';
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', 'Close authentication overlay');

  const copy = el('div', 'auth-overlay__header-copy');
  copy.append(title, subtitle);

  header.append(logo, copy, closeBtn);
  return { header, title, subtitle, closeBtn };
}

function buildLegalLink(text, type, onLegalLink) {
  const link = document.createElement('button');
  link.type = 'button';
  link.className = 'auth-overlay__legal-link';
  link.textContent = text;
  link.addEventListener('click', () => onLegalLink?.(type));
  return link;
}

function buildLegalCopy(onLegalLink) {
  const legal = el('p', 'auth-overlay__legal');
  legal.hidden = true;
  legal.append(
    document.createTextNode('By creating an account, you agree to the '),
    buildLegalLink('terms of use', 'terms', onLegalLink),
    document.createTextNode(' and '),
    buildLegalLink('privacy policy', 'privacy', onLegalLink),
    document.createTextNode('.'),
  );
  return legal;
}

function buildFooter({ onDemo, onSwap, onLegalLink }) {
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

  const legal = buildLegalCopy(onLegalLink);

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

export function render({ view = 'login', onClose, onSwitch, onLegalLink } = {}) {
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

  const { header, title, subtitle, closeBtn } = buildHeader();
  const formSlot = el('div', 'auth-overlay__form-slot');
  const body = el('div', 'auth-overlay__body');
  body.append(formSlot);

  let formUnmount = null;
  let closed = false;
  // Set only while reset-password's own submit is in flight (T021) — gates
  // close() below so ×/Escape/backdrop/"Back to sign in" all no-op during a
  // submit, matching DeleteAccountModal.js's loading-disables-close/Escape/
  // backdrop convention (the cited precedent for this exact behavior).
  // Reset to false at the top of every paint() so leaving the view (e.g. to
  // recovery-expired on an expired-session failure) can't strand it stuck.
  let resetPending = false;

  const footerBuilt = buildFooter({
    onDemo: () => enterDemo(),
    onSwap: (target) => setView(target),
    onLegalLink,
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
    const isForgotSent = state.view === 'forgot_sent';
    const isResetPassword = state.view === 'reset-password';
    const isRecoveryExpired = state.view === 'recovery-expired';

    unmountActiveForm();
    formSlot.replaceChildren();
    resetPending = false;
    closeBtn.disabled = false;

    // Header + footer chrome is hidden in verification_sent/forgot/
    // forgot_sent/reset-password/recovery-expired — none of demo/
    // swap-to-signup/legal makes sense mid verification or recovery. Each
    // of these renders its own "Back to sign in" (or, for reset-password,
    // a full close) inline rather than reusing this footer's login<->signup
    // swap mechanism, since SWAP_LABEL has no entry for any of them.
    footerBuilt.footer.hidden =
      isVerification || state.view === 'forgot' || isForgotSent || isResetPassword || isRecoveryExpired;
    footerBuilt.legal.hidden = state.view !== 'signup';

    if (state.view === 'login') {
      title.textContent = 'Welcome back';
      subtitle.textContent = 'Sign in to Project Alice.';
      formUnmount = mountLoginForm(formSlot, {
        email: state.email,
        onEmailChange: (value) => {
          state.email = value;
        },
        onSwitch: (target) => setView(target),
      });
      applySwap(footerBuilt, 'login');
    } else if (state.view === 'signup') {
      title.textContent = 'Create account';
      subtitle.textContent = 'Start organizing your job search.';
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
      subtitle.textContent = 'One last step to activate your workspace.';
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
    } else if (state.view === 'forgot') {
      title.textContent = 'Forgot your password?';
      subtitle.textContent = "We'll email you a link to reset it.";
      formUnmount = mountForgotPasswordForm(formSlot, {
        email: state.email,
        onEmailChange: (value) => {
          state.email = value;
        },
        onSuccess: () => setView('forgot_sent'),
        onSwitch: (target) => setView(target),
      });
    } else if (isForgotSent) {
      // Non-enumerating copy (FR-8/AC-5, contracts/api.md F1) — identical
      // regardless of whether `state.email` corresponds to a real account.
      // No "Open reset link (demo)" affordance: the design handoff's own
      // comment marks that as a prototype-only stand-in; production reaches
      // Reset Password only via a real emailed link (Phase 04).
      title.textContent = 'Check your inbox';
      subtitle.textContent = '';
      const center = el('div', 'auth-overlay__center');
      const icon = el('div', 'auth-overlay__check');
      icon.append(createMailIcon());
      const message = el('p', 'auth-overlay__verification-text');
      message.append(
        document.createTextNode('If an account exists for '),
        el('b', undefined, state.email),
        document.createTextNode(", we've sent a password reset link. Click it to choose a new password."),
      );
      const backLink = document.createElement('button');
      backLink.type = 'button';
      backLink.className = 'auth-overlay__back-link';
      backLink.textContent = 'Back to sign in';
      backLink.addEventListener('click', () => setView('login'));
      center.append(icon, message, backLink);
      formSlot.append(center);
    } else if (isResetPassword) {
      title.textContent = 'Set a new password';
      subtitle.textContent = 'Choose a new password for your account.';
      formUnmount = mountResetPasswordForm(formSlot, {
        onExpired: () => setView('recovery-expired'),
        onClose: () => close(),
        onPendingChange: (pending) => {
          resetPending = pending;
          closeBtn.disabled = pending;
        },
      });
    } else if (isRecoveryExpired) {
      // No prototype coverage for this state (T019 — recreated manually,
      // spec Clarification 2026-07-10). Kept deliberately simple, matching
      // verification_sent's icon-less inline-message treatment rather than
      // forgot_sent's mail-icon badge (which the design handoff DID cover).
      title.textContent = 'This reset link has expired';
      subtitle.textContent = '';
      const message = el(
        'p',
        'auth-overlay__verification-text',
        'Request a new one to reset your password.',
      );
      const backLink = document.createElement('button');
      backLink.type = 'button';
      backLink.className = 'auth-overlay__back-link';
      backLink.textContent = 'Request a new link';
      // Back to `forgot`, not `login` — the user still can't sign in
      // without a working password, so dead-ending at the login form
      // would leave them stuck (spec Clarification 2026-07-10).
      backLink.addEventListener('click', () => setView('forgot'));
      formSlot.append(message, backLink);
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
    // T021: while reset-password's own submit is in flight, ×/Escape/
    // backdrop/"Back to sign in" (all routed through this one close()) must
    // no-op rather than abandon mid-request — matching DeleteAccountModal.js's
    // loading-disables-close/Escape/backdrop convention, the cited precedent.
    // ResetPasswordForm releases this same flag in a `finally` regardless of
    // how its own submit settles (success or failure), so it can never get
    // stuck true forever.
    if (state.view === 'reset-password' && resetPending) {
      return;
    }
    // Abandoning an active recovery session (× / Escape / backdrop / the
    // form's own "Back to sign in", which calls this same close()) must
    // also end it — spec Clarification (2026-07-10), research.md D5,
    // contracts/api.md R7. No setAuthNotice(): nothing succeeded, so no
    // notification. Unlike every other view's close(), this does not tear
    // the overlay down immediately: closing before confirming the sign-out
    // attempt settled could hide the only UI representing an active
    // recovery session while that session was, in fact, never ended (a
    // rejected signOut()). So this reuses `resetPending` (the same flag
    // T021's in-flight gate already uses) to block re-entrant close calls
    // and disable the × button while the attempt is outstanding, and only
    // finishes closing once it has settled — one way or the other. A
    // rejected signOut() still finishes the close (a user permanently stuck
    // in a modal they can't escape is worse than a possibly-stale recovery
    // session that a subsequent sign-in attempt will overwrite regardless).
    if (state.view === 'reset-password') {
      resetPending = true;
      closeBtn.disabled = true;
      signOut()
        .catch(() => {
          // best-effort — finishClose() below still runs either way.
        })
        .finally(() => {
          resetPending = false;
          finishClose();
        });
      return;
    }
    finishClose();
  }

  function finishClose() {
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
      // A LegalModal stacked on top handles its own Escape; deferring here
      // keeps the signup form (and its entered email) intact underneath it.
      if (document.querySelector('.legal-overlay')) {
        return;
      }
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
