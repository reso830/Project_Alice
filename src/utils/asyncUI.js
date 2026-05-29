import { Toast } from '../components/Toast.js';

function isAbortError(error) {
  return error?.name === 'AbortError';
}

function failureMessage(errorMessage, error) {
  if (typeof errorMessage === 'function') {
    return errorMessage(error) ?? 'Something went wrong.';
  }

  return 'Something went wrong.';
}

function restorePeers(peerStates) {
  for (const { peer, disabled } of peerStates) {
    peer.disabled = disabled;
  }
}

export function bindBusyButton({ button, action, busyLabel, peers = [], errorMessage, silent = false } = {}) {
  if (!button) {
    throw new Error('bindBusyButton requires a button.');
  }

  let pendingPromise = null;
  let disposed = false;
  let cleanup = () => {};

  function run() {
    if (pendingPromise) {
      return pendingPromise;
    }

    if (typeof action !== 'function') {
      return Promise.reject(new Error('bindBusyButton requires an action.'));
    }

    disposed = false;
    const originalLabel = button.textContent;
    const originalDisabled = button.disabled;
    const peerStates = peers
      .filter((peer) => peer.getAttribute('aria-busy') !== 'true')
      .map((peer) => ({ peer, disabled: peer.disabled }));

    button.setAttribute('aria-busy', 'true');
    button.disabled = true;
    if (busyLabel) {
      button.textContent = busyLabel;
    }
    for (const { peer } of peerStates) {
      peer.disabled = true;
    }

    cleanup = () => {
      button.removeAttribute('aria-busy');
      button.disabled = originalDisabled;
      if (busyLabel && button.textContent === busyLabel) {
        button.textContent = originalLabel;
      }
      restorePeers(peerStates);
    };

    let actionPromise;
    try {
      actionPromise = Promise.resolve(action());
    } catch (error) {
      actionPromise = Promise.reject(error);
    }

    pendingPromise = actionPromise
      .catch((error) => {
        if (isAbortError(error)) {
          return null;
        }

        if (!silent && !disposed) {
          Toast.show(failureMessage(errorMessage, error), 'failure');
        }
        throw error;
      })
      .finally(() => {
        if (!disposed) {
          cleanup();
        }
        pendingPromise = null;
      });

    return pendingPromise;
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed = true;
    cleanup();
  }

  return { run, dispose };
}

export function bindContainerBusy({ container, action, errorMessage, silent = false } = {}) {
  if (!container) {
    throw new Error('bindContainerBusy requires a container.');
  }

  let pendingPromise = null;
  let disposed = false;
  let cleanup = () => {};

  function run() {
    if (pendingPromise) {
      return pendingPromise;
    }

    if (typeof action !== 'function') {
      return Promise.reject(new Error('bindContainerBusy requires an action.'));
    }

    disposed = false;
    container.setAttribute('aria-busy', 'true');
    cleanup = () => container.removeAttribute('aria-busy');

    let actionPromise;
    try {
      actionPromise = Promise.resolve(action());
    } catch (error) {
      actionPromise = Promise.reject(error);
    }

    pendingPromise = actionPromise
      .catch((error) => {
        if (isAbortError(error)) {
          return null;
        }

        if (!silent && !disposed) {
          Toast.show(failureMessage(errorMessage, error), 'failure');
        }
        throw error;
      })
      .finally(() => {
        if (!disposed) {
          cleanup();
        }
        pendingPromise = null;
      });

    return pendingPromise;
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed = true;
    cleanup();
  }

  return { run, dispose };
}

export function renderInlineError({ target, message, onRetry, retryLabel = 'Try again' } = {}) {
  if (!target) {
    throw new Error('renderInlineError requires a target.');
  }

  const element = document.createElement('div');
  const messageElement = document.createElement('p');
  const retryButton = document.createElement('button');

  element.className = 'inline-error';
  element.setAttribute('role', 'alert');
  element.setAttribute('aria-live', 'polite');
  messageElement.className = 'inline-error__message';
  messageElement.textContent = message;
  retryButton.className = 'inline-error__retry';
  retryButton.type = 'button';
  retryButton.textContent = retryLabel;
  retryButton.addEventListener('click', () => onRetry?.());

  element.append(messageElement, retryButton);
  target.replaceChildren(element);
  target.removeAttribute('aria-busy');
  retryButton.focus();

  return {
    element,
    focus: () => retryButton.focus(),
    dispose: () => {
      element.remove();
    },
  };
}
