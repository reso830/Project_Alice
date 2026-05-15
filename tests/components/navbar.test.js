// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/assets/Alice_White.png', () => ({ default: '/Alice_White.png' }));

const authStoreMocks = vi.hoisted(() => ({
  state: { status: 'local-mode', user: null, accessToken: null },
  subscribers: new Set(),
  signOut: vi.fn(),
}));

vi.mock('../../src/data/authStore.js', () => ({
  getAuthState: () => authStoreMocks.state,
  subscribe: (fn) => {
    authStoreMocks.subscribers.add(fn);
    return () => authStoreMocks.subscribers.delete(fn);
  },
  signOut: authStoreMocks.signOut,
}));

import { Navbar } from '../../src/components/Navbar.js';

function setAuthState(state) {
  authStoreMocks.state = state;
  for (const fn of authStoreMocks.subscribers) {
    fn(state);
  }
}

beforeEach(() => {
  authStoreMocks.state = { status: 'local-mode', user: null, accessToken: null };
  authStoreMocks.subscribers.clear();
  authStoreMocks.signOut.mockReset();
});

afterEach(() => {
  Navbar.destroy();
});

describe('Navbar — auth segment', () => {
  it('does not render the user segment in local-mode', () => {
    authStoreMocks.state = { status: 'local-mode', user: null, accessToken: null };
    const navbar = Navbar.render('tracker');

    const segment = navbar.querySelector('.navbar__user');
    expect(segment).not.toBeNull();
    expect(segment.hidden).toBe(true);
    expect(navbar.querySelector('.navbar__user-email')).toBeNull();
    expect(navbar.querySelector('.navbar__sign-out')).toBeNull();
  });

  it('renders the email and sign-out button when authenticated', () => {
    authStoreMocks.state = {
      status: 'authenticated',
      user: { id: 'u1', email: 'jane@example.com' },
      accessToken: 'tok',
    };
    const navbar = Navbar.render('tracker');

    const segment = navbar.querySelector('.navbar__user');
    expect(segment.hidden).toBe(false);
    expect(navbar.querySelector('.navbar__user-email')?.textContent).toBe('jane@example.com');
    expect(navbar.querySelector('.navbar__sign-out')?.textContent).toBe('Sign Out');
  });

  it('hides the segment when unauthenticated', () => {
    authStoreMocks.state = { status: 'unauthenticated', user: null, accessToken: null };
    const navbar = Navbar.render('tracker');

    const segment = navbar.querySelector('.navbar__user');
    expect(segment.hidden).toBe(true);
  });

  it('truncates a long email in the displayed text but keeps the full value in the title attribute', () => {
    const longEmail = 'a-very-long-local-part@some-long-domain.example.com';
    authStoreMocks.state = {
      status: 'authenticated',
      user: { id: 'u1', email: longEmail },
      accessToken: 'tok',
    };
    const navbar = Navbar.render('tracker');

    const emailNode = navbar.querySelector('.navbar__user-email');
    expect(emailNode.textContent.length).toBeLessThan(longEmail.length);
    expect(emailNode.textContent.endsWith('…')).toBe(true);
    expect(emailNode.title).toBe(longEmail);
  });

  it('does not truncate short emails', () => {
    authStoreMocks.state = {
      status: 'authenticated',
      user: { id: 'u1', email: 'jane@x.co' },
      accessToken: 'tok',
    };
    const navbar = Navbar.render('tracker');

    const emailNode = navbar.querySelector('.navbar__user-email');
    expect(emailNode.textContent).toBe('jane@x.co');
    expect(emailNode.textContent.endsWith('…')).toBe(false);
  });

  it('clicking the sign-out button calls authStore.signOut', () => {
    authStoreMocks.state = {
      status: 'authenticated',
      user: { id: 'u1', email: 'jane@example.com' },
      accessToken: 'tok',
    };
    const navbar = Navbar.render('tracker');

    navbar.querySelector('.navbar__sign-out').click();

    expect(authStoreMocks.signOut).toHaveBeenCalledTimes(1);
  });

  it('updates the segment when auth state transitions to authenticated', () => {
    const navbar = Navbar.render('tracker');
    expect(navbar.querySelector('.navbar__user').hidden).toBe(true);

    setAuthState({
      status: 'authenticated',
      user: { id: 'u1', email: 'jane@example.com' },
      accessToken: 'tok',
    });

    expect(navbar.querySelector('.navbar__user').hidden).toBe(false);
    expect(navbar.querySelector('.navbar__user-email')?.textContent).toBe('jane@example.com');
  });

  it('updates the segment when auth state transitions back to unauthenticated', () => {
    authStoreMocks.state = {
      status: 'authenticated',
      user: { id: 'u1', email: 'jane@example.com' },
      accessToken: 'tok',
    };
    const navbar = Navbar.render('tracker');
    expect(navbar.querySelector('.navbar__user').hidden).toBe(false);

    setAuthState({ status: 'unauthenticated', user: null, accessToken: null });

    expect(navbar.querySelector('.navbar__user').hidden).toBe(true);
    expect(navbar.querySelector('.navbar__user-email')).toBeNull();
  });

  it('destroy() unsubscribes from the auth store', () => {
    authStoreMocks.state = {
      status: 'authenticated',
      user: { id: 'u1', email: 'jane@example.com' },
      accessToken: 'tok',
    };
    const navbar = Navbar.render('tracker');
    expect(authStoreMocks.subscribers.size).toBe(1);

    Navbar.destroy();

    expect(authStoreMocks.subscribers.size).toBe(0);
    // Subsequent state updates do not throw or reach a stale reference.
    expect(() => {
      setAuthState({ status: 'unauthenticated', user: null, accessToken: null });
    }).not.toThrow();
    // The detached navbar element is no longer connected to internal state.
    expect(navbar.querySelector('.navbar__user')).not.toBeNull();
  });
});

describe('Navbar — existing nav behavior', () => {
  it('preserves the three primary nav buttons', () => {
    const navbar = Navbar.render('tracker');
    const buttons = navbar.querySelectorAll('.nav-btn');
    expect(Array.from(buttons, (b) => b.dataset.page)).toEqual(['tracker', 'calendar', 'profile']);
  });

  it('marks the active page', () => {
    const navbar = Navbar.render('profile');
    const active = navbar.querySelector('.nav-btn--active');
    expect(active?.dataset.page).toBe('profile');
  });
});
