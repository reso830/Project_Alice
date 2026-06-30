import fs from 'node:fs';

import { describe, expect, test } from 'vitest';

const launcher = fs.readFileSync('scripts/portable/Start-Alice.cmd', 'utf8');

describe('portable launcher update swap', () => {
  test('marks portable launches with the portable update channel', () => {
    expect(launcher).toContain('set "ALICE_UPDATE_CHANNEL=portable"');
  });

  test('swaps staged program files before starting Node', () => {
    expect(launcher).toContain('set "STAGING=%ROOT%data\\update-staging\\alice"');
    expect(launcher).toContain('call :apply_update');
    expect(launcher).toContain('robocopy "%STAGING%\\app" "%ROOT%app" /MIR');
    expect(launcher).toContain('robocopy "%STAGING%\\runtime" "%ROOT%runtime" /MIR');
    expect(launcher).toContain('del /f /q "%ROOT%data\\update-pending.json"');
    expect(launcher.match(/^:run$/gm)).toHaveLength(1);
    expect(launcher.match(/^if exist "%STAGING%\\" \($/gm)).toHaveLength(1);
    expect(launcher.match(/^if exist "%STAGING%\\" goto run$/gm)).toHaveLength(1);

    expect(launcher.indexOf('if exist "%STAGING%\\"')).toBeLessThan(
      launcher.indexOf('if not exist "%NODE%"'),
    );
  });

  test('overwrites the running launcher only as the final swap action', () => {
    const copyToNext = launcher.indexOf(
      'copy /y "%STAGING%\\Start-Alice.cmd" "%NEXT_LAUNCHER%"',
    );
    const removeStaging = launcher.indexOf('rmdir /s /q "%ROOT%data\\update-staging"');
    const overwriteLauncher = launcher.indexOf(
      'copy /y "%NEXT_LAUNCHER%" "%ROOT%Start-Alice.cmd"',
    );
    const restartLauncher = launcher.indexOf('"%ROOT%Start-Alice.cmd"', overwriteLauncher);

    expect(copyToNext).toBeGreaterThan(-1);
    expect(removeStaging).toBeGreaterThan(copyToNext);
    expect(overwriteLauncher).toBeGreaterThan(removeStaging);
    expect(restartLauncher).toBeGreaterThan(overwriteLauncher);
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
    expect(launcher).toContain('if exist "%ROOT%app.bak\\" ren "%ROOT%app.bak" "app"');
    expect(launcher).toContain(
      'if exist "%ROOT%runtime.bak\\" ren "%ROOT%runtime.bak" "runtime"',
    );
    expect(launcher).toContain('if exist "%ROOT%app.bak\\" rmdir /s /q "%ROOT%app.bak"');
    expect(launcher).toContain(
      'if exist "%ROOT%runtime.bak\\" rmdir /s /q "%ROOT%runtime.bak"',
    );
  });

  test('re-checks staging after Node exits during restart-to-finish', () => {
    const runLabel = launcher.indexOf(':run');
    const launchNode = launcher.indexOf('"%NODE%" "%BOOT%"');
    const relaunchWhenStaged = launcher.indexOf('if exist "%STAGING%\\" goto run');
    const errorHandling = launcher.indexOf('if errorlevel 1', launchNode);

    expect(runLabel).toBeGreaterThan(-1);
    expect(runLabel).toBeLessThan(launcher.indexOf('if exist "%STAGING%\\"'));
    expect(relaunchWhenStaged).toBeGreaterThan(launchNode);
    expect(relaunchWhenStaged).toBeLessThan(errorHandling);
  });

  test('marks post-update relaunches so the existing browser tab reconnects', () => {
    const setRelaunchEnv = launcher.indexOf('set "ALICE_UPDATED_RELAUNCH=1"');
    const clearRelaunchEnv = launcher.indexOf('set "ALICE_UPDATED_RELAUNCH="');
    const overwriteLauncher = launcher.indexOf(
      'copy /y "%NEXT_LAUNCHER%" "%ROOT%Start-Alice.cmd"',
    );
    const restartLauncher = launcher.indexOf('"%ROOT%Start-Alice.cmd"', overwriteLauncher);

    expect(setRelaunchEnv).toBeGreaterThan(-1);
    expect(setRelaunchEnv).toBeLessThan(restartLauncher);
    expect(clearRelaunchEnv).toBeGreaterThan(launcher.indexOf('"%NODE%" "%BOOT%"'));
  });
});
