// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/assets/logo/alice-sigil-full.svg', () => ({
  default: '/alice-sigil-full.svg',
}));
vi.mock('../../src/assets/logo/alice-sigil-full-white.svg', () => ({
  default: '/alice-sigil-full-white.svg',
}));

const demoStubMocks = vi.hoisted(() => ({
  enterDemo: vi.fn(),
}));

vi.mock('../../src/pages/welcome/demoStub.js', () => demoStubMocks);

const supabaseMocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));

const supabaseClientState = vi.hoisted(() => ({
  isHostedAuthAvailable: true,
}));

vi.mock('../../src/services/supabaseClient.js', () => ({
  supabase: {
    auth: {
      signInWithPassword: supabaseMocks.signInWithPassword,
      signUp: supabaseMocks.signUp,
      resetPasswordForEmail: supabaseMocks.resetPasswordForEmail,
      updateUser: supabaseMocks.updateUser,
      signOut: supabaseMocks.signOut,
    },
  },
  emailRedirectUrl: 'https://example.com/?auth=callback',
  get isHostedAuthAvailable() { return supabaseClientState.isHostedAuthAvailable; },
}));

import { AuthOverlay } from '../../src/pages/welcome/AuthOverlay.js';
import { WelcomePage, shouldMarquee } from '../../src/pages/welcome/WelcomePage.js';
import { APP_VERSION } from '../../src/pages/welcome/shared/appMeta.js';

const mainCss = readFileSync('src/styles/main.css', 'utf8').replace(/\r\n/g, '\n');

let container;
let heroSlideshowStub;

function makeHeroStub() {
  return {
    mount: vi.fn(),
    unmount: vi.fn(),
  };
}

// jsdom (this project's test env) has no native ResizeObserver — this mock
// mirrors the real API just enough for WelcomePage.js's marquee detection:
// construct with a callback, `observe()` records the target, and tests
// trigger a re-measure by calling `triggerResizeObservers()` directly
// instead of dispatching a real layout event.
class MockResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.observed = [];
    MockResizeObserver.instances.push(this);
  }

  observe(el) {
    this.observed.push(el);
  }

  unobserve(el) {
    this.observed = this.observed.filter((observed) => observed !== el);
  }

  disconnect() {
    this.disconnected = true;
  }
}
MockResizeObserver.instances = [];

function triggerResizeObservers() {
  for (const instance of MockResizeObserver.instances) {
    instance.callback([]);
  }
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  heroSlideshowStub = makeHeroStub();
  globalThis.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  MockResizeObserver.instances = [];
  globalThis.ResizeObserver = MockResizeObserver;
  supabaseMocks.signInWithPassword.mockReset();
  supabaseMocks.signUp.mockReset();
  supabaseMocks.resetPasswordForEmail.mockReset();
  supabaseMocks.updateUser.mockReset();
  supabaseMocks.signOut.mockReset().mockResolvedValue({ error: null });
  demoStubMocks.enterDemo.mockReset();
  supabaseClientState.isHostedAuthAvailable = true;
});

afterEach(() => {
  WelcomePage.unmount();
  container.remove();
  window.history.replaceState({}, '', '/');
  vi.restoreAllMocks();
});

describe('WelcomePage — structure', () => {
  it('mounts the welcome container with left content and right hero', () => {
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });

    expect(container.querySelector('.welcome')).not.toBeNull();
    expect(container.querySelector('.welcome__content')).not.toBeNull();
    expect(container.querySelector('.welcome__hero')).not.toBeNull();
    expect(heroSlideshowStub.mount).toHaveBeenCalledTimes(1);
  });

  it('renders the brand block with mark and wordmark', () => {
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });

    const mark = container.querySelector('.welcome__brand-mark');
    const text = container.querySelector('.welcome__brand-text');
    expect(mark).not.toBeNull();
    expect(mark.tagName).toBe('IMG');
    expect(text?.textContent).toBe('Project Alice');
  });

  it('renders the headline with the fixed line break', () => {
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });

    const headline = container.querySelector('.welcome__headline');
    expect(headline).not.toBeNull();
    expect(headline.textContent).toContain('Your');
    expect(headline.textContent).toContain('Career OS.');
    expect(headline.querySelector('br')).not.toBeNull();
  });

  it('renders the three CTAs in order (Sign In, Create Account, Try the demo)', () => {
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });

    const ctas = container.querySelectorAll('.welcome__cta');
    expect(ctas.length).toBe(3);
    expect(ctas[0].textContent).toBe('Sign In');
    expect(ctas[1].textContent).toBe('Create Account');
    // Feature 020: "Try the demo" renders enabled; clicking invokes the
    // shared `demoStub.enterDemo` handler which enters the portfolio
    // demo via authStore (covered in its own test below).
    expect(ctas[2].textContent).toBe('Try the demo');
    expect(ctas[2].disabled).toBe(false);
  });

  it('headline accents "Career OS." with an indigo em element', () => {
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });

    const accent = container.querySelector('.welcome__headline em.welcome__headline-accent');
    expect(accent).not.toBeNull();
    expect(accent.textContent).toBe('Career OS.');
  });

  it('renders the mini footer with version, issue links, repo link, and download chip sourced from appMeta', () => {
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });

    const meta = container.querySelector('.welcome__footer-meta');
    expect(meta).not.toBeNull();

    const version = meta.querySelector('.welcome__footer-version');
    expect(version?.textContent).toBe(APP_VERSION);

    const links = meta.querySelectorAll('a.welcome__footer-link');
    expect(links.length).toBe(6);

    // [0] license link
    expect(links[0].textContent).toBe('PolyForm Noncommercial 1.0.0');
    expect(links[0].getAttribute('href')).toBe(
      'https://polyformproject.org/licenses/noncommercial/1.0.0',
    );
    expect(links[0].getAttribute('target')).toBe('_blank');
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');

    // [1] report-issue link → ISSUE_URL
    expect(links[1].textContent).toBe('Report issue');
    expect(links[1].getAttribute('href')).toBe(
      'https://github.com/reso830/Project_Alice/issues/new',
    );
    expect(links[1].getAttribute('rel')).toBe('noopener noreferrer');
    // WCAG 2.5.3 (issue #139 Lighthouse audit): accessible name must contain
    // the visible text verbatim, or voice-control users saying "click Report
    // issue" can't target it.
    expect(links[1].getAttribute('aria-label')).toContain('Report issue');

    // [2] request-feature link → ISSUE_URL
    expect(links[2].textContent).toBe('Request feature');
    expect(links[2].getAttribute('href')).toBe(
      'https://github.com/reso830/Project_Alice/issues/new',
    );
    expect(links[2].getAttribute('rel')).toBe('noopener noreferrer');
    expect(links[2].getAttribute('aria-label')).toContain('Request feature');

    // [3] portfolio link (part of the base 5 items, not desktop-only)
    expect(links[3].textContent).toBe('alvinresoso.com');
    expect(links[3].getAttribute('href')).toBe('https://alvinresoso.com');
    expect(links[3].classList.contains('welcome__footer-desktop-only')).toBe(false);

    // [4] GitHub (desktop-only)
    expect(links[4].textContent).toBe('GitHub');
    expect(links[4].getAttribute('href')).toBe('https://github.com/reso830/Project_Alice');
    expect(links[4].classList.contains('welcome__footer-desktop-only')).toBe(true);

    // [5] download chip (desktop-only)
    expect(links[5].textContent).toBe(`Download Alice Portable ${APP_VERSION}`);
    expect(links[5].getAttribute('href')).toBe(
      'https://github.com/reso830/Project_Alice/releases/latest',
    );
    expect(links[5].classList.contains('welcome__footer-download')).toBe(true);
    expect(links[5].classList.contains('welcome__footer-desktop-only')).toBe(true);
  });

  it('clicking "Try the demo" invokes demoStub.enterDemo() (feature 020)', () => {
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });
    const tryDemo = container.querySelectorAll('.welcome__cta')[2];
    tryDemo.click();

    expect(demoStubMocks.enterDemo).toHaveBeenCalledTimes(1);
  });
});

