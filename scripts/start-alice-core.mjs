import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function repoRootFromScript() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function launcherPathFromScript() {
  return path.join(repoRootFromScript(), 'scripts', 'start-alice.mjs');
}

export function createLauncherEnv({ root = process.cwd(), updateEnabled = true } = {}) {
  const resolvedRoot = path.resolve(root);
  const dataDir = path.join(resolvedRoot, 'data');
  const configDir = path.join(resolvedRoot, 'config');
  return {
    APP_RUNTIME: 'local',
    ALICE_DATA_DIR: dataDir,
    ALICE_DB_PATH: path.join(dataDir, 'alice.db'),
    ALICE_CONFIG_DIR: configDir,
    ALICE_UPDATE_CHANNEL: updateEnabled ? 'git' : '',
  };
}

async function defaultRunCommand(command, args, { cwd = process.cwd(), env = process.env } = {}) {
  // npm is npm.cmd on Windows, which execFile/spawn cannot resolve without a shell.
  // Run npm via Node + the npm CLI script (cross-platform, like scripts/build-portable.mjs);
  // fall back to a shell on Windows when npm_execpath is unavailable.
  if (command === 'npm') {
    if (env.npm_execpath) {
      return execFileAsync(process.execPath, [env.npm_execpath, ...args], { cwd, env });
    }
    return execFileAsync('npm', args, { cwd, env, shell: process.platform === 'win32' });
  }
  return execFileAsync(command, args, { cwd, env });
}

async function defaultRunChild(command, args, { cwd = process.cwd(), env = process.env } = {}) {
  const child = spawn(command, args, { cwd, env, stdio: 'inherit' });
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => resolve(code ?? 0));
  });
}

