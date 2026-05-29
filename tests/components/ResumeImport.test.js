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
import { parseResume } from '../../src/services/resumeApi.js';

function setAuthState(state) {
  authStoreMocks.state = state;
  for (const fn of authStoreMocks.subscribers) {
    fn(state);
  }
}

beforeEach(() => {
  authStoreMocks.state = { status: 'local-mode', user: null, accessToken: null };
  authStoreMocks.subscribers.clear();
  parseResume.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.replaceChildren();
});

function makeResumeFile(name = 'resume.txt') {
  return new window.File(['resume text'], name, { type: 'text/plain' });
}

function selectFile(root, file = makeResumeFile()) {
  const input = root.querySelector('.resume-import__input');
  Object.defineProperty(input, 'files', {
    value: [file],
    configurable: true,
  });
  input.dispatchEvent(new Event('change'));
  return file;
}

async function flushPromises(count = 2) {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
}

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

  it('marks Process Resume busy, prevents duplicate parses, and preserves rotating messages', async () => {
    vi.useFakeTimers();
    let resolveParse;
    parseResume.mockReturnValue(new Promise((resolve) => {
      resolveParse = resolve;
    }));
    const onSuccess = vi.fn();
    const root = ResumeImport.create({ onSuccess });
    const file = selectFile(root);
    const process = root.querySelector('.profile-btn--primary');

    process.click();
    process.click();

    expect(process.getAttribute('aria-busy')).toBe('true');
    expect(process.disabled).toBe(true);
    expect(root.getAttribute('aria-busy')).toBe('true');
    expect(root.querySelector('.resume-import__status')?.textContent).toBe('Reading resume...');
    expect(parseResume).toHaveBeenCalledTimes(1);
    expect(parseResume).toHaveBeenCalledWith(file);

    vi.advanceTimersByTime(1200);

    expect(root.querySelector('.resume-import__status')?.textContent).toBe('Extracting experience...');

    resolveParse({ summary: 'Experienced engineer' });
    await flushPromises();

    expect(onSuccess).toHaveBeenCalledWith({ summary: 'Experienced engineer' });
  });

  it('renders inline resume parse failure and retries with the same file', async () => {
    parseResume
      .mockRejectedValueOnce(new Error('parse failed'))
      .mockResolvedValueOnce({ headline: 'Frontend Engineer' });
    const onSuccess = vi.fn();
    const root = ResumeImport.create({ onSuccess });
    const file = selectFile(root);

    root.querySelector('.profile-btn--primary').click();
    await flushPromises();

    const retry = root.querySelector('.inline-error__retry');
    expect(root.querySelector('.inline-error__message')?.textContent)
      .toBe("Couldn't parse the resume. Try again.");
    expect(retry).not.toBeNull();

    retry.click();

    expect(parseResume).toHaveBeenCalledTimes(2);
    expect(parseResume).toHaveBeenLastCalledWith(file);

    await flushPromises();

    expect(onSuccess).toHaveBeenCalledWith({ headline: 'Frontend Engineer' });
  });

  it('hides the upload surface in demo mode without surfacing the service-layer demo error', () => {
    authStoreMocks.state = { status: 'demo', user: null, accessToken: null };
    const root = ResumeImport.create();

    expect(root.hidden).toBe(true);
    expect(root.querySelector('.profile-btn--primary')).toBeNull();
    expect(parseResume).not.toHaveBeenCalled();
  });
});
