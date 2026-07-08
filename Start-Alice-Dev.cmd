@echo off
setlocal

set "ROOT=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\Start-Alice-Dev.ps1" %*
exit /b %ERRORLEVEL%
