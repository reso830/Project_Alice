import aliceColored from '../../assets/Alice_Colored.png';
import aliceWhite from '../../assets/Alice_White.png';
import { HeroSlideshow as DefaultHeroSlideshow } from './HeroSlideshow.js';
import { showDemoComingSoon } from './demoStub.js';
import { APP_VERSION, ISSUE_URL, LICENSE_NAME, LICENSE_URL } from './shared/appMeta.js';
import * as defaultTweaksStore from './tweaks/tweaksStore.js';
import { TweaksPanel as DefaultTweaksPanel } from './tweaks/TweaksPanel.js';

// Phase 14: theme-driven brand mark. The Tweaks panel (Phase 16) will swap
// `theme` between `warm | white | navy`; the colored variant pairs with the
// two light themes, the white variant with the navy theme. Phase 14 ships
// the default (`warm` theme → colored mark).
const BRAND_MARKS = {
  warm: aliceColored,
  white: aliceColored,
  navy: aliceWhite,
};

const VALID_AUTH_VIEWS = new Set([null, 'login', 'signup', 'verification_sent']);

let _container = null;
let _root = null;
let _overlaySlot = null;
let _heroSlideshow = null;
let _heroSlot = null;
let _brandMarkEl = null;
let _tweaksStore = null;
let _tweaksPanel = null;
let _tweaksUnsubscribe = null;
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
    return globalThis.matchMedia('(min-width: 760px) and (max-width: 1099px)').matches === true;
  } catch {
    return false;
  }
}

function mobileMatches() {
  if (typeof globalThis.matchMedia !== 'function') return false;
  try {
    return globalThis.matchMedia('(max-width: 759px)').matches === true;
  } catch {
    return false;
  }
}

