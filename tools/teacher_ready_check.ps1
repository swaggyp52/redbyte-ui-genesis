<#
.SYNOPSIS
  One-command lab readiness check — deploy verification, then Vivado smoke.

.DESCRIPTION
  Two-stage gate (fast gate first to avoid wasting the slow Vivado run):

    Stage 1 — Deploy check
      Fetches https://redbyteapps.dev/os/version.json and confirms the deployed
      SHA matches origin/main. Fails fast if site is stale — no point running a
      15-minute smoke build if students will hit an old version anyway.

    Stage 2 — Vivado smoke suite
      Exports Verilog + XDC for each shipped example, runs Vivado batch, checks
      that a .bit file was produced. Only runs if Stage 1 passes (or -SkipDeploy).

  SHA used for comparison is origin/main (after a quick git fetch), not local HEAD.
  This aligns with what Cloudflare Pages actually deploys on a push to main.
  Resolution order: git fetch origin → origin/main → fallback to local HEAD.

  Final verdict:
    READY FOR LAB   — both stages pass
    NOT READY       — lists every failing stage with reason + next action
    sha: <commit>   — always printed

  Exit code: 0 = all pass, 1 = any failure

.PARAMETER VivadoPath
  Forwarded verbatim to vivado_smoke.ps1. Optional — auto-discovered if omitted.

.PARAMETER Examples
  Comma-separated list of example IDs. Default: signal-tour,logic-gates,two-bit-counter

.PARAMETER OutRoot
  Root folder for build artifacts. Default: dist\smoke

.PARAMETER SkipDeploy
  Skip both deploy SHA check stages and go straight to smoke.
  Use when: working offline, deploy is intentionally in flight, or testing unreleased code.

.PARAMETER AllowDeployUnknown
  Treat a deploy endpoint fetch failure (network error, site down) as a warning instead of
  a hard failure. Smoke will still run. Use at your own risk in a monitored environment.

.EXAMPLE
  # Full pre-class check (normal case)
  .\tools\teacher_ready_check.ps1

.EXAMPLE
  # Offline or deploy in flight
  .\tools\teacher_ready_check.ps1 -SkipDeploy

.EXAMPLE
  # Network unreliable but you confirmed deploy manually
  .\tools\teacher_ready_check.ps1 -AllowDeployUnknown

.EXAMPLE
  # Override Vivado path
  .\tools\teacher_ready_check.ps1 -VivadoPath "D:\Xilinx\Vivado\2024.2\bin\vivado.bat"
#>

param(
  [string]$VivadoPath        = '',
  [string]$Examples          = 'signal-tour,logic-gates,two-bit-counter',
  [string]$OutRoot           = 'dist\smoke',
  [switch]$SkipDeploy,
  [switch]$AllowDeployUnknown
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot     = Split-Path -Parent $PSScriptRoot
$SmokeScript  = Join-Path $PSScriptRoot 'vivado_smoke.ps1'
$DeployScript = Join-Path $PSScriptRoot 'check_deploy.ps1'

if (-not (Test-Path $SmokeScript)) {
  Write-Host "ERROR: Missing required script: $SmokeScript"
  exit 1
}

# ── Resolve SHA (origin/main after fetch, fallback to HEAD) ───────────────────

$CommitSha    = ''
$ShaSource    = ''

try {
  & git -C $RepoRoot fetch origin --quiet 2>$null
  $CommitSha = (& git -C $RepoRoot rev-parse origin/main 2>$null).Trim()
  if ($CommitSha) { $ShaSource = 'origin/main' }
} catch {}

if (-not $CommitSha) {
  try {
    $CommitSha = (& git -C $RepoRoot rev-parse HEAD 2>$null).Trim()
    if ($CommitSha) { $ShaSource = 'HEAD (fallback)' }
  } catch {}
}

# ── Header ─────────────────────────────────────────────────────────────────────

Write-Host ''
Write-Host '══════════════════════════════════════════════════════════'
Write-Host '  RedByte Teacher Lab Readiness Check'
if ($CommitSha) { Write-Host "  SHA    : $CommitSha  ($ShaSource)" }
Write-Host '══════════════════════════════════════════════════════════'
Write-Host ''

# ── Stage 1: Deploy check (fast — fail before running the expensive smoke) ────

$deployExit = 0

if ($SkipDeploy) {
  Write-Host '[Stage 1/2] Deploy check: SKIPPED (-SkipDeploy)'
} elseif (-not (Test-Path $DeployScript)) {
  Write-Host '[Stage 1/2] Deploy check: SKIPPED (check_deploy.ps1 not found)'
} else {
  Write-Host '[Stage 1/2] Deploy check'
  & $DeployScript -CommitSha $CommitSha
  $deployExit = $LASTEXITCODE

  # Exit code 2 = fetch failed. Treat as hard failure unless -AllowDeployUnknown.
  if ($deployExit -eq 2 -and $AllowDeployUnknown) {
    Write-Host '  (continuing despite fetch failure — -AllowDeployUnknown is set)'
    $deployExit = 0
  }

  # Bail early on deploy failure — no point burning Vivado time if site is stale.
  if ($deployExit -ne 0) {
    Write-Host ''
    Write-Host '══════════════════════════════════════════════════════════'
    Write-Host '  NOT READY — deploy check failed, Vivado smoke not run'
    if ($deployExit -eq 1) {
      Write-Host '    [FAIL] Site is serving a different commit'
      Write-Host '           Push to main and wait for CI, or use -SkipDeploy'
    } else {
      Write-Host '    [FAIL] Could not reach version endpoint'
      Write-Host '           Check network, or use -AllowDeployUnknown / -SkipDeploy'
    }
    if ($CommitSha) { Write-Host "  sha: $CommitSha" }
    Write-Host '══════════════════════════════════════════════════════════'
    Write-Host ''
    exit 1
  }
}

Write-Host ''

# ── Stage 2: Vivado smoke ──────────────────────────────────────────────────────

Write-Host '[Stage 2/2] Vivado smoke build'
Write-Host ''

$smokeArgs = @('-Examples', $Examples, '-OutRoot', $OutRoot)
if ($VivadoPath) { $smokeArgs += @('-VivadoPath', $VivadoPath) }

& $SmokeScript @smokeArgs
$smokeExit = $LASTEXITCODE

# ── Final verdict ──────────────────────────────────────────────────────────────

$allPassed = ($deployExit -eq 0) -and ($smokeExit -eq 0)

Write-Host ''
Write-Host '══════════════════════════════════════════════════════════'

if ($allPassed) {
  Write-Host '  READY FOR LAB'
} else {
  Write-Host '  NOT READY'
  if ($smokeExit -ne 0) {
    $OutRootAbs = Join-Path $RepoRoot $OutRoot
    Write-Host "    [FAIL] Smoke build — check result.json files under $OutRootAbs"
  }
}

if ($CommitSha) { Write-Host "  sha: $CommitSha" }
Write-Host '══════════════════════════════════════════════════════════'
Write-Host ''

if ($allPassed) { exit 0 } else { exit 1 }
