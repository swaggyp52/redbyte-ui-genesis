# Agent Status Script
# Reports current repo state, last deploy info, and proof artifacts
# Usage: pnpm agent:status

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "`n=== RedByte Agent Status Report ===" -ForegroundColor Cyan
Write-Host "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n" -ForegroundColor Gray

# Git Status
Write-Host "[GIT STATUS]" -ForegroundColor Yellow
$branch = git rev-parse --abbrev-ref HEAD
$commit = git rev-parse --short HEAD
$dirty = git diff --quiet; $?
Write-Host "  Branch: $branch"
Write-Host "  Commit: $commit"
Write-Host "  Clean: $(if ($dirty) {'OK'} else {'DIRTY (uncommitted changes)'})"

# Check if ahead/behind origin
$upstream = git rev-parse --abbrev-ref "@{upstream}" 2>$null
if ($upstream) {
    $behind = (git rev-list HEAD..origin/$branch --count 2>$null) -as [int]
    $ahead = (git rev-list origin/$branch..HEAD --count 2>$null) -as [int]
    Write-Host "  Remote: $(if ($behind -eq 0 -and $ahead -eq 0) {'OK synced'} elseif ($behind -gt 0) {"$behind behind"} else {"$ahead ahead"})"
}

# Build Status
Write-Host "`n[BUILD STATUS]" -ForegroundColor Yellow
$distPath = "apps\playground\dist"
if (Test-Path $distPath) {
    $distTime = (Get-Item $distPath).LastWriteTime
    $age = (New-TimeSpan -Start $distTime -End (Get-Date)).TotalHours
    Write-Host "  Last Build: $($distTime.ToString('yyyy-MM-dd HH:mm:ss')) ($([math]::Round($age, 1))h ago)"
    
    # Check if examples exist
    $examplesPath = "$distPath\examples\fpga-proof"
    if (Test-Path $examplesPath) {
        $capsule = Test-Path "$examplesPath\traffic-light-stateful.capsule.json"
        $events = Test-Path "$examplesPath\traffic-light-stateful.events.ndjson"
        Write-Host "  FPGA Assets: $(if ($capsule -and $events) {'OK present'} else {'MISSING'})"
    } else {
        Write-Host "  FPGA Assets: MISSING (examples dir not found)" -ForegroundColor Red
    }
} else {
    Write-Host "  Build: ✗ NOT BUILT" -ForegroundColor Red
}

# Deployment Info
Write-Host "`n[DEPLOYMENT INFO]" -ForegroundColor Yellow
Write-Host "  Target: redbyteapps.dev (Cloudflare Pages)"
Write-Host "  Workflow: .github/workflows/deploy-cloudflare.yml"
Write-Host "  Trigger: Manual (workflow_dispatch)"
Write-Host "  Build Output: apps/playground/dist"

# FPGA Proof Artifacts
Write-Host "`n[FPGA PROOF ARTIFACTS]" -ForegroundColor Yellow
$artifactDirs = @("_ci_phase4_artifacts", "_ci_phase4_fixed")
foreach ($dir in $artifactDirs) {
    if (Test-Path $dir) {
        $count = (Get-ChildItem $dir -Recurse -File).Count
        Write-Host "  ${dir}: $count files"
    }
}

$bridgePackage = "packages\rb-fpga-bridge"
if (Test-Path $bridgePackage) {
    Write-Host "  rb-fpga-bridge: OK installed"
    $exampleCount = (Get-ChildItem "$bridgePackage\examples" -Filter "*.json" -ErrorAction SilentlyContinue).Count
    Write-Host "    Examples: $exampleCount test vectors"
} else {
    Write-Host "  rb-fpga-bridge: NOT FOUND"
}

Write-Host "`n=== End of Report ===`n" -ForegroundColor Cyan
