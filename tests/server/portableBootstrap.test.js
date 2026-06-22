import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { afterEach, describe, expect, test, vi } from 'vitest';

const roots = [];
const originalEnv = { ...process.env };

async function findFreePort() {
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

async function makePackageRoot({ withDist = true, openBrowser = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'alice-portable-'));
  roots.push(root);
  fs.mkdirSync(path.join(root, 'app', 'dist'), { recursive: true });
  fs.mkdirSync(path.join(root, 'config'), { recursive: true });
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.mkdirSync(path.join(root, 'logs'), { recursive: true });

  if (withDist) {
    fs.writeFileSync(path.join(root, 'app', 'dist', 'index.html'), '<main>Alice</main>');
  }
  fs.writeFileSync(
    path.join(root, 'config', 'settings.json'),
    JSON.stringify({ port: await findFreePort(), openBrowser }),
  );

  return root;
}

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('portable bootstrap', () => {
  test('sets local env before loading the database and opens the selected localhost URL', async () => {
    vi.resetModules();
    const { run } = await import('../../server/portable.js');
    const root = await makePackageRoot();
    const opened = [];

    const result = await run({
      root,
      open: async (url) => {
        opened.push(url);
      },
      maxTries: 1,
    });

    expect(process.env.APP_RUNTIME).toBe('local');
    expect(process.env.ALICE_DB_PATH).toBe(path.join(root, 'data', 'alice.db'));
    expect(fs.existsSync(path.join(root, 'data', 'alice.db'))).toBe(true);
    expect(result.port).toBeGreaterThan(0);
    expect(result.server.address().address).toBe('127.0.0.1');
    expect(opened).toEqual([`http://127.0.0.1:${result.port}`]);
    expect(fs.readFileSync(path.join(root, 'logs', 'alice.log'), 'utf8')).toContain(
      `http://127.0.0.1:${result.port}`,
    );

    await result.stop();
  });

  test('prints the URL instead of opening a browser when openBrowser is false', async () => {
    vi.resetModules();
    const { run } = await import('../../server/portable.js');
    const root = await makePackageRoot({ openBrowser: false });
    const opened = [];

    const result = await run({
      root,
      open: async (url) => {
        opened.push(url);
      },
      maxTries: 1,
    });

    expect(opened).toEqual([]);
    expect(fs.readFileSync(path.join(root, 'logs', 'alice.log'), 'utf8')).toContain(
      `http://127.0.0.1:${result.port}`,
    );

    await result.stop();
  });

  test('fails clearly when dist/index.html is missing', async () => {
    vi.resetModules();
    const { run } = await import('../../server/portable.js');
    const root = await makePackageRoot({ withDist: false });

    await expect(run({ root, open: async () => {} })).rejects.toThrow(
      /Missing required portable file/,
    );
  });
});
