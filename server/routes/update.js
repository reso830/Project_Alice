import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import zlib from 'node:zlib';
import express from 'express';

import { APP_VERSION } from '../../src/pages/welcome/shared/appMeta.js';
import { readUpdateSettings, writeUpdateSettings } from '../portable/settings.js';

const GITHUB_LATEST_RELEASE_URL = 'https://api.github.com/repos/reso830/Project_Alice/releases/latest';
const CACHE_MS = 60 * 60 * 1000;
const READY_STATUS = 'ready-to-restart';

function defaultDataDir() {
  if (process.env.ALICE_DATA_DIR) {
    return path.resolve(process.env.ALICE_DATA_DIR);
  }
  if (process.env.ALICE_DB_PATH) {
    return path.dirname(path.resolve(process.env.ALICE_DB_PATH));
  }
  return path.resolve('data');
}

function defaultConfigDir() {
  if (process.env.ALICE_CONFIG_DIR) {
    return path.resolve(process.env.ALICE_CONFIG_DIR);
  }
  return path.resolve('config');
}

export function normalizeVersion(version) {
  return String(version ?? '').trim().replace(/^v/i, '');
}

export function compareVersions(left, right) {
  const leftParts = normalizeVersion(left).split('.').map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = normalizeVersion(right).split('.').map((part) => Number.parseInt(part, 10) || 0);

  for (let index = 0; index < 3; index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (diff !== 0) {
      return Math.sign(diff);
    }
  }
  return 0;
}

export function isNewerVersion(candidate, current) {
  return compareVersions(candidate, current) > 0;
}

export function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

export function verifyChecksum(filePath, checksumText) {
  const expected = String(checksumText).trim().split(/\s+/)[0]?.toLowerCase();
  return Boolean(expected) && sha256File(filePath) === expected;
}

function dataUrlToPath(url) {
  if (url.startsWith('file://')) {
    return new URL(url);
  }
  if (/^[a-zA-Z]:[\\/]/.test(url) || url.startsWith('/')) {
    return path.resolve(url);
  }
  return null;
}

async function readTextSource(url) {
  const localPath = dataUrlToPath(url);
  if (localPath) {
    return fs.readFileSync(localPath, 'utf8');
  }

  const response = await globalThis.fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json, application/json',
      'User-Agent': 'Project-Alice-Updater',
    },
  });

  if (!response.ok) {
    const message = response.status === 403
      ? 'Update check rate limited. Try again later.'
      : `Update check failed with HTTP ${response.status}.`;
    throw new Error(message);
  }

  return response.text();
}

async function readJsonSource(url) {
  return JSON.parse(await readTextSource(url));
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw new DOMException('Update download cancelled.', 'AbortError');
  }
}

