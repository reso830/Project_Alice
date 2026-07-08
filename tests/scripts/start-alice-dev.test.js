import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, test } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const scriptPath = path.join(repoRoot, 'scripts', 'Start-Alice-Dev.ps1');
const tempRoots = [];

function createTempProject() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'alice-launcher-'));
  tempRoots.push(tempRoot);
  return tempRoot;
}

afterEach(() => {
  for (const tempRoot of tempRoots.splice(0)) {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

describe('Start-Alice-Dev launcher', () => {
  test('renames .env.local before starting local Alice', () => {
    const tempRoot = createTempProject();
    const envPath = path.join(tempRoot, '.env.local');
    const envContents = 'APP_RUNTIME=hosted\nSUPABASE_URL=https://example.supabase.co\n';
    writeFileSync(envPath, envContents);

    const result = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath,
        '-ProjectRoot',
        tempRoot,
        '-PrepareOnly',
      ],
      { cwd: repoRoot, encoding: 'utf8' },
    );

    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(existsSync(envPath)).toBe(false);

    const disabledFiles = result.stdout.match(/\.env\.local\.disabled-\d{8}-\d{6}/g) ?? [];
    expect(disabledFiles).toHaveLength(1);
    expect(readFileSync(path.join(tempRoot, disabledFiles[0]), 'utf8')).toBe(envContents);
  });
});
