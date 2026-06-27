import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_SETTINGS = Object.freeze({
  port: 3001,
  openBrowser: true,
});

function validPort(port) {
  return Number.isInteger(port) && port >= 1024 && port <= 65535;
}

export function readLaunchSettings(configDir) {
  const settingsPath = path.join(configDir, 'settings.json');

  if (!fs.existsSync(settingsPath)) {
    return { ...DEFAULT_SETTINGS };
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch (error) {
    console.warn(
      `[portable] Could not read config/settings.json; using defaults. ${error.message}`,
    );
    return { ...DEFAULT_SETTINGS };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.warn('[portable] config/settings.json must be an object; using defaults.');
    return { ...DEFAULT_SETTINGS };
  }

  const settings = { ...DEFAULT_SETTINGS };

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
