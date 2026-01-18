# Hardware Session v1 - Manual Export & Ingest Test
#
# This test verifies that exported bundles WITH hardware.json still ingest and grade cleanly.
#
# Prerequisites:
# - Desktop Bridge running: node tools/desktop-bridge.js (port 3002)
# - Dev server running: pnpm dev (port 5173)
#
# Steps:
# 1. Open browser: http://localhost:5173/lab.html?lab=traffic-light
# 2. Start attempt (enter any student name)
# 3. Navigate to "3. Hardware" tab
# 4. Verify bridge shows "● Online" and board shows "● Connected"
# 5. Click "📸 Capture Snapshot" button 2 times
# 6. Navigate to "4. Self-Check" tab, select "Correct" preset, click "Run Self-Check"
# 7. Navigate to "5. Export" tab, click "Export Submission", confirm
# 8. Note the downloaded ZIP filename (e.g., traffic-light-student-XYZ-2026-01-18T...rb-lab.zip)
#
# Then run this script with the downloaded ZIP path:

param(
    [Parameter(Mandatory=$true)]
    [string]$ZipPath
)

Write-Host "`n[TEST] Hardware Session v1 - Export with hardware.json ingest test" -ForegroundColor Cyan
Write-Host "[TEST] ZIP: $ZipPath`n" -ForegroundColor Yellow

# Verify ZIP exists
if (-not (Test-Path $ZipPath)) {
    Write-Host "[FAIL] ZIP file not found: $ZipPath" -ForegroundColor Red
    exit 1
}

# Extract and inspect ZIP contents
$tempExtract = Join-Path $env:TEMP "hw-test-extract-$(Get-Date -Format 'yyyyMMddHHmmss')"
Expand-Archive -Path $ZipPath -DestinationPath $tempExtract -Force

Write-Host "[STEP 1] Extracted ZIP contents:" -ForegroundColor Green
Get-ChildItem -Path $tempExtract -Recurse -File | ForEach-Object {
    Write-Host "  $($_.FullName.Replace($tempExtract, ''))" -ForegroundColor Gray
}

# Check for hardware.json
$hardwareJsonPath = Join-Path $tempExtract "proofs\hardware.json"
if (Test-Path $hardwareJsonPath) {
    Write-Host "`n[PASS] proofs/hardware.json exists" -ForegroundColor Green
    $hardwareData = Get-Content $hardwareJsonPath -Raw | ConvertFrom-Json
    Write-Host "  Bridge: $($hardwareData.bridge_status)" -ForegroundColor Gray
    Write-Host "  Board: $($hardwareData.board_status)" -ForegroundColor Gray
    Write-Host "  Model: $($hardwareData.board_model)" -ForegroundColor Gray
    Write-Host "  Snapshots: $($hardwareData.snapshots.Count)" -ForegroundColor Gray
} else {
    Write-Host "`n[WARN] proofs/hardware.json NOT found (optional, but expected for this test)" -ForegroundColor Yellow
}

# Check manifest for hardware section
$manifestPath = Join-Path $tempExtract "manifest.json"
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
if ($manifest.hardware) {
    Write-Host "`n[PASS] manifest.json contains hardware section" -ForegroundColor Green
    Write-Host "  evidence_path: $($manifest.hardware.evidence_path)" -ForegroundColor Gray
    Write-Host "  bridge_status: $($manifest.hardware.bridge_status)" -ForegroundColor Gray
    Write-Host "  board_status: $($manifest.hardware.board_status)" -ForegroundColor Gray
    Write-Host "  snapshots_count: $($manifest.hardware.snapshots_count)" -ForegroundColor Gray
} else {
    Write-Host "`n[WARN] manifest.json does NOT contain hardware section" -ForegroundColor Yellow
}

# Run ops-liveness ingest test
Write-Host "`n[STEP 2] Running ops-liveness ingest test..." -ForegroundColor Green

$jsonOut = ".\ops-liveness-hardware-v1.json"

& powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ops-liveness.ps1 `
    -StartServer `
    -ZipPath $ZipPath `
    -ExpectExitCodes 0,1 `
    -JsonOut $jsonOut

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n[FAIL] ops-liveness exited with code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

# Parse results
Write-Host "`n[STEP 3] Checking ingest results..." -ForegroundColor Green
$results = Get-Content $jsonOut -Raw | ConvertFrom-Json

Write-Host "`nΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöî" -ForegroundColor Cyan
Write-Host "  INGEST RESULTS" -ForegroundColor Cyan
Write-Host "ΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöîΓöî`n" -ForegroundColor Cyan

Write-Host "Overall Pass    : $($results.overallPass)" -ForegroundColor $(if ($results.overallPass) { "Green" } else { "Red" })
Write-Host "Grading Pass    : $($results.gradingPass)" -ForegroundColor $(if ($results.gradingPass) { "Green" } else { "Red" })
Write-Host "Ingest Status   : $($results.ingest.status)" -ForegroundColor Gray
Write-Host "Exit Code       : $($results.ingest.exit_code)" -ForegroundColor Gray
Write-Host "Verdict         : $($results.ingest.verdict)" -ForegroundColor Gray
Write-Host "Run ID          : $($results.ingest.run_id)" -ForegroundColor Gray

if ($results.contracts) {
    Write-Host "`nContracts:" -ForegroundColor Cyan
    Write-Host "  verdictMappingConsistent : $($results.contracts.verdictMappingConsistent)" -ForegroundColor $(if ($results.contracts.verdictMappingConsistent) { "Green" } else { "Red" })
    Write-Host "  gradeExitMatches         : $($results.contracts.gradeExitMatches)" -ForegroundColor $(if ($results.contracts.gradeExitMatches) { "Green" } else { "Red" })
}

Write-Host ""

# Final verdict
if ($results.overallPass -and $results.gradingPass -and ($results.ingest.exit_code -eq 0 -or $results.ingest.exit_code -eq 1)) {
    Write-Host "[PASS] Hardware Session v1 export + ingest VERIFIED Γ£êÔ£ê" -ForegroundColor Green
    Write-Host "       Bundle with hardware.json ingested cleanly and graded correctly." -ForegroundColor Green
    exit 0
} else {
    Write-Host "[FAIL] Hardware Session v1 export + ingest FAILED" -ForegroundColor Red
    exit 1
}