describe('WelcomePage — limitations banner (issue #139)', () => {
  it('renders the banner before .welcome, with the agreed copy, when hosted auth is available', () => {
    supabaseClientState.isHostedAuthAvailable = true;
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });

    const banner = container.querySelector('.welcome__limitations-banner');
    expect(banner).not.toBeNull();
    expect(banner.getAttribute('role')).toBe('note');
    expect(banner.textContent).toContain('Project Alice is a portfolio demonstrator');
    expect(banner.textContent).toContain('Hosted signup requires an invite');
    expect(banner.textContent).toContain('password-reset emails are limited');

    // Sibling before `.welcome`, not nested inside its grid/flex layout.
    expect(banner.nextElementSibling).toBe(container.querySelector('.welcome'));
    expect(container.querySelector('.welcome').classList.contains('welcome--has-banner')).toBe(true);
  });

  it('has no dismiss control — non-dismissible per product decision', () => {
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });

    const banner = container.querySelector('.welcome__limitations-banner');
    expect(banner.querySelector('button')).toBeNull();
  });

  it('does not render the banner in local mode (isHostedAuthAvailable=false)', () => {
    supabaseClientState.isHostedAuthAvailable = false;
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });

    expect(container.querySelector('.welcome__limitations-banner')).toBeNull();
    expect(container.querySelector('.welcome').classList.contains('welcome--has-banner')).toBe(false);
  });

  it('observes the track and viewport via ResizeObserver, and disconnects it on unmount', () => {
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });

    expect(MockResizeObserver.instances.length).toBe(1);
    const observer = MockResizeObserver.instances[0];
    expect(observer.observed).toContain(container.querySelector('.welcome__limitations-track'));
    expect(observer.observed).toContain(container.querySelector('.welcome__limitations-viewport'));

    WelcomePage.unmount();

    expect(observer.disconnected).toBe(true);
  });

  it('re-measures overflow via ResizeObserver — never synchronously on mount, so no forced reflow right after replaceChildren()', () => {
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });

    const banner = container.querySelector('.welcome__limitations-banner');
    const viewport = container.querySelector('.welcome__limitations-viewport');
    const track = container.querySelector('.welcome__limitations-track');

    // No measurement has happened yet — mount() never calls
    // updateLimitationsMarquee() itself, only ResizeObserver does.
    expect(banner.classList.contains('welcome__limitations-banner--marquee')).toBe(false);

    Object.defineProperty(track, 'scrollWidth', { value: 800, configurable: true });
    Object.defineProperty(viewport, 'clientWidth', { value: 320, configurable: true });
    triggerResizeObservers();

    expect(banner.classList.contains('welcome__limitations-banner--marquee')).toBe(true);
    // Distance (not the track's full width) is what the CSS animates by —
    // see the "jump-cut" fix in main.css.
    expect(track.style.getPropertyValue('--marquee-distance')).toBe('480px');

    Object.defineProperty(track, 'scrollWidth', { value: 300, configurable: true });
    triggerResizeObservers();

    expect(banner.classList.contains('welcome__limitations-banner--marquee')).toBe(false);
  });

  it('does not set up a ResizeObserver in local mode (no banner to measure)', () => {
    supabaseClientState.isHostedAuthAvailable = false;
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });

    expect(MockResizeObserver.instances.length).toBe(0);
  });
});

describe('shouldMarquee (issue #139)', () => {
  it('is true when the track is wider than the viewport', () => {
    expect(shouldMarquee({ scrollWidth: 500 }, { clientWidth: 300 })).toBe(true);
  });

  it('is false when the track fits within the viewport', () => {
    expect(shouldMarquee({ scrollWidth: 200 }, { clientWidth: 300 })).toBe(false);
  });

  it('tolerates 1px of subpixel rounding without flagging overflow', () => {
    expect(shouldMarquee({ scrollWidth: 301 }, { clientWidth: 300 })).toBe(false);
  });

  it('is false when either element is missing', () => {
    expect(shouldMarquee(null, { clientWidth: 300 })).toBe(false);
    expect(shouldMarquee({ scrollWidth: 500 }, null)).toBe(false);
  });

  it('keeps the marquee viewport clipped during animation (Lighthouse audit regression)', () => {
    // An earlier version set `overflow: visible` on
    // `.welcome__limitations-banner--marquee .welcome__limitations-viewport`,
    // which let the untruncated white-on-navy text spill out over the
    // page's own (light) background during the scroll — a Lighthouse a11y
    // audit caught it as a near-zero color-contrast violation. The viewport
    // must stay `overflow: hidden` in every state; only the track's
    // `transform` should move.
    expect(mainCss).not.toMatch(
      /\.welcome__limitations-banner--marquee\s+\.welcome__limitations-viewport\s*\{[^}]*overflow:\s*visible/,
    );
  });
});

describe('WelcomePage — password native controls', () => {
  it('suppresses native reveal and clear controls only on inputs with custom toggles', () => {
    expect(mainCss).toContain('.auth-form__input-wrap:has(.auth-form__password-toggle) .auth-form__input::-ms-reveal');
    expect(mainCss).toContain('.auth-form__input-wrap:has(.auth-form__password-toggle) .auth-form__input::-ms-clear');
    expect(mainCss).toContain('.conn-panel__field .edit-field__control::-ms-reveal');
    expect(mainCss).toContain('.conn-panel__field .edit-field__control::-ms-clear');
    expect(mainCss).not.toMatch(/\n\.auth-form__input::-ms-clear,/);
  });

  // Regression: PasswordChangeModal.js's `.pcf-input` fields use a different
  // class namespace than the shared `.auth-form__*` pattern above, so the
  // Edge-native-reveal-control suppression (v1.12.5) didn't cover them —
  // a duplicate eye icon on Change Password's password fields in Edge.
  it('also suppresses native reveal and clear controls on PasswordChangeModal\'s .pcf-input fields', () => {
    expect(mainCss).toContain('.pcf-input-wrap .pcf-input::-ms-reveal');
    expect(mainCss).toContain('.pcf-input-wrap .pcf-input::-ms-clear');
  });
});

describe('WelcomePage — auth overlay state machine', () => {
  it('renders the overlay slot hidden by default', () => {
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });

    const slot = container.querySelector('.welcome__auth-overlay-slot');
    expect(slot).not.toBeNull();
    expect(slot.hidden).toBe(true);
    expect(slot.children.length).toBe(0);
    expect(WelcomePage.getAuthView()).toBeNull();
  });

  it('Sign In click flips authView to "login" and reveals the overlay slot', () => {
    const openAuthOverlay = vi.fn();
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub, openAuthOverlay });

    container.querySelector('[data-auth-view="login"]').click();

    expect(WelcomePage.getAuthView()).toBe('login');
    expect(openAuthOverlay).toHaveBeenCalledWith('login');

    const slot = container.querySelector('.welcome__auth-overlay-slot');
    expect(slot.hidden).toBe(false);
    expect(slot.getAttribute('data-auth-view')).toBe('login');
    expect(slot.querySelector('.welcome__auth-panel[role="dialog"]')).not.toBeNull();
  });

  it('Create Account click flips authView to "signup" and reveals the overlay slot', () => {
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });
    container.querySelector('[data-auth-view="signup"]').click();

    expect(WelcomePage.getAuthView()).toBe('signup');
    const slot = container.querySelector('.welcome__auth-overlay-slot');
    expect(slot.hidden).toBe(false);
    expect(slot.getAttribute('data-auth-view')).toBe('signup');
  });

  it('setAuthView(null) hides the slot and clears its contents', () => {
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });
    WelcomePage.setAuthView('login');
    WelcomePage.setAuthView(null);

    const slot = container.querySelector('.welcome__auth-overlay-slot');
    expect(slot.hidden).toBe(true);
    expect(slot.children.length).toBe(0);
    expect(slot.hasAttribute('data-auth-view')).toBe(false);
    expect(WelcomePage.getAuthView()).toBeNull();
  });

  it('the default close button closes the overlay (returns to null)', () => {
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });
    WelcomePage.setAuthView('login');

    container.querySelector('.welcome__auth-close').click();

    expect(WelcomePage.getAuthView()).toBeNull();
    expect(container.querySelector('.welcome__auth-overlay-slot').hidden).toBe(true);
  });

  it('ESC closes an open overlay', () => {
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });
    WelcomePage.setAuthView('signup');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(WelcomePage.getAuthView()).toBeNull();
  });

  it('supports the "verification_sent" state without throwing', () => {
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });
    WelcomePage.setAuthView('verification_sent');

    expect(WelcomePage.getAuthView()).toBe('verification_sent');
    const slot = container.querySelector('.welcome__auth-overlay-slot');
    expect(slot.getAttribute('data-auth-view')).toBe('verification_sent');
  });

  it('ignores invalid view values', () => {
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });
    WelcomePage.setAuthView('login');
    WelcomePage.setAuthView('not-a-real-view');

    expect(WelcomePage.getAuthView()).toBe('login');
  });

  it('delegates overlay rendering to deps.authOverlay.render when provided', () => {
    const node = document.createElement('section');
    node.className = 'phase07-overlay';
    const authOverlay = { render: vi.fn().mockReturnValue(node) };
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub, authOverlay });

    container.querySelector('[data-auth-view="login"]').click();

    expect(authOverlay.render).toHaveBeenCalledTimes(1);
    expect(authOverlay.render.mock.calls[0][0].view).toBe('login');
    expect(container.querySelector('.phase07-overlay')).not.toBeNull();
    expect(container.querySelector('.welcome__auth-panel')).toBeNull();
  });

  it('Try Demo click does not flip authView (feature 020: enters demo via enterDemo)', () => {
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });
    container.querySelectorAll('.welcome__cta')[2].click();

    // Feature 020: Try Demo enters the portfolio demo via
    // `demoStub.enterDemo` — it never opens the auth overlay. The
    // enterDemo invocation is covered by an earlier test.
    expect(WelcomePage.getAuthView()).toBeNull();
  });
});