async function downloadToFile(url, filePath, onProgress = () => {}, { signal } = {}) {
  const localPath = dataUrlToPath(url);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  throwIfAborted(signal);

  if (localPath) {
    fs.copyFileSync(localPath, filePath);
    throwIfAborted(signal);
    const size = fs.statSync(filePath).size;
    onProgress(size, size);
    return;
  }

  const response = await globalThis.fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Download failed with HTTP ${response.status}.`);
  }

  const bytesTotal = Number(response.headers.get('content-length')) || null;
  if (!response.body?.getReader) {
    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
    onProgress(fs.statSync(filePath).size, bytesTotal);
    return;
  }

  const reader = response.body.getReader();
  const fd = fs.openSync(filePath, 'w');
  let bytesDownloaded = 0;

  try {
    while (true) {
      throwIfAborted(signal);
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const chunk = Buffer.from(value);
      fs.writeSync(fd, chunk);
      bytesDownloaded += chunk.length;
      onProgress(bytesDownloaded, bytesTotal);
    }
  } finally {
    fs.closeSync(fd);
  }
}

function findAsset(release, predicate) {
  return release?.assets?.find((asset) => predicate(asset.name ?? '', asset.browser_download_url ?? ''));
}

function mapRelease(release, currentVersion) {
  const latestVersion = normalizeVersion(release.tag_name ?? release.name);
  const zipAsset = findAsset(release, (name) => /\.zip$/i.test(name));
  const checksumAsset = findAsset(release, (name) => /\.sha256$/i.test(name));
  const packageUrl = zipAsset?.browser_download_url ?? release.packageUrl ?? null;
  const checksumUrl = checksumAsset?.browser_download_url ?? release.checksumUrl ?? null;

  return {
    updateAvailable: isNewerVersion(latestVersion, currentVersion),
    currentVersion: normalizeVersion(currentVersion),
    latestVersion,
    releaseNotesUrl: release.html_url ?? release.releaseNotesUrl ?? null,
    publishedAt: release.published_at ?? release.publishedAt ?? null,
    packageUrl,
    checksumUrl,
    size: zipAsset?.size ?? release.size ?? null,
  };
}

function extractZip(zipPath, destination) {
  const buffer = fs.readFileSync(zipPath);
  let offset = 0;

  fs.mkdirSync(destination, { recursive: true });

  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const fileName = buffer.toString('utf8', offset + 30, offset + 30 + fileNameLength);
    const dataStart = offset + 30 + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    const raw = buffer.subarray(dataStart, dataEnd);
    const safeName = fileName.replace(/\\/g, '/');

    if (safeName.includes('..') || path.isAbsolute(safeName)) {
      throw new Error(`Unsafe archive path: ${fileName}`);
    }

    const target = path.join(destination, safeName);
    if (safeName.endsWith('/')) {
      fs.mkdirSync(target, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const content = method === 0
        ? raw
        : method === 8
          ? zlib.inflateRawSync(raw)
          : null;
      if (!content) {
        throw new Error(`Unsupported ZIP compression method: ${method}`);
      }
      fs.writeFileSync(target, content);
    }

    offset = dataEnd;
  }
}

function createInitialStatus() {
  return {
    status: 'idle',
    progress: 0,
    bytesTotal: null,
    bytesDownloaded: 0,
    error: null,
    currentVersion: normalizeVersion(APP_VERSION),
    latestVersion: null,
    releaseNotesUrl: null,
  };
}

function readPendingFailure(dataDir) {
  const failurePath = path.join(dataDir, 'update-failed.json');
  if (!fs.existsSync(failurePath)) {
    return null;
  }

  try {
    const payload = JSON.parse(fs.readFileSync(failurePath, 'utf8'));
    return {
      status: 'failed',
      progress: 0,
      bytesTotal: null,
      bytesDownloaded: 0,
      error: payload.message || payload.error || 'Alice could not finish applying the update.',
      currentVersion: normalizeVersion(APP_VERSION),
      latestVersion: payload.latestVersion ? normalizeVersion(payload.latestVersion) : null,
      releaseNotesUrl: payload.releaseNotesUrl ?? null,
    };
  } catch {
    return {
      status: 'failed',
      progress: 0,
      bytesTotal: null,
      bytesDownloaded: 0,
      error: 'Alice could not finish applying the update.',
      currentVersion: normalizeVersion(APP_VERSION),
      latestVersion: null,
      releaseNotesUrl: null,
    };
  } finally {
    fs.rmSync(failurePath, { force: true });
  }
}

function publicStatus(state) {
  return { ...state.status };
}

function setFailure(state, error, status = 'failed') {
  state.status = {
    ...state.status,
    status,
    progress: 0,
    error: error instanceof Error ? error.message : String(error),
  };
}

export function createUpdateRouter({
  repos,
  onShutdown = async () => {},
  dataDir = defaultDataDir(),
  configDir = defaultConfigDir(),
  now = () => new Date(),
  scheduleShutdown = (callback) => setTimeout(callback, 500),
} = {}) {
  if (!repos) {
    throw new Error('createUpdateRouter: `repos` is required');
  }

  const state = {
    cache: null,
    status: readPendingFailure(dataDir) ?? createInitialStatus(),
    downloadPromise: null,
    downloadController: null,
    cancelRequested: false,
  };
  const router = express.Router();

  async function checkForUpdates({ force = false } = {}) {
    const source = process.env.ALICE_UPDATE_SOURCE_OVERRIDE || GITHUB_LATEST_RELEASE_URL;
    if (!force && state.cache && now().getTime() - state.cache.checkedAt < CACHE_MS) {
      return state.cache.payload;
    }

    state.status = { ...state.status, status: 'checking', error: null };
    const release = await readJsonSource(source);
    const payload = mapRelease(release, process.env.ALICE_VERSION_OVERRIDE || APP_VERSION);
    state.cache = { checkedAt: now().getTime(), payload };
    state.status = {
      ...state.status,
      status: payload.updateAvailable ? 'available' : 'idle',
      progress: 0,
      bytesTotal: payload.size,
      bytesDownloaded: 0,
      error: null,
      currentVersion: payload.currentVersion,
      latestVersion: payload.latestVersion,
      releaseNotesUrl: payload.releaseNotesUrl,
    };
    return payload;
  }

  async function stageUpdate(release, { signal } = {}) {
    if (!release?.packageUrl || !release?.checksumUrl) {
      throw new Error('Release package or checksum URL is missing.');
    }

    const stagingDir = path.join(dataDir, 'update-staging');
    const zipPath = path.join(stagingDir, 'update.zip');
    const checksumPath = path.join(stagingDir, 'update.zip.sha256');
    const extractDir = path.join(stagingDir, 'alice');

    fs.rmSync(stagingDir, { recursive: true, force: true });
    fs.mkdirSync(stagingDir, { recursive: true });
    throwIfAborted(signal);
    state.status = {
      ...state.status,
      status: 'downloading',
      progress: 0,
      bytesTotal: release.size,
      bytesDownloaded: 0,
      error: null,
    };

    await downloadToFile(release.packageUrl, zipPath, (bytesDownloaded, bytesTotal) => {
      state.status.bytesDownloaded = bytesDownloaded;
      state.status.bytesTotal = bytesTotal ?? state.status.bytesTotal;
      if (state.status.bytesTotal) {
        state.status.progress = Math.round((bytesDownloaded / state.status.bytesTotal) * 100);
      }
    }, { signal });
    throwIfAborted(signal);
    state.status = {
      ...state.status,
      status: 'verifying',
      progress: 100,
      bytesDownloaded: fs.statSync(zipPath).size,
      bytesTotal: state.status.bytesTotal ?? fs.statSync(zipPath).size,
      error: null,
    };
    await downloadToFile(release.checksumUrl, checksumPath, () => {}, { signal });
    throwIfAborted(signal);

    if (!verifyChecksum(zipPath, fs.readFileSync(checksumPath, 'utf8'))) {
      throw new Error('Checksum verification failed.');
    }

    throwIfAborted(signal);
    state.status = {
      ...state.status,
      status: 'extracting',
      progress: 100,
      bytesDownloaded: fs.statSync(zipPath).size,
      bytesTotal: state.status.bytesTotal ?? fs.statSync(zipPath).size,
      error: null,
    };
    fs.rmSync(extractDir, { recursive: true, force: true });
    throwIfAborted(signal);
    extractZip(zipPath, extractDir);
    state.status = {
      ...state.status,
      status: READY_STATUS,
      progress: 100,
      bytesDownloaded: fs.statSync(zipPath).size,
      stagedPath: extractDir,
      error: null,
    };
  }

  router.get('/check', async (_req, res) => {
    try {
      res.status(200).json(await checkForUpdates());
    } catch (error) {
      setFailure(state, error, 'check-failed');
      res.status(502).json({ error: { code: 'UPDATE_CHECK_FAILED', message: state.status.error } });
    }
  });

  router.post('/download', async (_req, res) => {
    if (state.downloadPromise) {
      res.status(202).json(publicStatus(state));
      return;
    }

    let release = state.cache?.payload;
    try {
      release = release ?? await checkForUpdates();
      if (!release?.packageUrl || !release?.checksumUrl) {
        throw new Error('Release package or checksum URL is missing.');
      }
      state.downloadController = new AbortController();
      state.cancelRequested = false;
      state.downloadPromise = stageUpdate(release, { signal: state.downloadController.signal }).catch((error) => {
        fs.rmSync(path.join(dataDir, 'update-staging'), { recursive: true, force: true });
        if (state.cancelRequested || error?.name === 'AbortError') {
          state.status = {
            ...state.status,
            status: release.updateAvailable ? 'available' : 'idle',
            progress: 0,
            bytesDownloaded: 0,
            error: null,
          };
        } else {
          setFailure(state, error);
        }
      }).finally(() => {
        state.downloadPromise = null;
        state.downloadController = null;
        state.cancelRequested = false;
      });
      res.status(202).json(publicStatus(state));
    } catch (error) {
      setFailure(state, error);
      res.status(502).json({ error: { code: 'UPDATE_DOWNLOAD_FAILED', message: state.status.error } });
    }
  });

  router.post('/cancel', (_req, res) => {
    if (!state.downloadPromise || !state.downloadController) {
      state.status = {
        ...state.status,
        status: state.cache?.payload?.updateAvailable ? 'available' : 'idle',
        progress: 0,
        bytesDownloaded: 0,
        error: null,
      };
      res.status(200).json(publicStatus(state));
      return;
    }

    state.cancelRequested = true;
    state.downloadController.abort();
    state.status = {
      ...state.status,
      status: state.cache?.payload?.updateAvailable ? 'available' : 'idle',
      progress: 0,
      bytesDownloaded: 0,
      error: null,
    };
    res.status(202).json(publicStatus(state));
  });

  router.get('/status', (_req, res) => {
    res.status(200).json(publicStatus(state));
  });

  router.post('/restart', (_req, res) => {
    if (state.status.status !== READY_STATUS) {
      res.status(409).json({
        error: {
          code: 'UPDATE_NOT_READY',
          message: 'No staged update is ready to restart.',
        },
      });
      return;
    }

    const pending = {
      status: 'pending',
      latestVersion: state.status.latestVersion,
      stagedPath: state.status.stagedPath,
      requestedAt: now().toISOString(),
    };
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'update-pending.json'), `${JSON.stringify(pending, null, 2)}\n`);
    state.status = { ...state.status, status: 'installing' };
    res.status(200).json({ status: 'restarting' });
    scheduleShutdown(() => {
      void onShutdown();
    });
  });

  router.get('/settings', (_req, res) => {
    res.status(200).json(readUpdateSettings(configDir));
  });

  router.post('/settings', (req, res) => {
    const result = writeUpdateSettings(configDir, req.body);
    if (!result.valid) {
      res.status(400).json({
        error: {
          code: 'INVALID_UPDATE_SETTINGS',
          message: result.message,
        },
      });
      return;
    }

    res.status(200).json({ success: true });
  });

  return router;
}
