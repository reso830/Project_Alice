import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  readLaunchSettings,
  readUpdateSettings,
  validateUpdateSettings,
  writeUpdateSettings,
} from '../../server/portable/settings.js';

const tempDirs = [];

function makeConfigDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alice-config-'));
  tempDirs.push(dir);
  return dir;
}

function writeSettings(configDir, value) {
  fs.writeFileSync(path.join(configDir, 'settings.json'), value);
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('readLaunchSettings', () => {
  test('returns defaults when settings file is absent', () => {
    expect(readLaunchSettings(makeConfigDir())).toEqual({
      port: 3001,
      openBrowser: true,
    });
  });

  test('reads valid settings and ignores unknown keys', () => {
    const configDir = makeConfigDir();
    writeSettings(configDir, JSON.stringify({
      port: 4123,
      openBrowser: false,
      ignored: 'value',
    }));

    expect(readLaunchSettings(configDir)).toEqual({
      port: 4123,
      openBrowser: false,
    });
  });

  test('falls back to the default port for malformed or invalid settings without throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const malformedDir = makeConfigDir();
    writeSettings(malformedDir, '{ bad json');

    expect(readLaunchSettings(malformedDir)).toEqual({
      port: 3001,
      openBrowser: true,
    });
    expect(warn).toHaveBeenCalled();

    const invalidDir = makeConfigDir();
    writeSettings(invalidDir, JSON.stringify({ port: 99, openBrowser: true }));

    expect(readLaunchSettings(invalidDir)).toEqual({
      port: 3001,
      openBrowser: true,
    });
  });

  test('falls back to defaults for valid JSON that is not a settings object', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    for (const value of ['null', '5', '"hi"', '[]']) {
      const configDir = makeConfigDir();
      writeSettings(configDir, value);

      expect(readLaunchSettings(configDir)).toEqual({
        port: 3001,
        openBrowser: true,
      });
    }

    expect(warn).toHaveBeenCalledTimes(4);
  });

  test('defaults openBrowser unless the setting is explicitly boolean false', () => {
    const configDir = makeConfigDir();
    writeSettings(configDir, JSON.stringify({ openBrowser: 'false' }));

    expect(readLaunchSettings(configDir)).toEqual({
      port: 3001,
      openBrowser: true,
    });
  });
});

describe('update settings', () => {
  test('returns update defaults when settings file is absent', () => {
    expect(readUpdateSettings(makeConfigDir())).toEqual({
      autoCheckUpdates: true,
      updateMode: 'ask',
    });
  });

  test('reads update settings alongside launch settings', () => {
    const configDir = makeConfigDir();
    writeSettings(configDir, JSON.stringify({
      port: 4123,
      openBrowser: false,
      autoCheckUpdates: false,
      updateMode: 'notify',
    }));

    expect(readLaunchSettings(configDir)).toEqual({
      port: 4123,
      openBrowser: false,
    });
    expect(readUpdateSettings(configDir)).toEqual({
      autoCheckUpdates: false,
      updateMode: 'notify',
    });
  });

  test('validates update settings payloads', () => {
    expect(validateUpdateSettings({ autoCheckUpdates: true, updateMode: 'auto' })).toMatchObject({
      valid: false,
    });
    expect(validateUpdateSettings({ autoCheckUpdates: 'true', updateMode: 'ask' })).toMatchObject({
      valid: false,
    });
    expect(validateUpdateSettings({ autoCheckUpdates: true, updateMode: 'beta' })).toMatchObject({
      valid: false,
    });
  });

  test('normalizes a removed auto update mode to the ask default', () => {
    const configDir = makeConfigDir();
    writeSettings(configDir, JSON.stringify({
      autoCheckUpdates: true,
      updateMode: 'auto',
    }));

    expect(readUpdateSettings(configDir)).toEqual({
      autoCheckUpdates: true,
      updateMode: 'ask',
    });
  });

  test('writes update settings without dropping launch settings', () => {
    const configDir = makeConfigDir();
    writeSettings(configDir, JSON.stringify({ port: 4123, openBrowser: false }));

    expect(writeUpdateSettings(configDir, { autoCheckUpdates: false, updateMode: 'notify' }))
      .toMatchObject({ valid: true });
    expect(JSON.parse(fs.readFileSync(path.join(configDir, 'settings.json'), 'utf8'))).toEqual({
      port: 4123,
      openBrowser: false,
      autoCheckUpdates: false,
      updateMode: 'notify',
    });
  });
});