describe('WelcomePage — ?auth=callback handling', () => {
  it('renders the verification banner and cleans the query string', () => {
    window.history.replaceState({}, '', '/?auth=callback');
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });

    expect(container.querySelector('.welcome__verification-banner')).not.toBeNull();
    expect(window.location.search).toBe('');
  });

  it('preserves other query params when cleaning auth=callback', () => {
    window.history.replaceState({}, '', '/?auth=callback&foo=bar');
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });

    expect(container.querySelector('.welcome__verification-banner')).not.toBeNull();
    expect(window.location.search).toBe('?foo=bar');
  });

  it('does not render the banner when auth=callback is absent', () => {
    window.history.replaceState({}, '', '/');
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });

    expect(container.querySelector('.welcome__verification-banner')).toBeNull();
  });

  // Feature 045 / research.md D4: a password-recovery link reuses this same
  // redirect URL, so it also carries ?auth=callback alongside Supabase's own
  // #...type=recovery marker. That combination must NOT show "Email
  // verified" — it's a recovery visit, not a signup-verification one.
  it('does not render the banner when the URL also carries a recovery marker', () => {
    window.history.replaceState({}, '', '/?auth=callback#access_token=abc&type=recovery');
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });

    expect(container.querySelector('.welcome__verification-banner')).toBeNull();
    // ?auth=callback is still stripped either way.
    expect(window.location.search).toBe('');
  });

  // Live-verification finding (2026-07-10, Browser Smoke Test): a real
  // expired/invalid recovery link's Supabase redirect carries NO `type=
  // recovery` — only `#error=access_denied&error_code=otp_expired&...`.
  // Before RECOVERY_FLOW_MARKER existed, this exact URL shape wrongly
  // showed "Email verified. You can sign in now." for a failed password
  // reset. ForgotPasswordForm.js now appends `flow=recovery` (which
  // Supabase preserves on both success and failure), so this must also
  // suppress the banner.
  it('does not render the banner for a failed recovery link (flow=recovery + a Supabase error, no type=recovery at all)', () => {
    window.history.replaceState(
      {},
      '',
      '/?auth=callback&flow=recovery#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    );
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });

    expect(container.querySelector('.welcome__verification-banner')).toBeNull();
  });
});

describe('WelcomePage — unmount', () => {
  it('clears the container and calls heroSlideshow.unmount', () => {
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });
    WelcomePage.unmount();

    expect(container.children.length).toBe(0);
    expect(heroSlideshowStub.unmount).toHaveBeenCalledTimes(1);
  });

  it('closes an open AuthOverlay so its document-level keydown listener does not leak', () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();
    expect(container.querySelector('.auth-overlay')).not.toBeNull();

    WelcomePage.unmount();

    // After unmount, dispatching Escape must not throw or cause side effects.
    expect(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    }).not.toThrow();
    expect(container.querySelector('.auth-overlay')).toBeNull();
  });

  it('clearing the open overlay via setAuthView(null) tears down its keydown listener', () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();
    const form = container.querySelector('.auth-form--login');
    expect(form).not.toBeNull();

    WelcomePage.setAuthView(null);
    expect(container.querySelector('.auth-overlay')).toBeNull();

    // Dispatching keys after teardown is a no-op (no stale listeners).
    expect(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Phase 07 — AuthOverlay + LoginForm + SignupForm
// ---------------------------------------------------------------------------

function flushMicrotasks() {
  return new Promise((resolve) => queueMicrotask(resolve));
}

function mountWelcomeWithOverlay() {
  WelcomePage.mount(container, {
    heroSlideshow: heroSlideshowStub,
    authOverlay: AuthOverlay,
  });
}

describe('AuthOverlay — open from CTA + initial view', () => {
  it('opens with login view and renders the login form when Sign In is clicked', () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();

    const overlay = container.querySelector('.auth-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay.getAttribute('data-view')).toBe('login');
    expect(container.querySelector('.auth-form--login')).not.toBeNull();
    expect(container.querySelector('.auth-form--signup')).toBeNull();
  });

  it('opens with signup view when Create Account is clicked', () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="signup"]').click();

    const overlay = container.querySelector('.auth-overlay');
    expect(overlay.getAttribute('data-view')).toBe('signup');
    expect(container.querySelector('.auth-form--signup')).not.toBeNull();
  });

  it('renders the swap-mode link pointing at the opposite mode (Phase 17)', () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="signup"]').click();

    // Phase 17 drops the tab strip in favour of a single swap-mode link in
    // the footer. In signup view the link offers "Sign in".
    const swap = container.querySelector('.auth-overlay__swap');
    expect(swap).not.toBeNull();
    expect(swap.dataset.authSwapTarget).toBe('login');
    expect(swap.textContent).toContain('Sign in');

    // Flipping back to login flips the link target.
    swap.click();
    const swapAfter = container.querySelector('.auth-overlay__swap');
    expect(swapAfter.dataset.authSwapTarget).toBe('signup');
    expect(swapAfter.textContent).toContain('Create one');
  });
});

describe('AuthOverlay — swap-mode link preserves email (Phase 17)', () => {
  it('switching from login to signup via the swap link keeps the typed email', () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();

    const loginEmail = container.querySelector('.auth-form--login input[name="email"]');
    loginEmail.value = 'jane@example.com';
    loginEmail.dispatchEvent(new Event('input', { bubbles: true }));

    container.querySelector('.auth-overlay__swap').click();

    const signupEmail = container.querySelector('.auth-form--signup input[name="email"]');
    expect(signupEmail).not.toBeNull();
    expect(signupEmail.value).toBe('jane@example.com');
  });

  it('switching back to login via the swap link keeps the typed email', () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();

    const loginEmail = container.querySelector('.auth-form--login input[name="email"]');
    loginEmail.value = 'jane@example.com';
    loginEmail.dispatchEvent(new Event('input', { bubbles: true }));

    container.querySelector('.auth-overlay__swap').click();
    container.querySelector('.auth-overlay__swap').click();

    expect(container.querySelector('.auth-form--login input[name="email"]').value).toBe('jane@example.com');
  });

  it('internal swap updates the slot data-auth-view but does not remount the overlay', () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();
    const overlayBefore = container.querySelector('.auth-overlay');

    container.querySelector('.auth-overlay__swap').click();
    const overlayAfter = container.querySelector('.auth-overlay');

    expect(overlayAfter).toBe(overlayBefore);
    expect(WelcomePage.getAuthView()).toBe('signup');
    expect(
      container.querySelector('.welcome__auth-overlay-slot').getAttribute('data-auth-view'),
    ).toBe('signup');
  });
});

