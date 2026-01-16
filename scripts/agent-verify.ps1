# Agent Verify Script
# Runs build + local URL checks + minimal smoke test
# Usage: pnpm agent:verify

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "`n=== RedByte Agent Verification ===" -ForegroundColor Cyan
$failed = $false

# Phase 1: Build
Write-Host "`n[1/3] Building monorepo..." -ForegroundColor Yellow
try {
    pnpm -r build 2>&1 | Out-Null
    Write-Host "  [OK] Build successful" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Build FAILED" -ForegroundColor Red
    $failed = $true
}

# Phase 2: Check dist assets
Write-Host "`n[2/3] Checking dist assets..." -ForegroundColor Yellow
$requiredFiles = @(
    "apps\playground\dist\index.html",
    "apps\playground\dist\examples\fpga-proof\traffic-light-stateful.capsule.json",
    "apps\playground\dist\examples\fpga-proof\traffic-light-stateful.events.ndjson"
)
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "  [OK] $file" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] MISSING: $file" -ForegroundColor Red
        $failed = $true
    }
}

# Phase 3: Local URL checks (if dev server is running)
Write-Host "`n[3/3] Testing local URLs (requires dev server on port 5173)..." -ForegroundColor Yellow
$urls = @(
    "http://localhost:5173/",
    "http://localhost:5173/examples/fpga-proof/traffic-light-stateful.capsule.json",
    "http://localhost:5173/examples/fpga-proof/traffic-light-stateful.events.ndjson"
)

$serverRunning = Test-NetConnection -ComputerName localhost -Port 5173 -WarningAction SilentlyContinue -InformationLevel Quiet
if (-not $serverRunning) {
    Write-Host "  [WARN] Dev server not running (start with: pnpm dev)" -ForegroundColor Yellow
} else {
    foreach ($url in $urls) {
        try {
            $response = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 5
            Write-Host "  [OK] $url (HTTP $($response.StatusCode))" -ForegroundColor Green
        } catch {
            Write-Host "  [FAIL] FAILED: $url" -ForegroundColor Red
            $failed = $true
        }
    }
}

# Summary
Write-Host "`n=== Verification $(if ($failed) {'FAILED'} else {'PASSED'}) ===" -ForegroundColor $(if ($failed) {'Red'} else {'Green'})
if ($failed) {
    exit 1
} else {
    exit 0
}
