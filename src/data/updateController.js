import { getUpdateStatus, setUpdateStatus } from './updateStatusStore.js';

const POLL_MS = 1000;
const AUTO_CHECK_MS = 24 * 60 * 60 * 1000;
const RESTART_DELAYED_MS = 30 * 1000;
const ACTIVE_STATUSES = new Set(['checking', 'downloading', 'verifying', 'extracting']);
const DEFAULT_SETTINGS = Object.freeze({ autoCheckUpdates: false, updateMode: 'ask' });

let _subscriberCount = 0;
let _pollTimer = null;
let _pollInFlight = null;
let _autoCheckTimer = null;
let _restartTimer = null;
let _restartStartedAt = 0;
let _settings = null;
let _settingsPromise = null;
let _settingsChangedHandler = null;
let _reloadPage = () => globalThis.location?.reload?.();

function normalizeSettings(settings = {}) {
  return {
    autoCheckUpdates: Boolean(settings.autoCheckUpdates),
    updateMode: settings.updateMode === 'notify' ? 'notify' : 'ask',
  };
}

function publishStatus(status) {
  return setUpdateStatus(status);
}

function publishSettings(settings) {
  _settings = normalizeSettings(settings);
  publishStatus(_settings);
  configureAutoChecks();
  return _settings;
}

async function readJson(route, options) {
  const response = await globalThis.fetch(route, options);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error?.message || 'Update request failed.');
  }
  return body;
}

export function normalizeVersion(version) {
  return String(version ?? '').trim().replace(/^v/i, '');
}

export function versionsMatch(left, right) {
  return Boolean(left || right) && normalizeVersion(left) === normalizeVersion(right);
}

function isActiveUpdateStatus(status) {
  return ACTIVE_STATUSES.has(status);
}

function clearStatusTimer() {
  if (_pollTimer) {
    globalThis.clearTimeout(_pollTimer);
    _pollTimer = null;
  }
}

function clearAutoCheckTimer() {
  if (_autoCheckTimer) {
    globalThis.clearInterval(_autoCheckTimer);
    _autoCheckTimer = null;
  }
}

function clearRestartTimer() {
  if (_restartTimer) {
    globalThis.clearTimeout(_restartTimer);
    _restartTimer = null;
  }
}

function scheduleStatusPoll() {
  if (_subscriberCount <= 0 || _pollTimer || _pollInFlight) {
    return;
  }
  if (!isActiveUpdateStatus(getUpdateStatus().status)) {
    return;
  }
  _pollTimer = globalThis.setTimeout(() => {
    _pollTimer = null;
    void pollStatus();
  }, POLL_MS);
}

async function pollStatus({ force = false } = {}) {
  if (_subscriberCount <= 0 && !force) {
    return null;
  }
  if (_pollInFlight) {
    return _pollInFlight;
  }
  _pollInFlight = readJson('/api/update/status')
    .then((status) => {
      _pollInFlight = null;
      if (getUpdateStatus().status === 'installing') {
        clearStatusTimer();
        return status;
      }
      publishStatus(status);
      if (isActiveUpdateStatus(status.status)) {
        scheduleStatusPoll();
      } else {
        clearStatusTimer();
      }
      return status;
    })
    .catch((error) => {
      _pollInFlight = null;
      clearStatusTimer();
      publishStatus({ status: 'check-failed', error: error.message });
      return null;
    });
  return _pollInFlight;
}

async function loadSettings({ force = false, runInitialCheck = true } = {}) {
  if (_settings && !force) {
    return _settings;
  }
  if (_settingsPromise) {
    return _settingsPromise;
  }
  _settingsPromise = readJson('/api/update/settings')
    .then((settings) => {
      const nextSettings = publishSettings(settings);
      if (runInitialCheck && nextSettings.autoCheckUpdates) {
        void check({ background: true });
      }
      return nextSettings;
    })
    .catch(() => {
      const nextSettings = publishSettings(_settings ?? DEFAULT_SETTINGS);
      return nextSettings;
    })
    .finally(() => {
      _settingsPromise = null;
    });
  return _settingsPromise;
}

function configureAutoChecks() {
  clearAutoCheckTimer();
  if (_subscriberCount <= 0 || !_settings?.autoCheckUpdates) {
    return;
  }
  _autoCheckTimer = globalThis.setInterval(() => {
    void check({ background: true });
  }, AUTO_CHECK_MS);
}

