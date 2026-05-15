import aliceWhite from '../../assets/Alice_White.png';
import applicationModalShot from '../../assets/welcome-hero/application-modal.png';
import calendarShot from '../../assets/welcome-hero/calendar.png';
import filtersShot from '../../assets/welcome-hero/filters.png';
import mobileTrackerShot from '../../assets/welcome-hero/mobile-tracker.png';
import profileShot from '../../assets/welcome-hero/profile.png';
import trackerShot from '../../assets/welcome-hero/tracker.png';
import { HeroSlideshow as DefaultHeroSlideshow } from './HeroSlideshow.js';

const VALID_AUTH_VIEWS = new Set([null, 'login', 'signup', 'verification_sent']);

const DEFAULT_HERO_SLIDES = [
  { src: trackerShot, alt: 'Tracker view showing job applications' },
  { src: applicationModalShot, alt: 'Application detail modal' },
  { src: profileShot, alt: 'Profile dashboard with summary and skills' },
  { src: filtersShot, alt: 'Status filter dropdown in the tracker toolbar' },
  { src: calendarShot, alt: 'Monthly calendar view' },
  { src: mobileTrackerShot, alt: 'Tracker view on a phone' },
];

let _container = null;
let _root = null;
let _overlaySlot = null;
let _heroSlideshow = null;
let _deps = null;
let _authView = null;
let _keyHandler = null;

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

function button(label, className, onClick, { disabled, title, dataAuthView } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = label;
  if (disabled) {
    btn.disabled = true;
  }
  if (title) {
    btn.title = title;
  }
  if (dataAuthView) {
    btn.dataset.authView = dataAuthView;
  }
  if (typeof onClick === 'function') {
    btn.addEventListener('click', onClick);
  }
  return btn;
}

function renderBrand() {
  const brand = el('div', 'welcome__brand');
  const mark = document.createElement('img');
  mark.className = 'welcome__brand-mark';
  mark.src = aliceWhite;
  mark.alt = '';
  const text = el('span', 'welcome__brand-text', 'Project Alice');
  brand.append(mark, text);
  return brand;
}

function renderHeadline() {
  const headline = document.createElement('h1');
  headline.className = 'welcome__headline';
  headline.append(document.createTextNode('Your job search,'));
  headline.append(document.createElement('br'));
  headline.append(document.createTextNode('organized.'));
  return headline;
}

function renderSupportingCopy() {
  return el(
    'p',
    'welcome__supporting',
    'Track applications, monitor status changes, and stay on top of follow-ups without losing the thread.',
  );
}

function renderCtaGroup() {
  const group = el('div', 'welcome__cta-group');

  const signIn = button('Sign In', 'welcome__cta welcome__cta--primary', (event) => {
    event.currentTarget.focus();
    setAuthView('login');
  }, { dataAuthView: 'login' });

  const signUp = button('Create Account', 'welcome__cta welcome__cta--secondary', (event) => {
    event.currentTarget.focus();
    setAuthView('signup');
  }, { dataAuthView: 'signup' });

  const tryDemo = button('Try Demo', 'welcome__cta welcome__cta--ghost', null, {
    disabled: true,
    title: 'Coming soon — available with the next release.',
  });

  group.append(signIn, signUp, tryDemo);
  return group;
}

function renderFooterMeta() {
  return el('p', 'welcome__footer-meta', 'Built with Vite · Supabase · Vercel');
}

function renderFloatingPills() {
  const wrap = el('div', 'welcome__floating-pills');
  for (const text of ['24 Active', '+12 This Month', '78% Match']) {
    wrap.append(el('span', 'welcome__pill', text));
  }
  wrap.append(
    el(
      'p',
      'welcome__sample-disclaimer',
      'Sample data — illustrative only',
    ),
  );
  return wrap;
}

function renderVerificationBanner() {
  const banner = el('div', 'welcome__verification-banner');
  banner.setAttribute('role', 'status');
  banner.textContent = 'Email verified. You can sign in now.';
  return banner;
}

function handleVerificationCallback(root) {
  if (typeof globalThis.location === 'undefined') {
    return;
  }
  let url;
  try {
    url = new URL(globalThis.location.href);
  } catch {
    return;
  }
  if (url.searchParams.get('auth') !== 'callback') {
    return;
  }

  root.prepend(renderVerificationBanner());

  url.searchParams.delete('auth');
  const search = url.searchParams.toString();
  const cleaned = url.pathname + (search ? `?${search}` : '') + url.hash;
  try {
    globalThis.history.replaceState({}, '', cleaned);
  } catch {
    // jsdom or restricted environments may reject replaceState; banner still rendered.
  }
}

