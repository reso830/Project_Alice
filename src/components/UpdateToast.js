import { createSvgIcon } from '../utils/icons.js';
import { setUpdateStatus, subscribeUpdateStatus } from '../data/updateStatusStore.js';

const RELEASES_URL = 'https://github.com/reso830/Project_Alice/releases/latest';
const POLL_MS = 1000;
const AUTO_CHECK_MS = 24 * 60 * 60 * 1000;
const RESTART_DELAYED_MS = 30 * 1000;

// 24×24 stroke glyphs (match the icon treatment in the reference drawings).
const GLYPHS = {
  check: 'M5 13l4 4L19 7',
  download: 'M12 4v10M8 12l4 4 4-4M5 20h14',
  refresh: 'M21 12a9 9 0 1 1-2.64-6.36M21 4v4h-4',
  warning: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  spark: 'M12 4l1.6 5.4L19 11l-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6z',
};

let _root = null;
let _pollTimer = null;
let _autoCheckTimer = null;
let _restartTimer = null;
let _mountId = 0;
let _dismissed = false;
let _status = { status: 'idle' };
let _onStatusChange = () => {};
let _onManage = () => {};
let _reloadPage = () => globalThis.location?.reload?.();
let _unsubscribeStatus = null;
let _downloadStartedAt = 0;
let _restartStartedAt = 0;

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  return node;
}

function glyph(pathData) {
  return createSvgIcon(pathData);
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(value || 0)));
}

function displayVersion(version) {
  const value = String(version || '').trim();
  return value.toLowerCase().startsWith('v') ? value : `v${value}`;
}

function normalizeVersion(version) {
  return String(version || '').trim().replace(/^v/i, '');
}

