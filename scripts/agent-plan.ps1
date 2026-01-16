# Agent Plan Script
# Generates TODO list in ops/agent/plan.md based on failures
# Usage: pnpm agent:plan

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "`n=== RedByte Agent Planning ===" -ForegroundColor Cyan

# Ensure ops/agent directory exists
$planDir = "ops\agent"
if (-not (Test-Path $planDir)) {
    New-Item -ItemType Directory -Path $planDir -Force | Out-Null
}

$planPath = "$planDir\plan.md"
$issues = @()

# Check build
Write-Host "Checking build status..." -ForegroundColor Yellow
if (-not (Test-Path "apps\playground\dist\index.html")) {
    $issues += @"
## ❌ Build Missing
**Issue:** Dist output not found.
**Action:** Run ``pnpm build``
**Priority:** HIGH
"@
}

# Check FPGA assets
Write-Host "Checking FPGA assets..." -ForegroundColor Yellow
$assetsPath = "apps\playground\dist\examples\fpga-proof"
if (-not (Test-Path $assetsPath)) {
    $issues += @"
## ❌ FPGA Assets Missing
**Issue:** Demo capsule and events not in dist.
**Action:** Verify ``publicDir`` in apps/playground/vite.config.ts points to ../../public
**Priority:** HIGH (blocks deployment)
"@
} else {
    $capsule = Test-Path "$assetsPath\traffic-light-stateful.capsule.json"
    $events = Test-Path "$assetsPath\traffic-light-stateful.events.ndjson"
    if (-not ($capsule -and $events)) {
        $issues += @"
## ⚠ Incomplete FPGA Assets
**Issue:** Some demo files missing (capsule: $capsule, events: $events)
**Action:** Check public/examples/fpga-proof/ has all files and rebuild
**Priority:** MEDIUM
"@
    }
}

# Check uncommitted changes
Write-Host "Checking git status..." -ForegroundColor Yellow
git diff --quiet
if (-not $?) {
    $issues += @"
## 📝 Uncommitted Changes
**Issue:** Working tree has modifications
**Action:** Review changes with ``git status`` and commit if valid
**Priority:** MEDIUM
"@
}

# Check if behind origin
$branch = git rev-parse --abbrev-ref HEAD
$behind = (git rev-list HEAD..origin/$branch --count 2>$null) -as [int]
if ($behind -gt 0) {
    $issues += @"
## 🔄 Behind Origin
**Issue:** Local branch is $behind commits behind origin/$branch
**Action:** Run ``git pull`` to sync
**Priority:** LOW
"@
}

# Generate plan
Write-Host "Generating plan at $planPath..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$planContent = @"
# RedByte Agent TODO Plan
**Generated:** $timestamp  
**Branch:** $branch

---

$(if ($issues.Count -eq 0) {
    "## [OK] No Issues Found`n`nAll checks passed. Ready for deployment."
} else {
    $issues -join "`n`n---`n`n"
})

---

## Next Steps
1. Review issues above (if any)
2. Run ``pnpm agent:verify`` after fixes
3. Deploy to redbyteapps.dev when ready:
   - Go to GitHub Actions → Deploy to Cloudflare Pages
   - Click "Run workflow" on main branch
   - Wait ~2 min for build + deploy
4. Verify https://redbyteapps.dev/examples/fpga-proof/traffic-light-stateful.capsule.json returns HTTP 200

## Manual Deployment Command
**DO NOT PUSH TO MAIN AUTOMATICALLY** — trigger workflow manually via GitHub UI.
"@

Set-Content -Path $planPath -Value $planContent -Encoding UTF8
Write-Host "[OK] Plan written to $planPath" -ForegroundColor Green

# Show summary
if ($issues.Count -eq 0) {
    Write-Host "`n[OK] No issues found. System ready." -ForegroundColor Green
} else {
    Write-Host "`n[WARN] Found $($issues.Count) issue(s). See $planPath for details." -ForegroundColor Yellow
}