export function setAuthView(view) {
  if (!VALID_AUTH_VIEWS.has(view)) {
    return;
  }
  _authView = view;
  _deps?.openAuthOverlay?.(view);
  renderOverlay();
}

function handleInternalViewChange(view) {
  if (!VALID_AUTH_VIEWS.has(view)) {
    return;
  }
  _authView = view;
  _deps?.openAuthOverlay?.(view);
  if (_overlaySlot) {
    _overlaySlot.dataset.authView = view;
  }
}

export function getAuthView() {
  return _authView;
}

function closeMountedOverlay() {
  if (!_overlaySlot) {
    return;
  }
  const overlayNode = _overlaySlot.firstElementChild;
  const overlayApi = overlayNode?.__authOverlay;
  if (overlayApi && typeof overlayApi.dispose === 'function') {
    try {
      overlayApi.dispose();
    } catch {
      // best-effort cleanup; we still tear down the DOM below
    }
  }
  _overlaySlot.replaceChildren();
}

function renderOverlay() {
  if (!_overlaySlot) {
    return;
  }
  closeMountedOverlay();

  if (_authView === null) {
    _overlaySlot.hidden = true;
    _overlaySlot.removeAttribute('data-auth-view');
    return;
  }

  _overlaySlot.hidden = false;
  _overlaySlot.dataset.authView = _authView;

  // Phase 06 renders a minimal sibling overlay slot so the state machine is
  // observable and dismissable. Phase 07's AuthOverlay will replace the shell
  // contents (forms, focus trap, accessible labels) via deps.authOverlay.
  if (_deps?.authOverlay?.render) {
    const node = _deps.authOverlay.render({
      view: _authView,
      onClose: () => setAuthView(null),
      onSwitch: (nextView) => handleInternalViewChange(nextView),
    });
    if (node) {
      _overlaySlot.append(node);
      return;
    }
  }

  const backdrop = el('div', 'welcome__auth-backdrop');
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      setAuthView(null);
    }
  });

  const panel = el('div', 'welcome__auth-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  const closeBtn = button('Close', 'welcome__auth-close', () => setAuthView(null));
  panel.append(closeBtn);

  _overlaySlot.append(backdrop, panel);
}

function onKeyDown(event) {
  if (event.key !== 'Escape' || _authView === null) {
    return;
  }
  // If a real AuthOverlay is mounted in the slot, defer to its own keydown
  // listener so it can run its close path (focus restoration, onClose). This
  // listener handles ESC only for the Phase 06 placeholder shell.
  const overlayNode = _overlaySlot?.firstElementChild;
  if (overlayNode?.__authOverlay) {
    return;
  }
  setAuthView(null);
}

export function mount(container, deps = {}) {
  if (_container) {
    unmount();
  }

  _container = container;
  _deps = deps;
  _authView = null;
  _root = el('div', 'welcome');

  const left = el('section', 'welcome__content');
  left.append(
    renderBrand(),
    renderHeadline(),
    renderSupportingCopy(),
    renderCtaGroup(),
    renderFooterMeta(),
  );

  const right = el('aside', 'welcome__hero');
  _heroSlideshow = deps.heroSlideshow ?? DefaultHeroSlideshow;
  _heroSlideshow.mount(right, { slides: deps.slides ?? DEFAULT_HERO_SLIDES });
  right.append(renderFloatingPills());

  _overlaySlot = el('div', 'welcome__auth-overlay-slot');
  _overlaySlot.hidden = true;

  _root.append(left, right, _overlaySlot);
  container.replaceChildren(_root);

  _keyHandler = onKeyDown;
  document.addEventListener('keydown', _keyHandler);

  handleVerificationCallback(_root);
}

export function unmount() {
  closeMountedOverlay();
  if (_keyHandler) {
    document.removeEventListener('keydown', _keyHandler);
    _keyHandler = null;
  }
  if (_heroSlideshow) {
    try {
      _heroSlideshow.unmount();
    } catch {
      // best-effort cleanup; container teardown still proceeds
    }
    _heroSlideshow = null;
  }
  if (_container) {
    _container.replaceChildren();
  }
  _container = null;
  _root = null;
  _overlaySlot = null;
  _deps = null;
  _authView = null;
}

export const WelcomePage = { mount, unmount, setAuthView, getAuthView };
