// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindBusyButton, bindContainerBusy, renderInlineError } from '../../src/utils/asyncUI.js';
import { Toast } from '../../src/components/Toast.js';

vi.mock('../../src/components/Toast.js', () => ({
  Toast: {
    show: vi.fn(),
  },
}));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.clearAllMocks();
});

describe('bindBusyButton', () => {
  it('sets button busy state during the action and restores it on success', async () => {
    const button = document.createElement('button');
    const pending = deferred();
    const handle = bindBusyButton({
      button,
      action: () => pending.promise,
      busyLabel: 'Saving...',
    });

    button.textContent = 'Save';
    const promise = handle.run();

    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe('Saving...');

    pending.resolve('saved');
    await expect(promise).resolves.toBe('saved');

    expect(button.hasAttribute('aria-busy')).toBe(false);
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe('Save');
  });

  it('toasts and rethrows non-abort failures after restoring the button', async () => {
    const button = document.createElement('button');
    const error = new Error('nope');
    const handle = bindBusyButton({
      button,
      action: () => Promise.reject(error),
      busyLabel: 'Saving...',
      errorMessage: (caught) => `Failed: ${caught.message}`,
    });

    await expect(handle.run()).rejects.toBe(error);

    expect(Toast.show).toHaveBeenCalledWith('Failed: nope', 'failure');
    expect(button.hasAttribute('aria-busy')).toBe(false);
    expect(button.disabled).toBe(false);
  });

  it('returns null for AbortError without showing a toast', async () => {
    const button = document.createElement('button');
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    const handle = bindBusyButton({
      button,
      action: () => Promise.reject(abortError),
    });

    await expect(handle.run()).resolves.toBeNull();

    expect(Toast.show).not.toHaveBeenCalled();
    expect(button.hasAttribute('aria-busy')).toBe(false);
  });

  it('returns the same in-flight promise for duplicate runs', async () => {
    const button = document.createElement('button');
    const pending = deferred();
    const action = vi.fn(() => pending.promise);
    const handle = bindBusyButton({ button, action });

    const first = handle.run();
    const second = handle.run();
    const third = handle.run();

    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(action).toHaveBeenCalledTimes(1);

    pending.resolve('done');
    await expect(Promise.all([first, second, third])).resolves.toEqual(['done', 'done', 'done']);
  });

  it('disposes during pending without later mutating the button', async () => {
    const button = document.createElement('button');
    button.textContent = 'Save';
    const pending = deferred();
    const handle = bindBusyButton({
      button,
      action: () => pending.promise,
      busyLabel: 'Saving...',
    });

    const promise = handle.run();
    handle.dispose();

    expect(button.hasAttribute('aria-busy')).toBe(false);
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe('Save');

    button.textContent = 'Changed after dispose';
    pending.resolve('done');
    await expect(promise).resolves.toBe('done');
    expect(button.textContent).toBe('Changed after dispose');
  });

  it('disposes during idle as a no-op', () => {
    const button = document.createElement('button');
    button.textContent = 'Save';
    const handle = bindBusyButton({ button, action: () => Promise.resolve() });

    expect(() => {
      handle.dispose();
      handle.dispose();
    }).not.toThrow();
    expect(button.textContent).toBe('Save');
  });

  it('locks peers and restores their previous disabled states', async () => {
    const button = document.createElement('button');
    const enabledPeer = document.createElement('button');
    const disabledPeer = document.createElement('button');
    const pending = deferred();
    disabledPeer.disabled = true;
    const handle = bindBusyButton({
      button,
      peers: [enabledPeer, disabledPeer],
      action: () => pending.promise,
    });

    const promise = handle.run();

    expect(enabledPeer.disabled).toBe(true);
    expect(disabledPeer.disabled).toBe(true);

    pending.resolve('ok');
    await promise;

    expect(enabledPeer.disabled).toBe(false);
    expect(disabledPeer.disabled).toBe(true);
  });

  it('throws clearly for a missing button', () => {
    expect(() => bindBusyButton({ button: null, action: () => Promise.resolve() }))
      .toThrow(/button/i);
  });

  it('throws clearly from run for a missing action', async () => {
    const button = document.createElement('button');
    const handle = bindBusyButton({ button, action: undefined });

    await expect(handle.run()).rejects.toThrow(/action/i);
  });
});