export async function resolveGitUpdateCapability({
  root = process.cwd(),
  runCommand = defaultRunCommand,
  logger = console,
} = {}) {
  try {
    await runCommand('git', ['rev-parse', '--is-inside-work-tree'], { cwd: root });
    return true;
  } catch (error) {
    logger.warn?.(
      `[launcher] Git self-update disabled: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
}

function readPending(root) {
  const pendingPath = path.join(root, 'data', 'update-pending.json');
  if (!fs.existsSync(pendingPath)) {
    return { pendingPath, pending: null };
  }

  const pending = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
  return { pendingPath, pending };
}

function writeFailure(root, pending, error) {
  const failurePath = path.join(root, 'data', 'update-failed.json');
  fs.mkdirSync(path.dirname(failurePath), { recursive: true });
  fs.writeFileSync(
    failurePath,
    `${JSON.stringify({
      status: 'failed',
      channel: pending.channel,
      targetTag: pending.targetTag,
      previousRef: pending.previousRef,
      latestVersion: pending.latestVersion,
      error: error instanceof Error ? error.message : String(error),
      failedAt: new Date().toISOString(),
    }, null, 2)}\n`,
  );
}

async function hasTrackedChanges(root, runCommand) {
  const result = await runCommand('git', ['status', '--porcelain'], { cwd: root });
  return String(result.stdout ?? '').trim().length > 0;
}

export async function applyPendingGitUpdate({
  root = process.cwd(),
  runCommand = defaultRunCommand,
  logger = console,
} = {}) {
  const { pendingPath, pending } = readPending(root);
  if (!pending || pending.channel !== 'git') {
    return { applied: false, rolledBack: false };
  }

  const targetTag = pending.targetTag;
  const previousRef = pending.previousRef;
  const stashMessage = `alice-self-update-${targetTag ?? pending.latestVersion}`;
  let stashed = false;

  try {
    if (await hasTrackedChanges(root, runCommand)) {
      await runCommand('git', ['stash', 'push', '--include-untracked', '-m', stashMessage], { cwd: root });
      stashed = true;
    }

    await runCommand('git', ['checkout', targetTag], { cwd: root });
    await runCommand('npm', ['install'], { cwd: root });
    await runCommand('npm', ['run', 'build', '--', '--mode', 'portable'], { cwd: root });

    if (stashed) {
      try {
        await runCommand('git', ['stash', 'pop'], { cwd: root });
      } catch (error) {
        logger.warn?.(
          `[launcher] Update applied, but stash restore needs manual attention: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    fs.rmSync(pendingPath, { force: true });
    return { applied: true, rolledBack: false };
  } catch (error) {
    logger.error?.(`[launcher] Git update failed: ${error instanceof Error ? error.message : String(error)}`);
    try {
      if (previousRef) {
        await runCommand('git', ['checkout', previousRef], { cwd: root });
        await runCommand('npm', ['install'], { cwd: root });
        await runCommand('npm', ['run', 'build', '--', '--mode', 'portable'], { cwd: root });
      }
    } finally {
      fs.rmSync(pendingPath, { force: true });
      writeFailure(root, pending, error);
    }
    return {
      applied: false,
      rolledBack: Boolean(previousRef),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function hasBuiltFrontend(root) {
  return fs.existsSync(path.join(root, 'dist', 'index.html'));
}

export function shutdownServerAndExit(server, {
  exit = (code) => process.exit(code),
  setTimeoutFn = globalThis.setTimeout,
  forceDelayMs = 750,
} = {}) {
  let exited = false;
  const finish = () => {
    if (exited) return;
    exited = true;
    exit(0);
  };

  if (!server) {
    finish();
    return;
  }

  server.close(() => {
    finish();
  });
  server.closeIdleConnections?.();
  setTimeoutFn(() => {
    server.closeAllConnections?.();
    finish();
  }, forceDelayMs);
}

async function openBrowser(url) {
  const command = process.platform === 'win32'
    ? 'cmd'
    : process.platform === 'darwin'
      ? 'open'
      : 'xdg-open';
  const args = process.platform === 'win32'
    ? ['/c', 'start', '', url]
    : [url];

  try {
    await defaultRunCommand(command, args);
  } catch {
    // Opening a browser is best-effort; the console still prints the URL.
  }
}

export async function runServer({
  root = repoRootFromScript(),
  open = openBrowser,
} = {}) {
  const resolvedRoot = path.resolve(root);
  fs.mkdirSync(path.join(resolvedRoot, 'data'), { recursive: true });
  fs.mkdirSync(path.join(resolvedRoot, 'config'), { recursive: true });
  const { config } = await import('../server/config.js');
  const { createRepositories } = await import('../server/repositories/index.js');
  const { createApp, logBoot } = await import('../server/index.js');
  const { listenWithFallback } = await import('../server/portable/listen.js');

  const repositories = await createRepositories(config);
  let activeServer = null;
  const app = createApp({
    repositories,
    config,
    serveStatic: true,
    distDir: path.join(resolvedRoot, 'dist'),
    onShutdown: async () => {
      shutdownServerAndExit(activeServer);
    },
  });
  const { server, port } = await listenWithFallback(app, {
    host: '127.0.0.1',
    port: config.port,
  });
  activeServer = server;
  const url = `http://127.0.0.1:${port}`;
  logBoot({ ...config, port });
  if (process.env.ALICE_SKIP_BROWSER_OPEN !== '1') {
    await open(url);
  }
  return { server, port, url };
}

export async function run({
  root = repoRootFromScript(),
  launcherPath = launcherPathFromScript(),
  runCommand = defaultRunCommand,
  runChild = defaultRunChild,
  logger = console,
} = {}) {
  const resolvedRoot = path.resolve(root);
  fs.mkdirSync(path.join(resolvedRoot, 'data'), { recursive: true });
  fs.mkdirSync(path.join(resolvedRoot, 'config'), { recursive: true });

  let launchCount = 0;
  for (;;) {
    const updateResult = await applyPendingGitUpdate({ root: resolvedRoot, runCommand, logger });
    const updateEnabled = await resolveGitUpdateCapability({ root: resolvedRoot, runCommand, logger });
    const env = {
      ...process.env,
      ...createLauncherEnv({ root: resolvedRoot, updateEnabled }),
      ALICE_SKIP_BROWSER_OPEN: launchCount > 0 ? '1' : '',
    };

    if (!updateResult.applied && !updateResult.rolledBack && !hasBuiltFrontend(resolvedRoot)) {
      await runCommand('npm', ['run', 'build', '--', '--mode', 'portable'], { cwd: resolvedRoot, env });
    }

    const exitCode = await runChild(process.execPath, [launcherPath, '--serve'], {
      cwd: resolvedRoot,
      env,
    });
    launchCount += 1;

    if (exitCode !== 0 || !fs.existsSync(path.join(resolvedRoot, 'data', 'update-pending.json'))) {
      return { exitCode, launchCount };
    }
  }
}
