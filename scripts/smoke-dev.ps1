$ErrorActionPreference = "Stop"

Write-Host "Cleaning up existing processes..."
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process chromium -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "Running smoke test headless..."
pnpm test:smoke --grep "DEV"

$testExitCode = $LASTEXITCODE
Write-Host "Test exit code: $testExitCode"
exit $testExitCode
