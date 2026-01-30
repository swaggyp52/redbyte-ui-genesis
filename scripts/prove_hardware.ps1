$ErrorActionPreference = "Stop"
$env:FORCE_COLOR = "0"
$env:CI = "1"

Write-Host "--- SHIP-GRADE HARDWARE PROOF PACK ---" -ForegroundColor Cyan

# 0) Kill anything holding node/vite/pnpm and especially 4242
Write-Host "[1/5] Cleaning up existing processes..." -ForegroundColor Yellow
Get-Process node, vite, pnpm -ErrorAction SilentlyContinue | Stop-Process -Force

# 1) Hard free port 4242 (kills zombie bridge cleanly)
$targetPid = (Get-NetTCPConnection -LocalPort 4242 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess
if ($targetPid) { 
    Write-Host "[1/5] Killing process $targetPid on port 4242..." -ForegroundColor Yellow
    Stop-Process -Id $targetPid -Force 
}

# 2) Start bridge (Run in background within this terminal for easy log capture)
Write-Host "[2/5] Starting Bridge Agent..." -ForegroundColor Yellow
# Using Start-Process with -NoNewWindow and redirecting to bridge.log
# Actually, for the AI to see it, I'll run it as a background job if possible, 
# or just start it and capture logs.
$bridgeProc = Start-Process powershell -ArgumentList "-Command", "pnpm --filter @redbyte/rb-bridge-agent dev > bridge.log 2>&1" -PassThru -NoNewWindow
Start-Sleep -Seconds 5

# 3) Capture protocol truth using REAL curl.exe
Write-Host "[3/5] Capturing Protocol Truth..." -ForegroundColor Yellow
curl.exe -s http://127.0.0.1:4242/health | Tee-Object -FilePath .\health.json
curl.exe -s http://127.0.0.1:4242/devices | Tee-Object -FilePath .\devices.json

# 4) Run idempotency twice
Write-Host "[4/5] Running Idempotency Run 1..." -ForegroundColor Yellow
pnpm exec tsx tools/verify_client.ts | Tee-Object -FilePath .\verify1.log
Write-Host "[4/5] Running Idempotency Run 2..." -ForegroundColor Yellow
pnpm exec tsx tools/verify_client.ts | Tee-Object -FilePath .\verify2.log

# 5) Stop Bridge
Write-Host "[5/5] Verification Complete. Cleaning up..." -ForegroundColor Cyan
if ($bridgeProc) { Stop-Process -Id $bridgeProc.Id -Force }

Write-Host "`n=== PROOF PACK COMPLETE ===" -ForegroundColor Green
Write-Host "Files generated: health.json, devices.json, verify1.log, verify2.log, bridge.log"