function computeEffective(tweaks) {
  // Plan §14.C: tablet width forces `layout: centered` regardless of Tweaks
  // panel selection. `variant` flows to `HeroSlideshow` so SceneStack /
  // SceneLogo render their tablet-correct DOM (2 cards / fixed 200×200).
  const isTablet = tabletMatches();
  const layout = isTablet ? 'centered' : tweaks.layout;
  const variant = layout === 'centered' ? 'centered' : 'default';
  return {
    layout,
    theme: tweaks.theme,
    copyIntensity: tweaks.copyIntensity,
    authState: tweaks.authState,
    heroScene: tweaks.heroScene,
    variant,
    isTablet,
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

function updateBrandMark(theme) {
  if (!_brandMarkEl) return;
  _brandMarkEl.src = BRAND_MARKS[theme] ?? BRAND_MARKS.warm;
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

function authStateToView(authState) {
  if (authState === 'signin') return 'login';
  if (authState === 'signup') return 'signup';
  return null;
}

function handleTweaksChange(next) {
  if (!_root) return;
  const prev = _effective;
  const eff = computeEffective(next);
  _effective = eff;
  applyTweakClasses(_root, eff);
  if (prev?.theme !== eff.theme) updateBrandMark(eff.theme);
  const heroChanged = !prev || prev.heroScene !== eff.heroScene || prev.variant !== eff.variant;
  if (heroChanged) mountHero(_heroSlot, eff);
  // Phase 17: the Tweaks panel can drive the auth modal directly. A change to
  // `authState` opens the modal if it is closed, swaps the view if it is open
  // in the other sign-in/up mode, and is a no-op in `verification_sent`. The
  // initial `init()` notify fires before WelcomePage subscribes, so this only
  // runs in response to user-driven `setTweak` calls.
  const authChanged = !prev || prev.authState !== eff.authState;
  const targetView = authStateToView(eff.authState);
  if (authChanged && targetView) {
    if (_authView === null) {
      // Modal closed — open it in the target view via the full mount path.
      setAuthView(targetView);
    } else if ((_authView === 'login' || _authView === 'signup') && _authView !== targetView) {
      // Modal already open — swap views in place via the overlay's internal
      // setView so the DOM node, focus, and entered email persist.
      const overlayNode = _overlaySlot?.firstElementChild;
      const overlayApi = overlayNode?.__authOverlay;
      if (overlayApi?.setView) {
        overlayApi.setView(targetView);
      } else {
        setAuthView(targetView);
      }
    }
    // verification_sent intentionally left alone.
  }
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
  mark.src = BRAND_MARKS[theme] ?? BRAND_MARKS.warm;
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

  // Phase 14: enabled CTA wired to the shared `showDemoComingSoon` stub.
  // Phase 17 wires the in-modal demo button to the same handler.
  // Feature 020 will replace `demoStub.js` with the real demo route.
  const tryDemo = button('Try the demo', 'welcome__cta welcome__cta--ghost', () => {
    showDemoComingSoon();
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

  const version = document.createElement('span');
  version.className = 'welcome__footer-version';
  version.textContent = APP_VERSION;

  wrap.append(
    version,
    makeExternalLink(LICENSE_NAME, LICENSE_URL, `${LICENSE_NAME} license`),
    makeExternalLink('⊙ Report an issue', ISSUE_URL, 'Report an issue on GitHub'),
    makeExternalLink('✦ Request a feature', ISSUE_URL, 'Request a feature on GitHub'),
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

  _tweaksStore = deps.tweaksStore ?? defaultTweaksStore;
  _tweaksStore.init();
  const initialTweaks = _tweaksStore.getTweaks();
  _effective = computeEffective(initialTweaks);
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
    renderFooterMeta(),
  );

  // Phase 18: on mobile the hero slideshow is omitted entirely. Resize-driven
  // viewport crossings only toggle `.welcome--mobile` on the root; the
  // slideshow remains in whatever state it was at mount.
  if (!_isMobile) {
    _heroSlot = el('aside', 'welcome__hero');
    _heroSlideshow = deps.heroSlideshow ?? DefaultHeroSlideshow;
    _heroSlideshow.mount(_heroSlot, {
      heroScene: _effective.heroScene,
      variant: _effective.variant,
    });
  }

  _overlaySlot = el('div', 'welcome__auth-overlay-slot');
  _overlaySlot.hidden = true;

  if (_heroSlot) {
    _root.append(left, _heroSlot, _overlaySlot);
  } else {
    _root.append(left, _overlaySlot);
  }
  container.replaceChildren(_root);

  _keyHandler = onKeyDown;
  document.addEventListener('keydown', _keyHandler);

  // Subscribe to tweaks AFTER initial render so the first notify is a no-op
  // (state hasn't changed; we only react to subsequent setTweak calls).
  _tweaksUnsubscribe = _tweaksStore.subscribe(handleTweaksChange);

  // Tablet width forces `centered` layout — listen for viewport changes so
  // resize-driven layout swaps mount the right scene variant.
  if (typeof globalThis.matchMedia === 'function') {
    try {
      _tabletMql = globalThis.matchMedia('(min-width: 760px) and (max-width: 1099px)');
      _tabletListener = () => handleTweaksChange(_tweaksStore.getTweaks());
      _tabletMql.addEventListener('change', _tabletListener);
    } catch {
      _tabletMql = null;
      _tabletListener = null;
    }
    // Phase 18: mobile listener toggles the `.welcome--mobile` class on the
    // root. CSS handles the visual swap; components already mounted at
    // load-time stay mounted (no remount on viewport crossing).
    try {
      _mobileMql = globalThis.matchMedia('(max-width: 759px)');
      _mobileListener = () => {
        if (!_root) return;
        _isMobile = _mobileMql.matches === true;
        _root.classList.toggle('welcome--mobile', _isMobile);
      };
      _mobileMql.addEventListener('change', _mobileListener);
    } catch {
      _mobileMql = null;
      _mobileListener = null;
    }
  }

  // Tweaks panel is hidden on mobile (self-skips at mount via its own
  // matchMedia check). Skipping the mount call here keeps the DOM clean.
  if (!_isMobile) {
    _tweaksPanel = deps.tweaksPanel ?? DefaultTweaksPanel;
    try {
      _tweaksPanel.mount(_root, { tweaksStore: _tweaksStore });
    } catch {
      _tweaksPanel = null;
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
  if (_tweaksUnsubscribe) {
    try { _tweaksUnsubscribe(); } catch { /* best-effort */ }
    _tweaksUnsubscribe = null;
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
  if (_tweaksPanel) {
    try { _tweaksPanel.unmount(); } catch { /* best-effort */ }
    _tweaksPanel = null;
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
  _heroSlot = null;
  _brandMarkEl = null;
  _tweaksStore = null;
  _effective = null;
  _deps = null;
  _authView = null;
}

export const WelcomePage = { mount, unmount, setAuthView, getAuthView };
