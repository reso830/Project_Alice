const RELEASES_URL = 'https://github.com/reso830/Project_Alice/releases/latest';
const POLL_MS = 1000;
const AUTO_CHECK_MS = 24 * 60 * 60 * 1000;

let _root = null;
let _pollTimer = null;
let _autoCheckTimer = null;
let _mountId = 0;
let _dismissed = false;
let _status = { status: 'idle' };
let _onStatusChange = () => {};

function createButton(className, text, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = text;
  button.addEventListener('click', onClick);
  return button;
}

function createLink(text) {
  const link = document.createElement('a');
  link.className = 'update-toast__link';
  link.href = _status.releaseNotesUrl || RELEASES_URL;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = text;
  return link;
}

function applyStatus(nextStatus) {
  _status = { ..._status, ...nextStatus };
  _onStatusChange(_status);
  renderStatus();
}

async function readJson(route, options) {
  const response = await globalThis.fetch(route, options);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error?.message || 'Update request failed.');
  }
  return body;
}

async function pollStatus() {
  try {
    applyStatus(await readJson('/api/update/status'));
  } catch (error) {
    applyStatus({ status: 'failed', error: error.message });
  }
}

function startPolling() {
  if (_pollTimer) {
    return;
  }
  _pollTimer = globalThis.setInterval(() => {
    void pollStatus();
  }, POLL_MS);
}

async function checkNow() {
  try {
    const result = await readJson('/api/update/check');
    applyStatus({
      ...result,
      status: result.updateAvailable ? 'available' : 'idle',
    });
    await pollStatus();
  } catch (error) {
    applyStatus({ status: 'failed', error: error.message });
  }
}

async function initializeAutoChecks(mountId) {
  try {
    const settings = await readJson('/api/update/settings');
    if (mountId !== _mountId || !_root) {
      return;
    }
    if (!settings.autoCheckUpdates) {
      return;
    }
    await checkNow();
    if (mountId !== _mountId || !_root) {
      return;
    }
    _autoCheckTimer = globalThis.setInterval(() => {
      void checkNow();
    }, AUTO_CHECK_MS);
  } catch {
    // Settings load failures should not bypass the user's auto-check preference.
  }
}

async function download() {
  try {
    applyStatus(await readJson('/api/update/download', { method: 'POST' }));
    startPolling();
  } catch (error) {
    applyStatus({ status: 'failed', error: error.message });
  }
}

async function restart() {
  try {
    applyStatus(await readJson('/api/update/restart', { method: 'POST' }));
  } catch (error) {
    applyStatus({ status: 'failed', error: error.message });
  }
}

function shouldRender() {
  return !_dismissed && ['available', 'downloading', 'ready-to-restart', 'installing', 'failed'].includes(_status.status);
}

function renderStatus() {
  if (!_root) {
    return;
  }
  _root.replaceChildren();
  _root.hidden = !shouldRender();
  if (_root.hidden) {
    return;
  }

  const icon = document.createElement('div');
  const body = document.createElement('div');
  const title = document.createElement('p');
  const meta = document.createElement('p');
  const actions = document.createElement('div');
  const close = createButton('update-toast__close', '×', () => {
    _dismissed = true;
    renderStatus();
  });

  icon.className = `update-toast__icon update-toast__icon--${_status.status}`;
  icon.setAttribute('aria-hidden', 'true');
  body.className = 'update-toast__body';
  title.className = 'update-toast__title';
  meta.className = 'update-toast__meta';
  actions.className = 'update-toast__actions';
  close.setAttribute('aria-label', 'Dismiss update notification');

  if (_status.status === 'available') {
    title.textContent = 'A new version is available';
    meta.textContent = `v${_status.latestVersion || ''}`;
    actions.append(
      createLink("What's new ↗"),
      createButton('update-toast__button update-toast__button--ghost', 'Remind me later', () => {
        _dismissed = true;
        renderStatus();
      }),
      createButton('update-toast__button update-toast__button--primary', 'Install now', download),
    );
  } else if (_status.status === 'downloading') {
    title.textContent = 'Downloading update';
    meta.textContent = `${_status.progress || 0}%`;
    const progress = document.createElement('div');
    const bar = document.createElement('span');
    const progressValue = Math.max(0, Math.min(100, _status.progress || 0));
    progress.className = 'update-toast__progress';
    progress.setAttribute('role', 'progressbar');
    progress.setAttribute('aria-label', 'Update download progress');
    progress.setAttribute('aria-valuemin', '0');
    progress.setAttribute('aria-valuemax', '100');
    progress.setAttribute('aria-valuenow', String(progressValue));
    bar.style.width = `${progressValue}%`;
    progress.append(bar);
    body.append(title, meta, progress);
    actions.append(createLink('Manage in Settings'));
  } else if (_status.status === 'ready-to-restart' || _status.status === 'installing') {
    title.textContent = _status.status === 'installing' ? 'Installing update' : 'Restart to finish';
    meta.textContent = `v${_status.latestVersion || ''} · applying changes`;
    actions.append(
      createLink('Manage in Settings'),
      createButton('update-toast__button update-toast__button--primary', 'Restart to finish', restart),
    );
  } else {
    title.textContent = 'Update failed';
    meta.textContent = _status.error || 'The current installation remains fully functional.';
    actions.append(createLink('Manage in Settings'));
  }

  if (!body.contains(title)) {
    body.append(title, meta);
  }
  body.append(actions);
  _root.append(icon, body, close);
}

export function mount({ health, onStatusChange = () => {} } = {}) {
  destroy();
  const mountId = _mountId + 1;
  _mountId = mountId;
  _onStatusChange = onStatusChange;
  _dismissed = false;
  _status = { status: 'idle' };

  if (!health?.updateSupported) {
    _onStatusChange(_status);
    return null;
  }

  _root = document.createElement('section');
  _root.className = 'update-toast';
  _root.hidden = true;
  _root.setAttribute('aria-live', 'polite');
  document.body.append(_root);
  void initializeAutoChecks(mountId);
  return _root;
}

export function destroy() {
  _mountId += 1;
  if (_pollTimer) {
    globalThis.clearInterval(_pollTimer);
  }
  if (_autoCheckTimer) {
    globalThis.clearInterval(_autoCheckTimer);
  }
  _pollTimer = null;
  _autoCheckTimer = null;
  _root?.remove();
  _root = null;
  _onStatusChange = () => {};
}

export const UpdateToast = { mount, destroy };
