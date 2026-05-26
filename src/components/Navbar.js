import aliceWhite from '../assets/Alice_White.png';
import { Toast } from './Toast.js';
import * as authStore from '../data/authStore.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const pages = [
  { id: 'tracker', label: 'Tracker' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'profile', label: 'Profile' },
];

let _root = null;
let _identityCluster = null;
let _unsubscribe = null;

function createDoorArrowIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'signout-btn__icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '13');
  svg.setAttribute('height', '13');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const doorFrame = document.createElementNS(SVG_NS, 'path');
  doorFrame.setAttribute('d', 'M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8');
  const arrowShaft = document.createElementNS(SVG_NS, 'path');
  arrowShaft.setAttribute('d', 'M11 12h10');
  const arrowHead = document.createElementNS(SVG_NS, 'path');
  arrowHead.setAttribute('d', 'M17 8l4 4-4 4');

  for (const element of [doorFrame, arrowShaft, arrowHead]) {
    element.setAttribute('fill', 'none');
    element.setAttribute('stroke', 'currentColor');
    element.setAttribute('stroke-width', '2');
    element.setAttribute('stroke-linecap', 'round');
    element.setAttribute('stroke-linejoin', 'round');
  }

  svg.append(doorFrame, arrowShaft, arrowHead);
  return svg;
}

export function setActive(page) {
  if (!_root) {
    return;
  }

  for (const button of _root.querySelectorAll('.nav-btn')) {
    button.classList.toggle('nav-btn--active', button.dataset.page === page);
  }
}

function renderIdentityCluster(state) {
  if (!_identityCluster) {
    return;
  }
  _identityCluster.replaceChildren();

  // Feature 020: demo branch — render a textual "Demo mode" badge plus
  // an Exit demo button. The badge keeps the mode unambiguous for
  // visitors who land deep in the app; the button is the canonical
  // exit affordance (FR-007).
  if (state?.status === 'demo') {
    _identityCluster.hidden = false;

    const badge = document.createElement('span');
    badge.className = 'topbar-demo-badge';
    badge.textContent = 'Demo mode';
    badge.setAttribute('aria-label', 'Demo mode active');

    const exit = document.createElement('button');
    exit.type = 'button';
    exit.className = 'signout-btn';
    exit.setAttribute('aria-label', 'Exit demo');

    const exitLabel = document.createElement('span');
    exitLabel.className = 'signout-btn__label';
    exitLabel.textContent = 'Exit demo';

    exit.append(createDoorArrowIcon(), exitLabel);
    exit.addEventListener('click', () => {
      authStore.exitDemo();
      Toast.show('Exited demo', 'success');
    });

    _identityCluster.append(badge, exit);
    return;
  }

  if (!state || state.status !== 'authenticated' || !state.user?.email) {
    _identityCluster.hidden = true;
    return;
  }

  _identityCluster.hidden = false;

  const email = document.createElement('span');
  email.className = 'topbar-email';
  email.textContent = state.user.email;
  email.title = state.user.email;

  const signOut = document.createElement('button');
  signOut.type = 'button';
  signOut.className = 'signout-btn';
  signOut.setAttribute('aria-label', 'Sign out');

  const label = document.createElement('span');
  label.className = 'signout-btn__label';
  label.textContent = 'Sign out';

  signOut.append(createDoorArrowIcon(), label);
  signOut.addEventListener('click', async () => {
    await authStore.signOut();
    Toast.show('Signed out', 'success');
  });

  _identityCluster.append(email, signOut);
}

export function render(activePage) {
  destroy();

  const topbar = document.createElement('header');
  topbar.className = 'topbar';

  const brand = document.createElement('div');
  brand.className = 'topbar-brand';

  const brandMark = document.createElement('img');
  brandMark.className = 'topbar-brand-mark';
  brandMark.src = aliceWhite;
  brandMark.alt = '';

  const brandText = document.createElement('span');
  brandText.className = 'topbar-brand-text';
  brandText.textContent = 'Project Alice';

  const brandTextShort = document.createElement('span');
  brandTextShort.className = 'topbar-brand-text--short';
  brandTextShort.textContent = 'Alice';

  brand.append(brandMark, brandText, brandTextShort);

  const pageNav = document.createElement('nav');
  pageNav.className = 'topbar-nav';
  pageNav.setAttribute('aria-label', 'Primary navigation');

  for (const page of pages) {
    const button = document.createElement('button');
    button.className = 'nav-btn';
    button.type = 'button';
    button.dataset.page = page.id;
    button.textContent = page.label;
    pageNav.append(button);
  }

  _identityCluster = document.createElement('div');
  _identityCluster.className = 'topbar-identity';
  _identityCluster.hidden = true;

  topbar.append(brand, pageNav, _identityCluster);
  _root = topbar;

  renderIdentityCluster(authStore.getAuthState());
  _unsubscribe = authStore.subscribe(renderIdentityCluster);

  setActive(activePage);
  return topbar;
}

export function destroy() {
  if (typeof _unsubscribe === 'function') {
    _unsubscribe();
  }
  _unsubscribe = null;
  _root = null;
  _identityCluster = null;
}

export const Navbar = { render, setActive, destroy };
