import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { APP_VERSION } from '../../src/pages/welcome/shared/appMeta.js';

const LOCK_FILE = 'alice.lock';
const PENDING_WAIT_MS = 5000;
const PENDING_POLL_MS = 50;

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

function buildLock(port, { now = new Date(), pending = false } = {}) {
  const lock = {
    version: 1,
    pid: process.pid,
    port,
    appVersion: APP_VERSION,
    launchTime: now.toISOString(),
  };

  if (pending) {
    lock.pending = true;
  }

  return lock;
}

function writeLockFile(filePath, lock, options = {}) {
  fs.writeFileSync(filePath, `${JSON.stringify(lock, null, 2)}\n`, options);
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function inspectLock(filePath, { probe = defaultProbe } = {}) {
  const lock = readLock(filePath);
  const pidActive = isPidActive(lock?.pid);
  const pending = lock?.pending === true;
  const healthActive = pidActive && !pending ? await probe(lock?.port, lock) : false;
  const active = pidActive && (pending || healthActive);
  const stale = !active;

  return {
    exists: true,
    active,
    stale,
    path: filePath,
    lock,
    port: lock?.port,
    pidActive,
    healthActive,
    pending,
  };
}

async function waitForFinalizedLock(filePath, {
  probe = defaultProbe,
  waitMs = PENDING_WAIT_MS,
  pollMs = PENDING_POLL_MS,
} = {}) {
  const deadline = Date.now() + waitMs;
  let status = await inspectLock(filePath, { probe });

  while (status.pending && status.pidActive && Date.now() < deadline) {
    await delay(pollMs);
    status = await inspectLock(filePath, { probe });
  }

  return status;
}

export function writeLock(port, { dataDir = defaultDataDir(), now = new Date() } = {}) {
  fs.mkdirSync(dataDir, { recursive: true });
  const lock = buildLock(port, { now });
  writeLockFile(lockPath(dataDir), lock);
  return lock;
}

export async function acquireLock({
  dataDir = defaultDataDir(),
  port = 0,
  probe = defaultProbe,
  now = new Date(),
  pendingWaitMs = PENDING_WAIT_MS,
  pendingPollMs = PENDING_POLL_MS,
} = {}) {
  fs.mkdirSync(dataDir, { recursive: true });
  const filePath = lockPath(dataDir);
  const lock = buildLock(port, { now, pending: true });

  try {
    writeLockFile(filePath, lock, { flag: 'wx' });
    return { acquired: true, active: false, stale: false, path: filePath, lock, port };
  } catch (error) {
    if (error?.code !== 'EEXIST') {
      throw error;
    }
  }

  const existing = await inspectLock(filePath, { probe });
  if (existing.pending && existing.active) {
    return {
      acquired: false,
      ...(await waitForFinalizedLock(filePath, {
        probe,
        waitMs: pendingWaitMs,
        pollMs: pendingPollMs,
      })),
    };
  }

  if (existing.active) {
    return { acquired: false, ...existing };
  }

  removeLock({ dataDir, pid: existing.lock?.pid });

  try {
    writeLockFile(filePath, lock, { flag: 'wx' });
    return { acquired: true, active: false, stale: true, path: filePath, lock, port };
  } catch (error) {
    if (error?.code !== 'EEXIST') {
      throw error;
    }
  }

  const winner = await inspectLock(filePath, { probe });
  return { acquired: false, ...winner };
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

  const status = await inspectLock(filePath, { probe });

  if (status.stale && removeStale) {
    removeLock({ dataDir, force: true });
  }

  return status;
}

export function removeLock({ dataDir = defaultDataDir(), pid, force = false } = {}) {
  const filePath = lockPath(dataDir);
  if (!force && pid !== undefined) {
    const lock = readLock(filePath);
    if (lock?.pid !== pid) {
      return false;
    }
  }

  fs.rmSync(filePath, { force: true });
  return true;
}
