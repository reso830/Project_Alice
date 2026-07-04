import aliceColored from '../../assets/logo/alice-sigil-full.svg';
import aliceWhite from '../../assets/logo/alice-sigil-full-white.svg';
import { HeroSlideshow as DefaultHeroSlideshow } from './HeroSlideshow.js';
import { enterDemo } from './demoStub.js';
import { APP_VERSION, ISSUE_URL, LICENSE_NAME, LICENSE_URL } from './shared/appMeta.js';

const REPOSITORY_URL = 'https://github.com/reso830/Project_Alice';
const RELEASES_URL = 'https://github.com/reso830/Project_Alice/releases/latest';

// Theme-driven brand mark. Production uses the warm default; white/navy
// variants remain as CSS design states after the prototype controls were
// removed.
const BRAND_MARKS = {
  warm: aliceColored,
  white: aliceColored,
  navy: aliceWhite,
};

const DEFAULT_WELCOME_CONFIG = Object.freeze({
  layout: 'diagonal',
  theme: 'warm',
  copyIntensity: 'none',
  heroScene: 'auto',
});

const VALID_AUTH_VIEWS = new Set([null, 'login', 'signup', 'verification_sent']);

let _container = null;
let _root = null;
let _overlaySlot = null;
let _heroSlideshow = null;
let _heroSlot = null;
let _brandMarkEl = null;
let _footerMetaEl = null;
let _tabletMql = null;
let _tabletListener = null;
let _mobileMql = null;
let _mobileListener = null;
let _isMobile = false;
let _effective = null;
let _deps = null;
let _authView = null;
let _keyHandler = null;

const LAYOUT_CLASSES = ['diagonal', 'split', 'centered', 'hero'];
const THEME_CLASSES = ['warm', 'white', 'navy'];
const COPY_CLASSES = ['none', 'minimal', 'pitch'];

function classMatcher(prefix, allowed) {
  return (cls) => allowed.some((v) => cls === `${prefix}${v}`);
}

function tabletMatches() {
  if (typeof globalThis.matchMedia !== 'function') return false;
  try {
    return globalThis.matchMedia('(min-width: 621px) and (max-width: 900px)').matches === true;
  } catch {
    return false;
  }
}

function mobileMatches() {
  if (typeof globalThis.matchMedia !== 'function') return false;
  try {
    return globalThis.matchMedia('(max-width: 620px)').matches === true;
  } catch {
    return false;
  }
}

function computeEffective(config) {
  const isTablet = tabletMatches();
  const isMobile = mobileMatches();
  const layout = (isTablet || isMobile) ? 'centered' : config.layout;
  const variant = layout === 'centered' ? 'centered' : 'default';
  return {
    layout,
    theme: config.theme,
    copyIntensity: config.copyIntensity,
    heroScene: config.heroScene,
    variant,
    isTablet,
    isMobile,
  };
}

function applyTweakClasses(root, eff) {
  if (!root) return;
  const isLayoutClass = classMatcher('welcome--layout-', LAYOUT_CLASSES);
  const isThemeClass = classMatcher('welcome--theme-', THEME_CLASSES);
  const isCopyClass = classMatcher('welcome--copy-', COPY_CLASSES);
  Array.from(root.classList).forEach((cls) => {
    if (isLayoutClass(cls) || isThemeClass(cls) || isCopyClass(cls)) {
      root.classList.remove(cls);
    }
  });
  root.classList.add(`welcome--layout-${eff.layout}`);
  root.classList.add(`welcome--theme-${eff.theme}`);
  root.classList.add(`welcome--copy-${eff.copyIntensity}`);
}

function effectiveBrandMark(theme, isMobile) {
  if (isMobile) return BRAND_MARKS.warm;
  return BRAND_MARKS[theme] ?? BRAND_MARKS.warm;
}

function updateBrandMark(theme) {
  if (!_brandMarkEl) return;
  _brandMarkEl.src = effectiveBrandMark(theme, _isMobile);
}

function mountHero(slot, eff) {
  // Phase 18: on mobile there is no slideshow to remount. Either of these
  // being absent means the slideshow was never mounted (mobile branch).
  if (!_heroSlideshow || !slot) return;
  try {
    _heroSlideshow.unmount();
  } catch {
    // best-effort
  }
  _heroSlideshow.mount(slot, {
    heroScene: eff.heroScene,
    variant: eff.variant,
  });
}

function ensureSlideshowMounted() {
  // Idempotent: creates `_heroSlot`, mounts the slideshow module, and inserts
  // the slot before `_overlaySlot` so DOM order matches the initial mount.
  if (_heroSlot || !_root || !_deps) return;
  _heroSlot = el('aside', 'welcome__hero');
  _heroSlideshow = _deps.heroSlideshow ?? DefaultHeroSlideshow;
  _heroSlideshow.mount(_heroSlot, {
    heroScene: _effective.heroScene,
    variant: _effective.variant,
  });
  const beforeNode = _footerMetaEl?.parentNode === _root ? _footerMetaEl : _overlaySlot;
  if (beforeNode && beforeNode.parentNode === _root) {
    _root.insertBefore(_heroSlot, beforeNode);
  } else {
    _root.append(_heroSlot);
  }
}

function handleViewportChange() {
  if (!_root) return;
  const prev = _effective;
  const eff = computeEffective(DEFAULT_WELCOME_CONFIG);
  _effective = eff;
  applyTweakClasses(_root, eff);
  if (prev?.theme !== eff.theme) updateBrandMark(eff.theme);
  const heroChanged = !prev || prev.heroScene !== eff.heroScene || prev.variant !== eff.variant;
  if (heroChanged) mountHero(_heroSlot, eff);
}

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

