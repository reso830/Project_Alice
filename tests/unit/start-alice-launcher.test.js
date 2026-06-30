import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { afterEach, describe, expect, test, vi } from 'vitest';

const roots = [];

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'alice-start-'));
  roots.push(root);
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.mkdirSync(path.join(root, 'config'), { recursive: true });
  return root;
}

function writePending(root, overrides = {}) {
  fs.writeFileSync(
    path.join(root, 'data', 'update-pending.json'),
    `${JSON.stringify({
      status: 'pending',
      channel: 'git',
      targetTag: 'v1.11.0',
      previousRef: 'abc123',
      latestVersion: '1.11.0',
      requestedAt: '2026-06-29T00:00:00.000Z',
      ...overrides,
    }, null, 2)}\n`,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('start-alice git launcher', () => {
  test('exports a git-channel environment for launcher-run clones', async () => {
    const { createLauncherEnv } = await import('../../scripts/start-alice-core.mjs');

    expect(createLauncherEnv({ root: 'C:/alice' })).toMatchObject({
      APP_RUNTIME: 'local',
      ALICE_UPDATE_CHANNEL: 'git',
      ALICE_CONFIG_DIR: path.resolve('C:/alice/config'),
      ALICE_DATA_DIR: path.resolve('C:/alice/data'),
      ALICE_DB_PATH: path.resolve('C:/alice/data/alice.db'),
    });
  });

  test('applies a pending git update and removes the handoff file on success', async () => {
    const root = makeRoot();
    writePending(root);
    const calls = [];
    const runCommand = vi.fn(async (command, args) => {
      calls.push([command, args]);
      return { stdout: '' };
    });
    const { applyPendingGitUpdate } = await import('../../scripts/start-alice-core.mjs');

    const result = await applyPendingGitUpdate({ root, runCommand, logger: console });

    expect(result).toEqual({ applied: true, rolledBack: false });
    expect(calls).toEqual([
      ['git', ['status', '--porcelain']],
      ['git', ['checkout', 'v1.11.0']],
      ['npm', ['install']],
      ['npm', ['run', 'build']],
    ]);
    expect(fs.existsSync(path.join(root, 'data', 'update-pending.json'))).toBe(false);
  });

  test('stashes tracked changes before checkout and restores them after success', async () => {
    const root = makeRoot();
    writePending(root);
    const calls = [];
    const runCommand = vi.fn(async (command, args) => {
      calls.push([command, args]);
      if (command === 'git' && args.join(' ') === 'status --porcelain') {
        return { stdout: ' M package.json\n' };
      }
      return { stdout: '' };
    });
    const { applyPendingGitUpdate } = await import('../../scripts/start-alice-core.mjs');

    await applyPendingGitUpdate({ root, runCommand, logger: console });

    expect(calls).toEqual([
      ['git', ['status', '--porcelain']],
      ['git', ['stash', 'push', '--include-untracked', '-m', 'alice-self-update-v1.11.0']],
      ['git', ['checkout', 'v1.11.0']],
      ['npm', ['install']],
      ['npm', ['run', 'build']],
      ['git', ['stash', 'pop']],
    ]);
  });

  test('rolls back to the previous ref when checkout/install/build fails', async () => {
    const root = makeRoot();
    writePending(root);
    const calls = [];
    let failedBuilds = 0;
    const runCommand = vi.fn(async (command, args) => {
      calls.push([command, args]);
      if (command === 'npm' && args.join(' ') === 'run build' && failedBuilds === 0) {
        failedBuilds += 1;
        throw new Error('build failed');
      }
      return { stdout: '' };
    });
    const { applyPendingGitUpdate } = await import('../../scripts/start-alice-core.mjs');

    const result = await applyPendingGitUpdate({ root, runCommand, logger: console });

    expect(result).toMatchObject({
      applied: false,
      rolledBack: true,
      error: expect.stringContaining('build failed'),
    });
    expect(calls).toEqual([
      ['git', ['status', '--porcelain']],
      ['git', ['checkout', 'v1.11.0']],
      ['npm', ['install']],
      ['npm', ['run', 'build']],
      ['git', ['checkout', 'abc123']],
      ['npm', ['install']],
      ['npm', ['run', 'build']],
    ]);
    expect(fs.existsSync(path.join(root, 'data', 'update-pending.json'))).toBe(false);
    expect(JSON.parse(fs.readFileSync(path.join(root, 'data', 'update-failed.json'), 'utf8'))).toMatchObject({
      status: 'failed',
      channel: 'git',
      targetTag: 'v1.11.0',
      previousRef: 'abc123',
    });
  });

  test('supervises the server process and relaunches after a pending update is written', async () => {
    const root = makeRoot();
    const calls = [];
    const runCommand = vi.fn(async (command, args) => {
      calls.push([command, args]);
      if (command === 'git' && args.join(' ') === 'rev-parse --is-inside-work-tree') {
        return { stdout: 'true\n' };
      }
      return { stdout: '' };
    });
    const runChild = vi.fn(async (_command, args, options) => {
      expect(args[0].replaceAll('\\', '/')).toMatch(/scripts\/start-alice\.mjs$/);
      expect(args[1]).toBe('--serve');
      if (runChild.mock.calls.length === 1) {
        writePending(root);
        expect(options.env.ALICE_SKIP_BROWSER_OPEN).toBe('');
      } else {
        expect(options.env.ALICE_SKIP_BROWSER_OPEN).toBe('1');
      }
      return 0;
    });
    const { run } = await import('../../scripts/start-alice-core.mjs');

    const result = await run({ root, runCommand, runChild, logger: console });

    expect(result).toEqual({ exitCode: 0, launchCount: 2 });
    expect(runChild).toHaveBeenCalledTimes(2);
    expect(calls).toEqual([
      ['git', ['rev-parse', '--is-inside-work-tree']],
      ['npm', ['run', 'build']],
      ['git', ['status', '--porcelain']],
      ['git', ['checkout', 'v1.11.0']],
      ['npm', ['install']],
      ['npm', ['run', 'build']],
      ['git', ['rev-parse', '--is-inside-work-tree']],
    ]);
  });

  test('detects whether git self-update can be enabled for the current directory', async () => {
    const { resolveGitUpdateCapability } = await import('../../scripts/start-alice-core.mjs');

    await expect(resolveGitUpdateCapability({
      root: process.cwd(),
      runCommand: async () => ({ stdout: '' }),
    })).resolves.toBe(true);

    await expect(resolveGitUpdateCapability({
      root: process.cwd(),
      runCommand: async () => {
        throw new Error('git not found');
      },
    })).resolves.toBe(false);
  });
});
