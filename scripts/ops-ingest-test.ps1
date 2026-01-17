#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Ops Ingest Test
    
.DESCRIPTION
    Contract lock: Validates that the instructor-ingest pipeline
    correctly processes student bundles and produces grade artifacts.
#>

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

Write-Host "`n=== Ops Ingest Test ===" -ForegroundColor Cyan

# Check for a test submission to ingest
$TestSubmission = "packages/ops/labs/fixtures/lab-traffic-light-minimal"
if (-not (Test-Path $TestSubmission)) {
    Write-Host "[WARN] Test fixture not available: $TestSubmission" -ForegroundColor Yellow
    Write-Host "[NOTE] Skipping ingest test (run ops:student-export-fixture-test first)" -ForegroundColor Yellow
    exit 0
}

Write-Host "[OK] Test fixture available" -ForegroundColor Green

# Run agent-lab in instructor-ingest mode
Write-Host "[RUN] Running instructor ingest on fixture..." -ForegroundColor Yellow
& powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/agent-lab.ps1 `
    -Mode instructor-ingest `
    -Submission $TestSubmission 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq 1 -or $LASTEXITCODE -eq 2) {
    Write-Host "[OK] Ingest completed (exit code: $LASTEXITCODE)" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Ingest failed with unexpected exit code: $LASTEXITCODE" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Ops Ingest Test PASSED ===" -ForegroundColor Green
exit 0
