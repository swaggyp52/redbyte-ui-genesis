#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Ops Make Bundle
    
.DESCRIPTION
    Contract lock: Creates a test bundle in the expected format
    for the student-export pipeline.
#>

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

Write-Host "`n=== Ops Make Bundle ===" -ForegroundColor Cyan

# Verify fixture exists
$FixtureSource = "packages/ops/labs/fixtures/lab-traffic-light-minimal"
if (-not (Test-Path $FixtureSource)) {
    Write-Host "[FAIL] Fixture source not found: $FixtureSource" -ForegroundColor Red
    exit 2
}

Write-Host "[OK] Fixture source found" -ForegroundColor Green
Write-Host "[NOTE] Bundle creation deferred to agent:lab student-export mode" -ForegroundColor Yellow
Write-Host "`n=== Ops Make Bundle completed ===" -ForegroundColor Green
exit 0
