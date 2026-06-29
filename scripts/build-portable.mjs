import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const NODE_VERSION = '24.14.1';
const NODE_ARCHIVE = `node-v${NODE_VERSION}-win-x64.zip`;
const NODE_BASE_URL = `https://nodejs.org/dist/v${NODE_VERSION}`;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = path.join(ROOT, 'portable-dist');
const STAGE_DIR = path.join(OUTPUT_DIR, 'alice');
const CACHE_DIR = path.join(OUTPUT_DIR, '.cache');

const POWERSHELL = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
const NPM_CLI = process.env.npm_execpath;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function runNpm(args, options = {}) {
  if (!NPM_CLI) {
    throw new Error('npm_execpath is unavailable; run this script via npm run build:portable.');
  }
  run(process.execPath, [NPM_CLI, ...args], options);
}

function removeIfExists(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true });
}

function copyDir(source, target, { required = true } = {}) {
  if (!fs.existsSync(source)) {
    if (required) {
      throw new Error(`Required path not found: ${source}`);
    }
    return;
  }

  fs.cpSync(source, target, {
    recursive: true,
    filter(sourcePath) {
      const name = path.basename(sourcePath);
      return ![
        '.env',
        '.env.local',
        '.env.production',
        '.git',
        'data',
        'logs',
        'portable-dist',
      ].includes(name);
    },
  });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function download(url, target) {
  return new Promise((resolve, reject) => {
    ensureDir(path.dirname(target));
    const file = fs.createWriteStream(target);

    https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.rmSync(target, { force: true });
        download(response.headers.location, target).then(resolve, reject);
        return;
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.rmSync(target, { force: true });
        reject(new Error(`Download failed (${response.statusCode}): ${url}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (error) => {
      file.close();
      fs.rmSync(target, { force: true });
      reject(error);
    });
  });
}

function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

async function ensureNodeRuntime() {
  const archivePath = path.join(CACHE_DIR, NODE_ARCHIVE);
  const sumsPath = path.join(CACHE_DIR, 'SHASUMS256.txt');

  if (!fs.existsSync(archivePath)) {
    await download(`${NODE_BASE_URL}/${NODE_ARCHIVE}`, archivePath);
  }
  if (!fs.existsSync(sumsPath)) {
    await download(`${NODE_BASE_URL}/SHASUMS256.txt`, sumsPath);
  }

  const sums = fs.readFileSync(sumsPath, 'utf8');
  const match = sums
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .find(([, filename]) => filename === NODE_ARCHIVE);

  if (!match) {
    throw new Error(`Official checksum not found for ${NODE_ARCHIVE}`);
  }

  const actual = sha256(archivePath);
  if (actual !== match[0]) {
    throw new Error(`Checksum mismatch for ${NODE_ARCHIVE}`);
  }

  const extractDir = path.join(CACHE_DIR, `node-v${NODE_VERSION}-win-x64`);
  if (!fs.existsSync(extractDir)) {
    const tempExtract = path.join(CACHE_DIR, 'node-extract');
    removeIfExists(tempExtract);
    ensureDir(tempExtract);
    run(POWERSHELL, [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath '${archivePath.replaceAll("'", "''")}' -DestinationPath '${tempExtract.replaceAll("'", "''")}' -Force`,
    ]);
    fs.renameSync(path.join(tempExtract, `node-v${NODE_VERSION}-win-x64`), extractDir);
    removeIfExists(tempExtract);
  }

  copyDir(extractDir, path.join(STAGE_DIR, 'runtime'));
}

function stageApp(packageJson) {
  const appDir = path.join(STAGE_DIR, 'app');
  ensureDir(appDir);

  copyDir(path.join(ROOT, 'server'), path.join(appDir, 'server'));
  copyDir(path.join(ROOT, 'src'), path.join(appDir, 'src'));
  copyDir(path.join(ROOT, 'shared'), path.join(appDir, 'shared'), { required: false });
  copyDir(path.join(ROOT, 'dist'), path.join(appDir, 'dist'));
  copyDir(path.join(ROOT, 'node_modules'), path.join(appDir, 'node_modules'));

  const appPackage = {
    name: packageJson.name,
    version: packageJson.version,
    private: true,
    type: packageJson.type,
    dependencies: packageJson.dependencies,
    engines: packageJson.engines,
  };
  writeJson(path.join(appDir, 'package.json'), appPackage);
  fs.copyFileSync(path.join(ROOT, 'package-lock.json'), path.join(appDir, 'package-lock.json'));
  runNpm(['prune', '--omit=dev'], { cwd: appDir });
}

function stageLayout(packageJson) {
  removeIfExists(STAGE_DIR);
  ensureDir(STAGE_DIR);
  stageApp(packageJson);

  ensureDir(path.join(STAGE_DIR, 'data'));
  ensureDir(path.join(STAGE_DIR, 'logs'));
  ensureDir(path.join(STAGE_DIR, 'config'));
  fs.copyFileSync(
    path.join(ROOT, 'config', 'settings.default.json'),
    path.join(STAGE_DIR, 'config', 'settings.json'),
  );
  fs.copyFileSync(
    path.join(ROOT, 'scripts', 'portable', 'Start-Alice.cmd'),
    path.join(STAGE_DIR, 'Start-Alice.cmd'),
  );
  fs.writeFileSync(path.join(STAGE_DIR, 'VERSION'), `${packageJson.version}\n`);
}

function verifyNoSecrets() {
  const forbidden = ['.env', '.env.local', '.env.production'];
  const stack = [STAGE_DIR];

  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (forbidden.includes(entry.name)) {
        throw new Error(`Secret-like file was staged: ${fullPath}`);
      }
      if (entry.isDirectory()) {
        stack.push(fullPath);
      }
    }
  }
}

