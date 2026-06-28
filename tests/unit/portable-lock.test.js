import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { APP_VERSION } from '../../src/pages/welcome/shared/appMeta.js';
import { checkLock, removeLock, writeLock } from '../../server/portable/lock.js';

const roots = [];

function makeDataDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'alice-lock-'));
  roots.push(root);
  const dataDir = path.join(root, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  return dataDir;
}

function readLock(dataDir) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, 'alice.lock'), 'utf8'));
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('portable lockfile manager', () => {
  test('writes the portable instance lock schema', () => {
    const dataDir = makeDataDir();
    const now = new Date('2026-06-28T00:00:00.000Z');

    writeLock(4317, { dataDir, now });

    expect(readLock(dataDir)).toEqual({
      version: 1,
      pid: process.pid,
      port: 4317,
      appVersion: APP_VERSION,
      launchTime: now.toISOString(),
    });
  });

  test('reports an active lock only when PID and health probe are live', async () => {
    const dataDir = makeDataDir();
    writeLock(4317, { dataDir });

    const status = await checkLock({
      dataDir,
      probe: vi.fn().mockResolvedValue(true),
    });

    expect(status).toMatchObject({
      exists: true,
      active: true,
      stale: false,
      port: 4317,
      pidActive: true,
      healthActive: true,
    });
    expect(fs.existsSync(path.join(dataDir, 'alice.lock'))).toBe(true);
  });

  test('removes stale locks when the recorded PID is not live', async () => {
    const dataDir = makeDataDir();
    fs.writeFileSync(
      path.join(dataDir, 'alice.lock'),
      JSON.stringify({
        version: 1,
        pid: 99999999,
        port: 4317,
        appVersion: APP_VERSION,
        launchTime: new Date().toISOString(),
      }),
    );

    const status = await checkLock({ dataDir, probe: vi.fn().mockResolvedValue(true) });

    expect(status).toMatchObject({
      exists: true,
      active: false,
      stale: true,
      pidActive: false,
      healthActive: false,
    });
    expect(fs.existsSync(path.join(dataDir, 'alice.lock'))).toBe(false);
  });

  test('removes lockfile on shutdown cleanup', () => {
    const dataDir = makeDataDir();
    writeLock(4317, { dataDir });

    removeLock({ dataDir });

    expect(fs.existsSync(path.join(dataDir, 'alice.lock'))).toBe(false);
  });
});
