// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/assets/Alice_White.png', () => ({ default: '/Alice_White.png' }));
vi.mock('../../src/assets/Alice_Colored.png', () => ({ default: '/Alice_Colored.png' }));

const demoStubMocks = vi.hoisted(() => ({
  enterDemo: vi.fn(),
}));

vi.mock('../../src/pages/welcome/demoStub.js', () => demoStubMocks);

const supabaseMocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock('../../src/services/supabaseClient.js', () => ({
  supabase: {
    auth: {
      signInWithPassword: supabaseMocks.signInWithPassword,
      signUp: supabaseMocks.signUp,
    },
  },
  emailRedirectUrl: 'https://example.com/?auth=callback',
  isHostedAuthAvailable: true,
}));

import { AuthOverlay } from '../../src/pages/welcome/AuthOverlay.js';
import { WelcomePage } from '../../src/pages/welcome/WelcomePage.js';

let container;
let heroSlideshowStub;

function makeHeroStub() {
  return {
    mount: vi.fn(),
    unmount: vi.fn(),
  };
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
  supabaseMocks.signInWithPassword.mockReset();
  supabaseMocks.signUp.mockReset();
  demoStubMocks.enterDemo.mockReset();
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
    expect(headline.textContent).toContain('Your job search,');
    expect(headline.textContent).toContain('organized.');
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

  it('headline accents "organized." with an indigo em element', () => {
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });

    const accent = container.querySelector('.welcome__headline em.welcome__headline-accent');
    expect(accent).not.toBeNull();
    expect(accent.textContent).toBe('organized.');
  });

  it('renders the mini footer with version, license link, and two issue links sourced from appMeta', () => {
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });

    const meta = container.querySelector('.welcome__footer-meta');
    expect(meta).not.toBeNull();

    const version = meta.querySelector('.welcome__footer-version');
    expect(version?.textContent).toBe('v0.11.0');

    const links = meta.querySelectorAll('a.welcome__footer-link');
    expect(links.length).toBe(3);

    // [0] license link
    expect(links[0].textContent).toBe('PolyForm Noncommercial 1.0.0');
    expect(links[0].getAttribute('href')).toBe(
      'https://polyformproject.org/licenses/noncommercial/1.0.0',
    );
    expect(links[0].getAttribute('target')).toBe('_blank');
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');

    // [1] report-issue link → ISSUE_URL
    expect(links[1].textContent).toBe('⊙ Report an issue');
    expect(links[1].getAttribute('href')).toBe(
      'https://github.com/reso830/Project_Alice/issues/new',
    );
    expect(links[1].getAttribute('rel')).toBe('noopener noreferrer');

    // [2] request-feature link → ISSUE_URL
    expect(links[2].textContent).toBe('✦ Request a feature');
    expect(links[2].getAttribute('href')).toBe(
      'https://github.com/reso830/Project_Alice/issues/new',
    );
    expect(links[2].getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('clicking "Try the demo" invokes demoStub.enterDemo() (feature 020)', () => {
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });
    const tryDemo = container.querySelectorAll('.welcome__cta')[2];
    tryDemo.click();

    expect(demoStubMocks.enterDemo).toHaveBeenCalledTimes(1);
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

  it('does not render a Forgot-password link in signin mode (spec: no custom in-app reset UI)', () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();

    const overlay = container.querySelector('.auth-overlay');
    expect(overlay.textContent.toLowerCase()).not.toContain('forgot');
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
// Phase 18 — Mobile branch (`<760px`) per design §3.3 + FR-025
// ---------------------------------------------------------------------------

function stubMobile(isMobile) {
  globalThis.matchMedia = vi.fn().mockImplementation((q) => ({
    matches: typeof q === 'string' && q.includes('max-width: 759px') ? isMobile : false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe('Phase 18 — Mobile branch (<760px)', () => {
  it('applies the .welcome--mobile class when the mobile media query matches at mount', () => {
    stubMobile(true);
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });
    expect(container.querySelector('.welcome--mobile')).not.toBeNull();
  });

  it('does not mount the hero slideshow on mobile (DOM-free)', () => {
    stubMobile(true);
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });
    expect(heroSlideshowStub.mount).not.toHaveBeenCalled();
    expect(container.querySelector('.welcome__hero')).toBeNull();
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
    expect(footer.textContent).toContain('v0.11.0');
  });

  it('renders the centered/tablet mini footer after the slideshow in DOM order', () => {
    globalThis.matchMedia = vi.fn().mockImplementation((q) => ({
      matches: typeof q === 'string' && q.includes('min-width: 760px'),
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
  // Live viewport-resize handling (FR-025: desktop MUST keep slideshow/panel;
  // mobile MUST omit them — applies on resize, not just initial mount).
  // -------------------------------------------------------------------------

  function liveMatchMedia(initialMobile) {
    const state = { mobile: initialMobile, listeners: new Set() };
    globalThis.matchMedia = vi.fn().mockImplementation((q) => {
      const isMobileQuery = typeof q === 'string' && q.includes('max-width: 759px');
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

  it('desktop → mobile resize tears down the slideshow', () => {
    const media = liveMatchMedia(false);
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });
    expect(container.querySelector('.welcome__hero')).not.toBeNull();
    expect(container.querySelector('.tweaks-panel')).toBeNull();
    expect(heroSlideshowStub.unmount).not.toHaveBeenCalled();

    media.setMobile(true);

    expect(container.querySelector('.welcome--mobile')).not.toBeNull();
    expect(container.querySelector('.welcome__hero')).toBeNull();
    expect(container.querySelector('.tweaks-panel')).toBeNull();
    expect(heroSlideshowStub.unmount).toHaveBeenCalled();
  });

  it('mobile → desktop resize mounts the slideshow without prototyping controls', () => {
    const media = liveMatchMedia(true);
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });
    expect(container.querySelector('.welcome__hero')).toBeNull();
    expect(container.querySelector('.tweaks-panel')).toBeNull();
    expect(heroSlideshowStub.mount).not.toHaveBeenCalled();

    media.setMobile(false);

    expect(container.querySelector('.welcome--mobile')).toBeNull();
    expect(container.querySelector('.welcome__hero')).not.toBeNull();
    expect(container.querySelector('.tweaks-panel')).toBeNull();
    expect(heroSlideshowStub.mount).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Brand mark override — mobile always uses Alice_Colored.png regardless of
  // the active theme (design §3.3).
  // -------------------------------------------------------------------------

  it('mobile mount uses Alice_Colored.png', () => {
    stubMobile(true);

    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });

    const mark = container.querySelector('.welcome__brand-mark');
    expect(mark.src).toContain('Alice_Colored');
  });

  it('desktop → mobile resize keeps Alice_Colored.png', () => {
    const media = liveMatchMedia(false);

    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });
    const mark = container.querySelector('.welcome__brand-mark');
    expect(mark.src).toContain('Alice_Colored');

    media.setMobile(true);

    expect(mark.src).toContain('Alice_Colored');
  });
});
