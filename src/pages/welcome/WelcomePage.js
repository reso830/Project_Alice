import aliceColored from '../../assets/logo/alice-sigil-full.svg';
import { HeroSlideshow as DefaultHeroSlideshow } from './HeroSlideshow.js';
import { enterDemo } from './demoStub.js';
import { LegalModal } from '../../components/LegalModal.js';
import { APP_VERSION, ISSUE_URL, LICENSE_NAME, LICENSE_URL } from './shared/appMeta.js';
import { RECOVERY_FLOW_MARKER, RECOVERY_URL_MARKER } from '../../data/authStore.js';
import { isHostedAuthAvailable } from '../../services/supabaseClient.js';

const REPOSITORY_URL = 'https://github.com/reso830/Project_Alice';
const RELEASES_URL = 'https://github.com/reso830/Project_Alice/releases/latest';
const PORTFOLIO_URL = 'https://alvinresoso.com';

// Issue #139: hosted-mode-only, non-dismissible disclosure. Copy is a
// deliberate product decision (see issue #139) — don't reword without
// re-checking there.
const LIMITATIONS_BANNER_COPY =
  'Heads up — Project Alice is a portfolio demonstrator, not a live product. '
  + 'Hosted signup requires an invite, and password-reset emails are limited '
  + 'to a handful every few hours.';

// Theme-driven brand mark. Production ships the midnight (navy) theme per the
// welcome-redesign prototype default; warm/white remain as CSS design states.
const BRAND_MARKS = {
  warm: aliceColored,
  white: aliceColored,
  navy: aliceColored,
};

const DEFAULT_WELCOME_CONFIG = Object.freeze({
  layout: 'diagonal',
  theme: 'navy',
  copyIntensity: 'none',
  heroScene: 'auto',
});

const VALID_AUTH_VIEWS = new Set([
  null, 'login', 'signup', 'verification_sent', 'forgot', 'forgot_sent', 'reset-password', 'recovery-expired',
]);

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
let _legalDialog = null; // 'terms' | 'privacy' | null
let _legalDialogNode = null;
let _legalTriggerEl = null;
let _limitationsBannerEl = null;
let _limitationsViewportEl = null;
let _limitationsTrackEl = null;
let _limitationsResizeObserver = null;

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
  headline.append(document.createTextNode('Your '));
  const accent = document.createElement('em');
  accent.className = 'welcome__headline-accent';
  accent.textContent = 'Career OS.';
  headline.append(accent);
  return headline;
}

