import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { APP_VERSION } from '../../src/pages/welcome/shared/appMeta.js';

const LOCK_FILE = 'alice.lock';

function defaultDataDir() {
  return path.resolve('data');
}

function lockPath(dataDir = defaultDataDir()) {
  return path.join(dataDir, LOCK_FILE);
}

function isPidActive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

async function defaultProbe(port) {
  if (!Number.isInteger(port) || port <= 0) {
    return false;
  }

  const controller = new globalThis.AbortController();
  const timer = setTimeout(() => controller.abort(), 1000);

  try {
    const response = await globalThis.fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      return false;
    }
    const body = await response.json();
    return body?.status === 'ok' && typeof body?.runtime === 'string';
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function readLock(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export function writeLock(port, { dataDir = defaultDataDir(), now = new Date() } = {}) {
  fs.mkdirSync(dataDir, { recursive: true });
  const lock = {
    version: 1,
    pid: process.pid,
    port,
    appVersion: APP_VERSION,
    launchTime: now.toISOString(),
  };
  fs.writeFileSync(lockPath(dataDir), `${JSON.stringify(lock, null, 2)}\n`);
  return lock;
}

export async function checkLock({
  dataDir = defaultDataDir(),
  probe = defaultProbe,
  removeStale = true,
} = {}) {
  const filePath = lockPath(dataDir);
  if (!fs.existsSync(filePath)) {
    return { exists: false, active: false, stale: false, path: filePath };
  }

  const lock = readLock(filePath);
  const pidActive = isPidActive(lock?.pid);
  const healthActive = pidActive ? await probe(lock?.port, lock) : false;
  const active = pidActive && healthActive;
  const stale = !active;

  if (stale && removeStale) {
    removeLock({ dataDir });
  }

  return {
    exists: true,
    active,
    stale,
    path: filePath,
    lock,
    port: lock?.port,
    pidActive,
    healthActive,
  };
}

export function removeLock({ dataDir = defaultDataDir() } = {}) {
  fs.rmSync(lockPath(dataDir), { force: true });
}
