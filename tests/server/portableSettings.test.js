import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { readLaunchSettings } from '../../server/portable/settings.js';

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
