import express from 'express';
import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  compareVersions,
  createUpdateRouter,
  getChecksumName,
  isNewerVersion,
  PORTABLE_ZIP_RE,
  sha256File,
  verifyChecksum,
} from '../../server/routes/update.js';

const servers = [];
const roots = [];
const originalEnv = { ...process.env };

const fixtureZip = path.resolve('tests/fixtures/update-v1.10.0.zip');
const fixtureChecksum = path.resolve('tests/fixtures/update-v1.10.0.zip.sha256');

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeStoredZipEntry(fileName, content, { flags = 0, compressedSize, extra = Buffer.alloc(0) } = {}) {
  const name = Buffer.from(fileName);
  const body = Buffer.from(content);
  const size = compressedSize ?? body.length;
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(flags, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt32LE(0, 10);
  header.writeUInt32LE(crc32(body), 14);
  header.writeUInt32LE(size, 18);
  header.writeUInt32LE(body.length, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(extra.length, 28);
  return Buffer.concat([header, name, extra, body]);
}

function makeStoredZip(entries) {
  return Buffer.concat(entries.map((entry) => makeStoredZipEntry(entry.name, entry.content, entry.options)));
}

function writeZipWithChecksum(root, name, buffer) {
  const zipPath = path.join(root, name);
  const checksumPath = path.join(root, `${name}.sha256`);
  fs.writeFileSync(zipPath, buffer);
  fs.writeFileSync(checksumPath, `${sha256Buffer(buffer)}  ${name}\n`);
  return { zipPath, checksumPath, size: buffer.length };
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function writeCustomRelease(root, zipName, zipBuffer, overrides = {}) {
  const { zipPath, checksumPath, size } = writeZipWithChecksum(root, zipName, zipBuffer);
  return writeRelease(root, {
    tag_name: 'v1.11.0',
    assets: [
      {
        name: zipName,
        browser_download_url: zipPath,
        size,
      },
      {
        name: `${zipName}.sha256`,
        browser_download_url: checksumPath,
      },
    ],
    ...overrides,
  });
}

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'alice-update-'));
  roots.push(root);
  return root;
}

function writeRelease(root, overrides = {}) {
  const releasePath = path.join(root, 'release.json');
  fs.writeFileSync(
    releasePath,
    JSON.stringify({
      tag_name: 'v1.10.0',
      html_url: 'https://github.com/reso830/Project_Alice/releases/tag/v1.10.0',
      published_at: '2026-06-26T15:08:27Z',
      assets: [
        {
          name: 'update-v1.10.0.zip',
          browser_download_url: fixtureZip,
          size: fs.statSync(fixtureZip).size,
        },
        {
          name: 'update-v1.10.0.zip.sha256',
          browser_download_url: fixtureChecksum,
        },
      ],
      ...overrides,
    }),
  );
  return releasePath;
}

async function makeServer({
  dataDir = path.join(makeRoot(), 'data'),
  configDir = path.join(makeRoot(), 'config'),
  onShutdown = async () => {},
  scheduleShutdown = (callback) => callback(),
  now,
  checkTimeoutMs,
  downloadTimeoutMs,
} = {}) {
  const app = express();
  app.use(express.json());
  app.use('/api/update', createUpdateRouter({
    repos: { forRequest: () => ({}) },
    dataDir,
    configDir,
    onShutdown,
    scheduleShutdown,
    now,
    checkTimeoutMs,
    downloadTimeoutMs,
  }));

  const server = app.listen(0);
  servers.push(server);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  return { baseUrl: `http://127.0.0.1:${port}`, dataDir, configDir };
}

async function requestJson(baseUrl, route, options = {}) {
  const response = await globalThis.fetch(`${baseUrl}${route}`, options);
  return { response, body: await response.json() };
}

async function waitForStatus(baseUrl, status) {
  return waitForStatusMatch(baseUrl, (body) => body.status === status, `status ${status}`);
}

async function waitForPathMissing(targetPath) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (!fs.existsSync(targetPath)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${targetPath} to be removed`);
}

async function waitForStatusMatch(baseUrl, predicate, label) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const { body } = await requestJson(baseUrl, '/api/update/status');
    if (predicate(body)) {
      return body;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for update ${label}`);
}

