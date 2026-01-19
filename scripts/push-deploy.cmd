@echo off
setlocal
set SCRIPT_DIR=%~dp0
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%push-deploy.ps1" %*
exit /b %ERRORLEVEL%