describe('AuthOverlay — close behaviors', () => {
  it('ESC closes the overlay', () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();
    expect(container.querySelector('.auth-overlay')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(container.querySelector('.auth-overlay')).toBeNull();
    expect(WelcomePage.getAuthView()).toBeNull();
  });

  it('clicking the backdrop closes the overlay', () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();
    const backdrop = container.querySelector('.auth-overlay__backdrop');

    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(container.querySelector('.auth-overlay')).toBeNull();
  });

  it('clicking the close button closes the overlay', () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();

    container.querySelector('.auth-overlay__close').click();

    expect(container.querySelector('.auth-overlay')).toBeNull();
  });

  it('restores focus to the triggering CTA after close', async () => {
    mountWelcomeWithOverlay();
    const signInCta = container.querySelector('[data-auth-view="login"]');
    signInCta.click();
    await flushMicrotasks();
    // Move focus inside the overlay so the restore is observable
    container.querySelector('.auth-form--login input[name="email"]').focus();
    expect(document.activeElement).not.toBe(signInCta);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(document.activeElement).toBe(signInCta);
  });
});

describe('AuthOverlay — focus trap', () => {
  it('Tab from the last focusable element wraps to the first', async () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();
    await flushMicrotasks();

    const panel = container.querySelector('.auth-overlay__panel');
    const focusables = panel.querySelectorAll('button, input');
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    last.focus();
    expect(document.activeElement).toBe(last);

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    document.dispatchEvent(event);

    expect(document.activeElement).toBe(first);
  });

  it('Shift+Tab from the first focusable element wraps to the last', async () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();
    await flushMicrotasks();

    const panel = container.querySelector('.auth-overlay__panel');
    const focusables = panel.querySelectorAll('button, input');
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    first.focus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
    document.dispatchEvent(event);

    expect(document.activeElement).toBe(last);
  });
});

describe('AuthOverlay — password toggle & touched validation (Phase 06 / T021)', () => {
  function openLogin() {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();
    return container.querySelector('.auth-form--login');
  }

  function openSignup() {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();
    container.querySelector('.auth-overlay__swap').click();
    return container.querySelector('.auth-form--signup');
  }

  for (const [label, open] of [['login', openLogin], ['signup', openSignup]]) {
    it(`password toggle flips input type, aria-label, and icon (${label})`, () => {
      const form = open();
      const password = form.querySelector('input[name="password"]');
      const toggle = form.querySelector('.auth-form__password-toggle');

      expect(password.type).toBe('password');
      expect(toggle.getAttribute('aria-label')).toBe('Show password');
      const iconBefore = toggle.querySelector('path').getAttribute('d');

      toggle.click();
      expect(password.type).toBe('text');
      expect(toggle.getAttribute('aria-label')).toBe('Hide password');
      expect(toggle.querySelector('path').getAttribute('d')).not.toBe(iconBefore);

      toggle.click();
      expect(password.type).toBe('password');
      expect(toggle.getAttribute('aria-label')).toBe('Show password');
      expect(toggle.querySelector('path').getAttribute('d')).toBe(iconBefore);
    });

    it(`invalid email stays quiet until touched, then warns on blur (${label})`, () => {
      const form = open();
      const email = form.querySelector('input[name="email"]');
      const field = email.closest('.auth-form__field');
      const fieldError = field.querySelector('.auth-form__field-error');

      // Typing an invalid value without blurring must not surface a warning.
      email.value = 'not-an-email';
      email.dispatchEvent(new Event('input', { bubbles: true }));
      expect(fieldError.textContent).toBe('');
      expect(field.classList.contains('auth-form__field--error')).toBe(false);

      // Blur marks the field touched and reveals the warning.
      email.dispatchEvent(new Event('blur', { bubbles: true }));
      expect(fieldError.textContent).toContain('valid email');
      expect(field.classList.contains('auth-form__field--error')).toBe(true);
      expect(email.getAttribute('aria-invalid')).toBe('true');

      // Correcting the value clears the touched warning.
      email.value = 'jane@example.com';
      email.dispatchEvent(new Event('input', { bubbles: true }));
      expect(fieldError.textContent).toBe('');
      expect(field.classList.contains('auth-form__field--error')).toBe(false);
    });

    it(`blurring an empty email stays quiet (navigating away must not warn) (${label})`, () => {
      const form = open();
      const email = form.querySelector('input[name="email"]');
      const field = email.closest('.auth-form__field');
      const fieldError = field.querySelector('.auth-form__field-error');

      // Focus then leave the empty field (e.g. clicking close/swap/demo).
      email.dispatchEvent(new Event('blur', { bubbles: true }));
      expect(fieldError.textContent).toBe('');
      expect(field.classList.contains('auth-form__field--error')).toBe(false);
      expect(email.getAttribute('aria-invalid')).not.toBe('true');
    });
  }
});

describe('LoginForm — submit behavior', () => {
  it('on success, the form clears the error region (authStore handles routing)', async () => {
    supabaseMocks.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();

    const form = container.querySelector('.auth-form--login');
    form.querySelector('input[name="email"]').value = 'jane@example.com';
    form.querySelector('input[name="password"]').value = 'longenough';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await flushMicrotasks();
    await flushMicrotasks();

    expect(supabaseMocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'jane@example.com',
      password: 'longenough',
    });
    expect(form.querySelector('.auth-form__error').textContent).toBe('');
  });

  it('on Supabase error, renders the neutral sign-in error', async () => {
    supabaseMocks.signInWithPassword.mockResolvedValue({ data: null, error: { message: 'whatever' } });
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();

    const form = container.querySelector('.auth-form--login');
    form.querySelector('input[name="email"]').value = 'jane@example.com';
    form.querySelector('input[name="password"]').value = 'longenough';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await flushMicrotasks();
    await flushMicrotasks();

    const errorRegion = form.querySelector('.auth-form__error');
    expect(errorRegion.textContent).toContain('Sign-in failed');
    expect(errorRegion.getAttribute('aria-live')).toBe('polite');
  });

  it('prevents double-submit while a request is in flight', async () => {
    let resolveSignIn;
    supabaseMocks.signInWithPassword.mockReturnValue(
      new Promise((resolve) => {
        resolveSignIn = resolve;
      }),
    );

    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();

    const form = container.querySelector('.auth-form--login');
    form.querySelector('input[name="email"]').value = 'jane@example.com';
    form.querySelector('input[name="password"]').value = 'longenough';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(supabaseMocks.signInWithPassword).toHaveBeenCalledTimes(1);
    expect(form.querySelector('.auth-form__submit').disabled).toBe(true);

    resolveSignIn({ data: { user: { id: 'u1' } }, error: null });
    await flushMicrotasks();
    await flushMicrotasks();
  });

  it('renders a visible + accessible loading state while in flight', async () => {
    let resolveSignIn;
    supabaseMocks.signInWithPassword.mockReturnValue(
      new Promise((resolve) => {
        resolveSignIn = resolve;
      }),
    );

    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();

    const form = container.querySelector('.auth-form--login');
    form.querySelector('input[name="email"]').value = 'jane@example.com';
    form.querySelector('input[name="password"]').value = 'longenough';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    const submitBtn = form.querySelector('.auth-form__submit');
    const status = form.querySelector('.auth-form__status');
    expect(submitBtn.textContent).toBe('Signing in…');
    expect(submitBtn.getAttribute('aria-busy')).toBe('true');
    expect(form.getAttribute('aria-busy')).toBe('true');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe('Signing in…');

    resolveSignIn({ data: { user: { id: 'u1' } }, error: null });
    await flushMicrotasks();
    await flushMicrotasks();

    expect(submitBtn.textContent).toBe('Sign In');
    expect(submitBtn.getAttribute('aria-busy')).toBe('false');
    expect(form.hasAttribute('aria-busy')).toBe(false);
    expect(status.textContent).toBe('');
  });
});

