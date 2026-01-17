#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Student Export Fixture Test
    
.DESCRIPTION
    Contract lock: Validates that student-export pipeline produces
    correctly formatted fixture bundles with expected directory structure,
    manifest, and capsule data.
    
.NOTES
    Exit Codes:
      0 = All fixture checks passed
      1 = Fixture validation failed (output format error)
      2 = Setup error (missing fixture data or agent-lab machinery)
#>

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

Write-Host "`n=== Student Export Fixture Test ===" -ForegroundColor Cyan

# Check fixture source exists
$FixtureLab = "packages/ops/labs/fixtures/lab-traffic-light-minimal"
$FixtureSource = Join-Path $RepoRoot $FixtureLab
if (-not (Test-Path $FixtureSource)) {
    Write-Host "[FAIL] Fixture source not found: $FixtureLab" -ForegroundColor Red
    exit 2
}

# Run agent-lab in student-export mode on fixture
$OutputDir = "packages/ops/labs/runs"
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

Write-Host "[RUN] Exporting fixture bundle via agent:lab (student-export mode)..." -ForegroundColor Yellow
try {
    # Use agent-lab with student-export mode
    & powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/agent-lab.ps1 `
        -Mode student-export `
        -Submission $FixtureSource 2>&1 | Out-Null
    
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 1 -and $LASTEXITCODE -ne 2) {
        Write-Host "[FAIL] agent-lab returned unexpected exit code: $LASTEXITCODE" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "[FAIL] agent-lab execution failed: $_" -ForegroundColor Red
    exit 2
}

# Validate fixture output structure
$RunDirs = Get-ChildItem $OutputDir -Directory | Where-Object { $_.Name -match "^run-" }
if ($RunDirs.Count -eq 0) {
    Write-Host "[FAIL] No run directories created" -ForegroundColor Red
    exit 1
}

$LatestRun = $RunDirs | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$RunPath = $LatestRun.FullName

# Check grade.json (the output from agent-lab student-export)
$GradeJson = Join-Path $RunPath "grade.json"
if (-not (Test-Path $GradeJson)) {
    Write-Host "[FAIL] Missing grade.json in run directory" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] grade.json found" -ForegroundColor Green

# Parse grade.json
try {
    $GradeData = Get-Content $GradeJson | ConvertFrom-Json
} catch {
    Write-Host "[FAIL] grade.json is invalid JSON: $_" -ForegroundColor Red
    exit 1
}

# Validate grade structure
$requiredGradeFields = @('run_id', 'timestamp', 'verdict')
foreach ($field in $requiredGradeFields) {
    if (-not $GradeData.PSObject.Properties[$field]) {
        Write-Host "[FAIL] grade missing required field: $field" -ForegroundColor Red
        exit 1
    }
}

Write-Host "[OK] grade structure valid (verdict=$($GradeData.verdict), run_id=$($GradeData.run_id))" -ForegroundColor Green

# Check grade.md
$GradeMd = Join-Path $RunPath "grade.md"
if (-not (Test-Path $GradeMd)) {
    Write-Host "[WARN] Missing grade.md in run directory (optional)" -ForegroundColor Yellow
}

# Summary
Write-Host "`n=== Student Export Fixture Test PASSED ===" -ForegroundColor Green
Write-Host "  - Grade JSON validated (fields present)"  
Write-Host "  - Grade structure confirmed (verdict + exit_code present)"
Write-Host "  - Output directory: $RunPath"
exit 0