describe('bindContainerBusy', () => {
  it('sets container busy state during the action and clears it on success', async () => {
    const container = document.createElement('section');
    const pending = deferred();
    const handle = bindContainerBusy({
      container,
      action: () => pending.promise,
    });

    const promise = handle.run();

    expect(container.getAttribute('aria-busy')).toBe('true');

    pending.resolve('loaded');
    await expect(promise).resolves.toBe('loaded');

    expect(container.hasAttribute('aria-busy')).toBe(false);
  });

  it('clears container busy state and shows a toast on failure', async () => {
    const container = document.createElement('section');
    const error = new Error('offline');
    const handle = bindContainerBusy({
      container,
      action: () => Promise.reject(error),
      errorMessage: () => 'Could not load.',
    });

    await expect(handle.run()).rejects.toBe(error);

    expect(container.hasAttribute('aria-busy')).toBe(false);
    expect(Toast.show).toHaveBeenCalledWith('Could not load.', 'failure');
  });

  it('returns the same in-flight promise for duplicate container runs', async () => {
    const container = document.createElement('section');
    const pending = deferred();
    const action = vi.fn(() => pending.promise);
    const handle = bindContainerBusy({ container, action });

    const first = handle.run();
    const second = handle.run();

    expect(first).toBe(second);
    expect(action).toHaveBeenCalledTimes(1);

    pending.resolve('ready');
    await expect(Promise.all([first, second])).resolves.toEqual(['ready', 'ready']);
  });

  it('returns null for container AbortError without showing a toast', async () => {
    const container = document.createElement('section');
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    const handle = bindContainerBusy({
      container,
      action: () => Promise.reject(abortError),
    });

    await expect(handle.run()).resolves.toBeNull();

    expect(Toast.show).not.toHaveBeenCalled();
    expect(container.hasAttribute('aria-busy')).toBe(false);
  });

  it('suppresses container failure toasts when silent is true', async () => {
    const container = document.createElement('section');
    const error = new Error('offline');
    const handle = bindContainerBusy({
      container,
      action: () => Promise.reject(error),
      silent: true,
    });

    await expect(handle.run()).rejects.toBe(error);

    expect(Toast.show).not.toHaveBeenCalled();
    expect(container.hasAttribute('aria-busy')).toBe(false);
  });

  it('disposes container busy state during pending without later mutating the container', async () => {
    const container = document.createElement('section');
    const pending = deferred();
    const handle = bindContainerBusy({
      container,
      action: () => pending.promise,
    });

    const promise = handle.run();
    handle.dispose();

    expect(container.hasAttribute('aria-busy')).toBe(false);

    container.setAttribute('aria-busy', 'manual');
    pending.resolve('done');
    await expect(promise).resolves.toBe('done');
    expect(container.getAttribute('aria-busy')).toBe('manual');

    expect(() => handle.dispose()).not.toThrow();
  });
});

describe('renderInlineError', () => {
  it('replaces target children with an accessible inline error', () => {
    const target = document.createElement('div');
    target.setAttribute('aria-busy', 'true');
    target.append(document.createElement('span'));

    const handle = renderInlineError({
      target,
      message: 'Could not load applications.',
      onRetry: vi.fn(),
    });

    expect(target.children).toHaveLength(1);
    expect(target.hasAttribute('aria-busy')).toBe(false);
    expect(handle.element.className).toBe('inline-error');
    expect(handle.element.getAttribute('role')).toBe('alert');
    expect(handle.element.getAttribute('aria-live')).toBe('polite');
    expect(handle.element.querySelector('.inline-error__message').textContent)
      .toBe('Could not load applications.');
    expect(handle.element.querySelector('.inline-error__retry').textContent)
      .toBe('Try again');
  });

  it('focuses the retry button after mounting', () => {
    const target = document.createElement('div');
    document.body.append(target);

    const handle = renderInlineError({
      target,
      message: 'Could not load.',
      onRetry: vi.fn(),
    });

    expect(document.activeElement).toBe(handle.element.querySelector('.inline-error__retry'));
  });

  it('invokes retry once per retry click', () => {
    const target = document.createElement('div');
    const onRetry = vi.fn();
    const handle = renderInlineError({ target, message: 'Could not load.', onRetry });
    const retry = handle.element.querySelector('.inline-error__retry');

    retry.click();
    retry.click();

    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('disposes idempotently', () => {
    const target = document.createElement('div');
    const handle = renderInlineError({ target, message: 'Could not load.', onRetry: vi.fn() });

    handle.dispose();
    handle.dispose();

    expect(target.children).toHaveLength(0);
  });
});