async function makeUpdateAssetServer({
  zipBuffer = fs.readFileSync(fixtureZip),
  checksumText = fs.readFileSync(fixtureChecksum, 'utf8'),
  chunkDelayMs = 80,
  checksumDelayMs = 80,
} = {}) {
  const server = http.createServer((req, res) => {
    if (req.url === '/update.zip') {
      const split = Math.max(1, Math.floor(zipBuffer.length / 2));
      res.writeHead(200, {
        'content-length': String(zipBuffer.length),
        'content-type': 'application/zip',
      });
      res.write(zipBuffer.subarray(0, split));
      setTimeout(() => {
        res.end(zipBuffer.subarray(split));
      }, chunkDelayMs);
      return;
    }

    if (req.url === '/update.zip.sha256') {
      res.writeHead(200, {
        'content-length': String(Buffer.byteLength(checksumText)),
        'content-type': 'text/plain',
      });
      setTimeout(() => {
        res.end(checksumText);
      }, checksumDelayMs);
      return;
    }

    res.writeHead(404);
    res.end('not found');
  });
  servers.push(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

async function makeSlowJsonServer({ delayMs = 100, body = '{}' } = {}) {
  const server = http.createServer((_req, res) => {
    setTimeout(() => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(body);
    }, delayMs);
  });
  servers.push(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return `http://127.0.0.1:${port}/release.json`;
}

async function makeStalledBodyJsonServer() {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.write('{');
  });
  servers.push(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return `http://127.0.0.1:${port}/release.json`;
}

afterEach(async () => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('update version and checksum helpers', () => {
  test('normalizes v prefixes and compares semantic versions numerically', () => {
    expect(compareVersions('v1.7.0', 'v1.10.0')).toBe(-1);
    expect(isNewerVersion('v1.10.0', '1.9.0')).toBe(true);
    expect(isNewerVersion('1.10.0', 'v1.10.1')).toBe(false);
    expect(isNewerVersion('v1.10.0', '1.10.0')).toBe(false);
  });

  test('verifies package SHA256 checksums against checksum files', () => {
    const checksum = fs.readFileSync(fixtureChecksum, 'utf8');

    expect(verifyChecksum(fixtureZip, checksum)).toBe(true);
    expect(sha256File(fixtureZip)).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyChecksum(fixtureZip, '0000  update-v1.10.0.zip')).toBe(false);
  });

  test('defines the portable release asset naming contract in one place', () => {
    const zipName = 'alice-v1.11.0-win-x64.zip';

    expect(PORTABLE_ZIP_RE.test(zipName)).toBe(true);
    expect(PORTABLE_ZIP_RE.test('update-v1.11.0.zip')).toBe(false);
    expect(getChecksumName(zipName)).toBe('alice-v1.11.0-win-x64.zip.sha256');
  });

});

describe('update route behavior', () => {
  test('checks mocked release metadata and caches the response', async () => {
    const root = makeRoot();
    const releasePath = writeRelease(root);
    process.env.ALICE_UPDATE_SOURCE_OVERRIDE = releasePath;
    process.env.ALICE_VERSION_OVERRIDE = '1.9.0';
    const { baseUrl } = await makeServer({ dataDir: path.join(root, 'data') });

    const first = await requestJson(baseUrl, '/api/update/check');
    fs.writeFileSync(releasePath, JSON.stringify({ tag_name: 'v1.9.0', assets: [] }));
    const second = await requestJson(baseUrl, '/api/update/check');

    expect(first.response.status).toBe(200);
    expect(first.body).toMatchObject({
      updateAvailable: true,
      currentVersion: '1.9.0',
      latestVersion: '1.10.0',
      releaseNotesUrl: 'https://github.com/reso830/Project_Alice/releases/tag/v1.10.0',
    });
    expect(second.body.latestVersion).toBe('1.10.0');
  });

  test('does not fall back to GitHub source zipballs when release assets are missing', async () => {
    const root = makeRoot();
    process.env.ALICE_UPDATE_SOURCE_OVERRIDE = writeRelease(root, {
      assets: [],
      zipball_url: 'https://github.com/reso830/Project_Alice/archive/refs/tags/v1.10.0.zip',
    });
    process.env.ALICE_VERSION_OVERRIDE = '1.9.0';
    const { baseUrl } = await makeServer({ dataDir: path.join(root, 'data') });

    const check = await requestJson(baseUrl, '/api/update/check');
    const download = await requestJson(baseUrl, '/api/update/download', { method: 'POST' });

    expect(check.response.status).toBe(200);
    expect(check.body.packageUrl).toBeNull();
    expect(check.body.checksumUrl).toBeNull();
    expect(download.response.status).toBe(502);
    expect(download.body.error.message).toMatch(/Release package or checksum URL is missing/);
  });

  test('selects the canonical portable package and paired checksum by release asset name', async () => {
    const root = makeRoot();
    process.env.ALICE_UPDATE_SOURCE_OVERRIDE = writeRelease(root, {
      tag_name: 'v1.11.0',
      assets: [
        { name: 'debug-symbols.zip', browser_download_url: 'file:///debug-symbols.zip', size: 999 },
        { name: 'debug-symbols.zip.sha256', browser_download_url: 'file:///debug-symbols.zip.sha256' },
        { name: 'alice-v1.11.0-win-x64.zip.sha256', browser_download_url: fixtureChecksum },
        { name: 'alice-v1.11.0-win-x64.zip', browser_download_url: fixtureZip, size: fs.statSync(fixtureZip).size },
      ],
    });
    process.env.ALICE_VERSION_OVERRIDE = '1.10.0';
    const { baseUrl } = await makeServer({ dataDir: path.join(root, 'data') });

    const check = await requestJson(baseUrl, '/api/update/check');

    expect(check.response.status).toBe(200);
    expect(check.body.packageUrl).toBe(fixtureZip);
    expect(check.body.checksumUrl).toBe(fixtureChecksum);
    expect(check.body.size).toBe(fs.statSync(fixtureZip).size);
  });

  test('keeps the single legacy zip fallback for local mocked releases', async () => {
    const root = makeRoot();
    process.env.ALICE_UPDATE_SOURCE_OVERRIDE = writeRelease(root);
    process.env.ALICE_VERSION_OVERRIDE = '1.9.0';
    const { baseUrl } = await makeServer({ dataDir: path.join(root, 'data') });

    const check = await requestJson(baseUrl, '/api/update/check');

    expect(check.response.status).toBe(200);
    expect(check.body.packageUrl).toBe(fixtureZip);
    expect(check.body.checksumUrl).toBe(fixtureChecksum);
  });

  test('rejects ambiguous multi-zip releases when no canonical portable package exists', async () => {
    const root = makeRoot();
    process.env.ALICE_UPDATE_SOURCE_OVERRIDE = writeRelease(root, {
      assets: [
        { name: 'debug-symbols.zip', browser_download_url: 'file:///debug-symbols.zip' },
        { name: 'source-build.zip', browser_download_url: 'file:///source-build.zip' },
        { name: 'source-build.zip.sha256', browser_download_url: 'file:///source-build.zip.sha256' },
      ],
    });
    const { baseUrl } = await makeServer({ dataDir: path.join(root, 'data') });

    const check = await requestJson(baseUrl, '/api/update/check');

    expect(check.response.status).toBe(502);
    expect(check.body.error.message).toMatch(/could not identify the update package/i);
  });

  test('reports check failures distinctly from download failures', async () => {
    const root = makeRoot();
    process.env.ALICE_UPDATE_SOURCE_OVERRIDE = path.join(root, 'missing-release.json');
    const { baseUrl } = await makeServer({ dataDir: path.join(root, 'data') });

    const check = await requestJson(baseUrl, '/api/update/check');
    const status = await requestJson(baseUrl, '/api/update/status');

    expect(check.response.status).toBe(502);
    expect(check.body.error.code).toBe('UPDATE_CHECK_FAILED');
    expect(status.body).toMatchObject({
      status: 'check-failed',
      progress: 0,
    });
    expect(status.body.error).toContain('missing-release.json');
  });

  test('times out slow update checks and reports a check failure', async () => {
    process.env.ALICE_UPDATE_SOURCE_OVERRIDE = await makeSlowJsonServer({ delayMs: 80 });
    const { baseUrl } = await makeServer({
      dataDir: path.join(makeRoot(), 'data'),
      checkTimeoutMs: 10,
    });

    const check = await requestJson(baseUrl, '/api/update/check');
    const status = await requestJson(baseUrl, '/api/update/status');

    expect(check.response.status).toBe(502);
    expect(check.body.error).toMatchObject({
      code: 'UPDATE_CHECK_FAILED',
      message: 'Update check timed out.',
    });
    expect(status.body).toMatchObject({
      status: 'check-failed',
      error: 'Update check timed out.',
    });
  });

  test('keeps the update check timeout active while reading the response body', async () => {
    process.env.ALICE_UPDATE_SOURCE_OVERRIDE = await makeStalledBodyJsonServer();
    const { baseUrl } = await makeServer({
      dataDir: path.join(makeRoot(), 'data'),
      checkTimeoutMs: 10,
    });

    const check = await requestJson(baseUrl, '/api/update/check');
    const status = await requestJson(baseUrl, '/api/update/status');

    expect(check.response.status).toBe(502);
    expect(check.body.error).toMatchObject({
      code: 'UPDATE_CHECK_FAILED',
      message: 'Update check timed out.',
    });
    expect(status.body).toMatchObject({
      status: 'check-failed',
      error: 'Update check timed out.',
    });
  });

  test('surfaces and clears a pending launcher update failure', async () => {
    const root = makeRoot();
    const dataDir = path.join(root, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'update-failed.json'), JSON.stringify({
      status: 'failed',
      message: 'Failed while replacing runtime files.',
      latestVersion: 'v1.10.0',
    }));

    const { baseUrl } = await makeServer({ dataDir });
    const status = await requestJson(baseUrl, '/api/update/status');

    expect(status.body).toMatchObject({
      status: 'failed',
      progress: 0,
      error: 'Failed while replacing runtime files.',
      latestVersion: '1.10.0',
    });
    expect(fs.existsSync(path.join(dataDir, 'update-failed.json'))).toBe(false);
  });

  test('downloads, verifies, extracts, and reports staged status', async () => {
    const root = makeRoot();
    process.env.ALICE_UPDATE_SOURCE_OVERRIDE = writeRelease(root);
    const { baseUrl, dataDir } = await makeServer({ dataDir: path.join(root, 'data') });

    const start = await requestJson(baseUrl, '/api/update/download', { method: 'POST' });
    const status = await waitForStatus(baseUrl, 'ready-to-restart');

    expect(start.response.status).toBe(202);
    expect(status).toMatchObject({
      status: 'ready-to-restart',
      progress: 100,
      latestVersion: '1.10.0',
      error: null,
    });
    expect(fs.existsSync(path.join(dataDir, 'update-staging', 'alice', 'app', 'dist', 'index.html'))).toBe(true);
    expect(fs.existsSync(path.join(dataDir, 'update-staging', 'alice', 'Start-Alice.cmd'))).toBe(true);
  });

  test('extracts legitimate archive names that contain dot-dot inside a filename segment', async () => {
    const root = makeRoot();
    const zipBuffer = makeStoredZip([
      { name: 'app/foo..bar.txt', content: 'safe dots' },
    ]);
    process.env.ALICE_UPDATE_SOURCE_OVERRIDE = writeCustomRelease(root, 'alice-v1.11.0-win-x64.zip', zipBuffer);
    process.env.ALICE_VERSION_OVERRIDE = '1.10.0';
    const { baseUrl, dataDir } = await makeServer({ dataDir: path.join(root, 'data') });

    await requestJson(baseUrl, '/api/update/download', { method: 'POST' });
    const status = await waitForStatus(baseUrl, 'ready-to-restart');

    expect(status.error).toBeNull();
    expect(fs.readFileSync(path.join(dataDir, 'update-staging', 'alice', 'app', 'foo..bar.txt'), 'utf8')).toBe('safe dots');
  });

  test.each([
    ['parent traversal', '../evil.txt'],
    ['nested parent traversal', 'app/../../evil.txt'],
    ['rooted absolute path', '/etc/x'],
    ['Windows absolute path', 'C:\\evil.txt'],
    ['Windows UNC absolute path', '\\\\server\\share\\evil.txt'],
    ['Windows drive-relative path', 'C:evil.bat'],
  ])('rejects unsafe archive path: %s', async (_label, fileName) => {
    const root = makeRoot();
    const zipBuffer = makeStoredZip([{ name: fileName, content: 'bad' }]);
    process.env.ALICE_UPDATE_SOURCE_OVERRIDE = writeCustomRelease(root, 'alice-v1.11.0-win-x64.zip', zipBuffer);
    process.env.ALICE_VERSION_OVERRIDE = '1.10.0';
    const { baseUrl } = await makeServer({ dataDir: path.join(root, 'data') });

    await requestJson(baseUrl, '/api/update/download', { method: 'POST' });
    const status = await waitForStatus(baseUrl, 'failed');

    expect(status.error).toMatch(/Unsafe archive path/);
  });

  test('rejects streamed ZIP entries that use data descriptors', async () => {
    const root = makeRoot();
    const zipBuffer = makeStoredZip([
      { name: 'app/index.html', content: '<h1>Alice</h1>', options: { flags: 0x08, compressedSize: 0 } },
    ]);
    process.env.ALICE_UPDATE_SOURCE_OVERRIDE = writeCustomRelease(root, 'alice-v1.11.0-win-x64.zip', zipBuffer);
    process.env.ALICE_VERSION_OVERRIDE = '1.10.0';
    const { baseUrl } = await makeServer({ dataDir: path.join(root, 'data') });

    await requestJson(baseUrl, '/api/update/download', { method: 'POST' });
    const status = await waitForStatus(baseUrl, 'failed');

    expect(status.error).toMatch(/streamed\/data-descriptor entries/i);
  });

  test('rejects ZIP entries whose data segment runs past the archive buffer', async () => {
    const root = makeRoot();
    const zipBuffer = makeStoredZip([
      { name: 'app/index.html', content: '<h1>Alice</h1>', options: { compressedSize: 10_000 } },
    ]);
    process.env.ALICE_UPDATE_SOURCE_OVERRIDE = writeCustomRelease(root, 'alice-v1.11.0-win-x64.zip', zipBuffer);
    process.env.ALICE_VERSION_OVERRIDE = '1.10.0';
    const { baseUrl } = await makeServer({ dataDir: path.join(root, 'data') });

    await requestJson(baseUrl, '/api/update/download', { method: 'POST' });
    const status = await waitForStatus(baseUrl, 'failed');

    expect(status.error).toMatch(/data segment out of bounds/i);
  });

  test('streams HTTP download progress and reports verification before extraction', async () => {
    const root = makeRoot();
    const zipBuffer = fs.readFileSync(fixtureZip);
    const assetBaseUrl = await makeUpdateAssetServer({ zipBuffer });
    process.env.ALICE_UPDATE_SOURCE_OVERRIDE = writeRelease(root, {
      assets: [
        { name: 'update-v1.10.0.zip', browser_download_url: `${assetBaseUrl}/update.zip`, size: zipBuffer.length },
        { name: 'update-v1.10.0.zip.sha256', browser_download_url: `${assetBaseUrl}/update.zip.sha256` },
      ],
    });
    const { baseUrl } = await makeServer({ dataDir: path.join(root, 'data') });

    const start = await requestJson(baseUrl, '/api/update/download', { method: 'POST' });
    const progress = await waitForStatusMatch(
      baseUrl,
      (body) => body.status === 'downloading' && body.progress > 0 && body.progress < 100,
      'partial download progress',
    );
    const verifying = await waitForStatus(baseUrl, 'verifying');
    const ready = await waitForStatus(baseUrl, 'ready-to-restart');

    expect(start.response.status).toBe(202);
    expect(progress.bytesDownloaded).toBeGreaterThan(0);
    expect(progress.bytesDownloaded).toBeLessThan(zipBuffer.length);
    expect(verifying.progress).toBe(100);
    expect(ready.progress).toBe(100);
  });

  test('reports one shared ETA estimate while downloading', async () => {
    const root = makeRoot();
    const zipBuffer = fs.readFileSync(fixtureZip);
    const assetBaseUrl = await makeUpdateAssetServer({ zipBuffer, chunkDelayMs: 400 });
    const downloadStartMs = 1_000;
    const downloadCheckMs = 2_000;
    let nowMs = downloadStartMs;
    process.env.ALICE_UPDATE_SOURCE_OVERRIDE = writeRelease(root, {
      assets: [
        { name: 'update-v1.10.0.zip', browser_download_url: `${assetBaseUrl}/update.zip`, size: zipBuffer.length },
        { name: 'update-v1.10.0.zip.sha256', browser_download_url: `${assetBaseUrl}/update.zip.sha256` },
      ],
    });
    const { baseUrl } = await makeServer({
      dataDir: path.join(root, 'data'),
      now: () => new Date(nowMs),
    });

    await requestJson(baseUrl, '/api/update/download', { method: 'POST' });
    nowMs = downloadCheckMs;
    const progress = await waitForStatusMatch(
      baseUrl,
      (body) => body.status === 'downloading' && body.progress > 0 && body.progress < 100,
      'partial download progress with ETA',
    );

    const elapsedSeconds = (downloadCheckMs - downloadStartMs) / 1000;
    expect(progress.secondsRemaining).toBeGreaterThanOrEqual(1);
    expect(progress.secondsRemaining).toBe(
      Math.ceil((progress.bytesTotal - progress.bytesDownloaded) / (progress.bytesDownloaded / elapsedSeconds)),
    );
  });

  test('cancels an in-flight download and clears staging', async () => {
    const root = makeRoot();
    const zipBuffer = fs.readFileSync(fixtureZip);
    const assetBaseUrl = await makeUpdateAssetServer({ zipBuffer, chunkDelayMs: 400 });
    process.env.ALICE_VERSION_OVERRIDE = '1.9.0';
    process.env.ALICE_UPDATE_SOURCE_OVERRIDE = writeRelease(root, {
      assets: [
        { name: 'update-v1.10.0.zip', browser_download_url: `${assetBaseUrl}/update.zip`, size: zipBuffer.length },
        { name: 'update-v1.10.0.zip.sha256', browser_download_url: `${assetBaseUrl}/update.zip.sha256` },
      ],
    });
    const { baseUrl, dataDir } = await makeServer({ dataDir: path.join(root, 'data') });

    await requestJson(baseUrl, '/api/update/download', { method: 'POST' });
    await waitForStatusMatch(
      baseUrl,
      (body) => body.status === 'downloading' && body.progress > 0 && body.progress < 100,
      'partial download progress',
    );

    const cancel = await requestJson(baseUrl, '/api/update/cancel', { method: 'POST' });
    const status = await waitForStatus(baseUrl, 'available');

    expect(cancel.response.status).toBe(202);
    expect(status).toMatchObject({
      status: 'available',
      progress: 0,
      error: null,
    });
    await waitForPathMissing(path.join(dataDir, 'update-staging'));
    expect(fs.existsSync(path.join(dataDir, 'update-staging'))).toBe(false);
  });

  test('cancels a ready staged update without leaking stagedPath or staged files', async () => {
    const root = makeRoot();
    process.env.ALICE_VERSION_OVERRIDE = '1.9.0';
    process.env.ALICE_UPDATE_SOURCE_OVERRIDE = writeRelease(root);
    const { baseUrl, dataDir } = await makeServer({ dataDir: path.join(root, 'data') });

    await requestJson(baseUrl, '/api/update/download', { method: 'POST' });
    const ready = await waitForStatus(baseUrl, 'ready-to-restart');

    expect(ready.stagedPath).toBe(path.join(dataDir, 'update-staging', 'alice'));
    expect(fs.existsSync(path.join(dataDir, 'update-staging', 'alice'))).toBe(true);

    const cancel = await requestJson(baseUrl, '/api/update/cancel', { method: 'POST' });
    const status = await requestJson(baseUrl, '/api/update/status');

    expect(cancel.response.status).toBe(200);
    expect(cancel.body).toMatchObject({
      status: 'available',
      progress: 0,
      bytesDownloaded: 0,
      error: null,
    });
    expect(cancel.body).not.toHaveProperty('stagedPath');
    expect(status.body).not.toHaveProperty('stagedPath');
    expect(fs.existsSync(path.join(dataDir, 'update-staging'))).toBe(false);
  });

  test('times out stalled downloads and clears staging', async () => {
    const root = makeRoot();
    const zipBuffer = fs.readFileSync(fixtureZip);
    const assetBaseUrl = await makeUpdateAssetServer({ zipBuffer, chunkDelayMs: 80 });
    process.env.ALICE_UPDATE_SOURCE_OVERRIDE = writeRelease(root, {
      assets: [
        { name: 'update-v1.10.0.zip', browser_download_url: `${assetBaseUrl}/update.zip`, size: zipBuffer.length },
        { name: 'update-v1.10.0.zip.sha256', browser_download_url: `${assetBaseUrl}/update.zip.sha256` },
      ],
    });
    const { baseUrl, dataDir } = await makeServer({
      dataDir: path.join(root, 'data'),
      downloadTimeoutMs: 10,
    });

    await requestJson(baseUrl, '/api/update/download', { method: 'POST' });
    const status = await waitForStatus(baseUrl, 'failed');

    expect(status.error).toBe('Update download timed out.');
    expect(fs.existsSync(path.join(dataDir, 'update-staging'))).toBe(false);
  });

  test('clears staging and reports failure when checksum verification fails', async () => {
    const root = makeRoot();
    const badChecksum = path.join(root, 'bad.sha256');
    fs.writeFileSync(badChecksum, '0000  update-v1.10.0.zip');
    process.env.ALICE_UPDATE_SOURCE_OVERRIDE = writeRelease(root, {
      assets: [
        { name: 'update-v1.10.0.zip', browser_download_url: fixtureZip, size: fs.statSync(fixtureZip).size },
        { name: 'update-v1.10.0.zip.sha256', browser_download_url: badChecksum },
      ],
    });
    const { baseUrl, dataDir } = await makeServer({ dataDir: path.join(root, 'data') });

    await requestJson(baseUrl, '/api/update/download', { method: 'POST' });
    const status = await waitForStatus(baseUrl, 'failed');

    expect(status.error).toMatch(/Checksum verification failed/);
    expect(fs.existsSync(path.join(dataDir, 'update-staging'))).toBe(false);
  });

  test('writes pending metadata and delegates shutdown after restart response', async () => {
    const root = makeRoot();
    const onShutdown = vi.fn();
    process.env.ALICE_UPDATE_SOURCE_OVERRIDE = writeRelease(root);
    const { baseUrl, dataDir } = await makeServer({
      dataDir: path.join(root, 'data'),
      onShutdown,
    });
    await requestJson(baseUrl, '/api/update/download', { method: 'POST' });
    await waitForStatus(baseUrl, 'ready-to-restart');

    const restart = await requestJson(baseUrl, '/api/update/restart', { method: 'POST' });

    expect(restart.response.status).toBe(200);
    expect(restart.body).toEqual({ status: 'restarting' });
    expect(JSON.parse(fs.readFileSync(path.join(dataDir, 'update-pending.json'), 'utf8'))).toMatchObject({
      status: 'pending',
      latestVersion: '1.10.0',
    });
    expect(onShutdown).toHaveBeenCalledTimes(1);
  });

  test('rejects cancel once a restart has been requested, preserving the staged update', async () => {
    const root = makeRoot();
    const onShutdown = vi.fn();
    process.env.ALICE_UPDATE_SOURCE_OVERRIDE = writeRelease(root);
    const { baseUrl, dataDir } = await makeServer({
      dataDir: path.join(root, 'data'),
      onShutdown,
    });
    await requestJson(baseUrl, '/api/update/download', { method: 'POST' });
    await waitForStatus(baseUrl, 'ready-to-restart');
    await requestJson(baseUrl, '/api/update/restart', { method: 'POST' });

    const cancel = await requestJson(baseUrl, '/api/update/cancel', { method: 'POST' });

    expect(cancel.response.status).toBe(409);
    expect(cancel.body.error.code).toBe('UPDATE_ALREADY_INSTALLING');
    expect(fs.existsSync(path.join(dataDir, 'update-staging', 'alice'))).toBe(true);
    expect(fs.existsSync(path.join(dataDir, 'update-pending.json'))).toBe(true);

    const status = await requestJson(baseUrl, '/api/update/status');
    expect(status.body.status).toBe('installing');
  });

  test('background checks do not clobber a staged update that is ready to restart', async () => {
    const root = makeRoot();
    let nowMs = 0;
    const releasePath = writeRelease(root);
    process.env.ALICE_UPDATE_SOURCE_OVERRIDE = releasePath;
    const { baseUrl, dataDir } = await makeServer({
      dataDir: path.join(root, 'data'),
      now: () => new Date(nowMs),
    });
    await requestJson(baseUrl, '/api/update/download', { method: 'POST' });
    await waitForStatus(baseUrl, 'ready-to-restart');

    fs.writeFileSync(releasePath, JSON.stringify({ tag_name: 'v1.11.0', assets: [] }));
    nowMs = 2 * 60 * 60 * 1000;
    const check = await requestJson(baseUrl, '/api/update/check');
    const status = await requestJson(baseUrl, '/api/update/status');
    const restart = await requestJson(baseUrl, '/api/update/restart', { method: 'POST' });

    expect(check.response.status).toBe(200);
    expect(check.body.latestVersion).toBe('1.11.0');
    expect(status.body).toMatchObject({
      status: 'ready-to-restart',
      latestVersion: '1.10.0',
    });
    expect(restart.response.status).toBe(200);
    expect(fs.existsSync(path.join(dataDir, 'update-pending.json'))).toBe(true);
  });

  test('download refreshes stale cached release metadata before staging', async () => {
    const root = makeRoot();
    let nowMs = 0;
    const releasePath = writeRelease(root);
    process.env.ALICE_UPDATE_SOURCE_OVERRIDE = releasePath;
    const { baseUrl } = await makeServer({
      dataDir: path.join(root, 'data'),
      now: () => new Date(nowMs),
    });

    const cached = await requestJson(baseUrl, '/api/update/check');
    expect(cached.body.latestVersion).toBe('1.10.0');

    fs.writeFileSync(
      releasePath,
      JSON.stringify({
        tag_name: 'v1.11.0',
        html_url: 'https://github.com/reso830/Project_Alice/releases/tag/v1.11.0',
        published_at: '2026-06-30T15:08:27Z',
        assets: [
          {
            name: 'update-v1.11.0.zip',
            browser_download_url: fixtureZip,
            size: fs.statSync(fixtureZip).size,
          },
          {
            name: 'update-v1.11.0.zip.sha256',
            browser_download_url: fixtureChecksum,
          },
        ],
      }),
    );
    nowMs = 2 * 60 * 60 * 1000;

    await requestJson(baseUrl, '/api/update/download', { method: 'POST' });
    const status = await waitForStatus(baseUrl, 'ready-to-restart');

    expect(status.latestVersion).toBe('1.11.0');
  });

  test('reads and writes update settings in config/settings.json', async () => {
    const root = makeRoot();
    const configDir = path.join(root, 'config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'settings.json'), JSON.stringify({
      port: 4123,
      openBrowser: false,
    }));
    const { baseUrl } = await makeServer({ configDir });

    const initial = await requestJson(baseUrl, '/api/update/settings');
    const saved = await requestJson(baseUrl, '/api/update/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoCheckUpdates: false, updateMode: 'notify' }),
    });
    const after = await requestJson(baseUrl, '/api/update/settings');

    expect(initial.response.status).toBe(200);
    expect(initial.body).toEqual({ autoCheckUpdates: true, updateMode: 'ask' });
    expect(saved.response.status).toBe(200);
    expect(saved.body).toEqual({ success: true });
    expect(after.body).toEqual({ autoCheckUpdates: false, updateMode: 'notify' });
    expect(JSON.parse(fs.readFileSync(path.join(configDir, 'settings.json'), 'utf8'))).toEqual({
      port: 4123,
      openBrowser: false,
      autoCheckUpdates: false,
      updateMode: 'notify',
    });
  });

  test('rejects invalid update settings without writing config', async () => {
    const root = makeRoot();
    const configDir = path.join(root, 'config');
    const { baseUrl } = await makeServer({ configDir });

    for (const updateMode of ['beta', 'auto']) {
      const result = await requestJson(baseUrl, '/api/update/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoCheckUpdates: true, updateMode }),
      });

      expect(result.response.status).toBe(400);
      expect(result.body.error.code).toBe('INVALID_UPDATE_SETTINGS');
    }
    expect(fs.existsSync(path.join(configDir, 'settings.json'))).toBe(false);
  });
});
