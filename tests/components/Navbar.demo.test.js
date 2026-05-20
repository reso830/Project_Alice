// @vitest-environment jsdom
//
// Navbar demo-state coverage (feature 020). Asserts the identity-cluster
// branching for `state.status === 'demo'`: badge text, Exit demo button
// with accessible label, exit click wiring, and regression guards that
// the authenticated and unauthenticated branches still behave as before.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/assets/Alice_White.png', () => ({ default: '/Alice_White.png' }));

const authStoreMock = vi.hoisted(() => ({
  getAuthState: vi.fn(),
  subscribe: vi.fn(),
  signOut: vi.fn(),
  exitDemo: vi.fn(),
}));

vi.mock('../../src/data/authStore.js', () => authStoreMock);

const toastMock = vi.hoisted(() => ({
  show: vi.fn(),
}));

vi.mock('../../src/components/Toast.js', () => ({ Toast: toastMock }));

import { Navbar } from '../../src/components/Navbar.js';

let container;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  authStoreMock.getAuthState.mockReset();
  authStoreMock.subscribe.mockReset().mockReturnValue(() => {});
  authStoreMock.signOut.mockReset();
  authStoreMock.exitDemo.mockReset();
  toastMock.show.mockReset();
});

afterEach(() => {
  Navbar.destroy();
  container.remove();
});

describe('Navbar — demo state', () => {
  it('renders the Demo mode badge and the Exit demo button when status is "demo"', () => {
    authStoreMock.getAuthState.mockReturnValue({
      status: 'demo',
      user: null,
      accessToken: null,
    });

    container.append(Navbar.render('tracker'));

    const identity = container.querySelector('.topbar-identity');
    expect(identity).not.toBeNull();
    expect(identity.hidden).toBe(false);

    const badge = identity.querySelector('.topbar-demo-badge');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe('Demo mode');
    expect(badge.getAttribute('aria-label')).toBe('Demo mode active');

    const exit = identity.querySelector('.signout-btn');
    expect(exit).not.toBeNull();
    expect(exit.getAttribute('aria-label')).toBe('Exit demo');
    expect(exit.querySelector('.signout-btn__label').textContent).toBe('Exit demo');

    // No email span — the demo visitor has no user identity.
    expect(identity.querySelector('.topbar-email')).toBeNull();
  });

  it('clicking Exit demo calls authStore.exitDemo() exactly once and surfaces a success toast', () => {
    authStoreMock.getAuthState.mockReturnValue({
      status: 'demo',
      user: null,
      accessToken: null,
    });

    container.append(Navbar.render('tracker'));

    const exit = container.querySelector('.topbar-identity .signout-btn');
    exit.click();

    expect(authStoreMock.exitDemo).toHaveBeenCalledTimes(1);
    expect(toastMock.show).toHaveBeenCalledTimes(1);
    expect(toastMock.show.mock.calls[0][0]).toBe('Exited demo');
    expect(toastMock.show.mock.calls[0][1]).toBe('success');
  });

  it('does NOT render the demo badge when status is "authenticated" (regression guard)', () => {
    authStoreMock.getAuthState.mockReturnValue({
      status: 'authenticated',
      user: { id: 'u1', email: 'real@example.com' },
      accessToken: 'tok',
    });

    container.append(Navbar.render('tracker'));

    expect(container.querySelector('.topbar-demo-badge')).toBeNull();
    // The authenticated branch still renders the email + Sign out button.
    expect(container.querySelector('.topbar-email').textContent).toBe('real@example.com');
    expect(
      container.querySelector('.topbar-identity .signout-btn').getAttribute('aria-label'),
    ).toBe('Sign out');
  });

  it('hides the identity cluster entirely when status is "unauthenticated"', () => {
    authStoreMock.getAuthState.mockReturnValue({
      status: 'unauthenticated',
      user: null,
      accessToken: null,
    });

    container.append(Navbar.render('tracker'));

    const identity = container.querySelector('.topbar-identity');
    expect(identity.hidden).toBe(true);
    expect(container.querySelector('.topbar-demo-badge')).toBeNull();
    expect(container.querySelector('.topbar-email')).toBeNull();
  });

  it('flips from authenticated to demo when the subscribed listener fires with a new state', () => {
    authStoreMock.getAuthState.mockReturnValue({
      status: 'authenticated',
      user: { id: 'u1', email: 'real@example.com' },
      accessToken: 'tok',
    });

    let subscriber;
    authStoreMock.subscribe.mockImplementation((fn) => {
      subscriber = fn;
      return () => {};
    });

    container.append(Navbar.render('tracker'));
    expect(container.querySelector('.topbar-demo-badge')).toBeNull();
    expect(container.querySelector('.topbar-email')).not.toBeNull();

    // Simulate authStore notifying with the new demo state.
    subscriber({ status: 'demo', user: null, accessToken: null });

    expect(container.querySelector('.topbar-demo-badge')).not.toBeNull();
    expect(container.querySelector('.topbar-email')).toBeNull();
  });
});