function renderSupportingCopy() {
  return el(
    'p',
    'welcome__supporting',
    'Track every application and see how you match — all in one place, on your terms.',
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

function closeLegalDialog() {
  _legalDialog = null;
  _legalDialogNode = null;
  if (_legalTriggerEl && typeof _legalTriggerEl.focus === 'function') {
    _legalTriggerEl.focus();
  }
  _legalTriggerEl = null;
}

// Shell-level dialog state (design_handoffs/Alice_Legal): only one of
// terms/privacy can be open at a time, reachable from both the mini-footer
// and the signup consent copy without either trigger owning the modal.
function setLegalDialog(type) {
  if (!_root || (type !== 'terms' && type !== 'privacy') || _legalDialog) {
    return;
  }
  _legalTriggerEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  _legalDialog = type;
  _legalDialogNode = LegalModal.render(type, closeLegalDialog);
}

function makeLegalLink(text, type, ariaLabel) {
  const link = document.createElement('button');
  link.type = 'button';
  link.className = 'welcome__footer-link';
  link.textContent = text;
  if (ariaLabel) {
    link.setAttribute('aria-label', ariaLabel);
  }
  link.addEventListener('click', () => setLegalDialog(type));
  return link;
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

// Scattered ambient sparkles across the galaxy background (prototype
// PAGE_TWINKLES). Desktop-only; behind the content.
const PAGE_TWINKLES = [
  { top: '8%', left: '4%', size: 14, dur: '3.4s', del: '.2s' },
  { top: '16%', left: '22%', size: 10, dur: '2.7s', del: '1.1s' },
  { top: '28%', left: '9%', size: 12, dur: '3.9s', del: '.6s' },
  { top: '38%', left: '31%', size: 9, dur: '2.4s', del: '1.8s' },
  { top: '52%', left: '6%', size: 13, dur: '3.1s', del: '2.2s' },
  { top: '64%', left: '24%', size: 10, dur: '2.9s', del: '.4s' },
  { top: '74%', left: '12%', size: 15, dur: '3.6s', del: '1.5s' },
  { top: '86%', left: '34%', size: 9, dur: '2.5s', del: '2.6s' },
  { top: '20%', left: '44%', size: 10, dur: '3.2s', del: '.9s' },
  { top: '46%', left: '40%', size: 8, dur: '2.8s', del: '1.9s' },
  { top: '70%', left: '46%', size: 11, dur: '3.5s', del: '.3s' },
  { top: '12%', left: '62%', size: 12, dur: '2.6s', del: '1.3s' },
  { top: '34%', left: '56%', size: 9, dur: '3.8s', del: '2.4s' },
  { top: '60%', left: '62%', size: 13, dur: '3.0s', del: '.7s' },
  { top: '82%', left: '58%', size: 10, dur: '2.3s', del: '1.6s' },
  { top: '6%', left: '82%', size: 12, dur: '3.3s', del: '1.0s' },
  { top: '42%', left: '88%', size: 14, dur: '2.9s', del: '.5s' },
  { top: '90%', left: '80%', size: 9, dur: '3.7s', del: '2.0s' },
  { top: '10%', left: '38%', size: 16, dur: '3.0s', del: '.7s' },
  { top: '24%', left: '70%', size: 11, dur: '2.6s', del: '1.7s' },
  { top: '54%', left: '78%', size: 18, dur: '3.4s', del: '.4s' },
  { top: '78%', left: '70%', size: 12, dur: '2.9s', del: '2.1s' },
  { top: '30%', left: '90%', size: 10, dur: '3.6s', del: '1.2s' },
  { top: '4%', left: '52%', size: 13, dur: '2.8s', del: '.6s' },
  { top: '48%', left: '18%', size: 20, dur: '3.9s', del: '1.4s' },
  { top: '66%', left: '36%', size: 9, dur: '2.4s', del: '2.3s' },
  { top: '88%', left: '18%', size: 14, dur: '3.2s', del: '.9s' },
  { top: '18%', left: '9%', size: 22, dur: '4.0s', del: '1.9s' },
  { top: '40%', left: '68%', size: 11, dur: '2.7s', del: '.3s' },
  { top: '58%', left: '52%', size: 8, dur: '3.3s', del: '1.6s' },
  { top: '94%', left: '46%', size: 12, dur: '2.5s', del: '2.4s' },
  { top: '14%', left: '92%', size: 15, dur: '3.5s', del: '1.0s' },
];

function renderStarfield() {
  const svgns = 'http://www.w3.org/2000/svg';
  const field = document.createElement('div');
  field.className = 'welcome__starfield';
  field.setAttribute('aria-hidden', 'true');
  for (const t of PAGE_TWINKLES) {
    const span = document.createElement('span');
    span.className = 'welcome__spark';
    span.style.top = t.top;
    span.style.left = t.left;
    span.style.setProperty('--tw-dur', t.dur);
    span.style.setProperty('--tw-del', t.del);
    const svg = document.createElementNS(svgns, 'svg');
    svg.setAttribute('width', String(t.size));
    svg.setAttribute('height', String(t.size));
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'currentColor');
    const path = document.createElementNS(svgns, 'path');
    path.setAttribute('d', 'M12 1.5c.8 6.4 3.1 8.7 9.5 9.5-6.4.8-8.7 3.1-9.5 9.5-.8-6.4-3.1-8.7-9.5-9.5 6.4-.8 8.7-3.1 9.5-9.5Z');
    svg.append(path);
    span.append(svg);
    field.append(span);
  }
  return field;
}

function createDownloadIcon() {
  const svgns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgns, 'svg');
  svg.setAttribute('class', 'welcome__footer-download-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(svgns, 'path');
  path.setAttribute('d', 'M12 3v12m0 0 4-4m-4 4-4-4M5 20h14');
  svg.append(path);
  return svg;
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
    makeLegalLink('Terms & Conditions', 'terms', 'View Terms & Conditions'),
    makeLegalLink('Privacy Policy', 'privacy', 'View Privacy Policy'),
    makeExternalLink('Report issue', ISSUE_URL, 'Report issue on GitHub'),
    makeExternalLink('Request feature', ISSUE_URL, 'Request feature on GitHub'),
    makeExternalLink('alvinresoso.com', PORTFOLIO_URL, 'Visit alvinresoso.com'),
  );

  const repo = makeExternalLink('GitHub', REPOSITORY_URL, 'Open Project Alice repository');
  repo.classList.add('welcome__footer-desktop-only');

  const download = makeExternalLink(
    `Download Alice Portable ${APP_VERSION}`,
    RELEASES_URL,
    `Download Alice Portable ${APP_VERSION}`,
  );
  download.classList.add('welcome__footer-download', 'welcome__footer-desktop-only');
  download.prepend(createDownloadIcon());

  // Download chip drops to its own line below the rest of the footer.
  const downloadRow = document.createElement('div');
  downloadRow.className = 'welcome__footer-download-row welcome__footer-desktop-only';
  downloadRow.append(download);

  wrap.append(repo, downloadRow);

  return wrap;
}

// Issue #139: true once the ticker text is actually wider than the space
// it has to scroll in — never guessed from a breakpoint, since that varies
// with font rendering/zoom. `+1` tolerates subpixel rounding.
export function shouldMarquee(trackEl, viewportEl) {
  if (!trackEl || !viewportEl) return false;
  return trackEl.scrollWidth > viewportEl.clientWidth + 1;
}

// Issue #139 review (Antigravity): re-measures on a real layout change
// (ResizeObserver) rather than only on window `resize` — the self-hosted
// @fontsource fonts load asynchronously, and a font swap changes the
// track's rendered width (and therefore whether it overflows) without
// firing a `resize` event at all, which could leave the marquee stuck in
// the wrong state. Also sets `--marquee-distance` to the exact overflow
// in pixels so the CSS animation slides by precisely that amount instead
// of the track's full `-100%` width, which used to leave a blank gap
// (track fully exited) right before the loop reset.
function updateLimitationsMarquee() {
  if (!_limitationsBannerEl || !_limitationsTrackEl || !_limitationsViewportEl) return;
  const overflowing = shouldMarquee(_limitationsTrackEl, _limitationsViewportEl);
  if (overflowing) {
    const distance = _limitationsTrackEl.scrollWidth - _limitationsViewportEl.clientWidth;
    _limitationsTrackEl.style.setProperty('--marquee-distance', `${distance}px`);
  }
  _limitationsBannerEl.classList.toggle('welcome__limitations-banner--marquee', overflowing);
}

function renderLimitationsBanner() {
  const banner = el('div', 'welcome__limitations-banner');
  banner.setAttribute('role', 'note');
  banner.setAttribute('aria-label', 'Hosted deployment limitations');

  const viewport = el('div', 'welcome__limitations-viewport');
  const track = el('span', 'welcome__limitations-track', LIMITATIONS_BANNER_COPY);
  viewport.append(track);
  banner.append(viewport);

  _limitationsBannerEl = banner;
  _limitationsViewportEl = viewport;
  _limitationsTrackEl = track;

  return banner;
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

  // Feature 045: a password-recovery link reuses this same redirect URL
  // (VITE_AUTH_EMAIL_REDIRECT_URL — research.md D4), so it carries
  // `?auth=callback` alongside a recovery marker — either Supabase's own
  // `type=recovery` on a successful link, or Alice's own `flow=recovery`
  // (RECOVERY_FLOW_MARKER, authStore.js) on a failed/expired one, which
  // Supabase's error redirect doesn't carry `type=recovery` for at all
  // (live-verification finding, 2026-07-10 — see RECOVERY_FLOW_MARKER's
  // comment). Either marker means a recovery visit, not a signup-
  // verification one — showing "Email verified" here would be wrong.
  // Recovery routing itself is authStore's job (its own guard already reads
  // these same markers, independently, before this ever runs); this only
  // suppresses the wrong banner. `?auth=callback` is still stripped below
  // either way.
  const isRecoveryLink =
    url.hash.includes(RECOVERY_URL_MARKER) || url.search.includes(RECOVERY_URL_MARKER)
    || url.hash.includes(RECOVERY_FLOW_MARKER) || url.search.includes(RECOVERY_FLOW_MARKER);
  if (!isRecoveryLink) {
    root.prepend(renderVerificationBanner());
  }

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
      onLegalLink: (type) => setLegalDialog(type),
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
  _authView = VALID_AUTH_VIEWS.has(deps.initialAuthView) ? deps.initialAuthView : null;

  _effective = computeEffective(DEFAULT_WELCOME_CONFIG);
  _isMobile = mobileMatches();

  _root = el('div', 'welcome');
  applyTweakClasses(_root, _effective);
  if (_isMobile) _root.classList.add('welcome--mobile');
  if (isHostedAuthAvailable) _root.classList.add('welcome--has-banner');

  const left = el('section', 'welcome__content');
  const pitchMid = el('div', 'welcome__pitch-mid');
  pitchMid.append(renderHeadline(), renderSupportingCopy(), renderCtaGroup());
  left.append(renderBrand({ theme: _effective.theme }), pitchMid);
  const footerMeta = renderFooterMeta();

  _overlaySlot = el('div', 'welcome__auth-overlay-slot');
  _overlaySlot.hidden = true;

  _root.append(renderStarfield(), left, footerMeta, _overlaySlot);

  // Issue #139: rendered as a sibling above `.welcome`, not a child of it —
  // it's `position: fixed` (zero layout footprint), so `.welcome--has-banner`
  // (set above) only needs to redistribute existing top padding on the
  // narrow-viewport hard-height layouts, never subtract from a height.
  if (isHostedAuthAvailable) {
    container.replaceChildren(renderLimitationsBanner(), _root);
    // No synchronous measurement here — ResizeObserver's own initial
    // callback (fired asynchronously, before the next paint) covers first
    // mount, so this never forces a layout reflow immediately after
    // `replaceChildren()`. It also re-fires on any later box-size change to
    // either element, which a plain `resize` listener wouldn't catch when
    // the self-hosted @fontsource fonts finish loading asynchronously and
    // change the track's rendered width with no `resize` event at all.
    if (typeof globalThis.ResizeObserver === 'function') {
      _limitationsResizeObserver = new globalThis.ResizeObserver(() => updateLimitationsMarquee());
      _limitationsResizeObserver.observe(_limitationsTrackEl);
      _limitationsResizeObserver.observe(_limitationsViewportEl);
    }
  } else {
    container.replaceChildren(_root);
  }

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

  if (_authView !== null) {
    renderOverlay();
  }
}

export function unmount() {
  closeMountedOverlay();
  if (_legalDialogNode) {
    _legalDialogNode.querySelector('.legal-modal__close')?.click();
  }
  _legalDialog = null;
  _legalDialogNode = null;
  _legalTriggerEl = null;
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
  if (_limitationsResizeObserver) {
    try { _limitationsResizeObserver.disconnect(); } catch { /* best-effort */ }
  }
  _limitationsResizeObserver = null;
  _limitationsBannerEl = null;
  _limitationsViewportEl = null;
  _limitationsTrackEl = null;
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
