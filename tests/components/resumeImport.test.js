// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authStoreMocks = vi.hoisted(() => ({
  state: { status: 'local-mode', user: null, accessToken: null },
  subscribers: new Set(),
}));

vi.mock('../../src/data/authStore.js', () => ({
  getAuthState: () => authStoreMocks.state,
  subscribe: (fn) => {
    authStoreMocks.subscribers.add(fn);
    return () => authStoreMocks.subscribers.delete(fn);
  },
  signOut: vi.fn(),
}));

vi.mock('../../src/services/resumeApi.js', () => ({
  parseResume: vi.fn(),
}));

import { ResumeImport } from '../../src/components/ResumeImport.js';

function setAuthState(state) {
  authStoreMocks.state = state;
  for (const fn of authStoreMocks.subscribers) {
    fn(state);
  }
}

beforeEach(() => {
  authStoreMocks.state = { status: 'local-mode', user: null, accessToken: null };
  authStoreMocks.subscribers.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ResumeImport — auth-state gating', () => {
  it('renders visibly in local-mode', () => {
    authStoreMocks.state = { status: 'local-mode', user: null, accessToken: null };
    const root = ResumeImport.create();

    expect(root).not.toBeNull();
    expect(root.classList.contains('resume-import')).toBe(true);
    expect(root.hidden).toBe(false);
  });

  it('renders visibly when authenticated', () => {
    authStoreMocks.state = {
      status: 'authenticated',
      user: { id: 'u1', email: 'jane@example.com' },
      accessToken: 'tok',
    };
    const root = ResumeImport.create();

    expect(root.hidden).toBe(false);
  });

  it('is hidden in the unauthenticated state', () => {
    authStoreMocks.state = { status: 'unauthenticated', user: null, accessToken: null };
    const root = ResumeImport.create();

    expect(root.hidden).toBe(true);
  });

  it('is hidden in the initializing state', () => {
    authStoreMocks.state = { status: 'initializing', user: null, accessToken: null };
    const root = ResumeImport.create();

    expect(root.hidden).toBe(true);
  });

  it('subscribes to authStore: hides when state transitions to unauthenticated', () => {
    authStoreMocks.state = { status: 'authenticated', user: { id: 'u1', email: 'a@b.co' } };
    const root = ResumeImport.create();
    expect(root.hidden).toBe(false);

    setAuthState({ status: 'unauthenticated', user: null, accessToken: null });

    expect(root.hidden).toBe(true);
  });

  it('subscribes to authStore: shows when state transitions back to authenticated', () => {
    authStoreMocks.state = { status: 'unauthenticated', user: null, accessToken: null };
    const root = ResumeImport.create();
    expect(root.hidden).toBe(true);

    setAuthState({ status: 'authenticated', user: { id: 'u1', email: 'a@b.co' } });

    expect(root.hidden).toBe(false);
  });

  it('destroy() unsubscribes from authStore', () => {
    const root = ResumeImport.create();
    expect(authStoreMocks.subscribers.size).toBe(1);

    root.destroy();

    expect(authStoreMocks.subscribers.size).toBe(0);
  });
});
