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

describe('Navbar — top bar structure (Phase 13)', () => {
  it('renders the unified topbar with brand cluster, page nav, and identity slot', () => {
    const topbar = Navbar.render('tracker');
    expect(topbar.className).toBe('topbar');
    expect(topbar.querySelector('.topbar-brand')).not.toBeNull();
    expect(topbar.querySelector('.topbar-brand-mark')).not.toBeNull();
    expect(topbar.querySelector('.topbar-brand-text')?.textContent).toBe('Project Alice');
    expect(topbar.querySelector('.topbar-brand-text--short')?.textContent).toBe('Alice');
    expect(topbar.querySelector('.topbar-nav')).not.toBeNull();
    expect(topbar.querySelector('.topbar-identity')).not.toBeNull();
  });
});

describe('Navbar — auth segment', () => {
  it('does not render the identity cluster contents in local-mode', () => {
    authStoreMocks.state = { status: 'local-mode', user: null, accessToken: null };
    const topbar = Navbar.render('tracker');

    const cluster = topbar.querySelector('.topbar-identity');
    expect(cluster).not.toBeNull();
    expect(cluster.hidden).toBe(true);
    expect(topbar.querySelector('.topbar-email')).toBeNull();
    expect(topbar.querySelector('.signout-btn')).toBeNull();
  });

  it('renders the email and sign-out button when authenticated', () => {
    authStoreMocks.state = {
      status: 'authenticated',
      user: { id: 'u1', email: 'jane@example.com' },
      accessToken: 'tok',
    };
    const topbar = Navbar.render('tracker');

    const cluster = topbar.querySelector('.topbar-identity');
    expect(cluster.hidden).toBe(false);
    expect(topbar.querySelector('.topbar-email')?.textContent).toBe('jane@example.com');
    expect(topbar.querySelector('.signout-btn .signout-btn__label')?.textContent).toBe('Sign out');
  });

  it('hides the identity cluster when unauthenticated', () => {
    authStoreMocks.state = { status: 'unauthenticated', user: null, accessToken: null };
    const topbar = Navbar.render('tracker');

    const cluster = topbar.querySelector('.topbar-identity');
    expect(cluster.hidden).toBe(true);
  });

  it('renders the full email in textContent + title (CSS handles visual truncation)', () => {
    const longEmail = 'a-very-long-local-part@some-long-domain.example.com';
    authStoreMocks.state = {
      status: 'authenticated',
      user: { id: 'u1', email: longEmail },
      accessToken: 'tok',
    };
    const topbar = Navbar.render('tracker');

    const emailNode = topbar.querySelector('.topbar-email');
    expect(emailNode.textContent).toBe(longEmail);
    expect(emailNode.title).toBe(longEmail);
  });

  it('renders an inline SVG door-arrow icon inside the sign-out button', () => {
    authStoreMocks.state = {
      status: 'authenticated',
      user: { id: 'u1', email: 'jane@x.co' },
      accessToken: 'tok',
    };
    const topbar = Navbar.render('tracker');

    const icon = topbar.querySelector('.signout-btn svg');
    expect(icon).not.toBeNull();
    expect(icon.getAttribute('aria-hidden')).toBe('true');
  });

  it('clicking the sign-out button calls authStore.signOut', () => {
    authStoreMocks.state = {
      status: 'authenticated',
      user: { id: 'u1', email: 'jane@example.com' },
      accessToken: 'tok',
    };
    const topbar = Navbar.render('tracker');

    topbar.querySelector('.signout-btn').click();
    expect(authStoreMocks.signOut).toHaveBeenCalledTimes(1);
  });

  it('updates the cluster when auth state transitions to authenticated', () => {
    const topbar = Navbar.render('tracker');
    expect(topbar.querySelector('.topbar-identity').hidden).toBe(true);

    setAuthState({
      status: 'authenticated',
      user: { id: 'u1', email: 'jane@example.com' },
      accessToken: 'tok',
    });

    expect(topbar.querySelector('.topbar-identity').hidden).toBe(false);
    expect(topbar.querySelector('.topbar-email')?.textContent).toBe('jane@example.com');
  });

  it('updates the cluster when auth state transitions back to unauthenticated', () => {
    authStoreMocks.state = {
      status: 'authenticated',
      user: { id: 'u1', email: 'jane@example.com' },
      accessToken: 'tok',
    };
    const topbar = Navbar.render('tracker');
    expect(topbar.querySelector('.topbar-identity').hidden).toBe(false);

    setAuthState({ status: 'unauthenticated', user: null, accessToken: null });

    expect(topbar.querySelector('.topbar-identity').hidden).toBe(true);
    expect(topbar.querySelector('.topbar-email')).toBeNull();
  });

  it('destroy() unsubscribes from the auth store', () => {
    authStoreMocks.state = {
      status: 'authenticated',
      user: { id: 'u1', email: 'jane@example.com' },
      accessToken: 'tok',
    };
    const topbar = Navbar.render('tracker');
    expect(authStoreMocks.subscribers.size).toBe(1);

    Navbar.destroy();

    expect(authStoreMocks.subscribers.size).toBe(0);
    expect(() => {
      setAuthState({ status: 'unauthenticated', user: null, accessToken: null });
    }).not.toThrow();
    expect(topbar.querySelector('.topbar-identity')).not.toBeNull();
  });
});

describe('Navbar — page nav', () => {
  it('preserves the three primary nav buttons', () => {
    const topbar = Navbar.render('tracker');
    const buttons = topbar.querySelectorAll('.nav-btn');
    expect(Array.from(buttons, (b) => b.dataset.page)).toEqual(['tracker', 'calendar', 'profile']);
  });

  it('marks the active page', () => {
    const topbar = Navbar.render('profile');
    const active = topbar.querySelector('.nav-btn--active');
    expect(active?.dataset.page).toBe('profile');
  });

  it('renders and clears the update badge on the profile button', () => {
    const topbar = Navbar.render('tracker');

    Navbar.setUpdateStatus('available');
    expect(topbar.querySelector('.nav-btn[data-page="profile"] .nav-btn__update-badge--active')).not.toBeNull();

    Navbar.setUpdateStatus('ready-to-restart');
    expect(topbar.querySelector('.nav-btn[data-page="profile"] .nav-btn__update-badge--ready')).not.toBeNull();

    Navbar.setUpdateStatus('idle');
    expect(topbar.querySelector('.nav-btn__update-badge')).toBeNull();
  });
});
