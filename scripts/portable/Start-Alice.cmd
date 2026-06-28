@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Alice - close this window to stop Alice

set "ROOT=%~dp0"
set "NODE=%ROOT%runtime\node.exe"
set "BOOT=%ROOT%app\server\portable.js"
set "STAGING=%ROOT%data\update-staging\alice"
set "NEXT_LAUNCHER=%ROOT%data\Start-Alice.next.cmd"

:run
if exist "%STAGING%\" (
  call :apply_update
  if errorlevel 1 exit /b 1
)

if not exist "%NODE%" (
  echo Alice could not start: bundled runtime missing.
  echo The package may be incomplete. Please extract the ZIP again.
  pause
  exit /b 1
)

echo Starting Alice...
echo Close this window or press Ctrl+C to stop Alice.
"%NODE%" "%BOOT%"

if exist "%STAGING%\" goto run

if errorlevel 1 (
  echo.
  echo Alice stopped with an error. Check logs\alice.log if it exists.
  pause
  exit /b 1
)

exit /b 0

:apply_update
echo Applying Alice update...
ping -n 2 127.0.0.1 >nul

if exist "%STAGING%\app\" (
  call :rename_with_retry app
  if errorlevel 1 (
    echo Alice update failed: could not release locks on app files.
    pause
    exit /b 1
  )
)

if exist "%STAGING%\runtime\" (
  call :rename_with_retry runtime
  if errorlevel 1 (
    echo Alice update failed: could not release locks on runtime files.
    call :rollback_update
    pause
    exit /b 1
  )
)

if exist "%STAGING%\app\" (
  robocopy "%STAGING%\app" "%ROOT%app" /MIR >nul
  if errorlevel 8 (
    echo Alice update failed while replacing app files.
    call :rollback_update
    pause
    exit /b 1
  )
)

if exist "%STAGING%\runtime\" (
  robocopy "%STAGING%\runtime" "%ROOT%runtime" /MIR >nul
  if errorlevel 8 (
    echo Alice update failed while replacing runtime files.
    call :rollback_update
    pause
    exit /b 1
  )
)

if exist "%STAGING%\Start-Alice.cmd" copy /y "%STAGING%\Start-Alice.cmd" "%NEXT_LAUNCHER%" >nul
if exist "%ROOT%data\update-pending.json" del /f /q "%ROOT%data\update-pending.json" >nul
rmdir /s /q "%ROOT%data\update-staging"

if exist "%ROOT%app.bak\" rmdir /s /q "%ROOT%app.bak"
if exist "%ROOT%runtime.bak\" rmdir /s /q "%ROOT%runtime.bak"

if exist "%NEXT_LAUNCHER%" (
  copy /y "%NEXT_LAUNCHER%" "%ROOT%Start-Alice.cmd" >nul
  "%ROOT%Start-Alice.cmd"
  exit /b 0
)

"%ROOT%Start-Alice.cmd"
exit /b 0

:rename_with_retry
set "TARGET=%~1"
set /a RETRY=0

:rename_retry
if not exist "%ROOT%%TARGET%\" exit /b 0
if exist "%ROOT%%TARGET%.bak\" rmdir /s /q "%ROOT%%TARGET%.bak"
ren "%ROOT%%TARGET%" "%TARGET%.bak"
if not errorlevel 1 exit /b 0
set /a RETRY+=1
if !RETRY! geq 5 exit /b 1
ping -n 2 127.0.0.1 >nul
goto rename_retry

:rollback_update
if exist "%ROOT%app\" rmdir /s /q "%ROOT%app"
if exist "%ROOT%runtime\" rmdir /s /q "%ROOT%runtime"
if exist "%ROOT%app.bak\" ren "%ROOT%app.bak" "app"
if exist "%ROOT%runtime.bak\" ren "%ROOT%runtime.bak" "runtime"
exit /b 0
