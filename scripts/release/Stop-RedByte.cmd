@echo off
if not exist "%~dp0runtime\node.exe" (
  echo RedByte: bundled runtime missing. Extract the entire ZIP into a folder before stopping. 1>&2
  set "RB_LAUNCH_EXIT=1"
  goto :finish
)
"%~dp0runtime\node.exe" "%~dp0launch.mjs" stop %*
set "RB_LAUNCH_EXIT=%ERRORLEVEL%"
:finish
if not "%RB_LAUNCH_EXIT%"=="0" if not "%RB_LAUNCH_NO_PAUSE%"=="1" pause
exit /b %RB_LAUNCH_EXIT%