function renderBrand({ theme = 'warm' } = {}) {
  const brand = el('div', 'welcome__brand');
  const mark = document.createElement('img');
  mark.className = 'welcome__brand-mark';
  mark.src = effectiveBrandMark(theme, _isMobile);
  mark.alt = '';
  _brandMarkEl = mark;
  const text = el('span', 'welcome__brand-text', 'Project Alice');
  brand.append(mark, text);
  return brand;
}

function renderHeadline() {
  const headline = document.createElement('h1');
  headline.className = 'welcome__headline';
  headline.append(document.createTextNode('Your job search,'));
  headline.append(document.createElement('br'));
  const accent = document.createElement('em');
  accent.className = 'welcome__headline-accent';
  accent.textContent = 'organized.';
  headline.append(accent);
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

  // Feature 020: enters the portfolio demo via `demoStub.enterDemo()`,
  // which delegates to `authStore.enterDemo()` (loads the seed and flips
  // the status to `'demo'`). The auth modal's footer demo button uses
  // the same handler — single seam for both call sites.
  const tryDemo = button('Try the demo', 'welcome__cta welcome__cta--ghost', () => {
    enterDemo();
  });

  group.append(signIn, signUp, tryDemo);
  return group;
}

function makeExternalLink(text, href, ariaLabel) {
  const a = document.createElement('a');
  a.className = 'welcome__footer-link';
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = text;
  if (ariaLabel) {
    a.setAttribute('aria-label', ariaLabel);
  }
  return a;
}

function renderFooterMeta() {
  const wrap = document.createElement('p');
  wrap.className = 'welcome__footer-meta';
  _footerMetaEl = wrap;

  const version = document.createElement('span');
  version.className = 'welcome__footer-version';
  version.textContent = APP_VERSION;

  wrap.append(
    version,
    makeExternalLink(LICENSE_NAME, LICENSE_URL, `${LICENSE_NAME} license`),
    makeExternalLink('⊙ Report an issue', ISSUE_URL, 'Report an issue on GitHub'),
    makeExternalLink('✦ Request a feature', ISSUE_URL, 'Request a feature on GitHub'),
  );

  const repo = makeExternalLink('GitHub', REPOSITORY_URL, 'Open Project Alice repository');
  repo.classList.add('welcome__footer-desktop-only');

  const download = makeExternalLink(
    `Download Alice Portable ${APP_VERSION}`,
    RELEASES_URL,
    `Download Alice Portable ${APP_VERSION}`,
  );
  download.classList.add('welcome__footer-download', 'welcome__footer-desktop-only');

  wrap.append(repo, download);

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

  _effective = computeEffective(DEFAULT_WELCOME_CONFIG);
  _isMobile = mobileMatches();

  _root = el('div', 'welcome');
  applyTweakClasses(_root, _effective);
  if (_isMobile) _root.classList.add('welcome--mobile');

  const left = el('section', 'welcome__content');
  left.append(
    renderBrand({ theme: _effective.theme }),
    renderHeadline(),
    renderSupportingCopy(),
    renderCtaGroup(),
  );
  const footerMeta = renderFooterMeta();

  _overlaySlot = el('div', 'welcome__auth-overlay-slot');
  _overlaySlot.hidden = true;

  _root.append(left, footerMeta, _overlaySlot);
  container.replaceChildren(_root);

  ensureSlideshowMounted();

  _keyHandler = onKeyDown;
  document.addEventListener('keydown', _keyHandler);

  // Tablet width forces `centered` layout — listen for viewport changes so
  // resize-driven layout swaps mount the right scene variant.
  if (typeof globalThis.matchMedia === 'function') {
    try {
      _tabletMql = globalThis.matchMedia('(min-width: 621px) and (max-width: 900px)');
      _tabletListener = () => handleViewportChange();
      _tabletMql.addEventListener('change', _tabletListener);
    } catch {
      _tabletMql = null;
      _tabletListener = null;
    }
    // Mobile listener toggles the `.welcome--mobile` class while keeping the
    // showcase mounted; CSS owns the portrait/landscape height behavior.
    try {
      _mobileMql = globalThis.matchMedia('(max-width: 620px)');
      _mobileListener = () => {
        if (!_root) return;
        const nextMobile = _mobileMql.matches === true;
        if (nextMobile === _isMobile) return;
        _isMobile = nextMobile;
        _root.classList.toggle('welcome--mobile', _isMobile);
        _effective = computeEffective(DEFAULT_WELCOME_CONFIG);
        applyTweakClasses(_root, _effective);
        ensureSlideshowMounted();
        mountHero(_heroSlot, _effective);
        updateBrandMark(_effective.theme);
      };
      _mobileMql.addEventListener('change', _mobileListener);
    } catch {
      _mobileMql = null;
      _mobileListener = null;
    }
  }

  handleVerificationCallback(_root);
}

export function unmount() {
  closeMountedOverlay();
  if (_keyHandler) {
    document.removeEventListener('keydown', _keyHandler);
    _keyHandler = null;
  }
  if (_tabletMql && _tabletListener) {
    try { _tabletMql.removeEventListener('change', _tabletListener); } catch { /* best-effort */ }
  }
  _tabletMql = null;
  _tabletListener = null;
  if (_mobileMql && _mobileListener) {
    try { _mobileMql.removeEventListener('change', _mobileListener); } catch { /* best-effort */ }
  }
  _mobileMql = null;
  _mobileListener = null;
  _isMobile = false;
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
  _heroSlot = null;
  _brandMarkEl = null;
  _footerMetaEl = null;
  _effective = null;
  _deps = null;
  _authView = null;
}

export const WelcomePage = { mount, unmount, setAuthView, getAuthView };
