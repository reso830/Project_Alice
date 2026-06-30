import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_LAUNCH_SETTINGS = Object.freeze({
  port: 3001,
  openBrowser: true,
});

const DEFAULT_UPDATE_SETTINGS = Object.freeze({
  autoCheckUpdates: true,
  updateMode: 'ask',
});

const UPDATE_MODES = new Set(['notify', 'ask', 'auto']);

function validPort(port) {
  return Number.isInteger(port) && port >= 1024 && port <= 65535;
}

function settingsPath(configDir) {
  return path.join(configDir, 'settings.json');
}

function readSettingsObject(configDir) {
  const filePath = settingsPath(configDir);

  if (!fs.existsSync(filePath)) {
    return {};
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.warn(
      `[portable] Could not read config/settings.json; using defaults. ${error.message}`,
    );
    return {};
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.warn('[portable] config/settings.json must be an object; using defaults.');
    return {};
  }

  return parsed;
}

export function validateUpdateSettings(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return { valid: false, message: 'Settings payload must be an object.' };
  }

  if (typeof candidate.autoCheckUpdates !== 'boolean') {
    return { valid: false, message: 'autoCheckUpdates must be a boolean.' };
  }

  if (!UPDATE_MODES.has(candidate.updateMode)) {
    return { valid: false, message: 'updateMode must be notify, ask, or auto.' };
  }

  return {
    valid: true,
    settings: {
      autoCheckUpdates: candidate.autoCheckUpdates,
      updateMode: candidate.updateMode,
    },
  };
}

export function readUpdateSettings(configDir) {
  const parsed = readSettingsObject(configDir);

  return {
    autoCheckUpdates: typeof parsed.autoCheckUpdates === 'boolean'
      ? parsed.autoCheckUpdates
      : DEFAULT_UPDATE_SETTINGS.autoCheckUpdates,
    updateMode: UPDATE_MODES.has(parsed.updateMode)
      ? parsed.updateMode
      : DEFAULT_UPDATE_SETTINGS.updateMode,
  };
}

export function writeUpdateSettings(configDir, nextSettings) {
  const validation = validateUpdateSettings(nextSettings);
  if (!validation.valid) {
    return validation;
  }

  fs.mkdirSync(configDir, { recursive: true });
  const existing = readSettingsObject(configDir);
  const merged = { ...existing, ...validation.settings };
  fs.writeFileSync(settingsPath(configDir), `${JSON.stringify(merged, null, 2)}\n`);

  return { valid: true, settings: validation.settings };
}

export function readLaunchSettings(configDir) {
  if (!fs.existsSync(settingsPath(configDir))) {
    return { ...DEFAULT_LAUNCH_SETTINGS };
  }
  const parsed = readSettingsObject(configDir);

  const settings = { ...DEFAULT_LAUNCH_SETTINGS };

  if ('port' in parsed) {
    if (validPort(parsed.port)) {
      settings.port = parsed.port;
    } else {
      console.warn('[portable] Invalid config/settings.json port; using default 3001.');
    }
  }

  if (typeof parsed.openBrowser === 'boolean') {
    settings.openBrowser = parsed.openBrowser;
  }

  return settings;
}