describe('SignupForm — field validation + submit behavior', () => {
  function fillSignupForm(form, { email, password }) {
    form.querySelector('input[name="email"]').value = email;
    form.querySelector('input[name="password"]').value = password;
  }

  it('renders inline field errors for invalid email and short password', () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="signup"]').click();

    const form = container.querySelector('.auth-form--signup');
    fillSignupForm(form, { email: 'not-an-email', password: 'short' });
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    const fieldErrors = form.querySelectorAll('.auth-form__field-error');
    expect(fieldErrors[0].textContent).toContain('valid email');
    expect(fieldErrors[1].textContent).toContain('at least 8');
    expect(supabaseMocks.signUp).not.toHaveBeenCalled();

    // Submit validation must also set the a11y + styling error state (not just text).
    expect(form.querySelector('input[name="email"]').getAttribute('aria-invalid')).toBe('true');
    expect(form.querySelector('input[name="password"]').getAttribute('aria-invalid')).toBe('true');
    expect(form.querySelectorAll('.auth-form__field--error')).toHaveLength(2);
  });

  it('happy path transitions the overlay to verification_sent', async () => {
    supabaseMocks.signUp.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="signup"]').click();

    const form = container.querySelector('.auth-form--signup');
    fillSignupForm(form, { email: 'jane@example.com', password: 'longenough' });
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await flushMicrotasks();
    await flushMicrotasks();

    expect(supabaseMocks.signUp).toHaveBeenCalledWith({
      email: 'jane@example.com',
      password: 'longenough',
      options: { emailRedirectTo: 'https://example.com/?auth=callback' },
    });
    expect(container.querySelector('.auth-overlay').getAttribute('data-view')).toBe(
      'verification_sent',
    );
    expect(container.querySelector('.auth-overlay__verification-text')).not.toBeNull();
    expect(WelcomePage.getAuthView()).toBe('verification_sent');
  });

  it('Supabase rejection renders the neutral signup error', async () => {
    supabaseMocks.signUp.mockResolvedValue({ data: null, error: { message: 'duplicate' } });
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="signup"]').click();

    const form = container.querySelector('.auth-form--signup');
    fillSignupForm(form, { email: 'jane@example.com', password: 'longenough' });
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await flushMicrotasks();
    await flushMicrotasks();

    const errorRegion = form.querySelector('.auth-form__error');
    expect(errorRegion.textContent).toBe('This email cannot sign up right now.');
  });

  it('two consecutive errors with different Supabase causes produce byte-identical error regions', async () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="signup"]').click();

    const form = container.querySelector('.auth-form--signup');
    const errorRegion = form.querySelector('.auth-form__error');

    supabaseMocks.signUp.mockResolvedValueOnce({ data: null, error: { message: 'allowlist-miss' } });
    fillSignupForm(form, { email: 'a@b.co', password: 'longenough' });
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();
    const html1 = errorRegion.outerHTML;

    supabaseMocks.signUp.mockResolvedValueOnce({ data: null, error: { message: 'rate-limit' } });
    fillSignupForm(form, { email: 'a@b.co', password: 'longenough' });
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();
    const html2 = errorRegion.outerHTML;

    expect(html1).toBe(html2);
    expect(errorRegion.textContent).toBe('This email cannot sign up right now.');
  });

  it('renders a visible + accessible loading state while in flight', async () => {
    let resolveSignUp;
    supabaseMocks.signUp.mockReturnValue(
      new Promise((resolve) => {
        resolveSignUp = resolve;
      }),
    );

    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="signup"]').click();

    const form = container.querySelector('.auth-form--signup');
    form.querySelector('input[name="email"]').value = 'jane@example.com';
    form.querySelector('input[name="password"]').value = 'longenough';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    const submitBtn = form.querySelector('.auth-form__submit');
    const status = form.querySelector('.auth-form__status');
    expect(submitBtn.textContent).toBe('Creating account…');
    expect(submitBtn.getAttribute('aria-busy')).toBe('true');
    expect(form.getAttribute('aria-busy')).toBe('true');
    expect(status.textContent).toBe('Creating account…');

    resolveSignUp({ data: { user: { id: 'u1' } }, error: null });
    await flushMicrotasks();
    await flushMicrotasks();

    // After success, the overlay flips to verification_sent so the form is unmounted.
    expect(container.querySelector('.auth-overlay').getAttribute('data-view')).toBe(
      'verification_sent',
    );
  });

  it('Done button on verification_sent closes the overlay', async () => {
    supabaseMocks.signUp.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="signup"]').click();

    const form = container.querySelector('.auth-form--signup');
    fillSignupForm(form, { email: 'jane@example.com', password: 'longenough' });
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await flushMicrotasks();
    await flushMicrotasks();

    container.querySelector('.auth-overlay__done').click();

    expect(container.querySelector('.auth-overlay')).toBeNull();
    expect(WelcomePage.getAuthView()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Phase 17 — Auth modal restyle (design §4.6)
// ---------------------------------------------------------------------------

describe('Phase 17 — Auth modal chrome', () => {
  it('renders a header row with a 40px Alice logo, title, and close button', () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();

    const header = container.querySelector('.auth-overlay__header');
    expect(header).not.toBeNull();
    const logo = header.querySelector('.auth-overlay__header-logo');
    expect(logo).not.toBeNull();
    expect(logo.tagName).toBe('IMG');
    expect(logo.getAttribute('width')).toBe('40');
    expect(logo.getAttribute('height')).toBe('40');
    expect(header.querySelector('.auth-overlay__title')).not.toBeNull();
    expect(header.querySelector('.auth-overlay__close')).not.toBeNull();
  });

  it('renders the panel with role=dialog and aria-modal=true (440px shell governed by CSS)', () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();

    const panel = container.querySelector('.auth-overlay__panel');
    expect(panel).not.toBeNull();
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(panel.getAttribute('aria-labelledby')).toBe('auth-overlay-title');
  });

  // Feature 045 reverses the prior "no custom in-app reset UI" decision
  // (feature 018) this test used to encode — see spec.md Problem Statement.
  it('renders a "Forgot password?" link in signin mode', () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();

    const link = container.querySelector('.auth-form--login .auth-form__forgot-link');
    expect(link).not.toBeNull();
    expect(link.textContent).toBe('Forgot password?');
  });

  it('does not render a Forgot-password link in signup mode', () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="signup"]').click();

    const overlay = container.querySelector('.auth-overlay');
    expect(overlay.textContent.toLowerCase()).not.toContain('forgot');
  });

  it('signup form has no name field', () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="signup"]').click();

    const signupForm = container.querySelector('.auth-form--signup');
    expect(signupForm.querySelector('input[name="name"]')).toBeNull();
  });
});

