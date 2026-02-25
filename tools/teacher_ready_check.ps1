<#
.SYNOPSIS
  One-command lab readiness check — smoke build + live deploy verification.

.DESCRIPTION
  Two-stage gate:

    Stage 1 — Vivado smoke suite
      Exports Verilog + XDC for each shipped example, runs Vivado batch, checks .bit file.

    Stage 2 — Deploy check (can be skipped with -SkipDeploy)
      Fetches https://redbyteapps.dev/os/version.json and confirms the deployed SHA
      matches local git HEAD. Eliminates "fixed last night, site still old" failures.

  Final verdict:
    READY FOR LAB   — both stages pass
    NOT READY       — lists every stage that failed with a reason
    sha: <commit>   — always printed so you can verify manually

  Exit code: 0 = all pass, 1 = any failure

.PARAMETER VivadoPath
  Forwarded verbatim to vivado_smoke.ps1. Optional — auto-discovered if omitted.

.PARAMETER Examples
  Comma-separated list of example IDs. Default: signal-tour,logic-gates,two-bit-counter

.PARAMETER OutRoot
  Root folder for build artifacts. Default: dist\smoke

.PARAMETER SkipDeploy
  Skip the deploy SHA check. Use when you know the deploy is pending or working offline.

.EXAMPLE
  # Full pre-class check
  .\tools\teacher_ready_check.ps1

.EXAMPLE
  # Skip deploy check (offline / deploy in flight)
  .\tools\teacher_ready_check.ps1 -SkipDeploy

.EXAMPLE
  # Override Vivado path
  .\tools\teacher_ready_check.ps1 -VivadoPath "D:\Xilinx\Vivado\2024.2\bin\vivado.bat"
#>

param(
  [string]$VivadoPath  = '',
  [string]$Examples    = 'signal-tour,logic-gates,two-bit-counter',
  [string]$OutRoot     = 'dist\smoke',
  [switch]$SkipDeploy
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot         = Split-Path -Parent $PSScriptRoot
$SmokeScript      = Join-Path $PSScriptRoot 'vivado_smoke.ps1'
$DeployScript     = Join-Path $PSScriptRoot 'check_deploy.ps1'

foreach ($required in @($SmokeScript)) {
  if (-not (Test-Path $required)) {
    Write-Host "ERROR: Missing required script: $required"
    exit 1
  }
}

# ── Repo commit SHA ────────────────────────────────────────────────────────────

$CommitSha = ''
try { $CommitSha = (& git -C $RepoRoot rev-parse HEAD 2>$null).Trim() } catch {}

# ── Header ─────────────────────────────────────────────────────────────────────

Write-Host ''
Write-Host '══════════════════════════════════════════════════════════'
Write-Host '  RedByte Teacher Lab Readiness Check'
if ($CommitSha) { Write-Host "  Commit : $CommitSha" }
Write-Host '══════════════════════════════════════════════════════════'
Write-Host ''

# ── Stage 1: Vivado smoke ──────────────────────────────────────────────────────

Write-Host '[Stage 1/2] Vivado smoke build'
Write-Host ''

$smokeArgs = @('-Examples', $Examples, '-OutRoot', $OutRoot)
if ($VivadoPath) { $smokeArgs += @('-VivadoPath', $VivadoPath) }

& $SmokeScript @smokeArgs
$smokeExit = $LASTEXITCODE

# ── Stage 2: Deploy check ─────────────────────────────────────────────────────

$deployExit = 0

if ($SkipDeploy) {
  Write-Host ''
  Write-Host '[Stage 2/2] Deploy check: SKIPPED (-SkipDeploy)'
} elseif (-not (Test-Path $DeployScript)) {
  Write-Host ''
  Write-Host '[Stage 2/2] Deploy check: SKIPPED (check_deploy.ps1 not found)'
} else {
  Write-Host ''
  Write-Host '[Stage 2/2] Deploy check'
  & $DeployScript -CommitSha $CommitSha
  $deployExit = $LASTEXITCODE
}

# ── Verdict ────────────────────────────────────────────────────────────────────

$allPassed = ($smokeExit -eq 0) -and ($deployExit -eq 0)

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
  if ($deployExit -eq 1) {
    Write-Host '    [FAIL] Deploy mismatch — site is serving a different commit'
    Write-Host '           Push and wait for CI to deploy, or use -SkipDeploy if intentional'
  }
  if ($deployExit -eq 2) {
    Write-Host '    [WARN] Deploy check failed (network error) — verify manually:'
    Write-Host '           https://redbyteapps.dev/os/version.json'
  }
}

if ($CommitSha) { Write-Host "  sha: $CommitSha" }
Write-Host '══════════════════════════════════════════════════════════'
Write-Host ''

if ($allPassed) { exit 0 } else { exit 1 }
