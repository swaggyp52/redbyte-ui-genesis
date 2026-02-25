<#
.SYNOPSIS
  Verify that the live RedByte site serves the expected commit SHA.

.DESCRIPTION
  Fetches https://redbyteapps.dev/os/version.json and compares the "sha" field
  against the local git HEAD (or a SHA passed explicitly).

  Exit codes:
    0  — deployed SHA matches local commit
    1  — DEPLOY MISMATCH (site is stale or ahead)
    2  — fetch failed (network issue or site down)

.PARAMETER CommitSha
  SHA to compare against. Defaults to local git rev-parse HEAD.

.PARAMETER Url
  URL of the version endpoint. Defaults to https://redbyteapps.dev/os/version.json

.EXAMPLE
  # Basic check
  .\tools\check_deploy.ps1

.EXAMPLE
  # Pass an explicit SHA (e.g. from CI)
  .\tools\check_deploy.ps1 -CommitSha "abc123def456"

.EXAMPLE
  # Test against a staging URL
  .\tools\check_deploy.ps1 -Url "https://staging.example.dev/os/version.json"
#>

param(
  [string]$CommitSha = '',
  [string]$Url       = 'https://redbyteapps.dev/os/version.json'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot

# ── Resolve local SHA ─────────────────────────────────────────────────────────
# Prefer origin/main (what Pages deploys) over local HEAD.
# Resolution order: -CommitSha arg → origin/main (after fetch) → HEAD (fallback)

if (-not $CommitSha) {
  try {
    & git -C $RepoRoot fetch origin --quiet 2>$null
    $CommitSha = (& git -C $RepoRoot rev-parse origin/main 2>$null).Trim()
  } catch {}
}
if (-not $CommitSha) {
  try { $CommitSha = (& git -C $RepoRoot rev-parse HEAD 2>$null).Trim() } catch {}
}

# ── Fetch deployed version ─────────────────────────────────────────────────────

Write-Host "  Checking : $Url"
Write-Host "  Local SHA: $CommitSha"

$deployedSha  = ''
$deployedTime = ''

try {
  $versionJson  = Invoke-RestMethod -Uri $Url -TimeoutSec 15
  $deployedSha  = $versionJson.sha
  $deployedTime = $versionJson.builtAt
} catch {
  Write-Host "  DEPLOY CHECK FAILED: could not fetch version endpoint"
  Write-Host "    $($_.Exception.Message)"
  exit 2
}

Write-Host "  Deployed : $deployedSha  (built $deployedTime)"

# ── Compare ───────────────────────────────────────────────────────────────────

if ($deployedSha -eq $CommitSha) {
  Write-Host "  DEPLOY CHECK PASSED"
  exit 0
} else {
  Write-Host "  DEPLOY MISMATCH"
  Write-Host "    local    : $CommitSha"
  Write-Host "    deployed : $deployedSha"
  exit 1
}
