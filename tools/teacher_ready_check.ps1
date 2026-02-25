<#
.SYNOPSIS
  One-command lab readiness check — run the Vivado smoke suite and print a go/no-go verdict.

.DESCRIPTION
  Resolves the current git commit SHA, delegates to vivado_smoke.ps1 for the full
  export + Vivado build pipeline, then prints a concise verdict:

    READY FOR LAB   — all examples built a bitstream; includes commit SHA
    NOT READY       — one or more examples failed; points to result.json logs

  Exit code mirrors vivado_smoke.ps1: 0 = all pass, 1 = any failure.

.PARAMETER VivadoPath
  Forwarded verbatim to vivado_smoke.ps1. Optional — auto-discovered if omitted.

.PARAMETER Examples
  Comma-separated list of example IDs. Default: signal-tour,logic-gates,two-bit-counter

.PARAMETER OutRoot
  Root folder for build artifacts. Default: dist\smoke

.EXAMPLE
  # Quick check with auto-detected Vivado
  .\tools\teacher_ready_check.ps1

.EXAMPLE
  # Override Vivado path
  .\tools\teacher_ready_check.ps1 -VivadoPath "D:\Xilinx\Vivado\2024.2\bin\vivado.bat"

.EXAMPLE
  # Check only the counter example
  .\tools\teacher_ready_check.ps1 -Examples two-bit-counter
#>

param(
  [string]$VivadoPath = '',
  [string]$Examples   = 'signal-tour,logic-gates,two-bit-counter',
  [string]$OutRoot    = 'dist\smoke'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot    = Split-Path -Parent $PSScriptRoot
$SmokeScript = Join-Path $PSScriptRoot 'vivado_smoke.ps1'

if (-not (Test-Path $SmokeScript)) {
  Write-Host "ERROR: Missing smoke script: $SmokeScript"
  exit 1
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

# ── Run smoke test ─────────────────────────────────────────────────────────────

$smokeArgs = @('-Examples', $Examples, '-OutRoot', $OutRoot)
if ($VivadoPath) { $smokeArgs += @('-VivadoPath', $VivadoPath) }

& $SmokeScript @smokeArgs
$smokeExit = $LASTEXITCODE

# ── Verdict ────────────────────────────────────────────────────────────────────

Write-Host ''
Write-Host '══════════════════════════════════════════════════════════'

if ($smokeExit -eq 0) {
  Write-Host '  READY FOR LAB'
  if ($CommitSha) { Write-Host "  sha: $CommitSha" }
} else {
  Write-Host "  NOT READY — one or more examples failed"
  if ($CommitSha) { Write-Host "  sha: $CommitSha" }
  $OutRootAbs = Join-Path $RepoRoot $OutRoot
  Write-Host "  See result.json files under: $OutRootAbs"
}

Write-Host '══════════════════════════════════════════════════════════'
Write-Host ''

exit $smokeExit
