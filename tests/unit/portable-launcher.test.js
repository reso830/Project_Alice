import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

import { describe, expect, test } from 'vitest';

const launcher = fs.readFileSync('scripts/portable/Start-Alice.cmd', 'utf8');

describe('portable launcher update swap', () => {
  test('swaps staged program files before starting Node', () => {
    expect(launcher).toContain('set "STAGING=%ROOT%data\\update-staging\\alice"');
    expect(launcher).toContain('set "PENDING_UPDATE=%ROOT%data\\update-pending.json"');
    expect(launcher).toContain('call :apply_update');
    expect(launcher).toContain('robocopy "%STAGING%\\app" "%ROOT%app" /MIR');
    expect(launcher).toContain('robocopy "%STAGING%\\runtime" "%ROOT%runtime" /MIR');
    expect(launcher).toContain('del /f /q "%PENDING_UPDATE%"');
    expect(launcher.match(/^:run$/gm)).toHaveLength(1);
    expect(launcher.match(/^if exist "%STAGING%\\" \($/gm)).toHaveLength(1);
    expect(launcher).toContain('if exist "%PENDING_UPDATE%" (');
    expect(launcher).toContain('call :clear_abandoned_stage');
    expect(launcher.match(/^if exist "%STAGING%\\" if exist "%PENDING_UPDATE%" goto run$/gm)).toHaveLength(1);

    expect(launcher.indexOf('if exist "%STAGING%\\"')).toBeLessThan(
      launcher.indexOf('if not exist "%NODE%"'),
    );
    expect(launcher.indexOf('if exist "%PENDING_UPDATE%" (')).toBeLessThan(
      launcher.indexOf('call :apply_update'),
    );
  });

  test('clears abandoned staging instead of swapping without a pending install request', () => {
    expect(launcher).toContain(':clear_abandoned_stage');
    expect(launcher).toContain(
      'echo Found staged update files without a pending install request; clearing them.',
    );
    expect(launcher).toContain('if exist "%ROOT%data\\update-staging\\" rmdir /s /q "%ROOT%data\\update-staging"');
    expect(launcher.indexOf('call :clear_abandoned_stage')).toBeLessThan(
      launcher.indexOf('if not exist "%NODE%"'),
    );
  });

  test('executes the staged launcher to finalize replacement after the swap', () => {
    const copyToNext = launcher.indexOf(
      'copy /y "%STAGING%\\Start-Alice.cmd" "%NEXT_LAUNCHER%"',
    );
    const removeStaging = launcher.indexOf('rmdir /s /q "%ROOT%data\\update-staging"');
    const setPortableRoot = launcher.indexOf('set "ALICE_PORTABLE_ROOT=%ROOT:~0,-1%"');
    const runNextLauncher = launcher.indexOf('"%NEXT_LAUNCHER%" --finalize-launcher');
    const finalizeLauncher = launcher.indexOf(':finalize_launcher');
    const overwriteLauncher = launcher.indexOf(
      'copy /y "%NEXT_LAUNCHER%" "%ROOT%Start-Alice.cmd"',
      finalizeLauncher,
    );
    const deleteNextLauncher = launcher.indexOf(
      'del /f /q "%NEXT_LAUNCHER%"',
      finalizeLauncher,
    );

    expect(copyToNext).toBeGreaterThan(-1);
    expect(removeStaging).toBeGreaterThan(copyToNext);
    expect(setPortableRoot).toBeGreaterThan(removeStaging);
    expect(runNextLauncher).toBeGreaterThan(setPortableRoot);
    expect(finalizeLauncher).toBeGreaterThan(runNextLauncher);
    expect(overwriteLauncher).toBeGreaterThan(finalizeLauncher);
    expect(deleteNextLauncher).toBeGreaterThan(overwriteLauncher);
  });

  test('renames active directories to backups before mirroring staged files', () => {
    const applyUpdate = launcher.indexOf(':apply_update');
    const firstDelay = launcher.indexOf('ping -n 2 127.0.0.1 >nul', applyUpdate);
    const renameApp = launcher.indexOf('call :rename_with_retry app');
    const renameRuntime = launcher.indexOf('call :rename_with_retry runtime');
    const copyApp = launcher.indexOf('robocopy "%STAGING%\\app" "%ROOT%app" /MIR');
    const copyRuntime = launcher.indexOf('robocopy "%STAGING%\\runtime" "%ROOT%runtime" /MIR');

    expect(firstDelay).toBeGreaterThan(applyUpdate);
    expect(renameApp).toBeLessThan(copyApp);
    expect(renameRuntime).toBeLessThan(copyRuntime);
    expect(launcher).toContain(':rename_with_retry');
    expect(launcher).toContain('ren "%ROOT%%TARGET%" "%TARGET%.bak"');
    expect(launcher).toContain('if !RETRY! geq 20 exit /b 1');
    expect(launcher).toContain('set /a DELAY_SECONDS=2');
    expect(launcher).toContain('if !RETRY! geq 8 set /a DELAY_SECONDS=4');
    expect(launcher).toContain('if !RETRY! geq 15 set /a DELAY_SECONDS=8');
  });

  test('keeps staged updates retryable when file locks do not release', () => {
    expect(launcher).toContain(
      'echo Close other Alice windows or file sync tools, then press any key to retry.',
    );
    expect(launcher.match(/goto apply_update/g)).toHaveLength(2);
  });

  test('rolls back renamed folders when mirroring fails', () => {
    expect(launcher).toContain('call :rollback_update');
    expect(launcher).toContain('call :mark_update_failed "Failed while replacing app files."');
    expect(launcher).toContain('call :mark_update_failed "Failed while replacing runtime files."');
    expect(launcher.match(/call :clear_pending_update/g)).toHaveLength(2);
    expect(launcher).toContain('if exist "%ROOT%app.bak\\" ren "%ROOT%app.bak" "app"');
    expect(launcher).toContain(
      'if exist "%ROOT%runtime.bak\\" ren "%ROOT%runtime.bak" "runtime"',
    );
    expect(launcher).toContain('if exist "%ROOT%app.bak\\" rmdir /s /q "%ROOT%app.bak"');
    expect(launcher).toContain(
      'if exist "%ROOT%runtime.bak\\" rmdir /s /q "%ROOT%runtime.bak"',
    );
  });

  test('rollback only deletes a live folder when its backup exists to restore', () => {
    // Guards against wiping the sole runtime\node.exe when no runtime.bak was
    // ever created (e.g. an app-only staged package that fails mid-mirror).
    expect(launcher).toContain(
      'if exist "%ROOT%app.bak\\" if exist "%ROOT%app\\" rmdir /s /q "%ROOT%app"',
    );
    expect(launcher).toContain(
      'if exist "%ROOT%runtime.bak\\" if exist "%ROOT%runtime\\" rmdir /s /q "%ROOT%runtime"',
    );
    // The unconditional deletes must be gone.
    expect(launcher).not.toMatch(/^if exist "%ROOT%runtime\\" rmdir \/s \/q "%ROOT%runtime"$/m);
    expect(launcher).not.toMatch(/^if exist "%ROOT%app\\" rmdir \/s \/q "%ROOT%app"$/m);
  });

  test('marks the portable runtime so self-update is gated to the launcher', () => {
    expect(launcher).toContain('set "ALICE_UPDATE_CHANNEL=portable"');
    // Set before Node boots so the server reads it from the environment.
    expect(launcher.indexOf('set "ALICE_UPDATE_CHANNEL=portable"')).toBeLessThan(
      launcher.indexOf('"%NODE%" "%BOOT%"'),
    );
  });

  test('re-checks staging after Node exits during restart-to-finish', () => {
    const runLabel = launcher.indexOf(':run');
    const launchNode = launcher.indexOf('"%NODE%" "%BOOT%"');
    const relaunchWhenStaged = launcher.indexOf('if exist "%STAGING%\\" if exist "%PENDING_UPDATE%" goto run');
    const errorHandling = launcher.indexOf('if not "%NODE_EXIT%"=="0"', launchNode);

    expect(runLabel).toBeGreaterThan(-1);
    expect(runLabel).toBeLessThan(launcher.indexOf('if exist "%STAGING%\\"'));
    expect(relaunchWhenStaged).toBeGreaterThan(launchNode);
    expect(relaunchWhenStaged).toBeLessThan(errorHandling);
  });

  test('preserves the Node exit code while clearing abandoned staging after launch', () => {
    const launchNode = launcher.indexOf('"%NODE%" "%BOOT%"');
    const captureNodeExit = launcher.indexOf('set "NODE_EXIT=%ERRORLEVEL%"', launchNode);
    const clearAfterLaunch = launcher.indexOf('if exist "%STAGING%\\" call :clear_abandoned_stage', launchNode);
    const errorHandling = launcher.indexOf('if not "%NODE_EXIT%"=="0"', launchNode);
    const exitWithNodeCode = launcher.indexOf('exit /b %NODE_EXIT%', errorHandling);

    expect(captureNodeExit).toBeGreaterThan(launchNode);
    expect(captureNodeExit).toBeLessThan(clearAfterLaunch);
    expect(clearAfterLaunch).toBeLessThan(errorHandling);
    expect(exitWithNodeCode).toBeGreaterThan(errorHandling);
  });

  test('marks post-update relaunches so the existing browser tab reconnects', () => {
    const setRelaunchEnv = launcher.indexOf('set "ALICE_UPDATED_RELAUNCH=1"');
    const clearRelaunchEnv = launcher.indexOf('set "ALICE_UPDATED_RELAUNCH="');
    const restartLauncher = launcher.indexOf('"%NEXT_LAUNCHER%" --finalize-launcher');

    expect(setRelaunchEnv).toBeGreaterThan(-1);
    expect(setRelaunchEnv).toBeLessThan(restartLauncher);
    expect(clearRelaunchEnv).toBeGreaterThan(launcher.indexOf('"%NODE%" "%BOOT%"'));
  });

  test.runIf(process.platform === 'win32')(
    'executes the staged swap and leaves a clean update filesystem',
    async () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'alice-launcher-'));
      try {
        const write = (relativePath, content = '') => {
          const target = path.join(root, relativePath);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, content);
        };

        write('Start-Alice.cmd', launcher);
        write('app/dist/old.txt', 'old app');
        write('app/server/portable.js', "import fs from 'node:fs';\nfs.writeFileSync('data/boot-marker.txt', 'booted');\n");
        fs.mkdirSync(path.join(root, 'runtime'), { recursive: true });
        fs.copyFileSync(process.execPath, path.join(root, 'runtime', 'node.exe'));
        write('data/update-pending.json', '{"version":"test"}\n');
        write('data/update-staging/alice/app/dist/new.txt', 'new app');
        write(
          'data/update-staging/alice/app/server/portable.js',
          "import fs from 'node:fs';\nfs.writeFileSync('data/boot-marker.txt', 'booted');\n",
        );
        fs.mkdirSync(path.join(root, 'data', 'update-staging', 'alice', 'runtime'), {
          recursive: true,
        });
        fs.copyFileSync(
          process.execPath,
          path.join(root, 'data', 'update-staging', 'alice', 'runtime', 'node.exe'),
        );
        write('data/update-staging/alice/Start-Alice.cmd', launcher);

        const result = await new Promise((resolve) => {
          const child = spawn('cmd.exe', ['/c', path.join(root, 'Start-Alice.cmd')], {
            cwd: root,
            env: { ...process.env, ALICE_PORTABLE_ROOT: root },
            windowsHide: true,
          });
          let stdout = '';
          let stderr = '';
          child.stdout.on('data', (chunk) => {
            stdout += chunk;
          });
          child.stderr.on('data', (chunk) => {
            stderr += chunk;
          });
          child.on('close', (code) => resolve({ code, stdout, stderr }));
        });

        expect(result).toMatchObject({ code: 0 });
        expect(result.stderr).toBe('');
        expect(fs.existsSync(path.join(root, 'app', 'dist', 'new.txt'))).toBe(true);
        expect(fs.existsSync(path.join(root, 'app', 'dist', 'old.txt'))).toBe(false);
        expect(fs.existsSync(path.join(root, 'runtime', 'node.exe'))).toBe(true);
        expect(fs.existsSync(path.join(root, 'data', 'boot-marker.txt'))).toBe(true);
        expect(fs.existsSync(path.join(root, 'data', 'update-staging'))).toBe(false);
        expect(fs.existsSync(path.join(root, 'data', 'update-pending.json'))).toBe(false);
        expect(fs.existsSync(path.join(root, 'data', 'Start-Alice.next.cmd'))).toBe(false);
        expect(fs.existsSync(path.join(root, 'app.bak'))).toBe(false);
        expect(fs.existsSync(path.join(root, 'runtime.bak'))).toBe(false);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    },
    15000,
  );
});