function smokeDatabase(packageJson) {
  const nodeExe = path.join(STAGE_DIR, 'runtime', 'node.exe');
  const smokeScript = path.join(OUTPUT_DIR, 'db-smoke.mjs');
  fs.writeFileSync(smokeScript, `
import { createRepositories } from './alice/app/server/repositories/index.js';
process.env.APP_RUNTIME = 'local';
process.env.ALICE_DB_PATH = './alice/data/alice.db';
await createRepositories({ runtime: 'local', isHosted: false, port: 0, supabase: null });
const { db } = await import('./alice/app/server/db.js');
db.close();
`);

  const result = spawnSync(nodeExe, [smokeScript], {
    cwd: OUTPUT_DIR,
    stdio: 'inherit',
    shell: false,
  });
  fs.rmSync(smokeScript, { force: true });

  if (result.status !== 0) {
    throw new Error(`Portable DB smoke failed for ${packageJson.version}`);
  }
}

function zipArtifact(packageJson) {
  const zipPath = path.join(OUTPUT_DIR, `alice-v${packageJson.version}-win-x64.zip`);
  const checksumPath = `${zipPath}.sha256`;
  removeIfExists(zipPath);
  removeIfExists(checksumPath);

  run(POWERSHELL, [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path '${STAGE_DIR.replaceAll("'", "''")}\\*' -DestinationPath '${zipPath.replaceAll("'", "''")}' -Force`,
  ]);

  fs.writeFileSync(checksumPath, `${sha256(zipPath)}  ${path.basename(zipPath)}\n`);
}

async function main() {
  if (process.platform !== 'win32') {
    throw new Error('Portable build is Windows-only for v1.');
  }

  const packageJson = readJson(path.join(ROOT, 'package.json'));
  removeIfExists(OUTPUT_DIR);
  ensureDir(CACHE_DIR);

  runNpm(['run', 'build', '--', '--mode', 'portable']);
  stageLayout(packageJson);
  await ensureNodeRuntime();
  verifyNoSecrets();
  smokeDatabase(packageJson);
  zipArtifact(packageJson);

  console.log(`Portable package ready: ${path.join(OUTPUT_DIR, `alice-v${packageJson.version}-win-x64.zip`)}`);
}

await main();
