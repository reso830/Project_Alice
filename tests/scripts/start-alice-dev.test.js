import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { platform } from 'node:process';
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
  // The launcher is a PowerShell script; only exercise it on Windows runners.
  // CI (ubuntu-latest) has no powershell.exe, so this is skipped there.
  test.runIf(platform === 'win32')('keeps the frontend local without touching .env.local', () => {
    const tempRoot = createTempProject();
    const envPath = path.join(tempRoot, '.env.local');
    // A stale .env.local with hosted browser vars would otherwise flip the
    // frontend into hosted-auth mode against a local backend.
    const envContents = 'VITE_SUPABASE_URL=https://example.supabase.co\nVITE_SUPABASE_ANON_KEY=anon-key\n';
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

    // The guard is non-destructive: .env.local is left exactly as-is.
    expect(existsSync(envPath)).toBe(true);
    expect(readFileSync(envPath, 'utf8')).toBe(envContents);
    expect(existsSync(path.join(tempRoot, '.env.local.disabled')), 'no disabled sidecar file').toBe(false);

    // The launcher reports that it clears the hosted frontend vars for local mode.
    expect(result.stdout).toMatch(/VITE_SUPABASE_URL=(\r?\n|\s|$)/);
    expect(result.stdout).toMatch(/VITE_SUPABASE_ANON_KEY=(\r?\n|\s|$)/);
  });

  // Exercises the REAL start path (Start-AliceProcess: argument passing + env
  // override + process start + teardown), not just the -PrepareOnly short-circuit.
  // This is the regression guard for the launcher running under powershell.exe
  // (Windows PowerShell 5.1), where ProcessStartInfo.ArgumentList does not exist.
  test.runIf(platform === 'win32')('starts a real process and passes the local-mode env override through', () => {
    const tempRoot = createTempProject();
    // A stale hosted var the override must beat.
    writeFileSync(path.join(tempRoot, '.env.local'), 'VITE_SUPABASE_URL=https://should-be-ignored.example\n');

    const result = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-ProjectRoot', tempRoot, '-SelfTest'],
      { cwd: repoRoot, encoding: 'utf8' },
    );

    expect(result.status, result.stderr || result.stdout).toBe(0);
    // The child actually ran (would throw on .ArgumentList under PS 5.1) and saw
    // an empty VITE_SUPABASE_URL — neither the .env.local value nor "unset".
    expect(result.stdout).toContain('VITE_SUPABASE_URL=[]');
    expect(result.stdout).not.toContain('should-be-ignored');
    expect(result.stdout).not.toContain('VITE_SUPABASE_URL=[unset]');

    // The self-test also launches npm.cmd through Start-AliceProcess — the
    // same batch-file (.cmd) path the real backend/frontend commands use.
    // CreateProcess cannot run a .cmd directly; a regression to invoking it
    // without the cmd.exe /d /s /c wrapper would fail Process.Start() here.
    expect(result.stdout).toContain('npm.cmd launch exit code=0');
  });
});