function handleSettingsChanged(event) {
  if (event?.detail) {
    publishSettings(event.detail);
    return;
  }
  void loadSettings({ force: true, runInitialCheck: false });
}

function ensureSettingsListener() {
  if (_settingsChangedHandler) {
    return;
  }
  _settingsChangedHandler = handleSettingsChanged;
  globalThis.addEventListener?.('alice-update-settings-changed', _settingsChangedHandler);
}

function removeSettingsListener() {
  if (!_settingsChangedHandler) {
    return;
  }
  globalThis.removeEventListener?.('alice-update-settings-changed', _settingsChangedHandler);
  _settingsChangedHandler = null;
}

function startController() {
  ensureSettingsListener();
  void loadSettings({ runInitialCheck: false }).then((settings) => {
    if (_subscriberCount <= 0) {
      return;
    }
    void pollStatus({ force: true }).then((status) => {
      if (_subscriberCount <= 0 || !settings.autoCheckUpdates || status?.status !== 'idle') {
        return;
      }
      void check({ background: true });
    });
  });
}

function stopController() {
  clearStatusTimer();
  clearAutoCheckTimer();
  clearRestartTimer();
  removeSettingsListener();
  _restartStartedAt = 0;
}

export function subscribeUpdateController({ reloadPage } = {}) {
  if (reloadPage) {
    _reloadPage = reloadPage;
  }
  _subscriberCount += 1;
  if (_subscriberCount === 1) {
    startController();
  }

  let active = true;
  return () => {
    if (!active) {
      return;
    }
    active = false;
    _subscriberCount = Math.max(0, _subscriberCount - 1);
    if (_subscriberCount === 0) {
      stopController();
    }
  };
}

async function pollRestartHealth() {
  _restartTimer = null;
  try {
    const health = await readJson('/api/health');
    const latestVersion = getUpdateStatus().latestVersion;
    if (!latestVersion || versionsMatch(health.version, latestVersion)) {
      _reloadPage();
      return;
    }
  } catch {
    // The server is expected to be down briefly while the launcher swaps files.
  }

  if (
    !getUpdateStatus().restartDelayed
    && _restartStartedAt
    && Date.now() - _restartStartedAt >= RESTART_DELAYED_MS
  ) {
    publishStatus({ restartDelayed: true });
  }

  if (_subscriberCount > 0) {
    _restartTimer = globalThis.setTimeout(() => {
      void pollRestartHealth();
    }, POLL_MS);
  }
}

function beginRestartWatch() {
  if (_restartTimer) {
    return;
  }
  _restartTimer = globalThis.setTimeout(() => {
    void pollRestartHealth();
  }, POLL_MS);
}

export async function check({ background = false, refreshStatus = true } = {}) {
  if (!background) {
    publishStatus({ status: 'checking', error: null });
  }
  try {
    const result = await readJson('/api/update/check');
    publishStatus({
      ...result,
      status: result.updateAvailable ? 'available' : 'idle',
      error: null,
    });
    if (refreshStatus) {
      await pollStatus({ force: true });
    }
  } catch (error) {
    publishStatus({ status: 'check-failed', error: error.message });
  }
  return getUpdateStatus();
}

export async function download() {
  publishStatus({ status: 'downloading', error: null, restartDelayed: false });
  try {
    const status = await readJson('/api/update/download', { method: 'POST' });
    publishStatus(status);
    await pollStatus({ force: true });
    scheduleStatusPoll();
  } catch (error) {
    clearStatusTimer();
    publishStatus({ status: 'failed', error: error.message });
  }
  return getUpdateStatus();
}

export async function cancel() {
  try {
    const status = await readJson('/api/update/cancel', { method: 'POST' });
    clearStatusTimer();
    publishStatus(status);
  } catch (error) {
    clearStatusTimer();
    publishStatus({ status: 'failed', error: error.message });
  }
  return getUpdateStatus();
}

export async function restart() {
  clearStatusTimer();
  publishStatus({ status: 'installing', error: null, restartDelayed: false });
  try {
    await readJson('/api/update/restart', { method: 'POST' });
    _restartStartedAt = Date.now();
    beginRestartWatch();
  } catch (error) {
    clearRestartTimer();
    publishStatus({ status: 'failed', error: error.message });
  }
  return getUpdateStatus();
}

export function resetUpdateControllerForTesting() {
  stopController();
  _subscriberCount = 0;
  _pollInFlight = null;
  _settings = null;
  _settingsPromise = null;
  _reloadPage = () => globalThis.location?.reload?.();
}