describe('Phase 17 — Auth modal footer', () => {
  it('renders the "or" divider, demo button, and swap link in both login and signup', () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();
    expect(container.querySelector('.auth-overlay__divider')).not.toBeNull();
    expect(container.querySelector('.auth-overlay__demo')).not.toBeNull();
    expect(container.querySelector('.auth-overlay__swap')).not.toBeNull();

    container.querySelector('.auth-overlay__swap').click();
    expect(container.querySelector('.auth-overlay__divider')).not.toBeNull();
    expect(container.querySelector('.auth-overlay__demo')).not.toBeNull();
    expect(container.querySelector('.auth-overlay__swap')).not.toBeNull();
  });

  it('shows legal copy only in signup mode', () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();
    expect(container.querySelector('.auth-overlay__legal').hidden).toBe(true);

    container.querySelector('.auth-overlay__swap').click();
    expect(container.querySelector('.auth-overlay__legal').hidden).toBe(false);
    expect(container.querySelector('.auth-overlay__legal').textContent.toLowerCase()).toContain('terms');
  });

  it('clicking the in-modal demo button invokes demoStub.enterDemo() (feature 020)', () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();
    container.querySelector('.auth-overlay__demo').click();

    expect(demoStubMocks.enterDemo).toHaveBeenCalledTimes(1);
  });

  it('hides the footer chrome on verification_sent', async () => {
    supabaseMocks.signUp.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="signup"]').click();

    const form = container.querySelector('.auth-form--signup');
    form.querySelector('input[name="email"]').value = 'jane@example.com';
    form.querySelector('input[name="password"]').value = 'longenough';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await flushMicrotasks();
    await flushMicrotasks();

    expect(container.querySelector('.auth-overlay__footer').hidden).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Feature 042 — Mobile branch (`≤620px`) per responsive welcome spec
// ---------------------------------------------------------------------------

function stubMobile(isMobile) {
  globalThis.matchMedia = vi.fn().mockImplementation((q) => ({
    matches: typeof q === 'string' && q.includes('max-width: 620px') ? isMobile : false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe('Feature 042 — Mobile branch (≤620px)', () => {
  it('applies the .welcome--mobile class when the mobile media query matches at mount', () => {
    stubMobile(true);
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });
    expect(container.querySelector('.welcome--mobile')).not.toBeNull();
  });

  it('mounts the capped showcase on mobile using the centered variant', () => {
    stubMobile(true);
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });
    expect(container.querySelector('.welcome__hero')).not.toBeNull();
    expect(heroSlideshowStub.mount).toHaveBeenCalledTimes(1);
    expect(heroSlideshowStub.mount.mock.calls[0][1]).toMatchObject({
      heroScene: 'auto',
      variant: 'centered',
    });
  });

  it('does not render the removed prototyping controls on mobile', () => {
    stubMobile(true);
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });
    expect(container.querySelector('.tweaks-panel')).toBeNull();
    expect(container.querySelector('.tweaks-panel__toggle')).toBeNull();
  });

  it('keeps the three CTAs available on mobile (auth flow remains)', () => {
    stubMobile(true);
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });
    const ctas = container.querySelectorAll('.welcome__cta');
    expect(ctas.length).toBe(3);
    // Sign In / Create Account still flip the auth view on mobile.
    ctas[0].click();
    expect(WelcomePage.getAuthView()).toBe('login');
  });

  it('desktop mount (default stub) renders the slideshow without prototyping controls', () => {
    // Sanity baseline: the default stub (matches: false everywhere) is desktop.
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });
    expect(container.querySelector('.welcome--mobile')).toBeNull();
    expect(container.querySelector('.welcome__hero')).not.toBeNull();
    expect(heroSlideshowStub.mount).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.tweaks-panel__toggle')).toBeNull();
  });

  it('keeps the mini footer visible on mobile', () => {
    stubMobile(true);
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });

    const footer = container.querySelector('.welcome__footer-meta');
    expect(footer).not.toBeNull();
    expect(footer.textContent).toContain(APP_VERSION);
  });

  it('renders the centered/tablet mini footer after the slideshow in DOM order', () => {
    globalThis.matchMedia = vi.fn().mockImplementation((q) => ({
      matches: typeof q === 'string' && q.includes('min-width: 621px'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });
    const rootChildren = [...container.querySelector('.welcome').children];
    const heroIndex = rootChildren.findIndex((node) => node.classList.contains('welcome__hero'));
    const footerIndex = rootChildren.findIndex((node) => node.classList.contains('welcome__footer-meta'));

    expect(container.querySelector('.welcome--layout-centered')).not.toBeNull();
    expect(heroIndex).toBeGreaterThan(-1);
    expect(footerIndex).toBeGreaterThan(heroIndex);
  });

  // -------------------------------------------------------------------------
  // Live viewport-resize handling: desktop and mobile both keep the showcase,
  // but mobile toggles the height-locked `.welcome--mobile` shell and centered variant.
  // -------------------------------------------------------------------------

  function liveMatchMedia(initialMobile) {
    const state = { mobile: initialMobile, listeners: new Set() };
    globalThis.matchMedia = vi.fn().mockImplementation((q) => {
      const isMobileQuery = typeof q === 'string' && q.includes('max-width: 620px');
      const mql = {
        get matches() {
          return isMobileQuery ? state.mobile : false;
        },
        addEventListener: vi.fn((evt, fn) => {
          if (evt === 'change' && isMobileQuery) state.listeners.add(fn);
        }),
        removeEventListener: vi.fn((evt, fn) => {
          if (evt === 'change' && isMobileQuery) state.listeners.delete(fn);
        }),
      };
      return mql;
    });
    state.setMobile = (next) => {
      if (next === state.mobile) return;
      state.mobile = next;
      state.listeners.forEach((fn) => fn({ matches: next }));
    };
    return state;
  }

  it('desktop → mobile resize keeps the showcase and remounts it with the centered variant', () => {
    const media = liveMatchMedia(false);
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });
    expect(container.querySelector('.welcome__hero')).not.toBeNull();
    expect(container.querySelector('.tweaks-panel')).toBeNull();
    expect(heroSlideshowStub.unmount).not.toHaveBeenCalled();

    media.setMobile(true);

    expect(container.querySelector('.welcome--mobile')).not.toBeNull();
    expect(container.querySelector('.welcome__hero')).not.toBeNull();
    expect(container.querySelector('.tweaks-panel')).toBeNull();
    expect(heroSlideshowStub.unmount).toHaveBeenCalled();
    expect(heroSlideshowStub.mount).toHaveBeenCalledTimes(2);
    expect(heroSlideshowStub.mount.mock.calls[1][1]).toMatchObject({
      heroScene: 'auto',
      variant: 'centered',
    });
  });

  it('mobile → desktop resize keeps the showcase and remounts it with the default variant', () => {
    const media = liveMatchMedia(true);
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });
    expect(container.querySelector('.welcome__hero')).not.toBeNull();
    expect(container.querySelector('.tweaks-panel')).toBeNull();
    expect(heroSlideshowStub.mount).toHaveBeenCalledTimes(1);
    expect(heroSlideshowStub.mount.mock.calls[0][1]).toMatchObject({
      heroScene: 'auto',
      variant: 'centered',
    });

    media.setMobile(false);

    expect(container.querySelector('.welcome--mobile')).toBeNull();
    expect(container.querySelector('.welcome__hero')).not.toBeNull();
    expect(container.querySelector('.tweaks-panel')).toBeNull();
    expect(heroSlideshowStub.mount).toHaveBeenCalledTimes(2);
    expect(heroSlideshowStub.mount.mock.calls[1][1]).toMatchObject({
      heroScene: 'auto',
      variant: 'default',
    });
  });

  // -------------------------------------------------------------------------
  // Brand mark override — mobile uses the full-color vector sigil regardless
  // of the active theme.
  // -------------------------------------------------------------------------

  it('mobile mount uses alice-sigil-full.svg', () => {
    stubMobile(true);

    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });

    const mark = container.querySelector('.welcome__brand-mark');
    expect(mark.src).toContain('alice-sigil-full.svg');
  });

  it('desktop → mobile resize keeps alice-sigil-full.svg', () => {
    const media = liveMatchMedia(false);

    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });
    const mark = container.querySelector('.welcome__brand-mark');
    expect(mark.src).toContain('alice-sigil-full.svg');

    media.setMobile(true);

    expect(mark.src).toContain('alice-sigil-full.svg');
  });
});

