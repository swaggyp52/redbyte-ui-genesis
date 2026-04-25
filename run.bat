@echo off
setlocal

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-RedByte.ps1" %*
set "RB_EXIT=%ERRORLEVEL%"

if not "%RB_EXIT%"=="0" (
  echo.
  echo RedByte did not start successfully. Exit code: %RB_EXIT%
  echo Review the message above, then press any key to close this window.
  pause >nul
)

exit /b %RB_EXIT%
