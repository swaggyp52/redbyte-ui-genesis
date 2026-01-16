param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("proof-audit", "ci-gate", "phase4-replay-audit")]
    [string]$Task,
    [string]$RunId = (Get-Date -Format "yyyyMMdd-HHmmss"),
    [int]$MaxClaudeCalls = 1,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# Get repo root via git (most reliable method)
$repoRoot = (& git rev-parse --show-toplevel 2>$null).Trim()
if (-not $repoRoot) {
    Write-Host "[ERROR] Not in a git repository" -ForegroundColor Red
    exit 1
}

Write-Host "=== AI-RUN AUTOMATION ===" -ForegroundColor Cyan
Write-Host "Task: $Task" -ForegroundColor Yellow
Write-Host "RunId: $RunId" -ForegroundColor Yellow
Write-Host "DryRun: $DryRun" -ForegroundColor Yellow
Write-Host "MaxClaudeCalls: $MaxClaudeCalls" -ForegroundColor Yellow
Write-Host ""

# Ensure required directories exist
New-Item -ItemType Directory -Force -Path (Join-Path $repoRoot "ops/claude/logs") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $repoRoot "ops/claude/work/$RunId") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $repoRoot "ops/claude/reports") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $repoRoot "ops/claude/cache") | Out-Null

# ===== TIER A: LOCAL CONTEXT (free, deterministic) =====
Write-Host "[TIER A] Gathering context..." -ForegroundColor Cyan
& "$PSScriptRoot\context_pack.ps1" -RunId $RunId

# Get repo root via git (most reliable method)
$repoRoot = (& git rev-parse --show-toplevel 2>$null).Trim()
if (-not $repoRoot) {
    Write-Host "[ERROR] Not in a git repository" -ForegroundColor Red
    exit 1
}

$contextFile = Join-Path $repoRoot "ops/claude/work/$RunId/context.json"
if (-not (Test-Path $contextFile)) {
    Write-Host "[ERROR] Context file not found: $contextFile" -ForegroundColor Red
    exit 1
}
$context = Get-Content $contextFile -Raw | ConvertFrom-Json

# ===== CACHING =====
Write-Host "[CACHE] Computing cache key..." -ForegroundColor Cyan
$commit = $context.commit
$fileHashes = @($context.changed_files) | ForEach-Object { 
    if (Test-Path $_) { 
        $hash = (Get-FileHash $_ -Algorithm SHA256).Hash.Substring(0,8)
        "$_=$hash"
    }
} | Sort-Object

$cacheKeyData = "$commit`n$($fileHashes -join "`n")"
$cacheKeyHash = (Get-FileHash -InputStream ([System.IO.MemoryStream]::new([System.Text.Encoding]::UTF8.GetBytes($cacheKeyData))) -Algorithm SHA256).Hash.Substring(0,12)
$cacheKey = "$Task-$cacheKeyHash"

Write-Host "Cache key: $cacheKey" -ForegroundColor Green

$cacheFile = Join-Path $repoRoot "ops/claude/cache/$cacheKey.json"
$usedCache = $false

if (Test-Path $cacheFile) {
    Write-Host "[CACHE] HIT - Using cached result" -ForegroundColor Green
    $cachedResult = Get-Content $cacheFile -Raw
    Write-Host ""
    $cachedResult
    Write-Host ""
    Write-Host "ClaudeCallsUsed: 0" -ForegroundColor Cyan
    exit 0
}

Write-Host "[CACHE] MISS - Will compute" -ForegroundColor Yellow

# ===== DRY RUN MODE =====
if ($DryRun) {
    Write-Host ""
    Write-Host "[DRY-RUN] Skipping Claude (0 calls)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Context summary:" -ForegroundColor Cyan
    $context | ConvertTo-Json | Select-Object -First 20
    Write-Host ""
    Write-Host "ClaudeCallsUsed: 0" -ForegroundColor Cyan
    exit 0
}

# ===== TIER B: CLAUDE DECISION (paid, once max) =====
if ($MaxClaudeCalls -le 0) {
    Write-Host ""
    Write-Host "[BUDGET] MaxClaudeCalls=$MaxClaudeCalls - stopping (local results only)" -ForegroundColor Yellow
    Write-Host "ClaudeCallsUsed: 0" -ForegroundColor Cyan
    exit 0
}

Write-Host "[TIER B] Making Claude decision..." -ForegroundColor Cyan
& "$PSScriptRoot\claude_decide.ps1" `
    -ContextFile $contextFile `
    -Task $Task `
    -RunId $RunId `
    -TimeoutSec 45

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ClaudeCallsUsed: 1" -ForegroundColor Cyan
    Write-Host "[FAIL] Claude decision failed" -ForegroundColor Red
    exit 1
}

# ===== CACHE RESULT =====
Write-Host "[CACHE] Saving result..." -ForegroundColor Cyan
$decisionFile = Join-Path $repoRoot "ops/claude/reports/$RunId-$Task-decision.txt"
Get-Content $decisionFile -Raw | Out-File -FilePath $cacheFile -Encoding utf8
Write-Host "Cache saved: $cacheKey" -ForegroundColor Green

Write-Host ""
Write-Host "=== REPORTS ===" -ForegroundColor Cyan
Get-ChildItem (Join-Path $repoRoot "ops/claude/reports/$RunId*") -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  $($_.Name)" -ForegroundColor Green
}

Write-Host ""
Write-Host "ClaudeCallsUsed: 1" -ForegroundColor Cyan
Write-Host "SUCCESS - Exit code 0" -ForegroundColor Green
exit 0
