#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Lab Ingest Agent - Autonomous grading pipeline for FPGA proof submissions
    
.DESCRIPTION
    Ingests student submission bundles (.rb-lab.zip or unzipped folder), 
    validates against core library, and generates grade artifacts.
    
    Output: ops/labs/runs/<run_id>/grade.{json,md} + [FINAL] log line
    
.PARAMETER Mode
    Pipeline mode: 'student-export', 'instructor-ingest'
    
.PARAMETER Submission
    Path to submission: .rb-lab.zip file or unzipped folder
    
.PARAMETER StrictHash
    Require exact hash match (exit code 2 on mismatch, else 1)
    
.PARAMETER Golden
    Optional: Path to golden proof for diff comparison
    
.EXAMPLE
    pnpm agent:lab -- --mode instructor-ingest --submission ./student-work/alice.rb-lab.zip --strict-hash
    
.EXAMPLE
    pnpm agent:lab -- --submission ./unzipped_bundle --golden ./reference.capsule.json
#>

param(
    [ValidateSet('student-export', 'instructor-ingest')]
    [string]$Mode = 'instructor-ingest',
    
    [Parameter(Mandatory)]
    [string]$Submission,
    
    [switch]$StrictHash,
    
    [string]$Golden
)

$ErrorActionPreference = 'Stop'

# Locate agent engine
$RepoRoot = Split-Path -Parent $PSScriptRoot
$EngineScript = Join-Path $RepoRoot 'packages/rb-fpga-proof-core/scripts/lab-ingest.js'

if (-not (Test-Path $EngineScript)) {
    Write-Error "Lab ingest engine not found: $EngineScript"
    exit 1
}

# Validate input
if (-not (Test-Path $Submission)) {
    Write-Error "Submission not found: $Submission"
    exit 1
}

# Build node command
$NodeArgs = @(
    $EngineScript,
    '--mode', $Mode,
    '--submission', $Submission
)

if ($StrictHash) {
    $NodeArgs += '--strict-hash'
}

if ($Golden) {
    $NodeArgs += '--golden', $Golden
}

# Execute pipeline
Write-Host "Lab Ingest: $Mode" -ForegroundColor Cyan
Write-Host "Submission: $Submission`n" -ForegroundColor Gray

& node @NodeArgs

$ExitCode = $LASTEXITCODE
exit $ExitCode