// Feature 045, Phase 03 — Forgot Password (Welcome, request). US-2.
describe('AuthOverlay — Forgot Password (feature 045)', () => {
  function openForgot() {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();
    container.querySelector('.auth-form__forgot-link').click();
  }

  // Sets the email input's value AND fires `input` so AuthOverlay's
  // onEmailChange wiring updates state.email — required for anything that
  // reads the confirmation message's embedded email (forgot_sent), not just
  // the form's own submit handler (which reads the input directly).
  function fillForgotEmail(form, email) {
    const input = form.querySelector('input[name="email"]');
    input.value = email;
    input.dispatchEvent(new Event('input'));
  }

  it('clicking "Forgot password?" opens the forgot view with the email form', () => {
    openForgot();

    const overlay = container.querySelector('.auth-overlay');
    expect(overlay.getAttribute('data-view')).toBe('forgot');
    expect(overlay.querySelector('.auth-overlay__title').textContent).toBe('Forgot your password?');
    expect(overlay.querySelector('.auth-overlay__subtitle').textContent).toBe(
      "We'll email you a link to reset it.",
    );
    const form = container.querySelector('.auth-form--forgot');
    expect(form).not.toBeNull();
    expect(form.querySelector('input[name="email"]')).not.toBeNull();
    // No current/new password fields — this is the "forgot" step, not "reset".
    expect(form.querySelector('input[type="password"]')).toBeNull();
  });

  it('hides the footer chrome (demo/swap/legal) in the forgot view', () => {
    openForgot();

    expect(container.querySelector('.auth-overlay__footer').hidden).toBe(true);
  });

  it('malformed email shows an inline error and never calls resetPasswordForEmail', () => {
    openForgot();

    const form = container.querySelector('.auth-form--forgot');
    form.querySelector('input[name="email"]').value = 'not-an-email';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(form.querySelector('.auth-form__field-error').textContent).toContain('valid email');
    expect(supabaseMocks.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(container.querySelector('.auth-overlay').getAttribute('data-view')).toBe('forgot');
  });

  it('a valid email calls resetPasswordForEmail with the redirect URL and shows a loading state', async () => {
    let resolveReset;
    supabaseMocks.resetPasswordForEmail.mockReturnValue(
      new Promise((resolve) => { resolveReset = resolve; }),
    );
    openForgot();

    const form = container.querySelector('.auth-form--forgot');
    form.querySelector('input[name="email"]').value = 'jane@example.com';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushMicrotasks();

    expect(supabaseMocks.resetPasswordForEmail).toHaveBeenCalledWith('jane@example.com', {
      redirectTo: 'https://example.com/?auth=callback&flow=recovery',
    });
    const submitBtn = form.querySelector('.auth-form__submit');
    expect(submitBtn.disabled).toBe(true);
    expect(submitBtn.textContent).toBe('Sending…');

    resolveReset({ data: {}, error: null });
    await flushMicrotasks();
    await flushMicrotasks();
  });

  it('a registered email (success response) transitions to forgot_sent with non-enumerating copy', async () => {
    supabaseMocks.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    openForgot();

    const form = container.querySelector('.auth-form--forgot');
    fillForgotEmail(form, 'registered@example.com');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    const overlay = container.querySelector('.auth-overlay');
    expect(overlay.getAttribute('data-view')).toBe('forgot_sent');
    expect(overlay.querySelector('.auth-overlay__title').textContent).toBe('Check your inbox');
    const message = overlay.querySelector('.auth-overlay__verification-text');
    expect(message.textContent).toContain('If an account exists for');
    expect(message.textContent).toContain('registered@example.com');
    expect(message.textContent).toContain("we've sent a password reset link");
  });

  it('an unregistered email (error response) reaches the SAME forgot_sent copy — non-enumeration (FR-8/AC-5)', async () => {
    supabaseMocks.resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { message: 'User not found' },
    });
    openForgot();

    const form = container.querySelector('.auth-form--forgot');
    fillForgotEmail(form, 'unregistered@example.com');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    const overlay = container.querySelector('.auth-overlay');
    expect(overlay.getAttribute('data-view')).toBe('forgot_sent');
    expect(supabaseMocks.resetPasswordForEmail).toHaveBeenCalledWith('unregistered@example.com', {
      redirectTo: 'https://example.com/?auth=callback&flow=recovery',
    });
    const message = overlay.querySelector('.auth-overlay__verification-text');
    expect(message.textContent).toContain('If an account exists for');
    expect(message.textContent).toContain('unregistered@example.com');
  });

  it('a thrown/rejected resetPasswordForEmail call also reaches forgot_sent, not a distinct error state', async () => {
    supabaseMocks.resetPasswordForEmail.mockRejectedValue(new TypeError('network down'));
    openForgot();

    const form = container.querySelector('.auth-form--forgot');
    form.querySelector('input[name="email"]').value = 'jane@example.com';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    expect(container.querySelector('.auth-overlay').getAttribute('data-view')).toBe('forgot_sent');
  });

  it('success and error provider responses produce byte-identical forgot_sent messages for the same email', async () => {
    supabaseMocks.resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: null });
    openForgot();
    let form = container.querySelector('.auth-form--forgot');
    fillForgotEmail(form, 'same@example.com');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();
    const html1 = container.querySelector('.auth-overlay__verification-text').outerHTML;

    container.querySelector('.auth-overlay__back-link').click();
    container.querySelector('.auth-form__forgot-link').click();
    supabaseMocks.resetPasswordForEmail.mockResolvedValueOnce({
      data: null,
      error: { message: 'user not found' },
    });
    form = container.querySelector('.auth-form--forgot');
    fillForgotEmail(form, 'same@example.com');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();
    const html2 = container.querySelector('.auth-overlay__verification-text').outerHTML;

    expect(html1).toBe(html2);
  });

  it('"Back to sign in" on the forgot form returns to the login view', () => {
    openForgot();

    container.querySelector('.auth-overlay__back-link').click();

    const overlay = container.querySelector('.auth-overlay');
    expect(overlay.getAttribute('data-view')).toBe('login');
    expect(container.querySelector('.auth-form--login')).not.toBeNull();
  });

  it('"Back to sign in" on forgot_sent returns to the login view', async () => {
    supabaseMocks.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    openForgot();
    const form = container.querySelector('.auth-form--forgot');
    form.querySelector('input[name="email"]').value = 'jane@example.com';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();
    expect(container.querySelector('.auth-overlay').getAttribute('data-view')).toBe('forgot_sent');

    container.querySelector('.auth-overlay__back-link').click();

    expect(container.querySelector('.auth-overlay').getAttribute('data-view')).toBe('login');
  });

  it('prevents double-submit while a request is in flight', async () => {
    let resolveReset;
    supabaseMocks.resetPasswordForEmail.mockReturnValue(
      new Promise((resolve) => { resolveReset = resolve; }),
    );
    openForgot();

    const form = container.querySelector('.auth-form--forgot');
    form.querySelector('input[name="email"]').value = 'jane@example.com';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushMicrotasks();

    expect(supabaseMocks.resetPasswordForEmail).toHaveBeenCalledTimes(1);

    resolveReset({ data: {}, error: null });
    await flushMicrotasks();
    await flushMicrotasks();
  });

  it('email typed in the login form persists when switching to forgot', () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();
    const loginEmail = container.querySelector('.auth-form--login input[name="email"]');
    loginEmail.value = 'persisted@example.com';
    loginEmail.dispatchEvent(new Event('input'));

    container.querySelector('.auth-form__forgot-link').click();

    const forgotEmail = container.querySelector('.auth-form--forgot input[name="email"]');
    expect(forgotEmail.value).toBe('persisted@example.com');
  });
});

