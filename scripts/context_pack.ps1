param(
    [string]$RunId = (Get-Date -Format "yyyyMMdd-HHmmss"),
    [int]$MaxLogLines = 50
)

$ErrorActionPreference = "Stop"

# Get repo root via git
$repoRoot = (& git rev-parse --show-toplevel 2>$null).Trim()
if (-not $repoRoot) {
    Write-Host "[ERROR] Not in a git repository" -ForegroundColor Red
    exit 1
}

$WorkDir = Join-Path $repoRoot "ops/claude/work/$RunId"
New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null

Write-Host "=== CONTEXT PACK ===" -ForegroundColor Cyan
Write-Host "Gathering local context (no Claude calls)" -ForegroundColor Yellow

$context = @{
    timestamp = Get-Date -Format "o"
    branch = (git rev-parse --abbrev-ref HEAD)
    commit = (git rev-parse HEAD)
    commit_short = (git rev-parse --short HEAD)
    changed_files = @()
    local_checks = @{}
}

# Get changed files (diff from HEAD~1)
try {
    $changedFiles = @(git diff --name-only HEAD~1..HEAD)
    if ($changedFiles.Count -eq 0) {
        $changedFiles = @(git status --porcelain | ForEach-Object { $_.Substring(3) })
    }
    $context.changed_files = $changedFiles | Select-Object -First 50
} catch {
    Write-Host "[WARN] Could not get changed files: $_" -ForegroundColor Yellow
}

Write-Host "Branch: $($context.branch)" -ForegroundColor Green
Write-Host "Commit: $($context.commit_short)" -ForegroundColor Green
Write-Host "Changed files: $($context.changed_files.Count)" -ForegroundColor Green

# Run pnpm quality check
Write-Host "Running pnpm quality..." -ForegroundColor Yellow
$qualityOutput = @()
try {
    $qualityResult = & pnpm -s quality 2>&1
    $qualityPass = $LASTEXITCODE -eq 0
    $qualityOutput = $qualityResult | Select-Object -Last $MaxLogLines
    $context.local_checks.quality = @{
        pass = $qualityPass
        exit_code = $LASTEXITCODE
        last_lines = @($qualityOutput)
    }
    Write-Host "  Quality: $(if ($qualityPass) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($qualityPass) { 'Green' } else { 'Red' })
} catch {
    Write-Host "  Quality: ERROR - $_" -ForegroundColor Yellow
    $context.local_checks.quality = @{ pass = $false; error = $_ }
}

# Run proof:run if available
Write-Host "Running proof:run..." -ForegroundColor Yellow
try {
    $proofResult = & pnpm --filter @redbyte/fpga-bridge proof:run 2>&1
    $proofPass = $LASTEXITCODE -eq 0
    $proofOutput = $proofResult | Select-Object -Last $MaxLogLines
    $context.local_checks.proof_run = @{
        pass = $proofPass
        exit_code = $LASTEXITCODE
        last_lines = @($proofOutput)
    }
    Write-Host "  Proof:run: $(if ($proofPass) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($proofPass) { 'Green' } else { 'Red' })
} catch {
    Write-Host "  Proof:run: SKIP - $_" -ForegroundColor DarkYellow
    $context.local_checks.proof_run = @{ pass = $null; skipped = $true }
}

# Check proof artifacts directory
Write-Host "Checking proof artifacts..." -ForegroundColor Yellow
$proofDir = "ops/proof"
if (Test-Path $proofDir) {
    $proofFiles = @(Get-ChildItem $proofDir -Recurse | Select-Object -ExpandProperty FullName)
    $context.local_checks.proof_artifacts = @{
        count = $proofFiles.Count
        files = @($proofFiles | Select-Object -First 10)
    }
    Write-Host "  Artifacts: $($proofFiles.Count) files" -ForegroundColor Green
} else {
    $context.local_checks.proof_artifacts = @{ count = 0; files = @() }
    Write-Host "  Artifacts: Not found" -ForegroundColor Yellow
}

# Git status summary
Write-Host "Git status..." -ForegroundColor Yellow
$gitStatus = git status --porcelain
$context.git_status = $gitStatus
Write-Host "  Modified/new files: $(($gitStatus | Measure-Object).Count)" -ForegroundColor Green

# Save context packet
$contextPath = Join-Path $WorkDir "context.json"
$context | ConvertTo-Json -Depth 10 | Out-File -FilePath $contextPath -Encoding utf8

Write-Host ""
Write-Host "[OK] Context packed to $contextPath" -ForegroundColor Green
Write-Host "Context size: $(([System.Text.Encoding]::UTF8.GetByteCount([System.IO.File]::ReadAllText($contextPath)) / 1024).ToString('F1')) KB" -ForegroundColor Cyan

# Output summary
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Quality check: $(if ($context.local_checks.quality.pass) { 'PASS' } else { 'FAIL' })" -ForegroundColor Green
Write-Host "  Proof artifacts: $($context.local_checks.proof_artifacts.count) files" -ForegroundColor Green
Write-Host "  Changed files: $($context.changed_files.Count)" -ForegroundColor Green

exit 0
