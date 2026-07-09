import { createSvgIcon } from '../utils/icons.js';
import {
  cancel as cancelUpdate,
  download as downloadUpdate,
  restart as restartUpdate,
  subscribeUpdateController,
} from '../data/updateController.js';
import { subscribeUpdateStatus } from '../data/updateStatusStore.js';

const RELEASES_URL = 'https://github.com/reso830/Project_Alice/releases/latest';

// 24×24 stroke glyphs (match the icon treatment in the reference drawings).
const GLYPHS = {
  check: 'M5 13l4 4L19 7',
  download: 'M12 4v10M8 12l4 4 4-4M5 20h14',
  refresh: 'M21 12a9 9 0 1 1-2.64-6.36M21 4v4h-4',
  warning: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  spark: 'M12 4l1.6 5.4L19 11l-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6z',
};

let _root = null;
let _mountId = 0;
let _dismissed = false;
let _status = { status: 'idle' };
let _onStatusChange = () => {};
let _onManage = () => {};
let _reloadPage = () => globalThis.location?.reload?.();
let _unsubscribeStatus = null;
let _unsubscribeController = null;
let _updateMode = 'ask';

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
  const seconds = Number(status.secondsRemaining);
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
        title: 'Restarting Alice',
        metaText: _status.restartDelayed
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
        : 'Waiting for Alice to come back online';
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
    actions.append(manageLink(), actionButton('Cancel', 'ghost', cancelDownload));
  } else if (['verifying', 'extracting'].includes(state)) {
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
  if (_dismissed) {
    return false;
  }
  const isPassive = _status.status === 'available';
  if (isPassive && _updateMode === 'notify') {
    return false;
  }
  return [
    'available',
    'downloading',
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
  if (['downloading', 'verifying', 'extracting', 'installing', 'ready-to-restart'].includes(state)) {
    _root.append(renderProgressBlock(state));
  }
  const actions = renderActions(state);
  if (actions.childElementCount > 0) {
    _root.append(el('hr', 'update-toast__divider'));
    _root.append(actions);
  }
}

function applyStatus(nextStatus) {
  _status = { ..._status, ...nextStatus };
  if (Object.hasOwn(_status, 'updateMode')) {
    _updateMode = _status.updateMode === 'notify' ? 'notify' : 'ask';
  }
  _onStatusChange(_status);
  renderStatus();
}

async function download() {
  await downloadUpdate();
}

async function cancelDownload() {
  await cancelUpdate();
  dismiss();
}

async function restart() {
  await restartUpdate();
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
  _updateMode = 'ask';

  if (!health?.updateSupported) {
    _onStatusChange(_status);
    return null;
  }

  _root = document.createElement('section');
  _root.className = 'update-toast';
  _root.hidden = true;
  _root.setAttribute('aria-live', 'polite');
  document.body.append(_root);
  _unsubscribeStatus = subscribeUpdateStatus((status) => {
    applyStatus(status);
  }, { emit: true });
  _unsubscribeController = subscribeUpdateController({ reloadPage: _reloadPage });
  if (mountId !== _mountId) {
    destroy();
  }
  return _root;
}

export function destroy() {
  _mountId += 1;
  _unsubscribeStatus?.();
  _unsubscribeController?.();
  _unsubscribeStatus = null;
  _unsubscribeController = null;
  _updateMode = 'ask';
  _root?.remove();
  _root = null;
  _onStatusChange = () => {};
  _onManage = () => {};
  _reloadPage = () => globalThis.location?.reload?.();
}

export const UpdateToast = { mount, destroy };
