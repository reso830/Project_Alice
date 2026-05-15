import aliceWhite from '../assets/Alice_White.png';
import * as authStore from '../data/authStore.js';

const pages = [
  { id: 'tracker', label: 'Tracker' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'profile', label: 'Profile' },
];

const EMAIL_DISPLAY_LIMIT = 24;

let _root = null;
let _authSegment = null;
let _unsubscribe = null;

function truncateEmail(email) {
  if (typeof email !== 'string' || email.length <= EMAIL_DISPLAY_LIMIT) {
    return email ?? '';
  }
  return `${email.slice(0, EMAIL_DISPLAY_LIMIT - 1)}…`;
}

export function setActive(page) {
  if (!_root) {
    return;
  }

  for (const button of _root.querySelectorAll('.nav-btn')) {
    button.classList.toggle('nav-btn--active', button.dataset.page === page);
  }
}

function renderAuthSegment(state) {
  if (!_authSegment) {
    return;
  }
  _authSegment.replaceChildren();

  if (!state || state.status !== 'authenticated' || !state.user?.email) {
    _authSegment.hidden = true;
    return;
  }

  _authSegment.hidden = false;

  const email = document.createElement('span');
  email.className = 'navbar__user-email';
  email.textContent = truncateEmail(state.user.email);
  email.title = state.user.email;

  const signOut = document.createElement('button');
  signOut.type = 'button';
  signOut.className = 'navbar__sign-out';
  signOut.textContent = 'Sign Out';
  signOut.addEventListener('click', () => {
    authStore.signOut();
  });

  _authSegment.append(email, signOut);
}

export function render(activePage) {
  destroy();

  const navbar = document.createElement('header');
  const logo = document.createElement('div');
  const logoMark = document.createElement('img');
  const logoText = document.createElement('span');
  const navActions = document.createElement('nav');

  navbar.className = 'navbar';
  logo.className = 'navbar__logo';
  logoMark.className = 'navbar__logo-mark';
  logoMark.src = aliceWhite;
  logoMark.alt = '';
  logoText.className = 'navbar__logo-text';
  logoText.textContent = 'Project Alice';
  navActions.className = 'navbar__actions';
  navActions.setAttribute('aria-label', 'Primary navigation');

  for (const page of pages) {
    const button = document.createElement('button');
    button.className = 'nav-btn';
    button.type = 'button';
    button.dataset.page = page.id;
    button.textContent = page.label;
    navActions.append(button);
  }

  _authSegment = document.createElement('div');
  _authSegment.className = 'navbar__user';
  _authSegment.hidden = true;

  logo.append(logoMark, logoText);
  navbar.append(logo, navActions, _authSegment);
  _root = navbar;

  renderAuthSegment(authStore.getAuthState());
  _unsubscribe = authStore.subscribe(renderAuthSegment);

  setActive(activePage);
  return navbar;
}

export function destroy() {
  if (typeof _unsubscribe === 'function') {
    _unsubscribe();
  }
  _unsubscribe = null;
  _root = null;
  _authSegment = null;
}

export const Navbar = { render, setActive, destroy };
