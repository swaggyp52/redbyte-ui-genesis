# scripts/night_shift.ps1
# Main Night Shift runner - enforces safety + proof + PRs
#
# ⚠️ INFRASTRUCTURE CODE ⚠️
# This file is the safety net for overnight autonomous execution.
# DO NOT casually edit. If changes are needed:
# - Open PR with explicit justification
# - Test manually before merging
# - Document in ops/NIGHT_SHIFT_LOG.md
#
# The runner, not the AI, is in charge.
#
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-LogLine([string]$line) {
  $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  $out = "[$ts] $line"
  Write-Host $out
  Add-Content -Path "ops/NIGHT_SHIFT_LOG.md" -Value $out
}

function Require-Cmd([string]$name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $name"
  }
}

function Assert-RepoClean() {
  $s = git status --porcelain
  if ($s) { throw "Repo is dirty. Commit/stash changes before running Night Shift." }
}

function Get-NextReadyTicket() {
  $path = "ops/NIGHT_SHIFT_QUEUE.md"
  if (-not (Test-Path $path)) { throw "Missing $path" }

  $content = Get-Content $path -Raw

  # Parse markdown sections starting with "## "
  $sections = ($content -split "(?m)^\#\#\s+")
  foreach ($sec in $sections) {
    if ([string]::IsNullOrWhiteSpace($sec)) { continue }

    $lines = $sec -split "`n"
    $title = $lines[0].Trim()

    if ($sec -match "(?im)^\*\*Status\*\*:\s*READY\s*$") {
      return @{
        Title = $title
        Body  = $sec.Trim()
      }
    }
  }

  return $null
}

function Slugify([string]$s) {
  $slug = $s.ToLowerInvariant()
  $slug = $slug -replace "[^a-z0-9]+", "-"
  $slug = $slug.Trim("-")
  if ($slug.Length -gt 50) { $slug = $slug.Substring(0, 50).Trim("-") }
  if (-not $slug) { $slug = "ticket" }
  return $slug
}

function Save-Proof([string]$slug, [string]$name, [string]$text) {
  $dir = "ops/proof"
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  $path = Join-Path $dir "$slug-$name.txt"
  Set-Content -Path $path -Value $text -Encoding UTF8
  return $path
}

function Run-And-Capture([string]$cmd) {
  Write-LogLine "RUN: $cmd"
  $out = Invoke-Expression $cmd 2>&1 | Out-String
  return $out
}

# ---------------- Main ----------------
Require-Cmd git
Require-Cmd pnpm
Require-Cmd gh

# Verify Playwright is installed (required for smoke tests)
$playwrightCheck = pnpm exec playwright --version 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: Playwright not found. Run: pnpm exec playwright install chromium"
  throw "Playwright not installed"
}

Write-LogLine "=== Night Shift start ==="
Assert-RepoClean

$maxTickets = 2   # Max tickets per shift
$done = 0

# Detect which worker to use (based on which exists)
$workerScript = $null
@("night_shift_worker_anthropic.ps1", "night_shift_worker_openai.ps1", "night_shift_worker_ollama.ps1", "night_shift_worker.ps1") | ForEach-Object {
  $path = "scripts\$_"
  if (Test-Path $path) {
    $workerScript = $path
    Write-LogLine "Detected worker: $workerScript"
    return
  }
}

while ($done -lt $maxTickets) {
  $ticket = Get-NextReadyTicket
  if ($null -eq $ticket) {
    Write-LogLine "No READY tickets found. Stopping."
    break
  }

  $title = $ticket.Title
  $slug = Slugify $title
  $branch = "feat/nightshift/$slug"

  Write-LogLine "=== Ticket $($done+1)/$maxTickets: $title ==="
  Write-LogLine "Branch: $branch"

  # Create branch from main
  git fetch origin 2>&1 | Out-Null
  git checkout main 2>&1 | Out-Null
  git pull origin main 2>&1 | Out-Null
  git checkout -b $branch 2>&1 | Out-Null

  # Invoke worker (if exists)
  if ($workerScript) {
    Write-LogLine "Invoking worker..."
    try {
      & $workerScript -TicketTitle $title -TicketBody $ticket.Body
    } catch {
      Write-LogLine "WORKER FAILED: $_"
      Write-LogLine "Leaving branch for manual review."
      break
    }
  } else {
    Write-LogLine "No worker script found. Proceeding with tests/build only."
  }

  # Run tests
  Write-LogLine "Running tests..."
  $testOut = Run-And-Capture "pnpm test --run"
  $testProof = Save-Proof $slug "tests" $testOut

  # Run build
  Write-LogLine "Running build..."
  $buildOut = Run-And-Capture "pnpm -r build"
  $buildProof = Save-Proof $slug "build" $buildOut

  # Run Playwright smoke test (headless, quick check for UI breakage)
  Write-LogLine "Running Playwright smoke test..."
  $smokeOut = Run-And-Capture "pnpm exec playwright test tests/e2e/night-shift-smoke.spec.ts --project=chromium"
  $smokeProof = Save-Proof $slug "smoke" $smokeOut

  # Check for failures
  $testFailed = ($testOut -match "(?im)FAIL\b" -or $testOut -match "(?im)failed")
  $buildFailed = ($buildOut -match "(?im)\berror\b")
  $smokeFailed = ($smokeOut -match "(?im)failed" -or $smokeOut -match "(?im)\berror\b")

  if ($testFailed -or $buildFailed -or $smokeFailed) {
    Write-LogLine "FAIL: Tests, build, or smoke test indicate failure."
    Write-LogLine "Proof: $testProof ; $buildProof ; $smokeProof"
    Write-LogLine "Leaving branch for review."
    break
  }

  # If there are changes, commit them
  $changes = git status --porcelain
  if ($changes) {
    git add -A 2>&1 | Out-Null
    $msg = "feat(nightshift): $title`n`nImplemented via Night Shift automation.`n`nProof:`n- Tests: $testProof`n- Build: $buildProof`n- Smoke: $smokeProof"
    git commit -m $msg 2>&1 | Out-Null
    Write-LogLine "Changes committed."
  } else {
    Write-LogLine "No code changes detected; skipping PR."
    $done++
    continue
  }

  # Push and open PR
  Write-LogLine "Pushing branch..."
  git push -u origin $branch 2>&1 | Out-Null

  $prBody = @"
**Night Shift automated PR**

Ticket: $title

**Proof**:
- Tests: ``ops/proof/$slug-tests.txt``
- Build: ``ops/proof/$slug-build.txt``
- Smoke: ``ops/proof/$slug-smoke.txt``
- Patch: ``ops/proof/$slug-patch.diff`` (if generated)

**Acceptance Checklist**:
See ticket in ``ops/NIGHT_SHIFT_QUEUE.md`` for full criteria.

**Rollback**:
``git revert <commit-sha>`` or ``git reset --hard origin/main && git push --force``
"@

  Write-LogLine "Opening PR..."
  $prUrl = gh pr create --base main --head $branch --title "Night Shift: $title" --body $prBody 2>&1 | Out-String
  Write-LogLine "PR opened: $prUrl"

  # Mark ticket as PR_OPEN in queue (simple sed-like replace)
  $queuePath = "ops/NIGHT_SHIFT_QUEUE.md"
  $queueContent = Get-Content $queuePath -Raw
  $queueContent = $queueContent -replace "(\*\*Status\*\*:\s*)READY", "`$1PR_OPEN"
  Set-Content -Path $queuePath -Value $queueContent -Encoding UTF8 -NoNewline

  $done++
}

Write-LogLine "=== Night Shift end (completed $done ticket(s)) ==="
