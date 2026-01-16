param(
    [Parameter(Mandatory=$true)][string]$Task,
    [Parameter(Mandatory=$true)][string]$TaskFile,
    [string]$RunId = (Get-Date -Format "yyyyMMdd-HHmmss"),
    [int]$TimeoutSec = 45,
    [int]$MaxChars = 1800
)

$ErrorActionPreference = "Stop"

# Setup directories
$WorkDir = "ops/claude/work/$RunId"
New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null

$ReportDir = "ops/claude/reports"
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

Write-Host "[MAPREDUCE] Starting $Task (RunId: $RunId)" -ForegroundColor Cyan

# Read task definition file
if (-not (Test-Path $TaskFile)) {
    Write-Host "[ERROR] Task file not found: $TaskFile" -ForegroundColor Red
    exit 1
}

$taskDef = Get-Content $TaskFile -Raw | ConvertFrom-Json

# Execute steps
$stepResults = @()
$stepIndex = 0

foreach ($step in $taskDef.steps) {
    $stepIndex++
    $stepId = "step-$($stepIndex.ToString().PadLeft(2, '0'))"
    $stepOutput = Join-Path $WorkDir "$stepId.json"
    
    Write-Host "[$stepId] $($step.name)" -ForegroundColor Yellow
    
    # Execute claude_exec for this step
    & "$PSScriptRoot\claude_exec.ps1" `
        -Prompt $step.prompt `
        -OutFile $stepOutput `
        -Format "json" `
        -TimeoutSec $TimeoutSec `
        -MaxChars $MaxChars
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Step failed" -ForegroundColor Red
        exit 1
    }
    
    # Load result
    $result = Get-Content $stepOutput -Raw | ConvertFrom-Json
    $stepResults += @{
        step = $stepId
        name = $step.name
        result = $result
    }
}

# Synthesis step
$synthesisPrompt = $taskDef.synthesis.prompt + "`n`nPrevious findings:`n" + ($stepResults | ConvertTo-Json -Compress)
Write-Host "[synthesis] Creating verdict" -ForegroundColor Yellow

$synthesisOutput = Join-Path $WorkDir "synthesis.json"
& "$PSScriptRoot\claude_exec.ps1" `
    -Prompt $synthesisPrompt `
    -OutFile $synthesisOutput `
    -Format "json" `
    -TimeoutSec $TimeoutSec `
    -MaxChars $MaxChars

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Synthesis failed" -ForegroundColor Red
    exit 1
}

# Load final result
$finalResult = Get-Content $synthesisOutput -Raw | ConvertFrom-Json

# Save JSON report
$jsonReport = @{
    runId = $RunId
    task = $Task
    timestamp = Get-Date -Format "o"
    steps = $stepResults
    verdict = $finalResult
} | ConvertTo-Json -Depth 10

$jsonReportPath = Join-Path $ReportDir "$RunId-$Task.json"
$jsonReport | Out-File -FilePath $jsonReportPath -Encoding utf8
Write-Host "[REPORT] JSON: $jsonReportPath" -ForegroundColor Green

exit 0
