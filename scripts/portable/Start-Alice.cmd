@echo off
setlocal
title Alice - close this window to stop Alice

set "ROOT=%~dp0"
set "NODE=%ROOT%runtime\node.exe"
set "BOOT=%ROOT%app\server\portable.js"

if not exist "%NODE%" (
  echo Alice could not start: bundled runtime missing.
  echo The package may be incomplete. Please extract the ZIP again.
  pause
  exit /b 1
)

echo Starting Alice...
echo Close this window or press Ctrl+C to stop Alice.
"%NODE%" "%BOOT%"

if errorlevel 1 (
  echo.
  echo Alice stopped with an error. Check logs\alice.log if it exists.
  pause
  exit /b 1
)
