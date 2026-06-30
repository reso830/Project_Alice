import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { createApp } from '../../server/index.js';
import { createSqliteRepositories } from '../../server/repositories/index.js';
import { APP_VERSION } from '../../src/pages/welcome/shared/appMeta.js';
import { makeMemoryDb, wrapAsDispatcher } from './helpers.js';

const servers = [];
const tempDirs = [];

async function makeServer({ serveStatic } = {}) {
  const distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alice-dist-'));
  tempDirs.push(distDir);
  fs.writeFileSync(path.join(distDir, 'index.html'), '<main>Alice portable shell</main>');
  fs.writeFileSync(path.join(distDir, 'asset.txt'), 'portable asset');

  const repositories = await createSqliteRepositories(makeMemoryDb());
  const app = createApp({
    repositories: wrapAsDispatcher(repositories),
    config: { runtime: 'local' },
    serveStatic,
    distDir,
  });
  const server = app.listen(0);
  servers.push(server);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();

  return { baseUrl: `http://127.0.0.1:${port}` };
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );

  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('createApp static serving', () => {
  test('serves built assets and falls back to index for non-api GET requests when enabled', async () => {
    const { baseUrl } = await makeServer({ serveStatic: true });

    const assetResponse = await globalThis.fetch(`${baseUrl}/asset.txt`);
    expect(assetResponse.status).toBe(200);
    expect(await assetResponse.text()).toBe('portable asset');

    const routeResponse = await globalThis.fetch(`${baseUrl}/some/spa/route`);
    expect(routeResponse.status).toBe(200);
    expect(await routeResponse.text()).toBe('<main>Alice portable shell</main>');
  });

  test('does not shadow api routes or rewrite non-get requests when static serving is enabled', async () => {
    const { baseUrl } = await makeServer({ serveStatic: true });

    const healthResponse = await globalThis.fetch(`${baseUrl}/api/health`);
    expect(healthResponse.status).toBe(200);
    expect(await healthResponse.json()).toEqual({
      status: 'ok',
      runtime: 'local',
      version: APP_VERSION,
      updateSupported: false,
      updateChannel: null,
    });

    const postResponse = await globalThis.fetch(`${baseUrl}/not-api`, {
      method: 'POST',
    });
    expect(postResponse.status).toBe(404);
    expect(await postResponse.text()).not.toContain('Alice portable shell');
  });

  test('leaves non-api routes unserved when static serving is not enabled', async () => {
    const { baseUrl } = await makeServer();

    const response = await globalThis.fetch(`${baseUrl}/some/spa/route`);
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain('Alice portable shell');
  });
});
