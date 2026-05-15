// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/assets/Alice_White.png', () => ({ default: '/Alice_White.png' }));
vi.mock('../../src/assets/welcome-hero/tracker.png', () => ({ default: '/tracker.png' }));
vi.mock('../../src/assets/welcome-hero/application-modal.png', () => ({ default: '/application-modal.png' }));
vi.mock('../../src/assets/welcome-hero/profile.png', () => ({ default: '/profile.png' }));
vi.mock('../../src/assets/welcome-hero/filters.png', () => ({ default: '/filters.png' }));
vi.mock('../../src/assets/welcome-hero/calendar.png', () => ({ default: '/calendar.png' }));
vi.mock('../../src/assets/welcome-hero/mobile-tracker.png', () => ({ default: '/mobile-tracker.png' }));

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

  it('renders the three CTAs in order (Sign In, Create Account, Try Demo)', () => {
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });

    const ctas = container.querySelectorAll('.welcome__cta');
    expect(ctas.length).toBe(3);
    expect(ctas[0].textContent).toBe('Sign In');
    expect(ctas[1].textContent).toBe('Create Account');
    expect(ctas[2].textContent).toBe('Try Demo');
  });

  it('renders Try Demo as disabled with the coming-soon tooltip', () => {
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });

    const tryDemo = container.querySelectorAll('.welcome__cta')[2];
    expect(tryDemo.disabled).toBe(true);
    expect(tryDemo.title).toBe('Coming soon — available with the next release.');
  });

  it('renders the three floating metadata pills plus the sample-data disclaimer', () => {
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });

    const pills = container.querySelectorAll('.welcome__pill');
    expect(pills.length).toBe(3);
    expect(Array.from(pills, (p) => p.textContent)).toEqual([
      '24 Active',
      '+12 This Month',
      '78% Match',
    ]);
    const disclaimer = container.querySelector('.welcome__sample-disclaimer');
    expect(disclaimer?.textContent).toBe('Sample data — illustrative only');
  });

  it('renders the footer metadata line', () => {
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });

    expect(container.querySelector('.welcome__footer-meta')?.textContent).toBe(
      'Built with Vite · Supabase · Vercel',
    );
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

  it('Try Demo click does not flip authView (disabled button)', () => {
    WelcomePage.mount(container, { heroSlideshow: heroSlideshowStub });
    container.querySelectorAll('.welcome__cta')[2].click();

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

  it('marks the corresponding tab active and exposes role=tablist', () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="signup"]').click();

    expect(container.querySelector('[role="tablist"]')).not.toBeNull();
    const signupTab = container.querySelector('[data-tab="signup"]');
    const loginTab = container.querySelector('[data-tab="login"]');
    expect(signupTab.classList.contains('auth-overlay__tab--active')).toBe(true);
    expect(loginTab.classList.contains('auth-overlay__tab--active')).toBe(false);
    expect(signupTab.getAttribute('aria-selected')).toBe('true');
    expect(loginTab.getAttribute('aria-selected')).toBe('false');
  });
});

describe('AuthOverlay — tab switching preserves email', () => {
  it('switching from login to signup keeps the typed email', () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();

    const loginEmail = container.querySelector('.auth-form--login input[name="email"]');
    loginEmail.value = 'jane@example.com';
    loginEmail.dispatchEvent(new Event('input', { bubbles: true }));

    container.querySelector('[data-tab="signup"]').click();

    const signupEmail = container.querySelector('.auth-form--signup input[name="email"]');
    expect(signupEmail).not.toBeNull();
    expect(signupEmail.value).toBe('jane@example.com');
  });

  it('switching back to login keeps the typed email', () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();

    const loginEmail = container.querySelector('.auth-form--login input[name="email"]');
    loginEmail.value = 'jane@example.com';
    loginEmail.dispatchEvent(new Event('input', { bubbles: true }));

    container.querySelector('[data-tab="signup"]').click();
    container.querySelector('[data-tab="login"]').click();

    expect(container.querySelector('.auth-form--login input[name="email"]').value).toBe('jane@example.com');
  });

  it('internal tab switch updates the slot data-auth-view (but does not remount the overlay)', () => {
    mountWelcomeWithOverlay();
    container.querySelector('[data-auth-view="login"]').click();
    const overlayBefore = container.querySelector('.auth-overlay');

    container.querySelector('[data-tab="signup"]').click();
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
