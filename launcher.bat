@echo off
setlocal

echo ====================================================
echo Starting RedByte OS (Production Mode)
echo ====================================================

rem Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found. Please install Node.js LTS.
    pause
    exit /b 1
)

rem Check for Dist
if not exist "apps\playground\dist\index.html" (
    echo [Launcher] Production build not found. Building now...
    echo [Launcher] This may take a minute...
    call pnpm build
    if %errorlevel% neq 0 (
        echo [Launcher] Build failed.
        pause
        exit /b 1
    )
)

echo [Launcher] Starting Bridge Agent...
rem Start Bridge in background (using start /b or separate window minimized)
rem We assume packages/rb-bridge-agent/dist/index.js exists or we use ts-node/direct
rem Check if bridge is built
if exist "packages\rb-bridge-agent\dist\index.js" (
    start "RedByte Bridge" /min node packages\rb-bridge-agent\dist\index.js
) else (
    echo [Launcher] Bridge dist not found, running via pnpm start...
    start "RedByte Bridge" /min pnpm --filter rb-bridge-agent start
)

echo [Launcher] Starting UI Server...
start "RedByte UI" /min node apps\playground\scripts\prod-server.js

echo [Launcher] Opening Browser...
timeout /t 2 >nul
start http://127.0.0.1:4243

echo [Launcher] RedByte OS is running.
echo [Launcher] Close the Bridge and UI windows to exit.
rem pause