function versionsMatch(left, right) {
  return normalizeVersion(left) === normalizeVersion(right);
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) {
    return '';
  }
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(1)} MB`;
  }
  const kb = bytes / 1024;
  if (kb >= 1) {
    return `${kb.toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

function releasedText(publishedAt) {
  if (!publishedAt) {
    return 'new release';
  }
  const then = new Date(publishedAt);
  if (Number.isNaN(then.getTime())) {
    return 'new release';
  }
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  if (days <= 0) {
    return 'released today';
  }
  if (days === 1) {
    return 'released yesterday';
  }
  if (days < 30) {
    return `released ${days} days ago`;
  }
  return `released ${then.toLocaleDateString()}`;
}

function etaText(status) {
  const total = status.bytesTotal;
  const done = status.bytesDownloaded;
  if (!total || !done || !_downloadStartedAt) {
    return '';
  }
  const elapsed = (Date.now() - _downloadStartedAt) / 1000;
  const rate = elapsed > 0 ? done / elapsed : 0;
  if (rate <= 0) {
    return '';
  }
  const seconds = Math.ceil(Math.max(0, total - done) / rate);
  return Number.isFinite(seconds) ? `~${seconds}s left` : '';
}

function dismiss() {
  _dismissed = true;
  renderStatus();
}

function closeButton() {
  const button = el('button', 'update-toast__close');
  button.type = 'button';
  button.textContent = '×';
  button.setAttribute('aria-label', 'Dismiss update notification');
  button.addEventListener('click', dismiss);
  return button;
}

function whatsNewLink() {
  const link = el('a', 'update-toast__link update-toast__link--lead');
  link.href = _status.releaseNotesUrl || RELEASES_URL;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = "What's new ↗";
  return link;
}

function manageLink() {
  const button = el('button', 'update-toast__link update-toast__link--lead');
  button.type = 'button';
  button.append(glyph(GLYPHS.spark), document.createTextNode('Manage in Settings'));
  button.addEventListener('click', () => {
    _onManage();
    dismiss();
  });
  return button;
}

function actionButton(text, variant, onClick) {
  const button = el('button', `update-toast__button update-toast__button--${variant}`);
  button.type = 'button';
  button.textContent = text;
  button.addEventListener('click', onClick);
  return button;
}

function stateConfig(state) {
  switch (state) {
    case 'available':
      return {
        iconMod: 'available',
        glyph: GLYPHS.check,
        title: 'A new version is available',
        metaText: releasedText(_status.publishedAt),
        showChip: true,
      };
    case 'downloading':
      return {
        iconMod: 'downloading',
        glyph: GLYPHS.download,
        title: 'Downloading update',
        metaText: formatBytes(_status.bytesTotal || _status.size),
        showChip: true,
      };
    case 'fetching':
      return {
        iconMod: 'downloading',
        glyph: GLYPHS.download,
        title: 'Fetching update',
        metaText: 'syncing release tags…',
        showChip: true,
      };
    case 'verifying':
      return {
        iconMod: 'installing',
        glyph: GLYPHS.refresh,
        title: 'Verifying update',
        metaText: 'checking the update package…',
        showChip: true,
      };
    case 'extracting':
      return {
        iconMod: 'installing',
        glyph: GLYPHS.refresh,
        title: 'Extracting update',
        metaText: 'preparing files…',
        showChip: true,
      };
    case 'installing':
      return {
        iconMod: 'installing',
        glyph: GLYPHS.refresh,
        title: _status.updateChannel === 'git' ? 'Updating via git' : 'Restarting Alice',
        metaText: _status.updateChannel === 'git'
          ? 'applying the release tag…'
          : _status.restartDelayed
            ? 'Alice is taking longer than expected to come back online.'
            : 'waiting for Alice to come back online…',
        showChip: true,
      };
    case 'ready-to-restart':
      return {
        iconMod: 'installing',
        glyph: GLYPHS.refresh,
        title: 'Installing update',
        metaText: 'ready to apply changes…',
        showChip: true,
      };
    default:
      return {
        iconMod: 'failed',
        glyph: GLYPHS.warning,
        title: 'Update failed',
        metaText: _status.error || 'The current installation remains fully functional.',
        showChip: false,
      };
  }
}

function renderHeader(config) {
  const header = el('div', 'update-toast__header');
  const icon = el('div', `update-toast__icon update-toast__icon--${config.iconMod}`);
  icon.setAttribute('aria-hidden', 'true');
  icon.append(glyph(config.glyph));

  const body = el('div', 'update-toast__body');
  const title = el('p', 'update-toast__title');
  title.textContent = config.title;
  const meta = el('p', 'update-toast__meta');
  if (config.showChip) {
    const chip = el('span', 'update-toast__version-chip');
    chip.textContent = displayVersion(_status.latestVersion);
    meta.append(chip);
  }
  if (config.metaText) {
    const text = el('span', 'update-toast__meta-text');
    text.textContent = config.metaText;
    meta.append(text);
  }
  body.append(title, meta);

  header.append(icon, body, closeButton());
  return header;
}

function renderProgressBlock(state) {
  const indeterminate = state !== 'downloading';
  const block = el('div', 'update-toast__progress-block');
  const progress = el('div', `update-toast__progress${indeterminate ? ' update-toast__progress--indeterminate' : ''}`);
  const bar = document.createElement('span');
  progress.setAttribute('role', 'progressbar');

  const meta = el('div', 'update-toast__progress-meta');
  const left = document.createElement('span');
  const right = document.createElement('span');

  if (indeterminate) {
    progress.setAttribute('aria-label', state === 'installing' ? 'Restarting Alice' : 'Installing update');
    if (state === 'installing') {
      left.textContent = _status.restartDelayed
        ? 'Keep this tab open or restart Alice manually'
        : _status.updateChannel === 'git'
          ? 'Keep this tab open while Alice updates.'
          : 'Waiting for Alice to come back online';
      right.textContent = '';
    } else if (state === 'fetching') {
      progress.setAttribute('aria-label', 'Fetching update');
      left.textContent = 'Syncing release tags';
      right.textContent = '';
    } else if (state === 'verifying') {
      left.textContent = 'Verifying package';
      right.textContent = '';
    } else if (state === 'extracting') {
      left.textContent = 'Extracting files';
      right.textContent = '';
    } else {
      left.textContent = 'Almost done';
      right.textContent = 'Restart to finish';
    }
  } else {
    const value = clampPercent(_status.progress);
    progress.setAttribute('aria-label', 'Update download progress');
    progress.setAttribute('aria-valuemin', '0');
    progress.setAttribute('aria-valuemax', '100');
    progress.setAttribute('aria-valuenow', String(value));
    bar.style.width = `${value}%`;
    left.textContent = `${value}%`;
    right.textContent = etaText(_status);
  }

  progress.append(bar);
  meta.append(left, right);
  block.append(progress, meta);
  return block;
}

function renderActions(state) {
  const actions = el('div', 'update-toast__actions');
  if (state === 'available') {
    actions.append(
      whatsNewLink(),
      actionButton('Remind me later', 'ghost', dismiss),
      actionButton('Install now', 'primary', download),
    );
  } else if (state === 'downloading') {
    actions.append(manageLink(), actionButton('Cancel', 'ghost', dismiss));
  } else if (['fetching', 'verifying', 'extracting'].includes(state)) {
    actions.append(manageLink());
  } else if (state === 'ready-to-restart') {
    actions.append(
      manageLink(),
      actionButton('Later', 'ghost', dismiss),
      actionButton('Restart to finish', 'primary', restart),
    );
  } else {
    actions.append(manageLink(), actionButton('Dismiss', 'ghost', dismiss));
  }
  return actions;
}

function shouldRender() {
  return !_dismissed
    && [
      'available',
      'downloading',
      'fetching',
      'verifying',
      'extracting',
      'ready-to-restart',
      'installing',
      'failed',
    ].includes(_status.status);
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

  const state = _status.status;
  const config = stateConfig(state);

  _root.append(renderHeader(config));
  if (['downloading', 'fetching', 'verifying', 'extracting', 'installing', 'ready-to-restart'].includes(state)) {
    _root.append(renderProgressBlock(state));
  }
  const actions = renderActions(state);
  if (actions.childElementCount > 0) {
    _root.append(el('hr', 'update-toast__divider'));
    _root.append(actions);
  }
}

function applyStatus(nextStatus, { publish = true } = {}) {
  _status = { ..._status, ...nextStatus };
  if (publish) {
    setUpdateStatus(_status);
  }
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

function stopPolling() {
  if (_pollTimer) {
    globalThis.clearInterval(_pollTimer);
    _pollTimer = null;
  }
}

function stopRestartPolling() {
  if (_restartTimer) {
    globalThis.clearTimeout(_restartTimer);
    _restartTimer = null;
  }
}

function shouldResumeRestartPolling(status = _status) {
  return status.status === 'installing' && Boolean(status.restartPolling || status.restartStartedAt);
}

async function pollRestartHealth() {
  _restartTimer = null;
  try {
    const health = await readJson('/api/health');
    if (!_status.latestVersion || versionsMatch(health.version, _status.latestVersion)) {
      _reloadPage();
      return;
    }
  } catch {
    // The server is expected to be down briefly while the launcher swaps files.
  }
  if (!_status.restartDelayed && _restartStartedAt && Date.now() - _restartStartedAt >= RESTART_DELAYED_MS) {
    applyStatus({ restartDelayed: true });
  }
  _restartTimer = globalThis.setTimeout(() => {
    void pollRestartHealth();
  }, POLL_MS);
}

function startRestartPolling() {
  if (_restartTimer) {
    return;
  }
  _restartStartedAt = _status.restartStartedAt || _restartStartedAt || Date.now();
  _restartTimer = globalThis.setTimeout(() => {
    void pollRestartHealth();
  }, POLL_MS);
}

async function pollStatus() {
  try {
    const status = await readJson('/api/update/status');
    applyStatus(status);
    if (['checking', 'downloading', 'fetching', 'verifying', 'extracting'].includes(status.status)) {
      startPolling();
    } else {
      stopPolling();
    }
  } catch (error) {
    stopPolling();
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
    applyStatus({ status: 'check-failed', error: error.message });
  }
}

async function initializeAutoChecks(mountId) {
  if (shouldResumeRestartPolling()) {
    return;
  }
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
  _downloadStartedAt = Date.now();
  try {
    applyStatus(await readJson('/api/update/download', { method: 'POST' }));
    startPolling();
  } catch (error) {
    applyStatus({ status: 'failed', error: error.message });
  }
}

async function restart() {
  // Go straight to the stable installing state (the raw `restarting` response
  // is not a renderable state and would flicker the toast out and back in).
  const restartStartedAt = Date.now();
  applyStatus({ status: 'installing', restartPolling: true, restartStartedAt });
  try {
    await readJson('/api/update/restart', { method: 'POST' });
    startRestartPolling();
  } catch (error) {
    stopRestartPolling();
    applyStatus({ status: 'failed', restartPolling: false, error: error.message });
  }
}

export function mount({
  health,
  onStatusChange = () => {},
  onManageInSettings = () => {},
  reloadPage = () => globalThis.location?.reload?.(),
} = {}) {
  destroy();
  const mountId = _mountId + 1;
  _mountId = mountId;
  _onStatusChange = onStatusChange;
  _onManage = onManageInSettings;
  _reloadPage = reloadPage;
  _dismissed = false;
  _status = { status: 'idle' };

  if (!health?.updateSupported) {
    _onStatusChange(_status);
    return null;
  }

  _status = { ..._status, updateChannel: health?.updateChannel ?? null };

  _root = document.createElement('section');
  _root.className = 'update-toast';
  _root.hidden = true;
  _root.setAttribute('aria-live', 'polite');
  document.body.append(_root);
  _unsubscribeStatus = subscribeUpdateStatus((status) => {
    applyStatus(status, { publish: false });
    if (shouldResumeRestartPolling(status)) {
      startRestartPolling();
    }
  }, { emit: true });
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
  stopRestartPolling();
  _unsubscribeStatus?.();
  _unsubscribeStatus = null;
  _pollTimer = null;
  _autoCheckTimer = null;
  _downloadStartedAt = 0;
  _restartStartedAt = 0;
  _root?.remove();
  _root = null;
  _onStatusChange = () => {};
  _onManage = () => {};
  _reloadPage = () => globalThis.location?.reload?.();
}

export const UpdateToast = { mount, destroy };
