import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { listenWithFallback } from './portable/listen.js';
import { acquireLock, removeLock, writeLock } from './portable/lock.js';
import { readLaunchSettings } from './portable/settings.js';

function defaultRoot() {
  const serverDir = path.dirname(fileURLToPath(import.meta.url));
  const parentDir = path.dirname(serverDir);
  return path.basename(parentDir) === 'app' ? path.dirname(parentDir) : parentDir;
}

function ensureRequiredFiles(root) {
  const indexPath = path.join(root, 'app', 'dist', 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error(`Missing required portable file: ${indexPath}`);
  }
}

function appendLog(root, message) {
  const logDir = path.join(root, 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  fs.appendFileSync(path.join(logDir, 'alice.log'), `${message}\n`);
}

async function defaultOpen(url) {
  if (process.platform === 'win32') {
    const child = spawn('cmd', ['/c', 'start', '', url], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
    return;
  }

  console.log(`Open Alice in your browser: ${url}`);
}

// Single-instance probe: returns true only when an Alice instance is already
// serving on the given origin (its /api/health returns `{ status:'ok', runtime }`).
// A non-Alice process on the port, a refused connection, or a timeout → false,
// so the launcher falls through to the normal port-fallback path.
async function defaultProbe(baseUrl) {
  const controller = new globalThis.AbortController();
  const timer = setTimeout(() => controller.abort(), 1000);

  try {
    const response = await globalThis.fetch(`${baseUrl}/api/health`, {
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

export async function run({
  root = defaultRoot(),
  open = defaultOpen,
  probe = defaultProbe,
  maxTries,
} = {}) {
  const packageRoot = path.resolve(root);
  ensureRequiredFiles(packageRoot);

  const configDir = path.join(packageRoot, 'config');
  const dataDir = path.join(packageRoot, 'data');
  const dataPath = path.join(dataDir, 'alice.db');
  const distDir = path.join(packageRoot, 'app', 'dist');

  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(path.join(packageRoot, 'logs'), { recursive: true });

  const settings = readLaunchSettings(configDir);
  const updatedRelaunch = process.env.ALICE_UPDATED_RELAUNCH === '1';
  if (updatedRelaunch) {
    delete process.env.ALICE_UPDATED_RELAUNCH;
  }
  const lock = await acquireLock({
    dataDir,
    port: settings.port,
    probe: (port) => probe(`http://127.0.0.1:${port}`),
  });

  // Single-instance: use the per-install lock so the same portable copy is
  // detected even when it fell back to a different port on its first launch.
  if (!lock.acquired) {
    const runningUrl = `http://127.0.0.1:${lock.port}`;
    appendLog(packageRoot, `[portable] Existing instance detected at ${runningUrl}; focusing it.`);
    console.log(`Alice is already running at ${runningUrl}; opening your browser.`);
    if (settings.openBrowser && !updatedRelaunch) {
      await open(runningUrl);
    } else if (updatedRelaunch) {
      console.log(`Alice relaunched after update; reconnecting the existing browser tab at ${runningUrl}`);
    } else {
      console.log(`Open Alice in your browser: ${runningUrl}`);
    }
    return { alreadyRunning: true, port: lock.port };
  }

  let server;
  let port;

  try {
    process.env.APP_RUNTIME = 'local';
    process.env.ALICE_CONFIG_DIR = configDir;
    process.env.ALICE_DB_PATH = dataPath;
    process.env.PORT = String(settings.port);

    const [{ config }, { createRepositories }, { createApp }] = await Promise.all([
      import('./config.js'),
      import('./repositories/index.js'),
      import('./index.js'),
    ]);

    const repositories = await createRepositories(config);
    let stopServer = async () => {};
    const onShutdown = async () => {
      await stopServer();
      process.exit(0);
    };
    const app = createApp({
      repositories,
      config,
      onShutdown,
      serveStatic: true,
      distDir,
    });
    ({ server, port } = await listenWithFallback(app, {
      host: '127.0.0.1',
      port: settings.port,
      maxTries,
    }));
    writeLock(port, { dataDir });

    function stop() {
      return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }).then(async () => {
        const { db } = await import('./db.js');
        if (db.open) {
          db.close();
        }
        removeLock({ dataDir, pid: process.pid });
      });
    }
    stopServer = stop;

    async function shutdown() {
      await stop();
      process.exit(0);
    }

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);

    const url = `http://127.0.0.1:${port}`;

    appendLog(packageRoot, `[portable] Alice listening at ${url}`);
    console.log(`Alice is running at ${url}`);
    console.log('Close this console window or press Ctrl+C to stop Alice.');

    if (settings.openBrowser && !updatedRelaunch) {
      await open(url);
    } else if (updatedRelaunch) {
      console.log(`Alice relaunched after update; reconnecting the existing browser tab at ${url}`);
    } else {
      console.log(`Open Alice in your browser: ${url}`);
    }

    return { server, port, stop };
  } catch (error) {
    if (server?.listening) {
      await new Promise((resolve, reject) => {
        server.close((closeError) => (closeError ? reject(closeError) : resolve()));
      });
    }
    removeLock({ dataDir, pid: process.pid });
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[portable] ${message}`);
    process.exit(1);
  }
}