describe('AuthOverlay — Reset Password + expired-link state (feature 045, Phase 04)', () => {
  // reset-password/recovery-expired are reachable ONLY via main.js's
  // initial-view threading (never a click) — main.test.js covers that
  // threading + the post-session "return to login" reroute wiring. This
  // suite covers what WelcomePage.mount({ initialAuthView }) + AuthOverlay
  // do once already in one of these two views: chrome, the expired-session
  // transition, and the abandon-path sign-out — mirroring how ForgotPassword
  // above exercises AuthOverlay's mechanics directly.
  function mountIntoReset() {
    WelcomePage.mount(container, {
      heroSlideshow: heroSlideshowStub,
      authOverlay: AuthOverlay,
      initialAuthView: 'reset-password',
    });
  }

  function mountIntoRecoveryExpired() {
    WelcomePage.mount(container, {
      heroSlideshow: heroSlideshowStub,
      authOverlay: AuthOverlay,
      initialAuthView: 'recovery-expired',
    });
  }

  it('WelcomePage.mount({ initialAuthView: "reset-password" }) opens straight into the reset-password view', () => {
    mountIntoReset();

    const overlay = container.querySelector('.auth-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay.getAttribute('data-view')).toBe('reset-password');
    expect(overlay.querySelector('.auth-overlay__title').textContent).toBe('Set a new password');
    const form = container.querySelector('.auth-form--reset');
    expect(form).not.toBeNull();
    expect(form.querySelectorAll('input[type="password"]')).toHaveLength(2);
  });

  it('hides the footer chrome (demo/swap/legal) in the reset-password view', () => {
    mountIntoReset();

    expect(container.querySelector('.auth-overlay__footer').hidden).toBe(true);
  });

  it('WelcomePage.mount({ initialAuthView: "recovery-expired" }) opens straight into the recovery-expired view', () => {
    mountIntoRecoveryExpired();

    const overlay = container.querySelector('.auth-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay.getAttribute('data-view')).toBe('recovery-expired');
    expect(overlay.querySelector('.auth-overlay__title').textContent).toBe('This reset link has expired');
    // No form — recovery-expired is message + link only.
    expect(container.querySelector('.auth-form--reset')).toBeNull();
  });

  it('a valid password submit calls updateUser then signs out (ends the recovery session)', async () => {
    supabaseMocks.updateUser.mockResolvedValue({ data: {}, error: null });
    mountIntoReset();

    const form = container.querySelector('.auth-form--reset');
    const [newInput, confirmInput] = form.querySelectorAll('input[type="password"]');
    newInput.value = 'LongEnough1';
    newInput.dispatchEvent(new Event('input'));
    confirmInput.value = 'LongEnough1';
    confirmInput.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    expect(supabaseMocks.updateUser).toHaveBeenCalledWith({ password: 'LongEnough1' });
    expect(supabaseMocks.signOut).toHaveBeenCalledTimes(1);
  });

  it('an expired/invalid session error on submit transitions to the recovery-expired view instead of a generic error', async () => {
    supabaseMocks.updateUser.mockResolvedValue({ data: null, error: { code: 'session_expired' } });
    mountIntoReset();

    const form = container.querySelector('.auth-form--reset');
    const [newInput, confirmInput] = form.querySelectorAll('input[type="password"]');
    newInput.value = 'LongEnough1';
    newInput.dispatchEvent(new Event('input'));
    confirmInput.value = 'LongEnough1';
    confirmInput.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    const overlay = container.querySelector('.auth-overlay');
    expect(overlay.getAttribute('data-view')).toBe('recovery-expired');
    expect(supabaseMocks.signOut).not.toHaveBeenCalled();
  });

  it('a non-expired updateUser failure shows an inline error and stays on reset-password', async () => {
    supabaseMocks.updateUser.mockResolvedValue({ data: null, error: { message: 'network blip' } });
    mountIntoReset();

    const form = container.querySelector('.auth-form--reset');
    const [newInput, confirmInput] = form.querySelectorAll('input[type="password"]');
    newInput.value = 'LongEnough1';
    newInput.dispatchEvent(new Event('input'));
    confirmInput.value = 'LongEnough1';
    confirmInput.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    expect(container.querySelector('.auth-overlay').getAttribute('data-view')).toBe('reset-password');
    expect(form.querySelector('.auth-form__error').textContent).toContain("Couldn't update");
    expect(supabaseMocks.signOut).not.toHaveBeenCalled();
  });

  it('"Request a new link" on recovery-expired goes to forgot, not login (still can\'t sign in without a working password)', () => {
    mountIntoRecoveryExpired();

    container.querySelector('.auth-overlay__back-link').click();

    const overlay = container.querySelector('.auth-overlay');
    expect(overlay.getAttribute('data-view')).toBe('forgot');
  });

  it.each([
    ['the × close button', (overlay) => overlay.querySelector('.auth-overlay__close').click()],
    ['the form\'s own "Back to sign in"', (overlay) => overlay.querySelector('.auth-overlay__back-link').click()],
    ['a backdrop click', (overlay) => overlay.querySelector('.auth-overlay__backdrop').dispatchEvent(new MouseEvent('click', { bubbles: true }))],
  ])('abandoning reset-password via %s waits for signOut() to settle, then ends the recovery session and closes the overlay', async (_label, act) => {
    mountIntoReset();
    const overlay = container.querySelector('.auth-overlay');

    act(overlay);

    // Not immediate — close() now confirms the sign-out attempt settled
    // before tearing the overlay down (see close()'s comment), rather than
    // firing signOut() and closing optimistically in the same tick.
    expect(container.querySelector('.auth-overlay')).not.toBeNull();
    expect(overlay.querySelector('.auth-overlay__close').disabled).toBe(true);

    await flushMicrotasks();
    await flushMicrotasks();

    expect(supabaseMocks.signOut).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.auth-overlay')).toBeNull();
  });

  it('abandoning reset-password via Escape also ends the recovery session', async () => {
    mountIntoReset();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    expect(supabaseMocks.signOut).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.auth-overlay')).toBeNull();
  });

  it('a rejected signOut() on the abandon path still finishes closing the overlay (no permanently stuck modal)', async () => {
    supabaseMocks.signOut.mockRejectedValue(new Error('network down'));
    mountIntoReset();

    container.querySelector('.auth-overlay__close').click();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(supabaseMocks.signOut).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.auth-overlay')).toBeNull();
  });

  it('a second close attempt while the abandon-path signOut() is still settling is a no-op (no duplicate signOut calls)', async () => {
    let resolveSignOut;
    supabaseMocks.signOut.mockReturnValue(new Promise((resolve) => { resolveSignOut = resolve; }));
    mountIntoReset();
    const overlay = container.querySelector('.auth-overlay');

    overlay.querySelector('.auth-overlay__close').click();
    overlay.querySelector('.auth-overlay__close').click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flushMicrotasks();

    expect(supabaseMocks.signOut).toHaveBeenCalledTimes(1);

    resolveSignOut({ error: null });
    await flushMicrotasks();
    await flushMicrotasks();
    expect(container.querySelector('.auth-overlay')).toBeNull();
  });

  it('abandoning recovery-expired (no active session) does NOT call signOut, and closes immediately (no signOut to wait for)', () => {
    mountIntoRecoveryExpired();
    const overlay = container.querySelector('.auth-overlay');

    overlay.querySelector('.auth-overlay__close').click();

    expect(supabaseMocks.signOut).not.toHaveBeenCalled();
    expect(container.querySelector('.auth-overlay')).toBeNull();
  });

  it('if signOut() rejects after a successful password update, the × button is re-enabled instead of staying stuck', async () => {
    supabaseMocks.updateUser.mockResolvedValue({ data: {}, error: null });
    supabaseMocks.signOut.mockRejectedValue(new Error('network down'));
    mountIntoReset();
    const closeBtn = container.querySelector('.auth-overlay__close');

    submitValidReset(container.querySelector('.auth-form--reset'));
    await flushMicrotasks();
    expect(closeBtn.disabled).toBe(true);

    await flushMicrotasks();
    await flushMicrotasks();
    await flushMicrotasks();

    // The update already succeeded and its own signOut() attempt failed —
    // the overlay is still showing reset-password (no reroute happened),
    // but the user is no longer stuck: close is usable again, and retries
    // the sign-out via the abandon path.
    expect(container.querySelector('.auth-overlay').getAttribute('data-view')).toBe('reset-password');
    expect(closeBtn.disabled).toBe(false);

    supabaseMocks.signOut.mockResolvedValue({ error: null });
    closeBtn.click();
    await flushMicrotasks();
    await flushMicrotasks();
    expect(container.querySelector('.auth-overlay')).toBeNull();
  });

  function submitValidReset(form) {
    const [newInput, confirmInput] = form.querySelectorAll('input[type="password"]');
    newInput.value = 'LongEnough1';
    newInput.dispatchEvent(new Event('input'));
    confirmInput.value = 'LongEnough1';
    confirmInput.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  it.each([
    ['the × close button', (overlay) => overlay.querySelector('.auth-overlay__close').click()],
    ['the form\'s own "Back to sign in"', (overlay) => overlay.querySelector('.auth-overlay__back-link').click()],
    ['a backdrop click', (overlay) => overlay.querySelector('.auth-overlay__backdrop').dispatchEvent(new MouseEvent('click', { bubbles: true }))],
    ['Escape', () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))],
  ])('T021: abandoning reset-password via %s while a submit is in flight is a no-op (matches DeleteAccountModal.js\'s loading-disables-close convention)', async (_label, act) => {
    let resolveUpdate;
    supabaseMocks.updateUser.mockReturnValue(new Promise((resolve) => { resolveUpdate = resolve; }));
    mountIntoReset();
    const form = container.querySelector('.auth-form--reset');
    submitValidReset(form);
    await flushMicrotasks();

    act(container.querySelector('.auth-overlay'));

    expect(container.querySelector('.auth-overlay').getAttribute('data-view')).toBe('reset-password');
    expect(supabaseMocks.signOut).not.toHaveBeenCalled();

    // The in-flight submit itself still completes normally afterward — the
    // gate only blocks the abandon path, not the pending request.
    resolveUpdate({ data: {}, error: null });
    await flushMicrotasks();
    await flushMicrotasks();
    expect(supabaseMocks.signOut).toHaveBeenCalledTimes(1);
  });

  it('the × close button is visually disabled while a reset-password submit is in flight, and re-enabled once it settles', async () => {
    let resolveUpdate;
    supabaseMocks.updateUser.mockReturnValue(new Promise((resolve) => { resolveUpdate = resolve; }));
    mountIntoReset();
    const closeBtn = container.querySelector('.auth-overlay__close');
    expect(closeBtn.disabled).toBe(false);

    submitValidReset(container.querySelector('.auth-form--reset'));
    await flushMicrotasks();
    expect(closeBtn.disabled).toBe(true);

    resolveUpdate({ data: null, error: { message: 'network blip' } });
    await flushMicrotasks();
    await flushMicrotasks();
    expect(closeBtn.disabled).toBe(false);
  });
});
