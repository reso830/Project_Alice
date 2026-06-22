import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { listenWithFallback } from './portable/listen.js';
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

export async function run({
  root = defaultRoot(),
  open = defaultOpen,
  maxTries,
} = {}) {
  const packageRoot = path.resolve(root);
  ensureRequiredFiles(packageRoot);

  const configDir = path.join(packageRoot, 'config');
  const dataPath = path.join(packageRoot, 'data', 'alice.db');
  const distDir = path.join(packageRoot, 'app', 'dist');

  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.mkdirSync(path.join(packageRoot, 'logs'), { recursive: true });

  const settings = readLaunchSettings(configDir);
  process.env.APP_RUNTIME = 'local';
  process.env.ALICE_DB_PATH = dataPath;
  process.env.PORT = String(settings.port);

  const [{ config }, { createRepositories }, { createApp }] = await Promise.all([
    import('./config.js'),
    import('./repositories/index.js'),
    import('./index.js'),
  ]);

  const repositories = await createRepositories(config);
  const app = createApp({
    repositories,
    config,
    serveStatic: true,
    distDir,
  });
  const { server, port } = await listenWithFallback(app, {
    host: '127.0.0.1',
    port: settings.port,
    maxTries,
  });
  const url = `http://127.0.0.1:${port}`;

  appendLog(packageRoot, `[portable] Alice listening at ${url}`);
  console.log(`Alice is running at ${url}`);
  console.log('Close this console window or press Ctrl+C to stop Alice.');

  if (settings.openBrowser) {
    await open(url);
  } else {
    console.log(`Open Alice in your browser: ${url}`);
  }

  function stop() {
    return new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }).then(async () => {
      const { db } = await import('./db.js');
      if (db.open) {
        db.close();
      }
    });
  }

  process.once('SIGINT', async () => {
    await stop();
    process.exit(0);
  });

  return { server, port, stop };
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
