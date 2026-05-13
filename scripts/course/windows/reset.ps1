[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [switch]$DryRun,
  [switch]$ConfirmReset,
  [switch]$IncludeDependencies
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

. (Join-Path $PSScriptRoot "common.ps1")

$RepoRoot = Resolve-RedByteRepoRoot -StartPath $PSScriptRoot
Set-Location -LiteralPath $RepoRoot

function Assert-SafeCourseCleanupPath {
  param(
    [Parameter(Mandatory = $true)][string]$RelativePath
  )

  if ([string]::IsNullOrWhiteSpace($RelativePath)) {
    throw "Refusing to clean an empty path."
  }

  $rootFull = [System.IO.Path]::GetFullPath($RepoRoot).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
  $targetFull = [System.IO.Path]::GetFullPath((Join-Path $RepoRoot $RelativePath))
  $rootPrefix = $rootFull + [System.IO.Path]::DirectorySeparatorChar

  if ($targetFull -eq $rootFull -or -not $targetFull.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to clean unsafe path: $targetFull"
  }

  $blockedNames = @("exports", "student-exports", "submissions", "downloads")
  foreach ($name in $blockedNames) {
    if ($targetFull -match "\\$([regex]::Escape($name))(\\|$)") {
      throw "Refusing to clean possible student project exports: $targetFull"
    }
  }

  return $targetFull
}

$targets = @(
  ".redbyte/course/logs",
  ".redbyte/course/tmp",
  ".tmp/course",
  ".vite",
  "apps/playground/dist",
  "dist",
  "dist.staged",
  "test-results",
  "playwright-report",
  "coverage"
)

if ($IncludeDependencies) {
  $targets += @("node_modules")
}

$effectiveDryRun = $DryRun -or -not $ConfirmReset

Write-Host "RedByte ECE141 reset" -ForegroundColor Cyan
Write-Host "Repo: $RepoRoot" -ForegroundColor DarkGray
Write-RbWarn "This script never deletes source files or student project exports by default."

if ($effectiveDryRun) {
  Write-RbWarn "-DryRun mode is active. Add -ConfirmReset to actually remove allowlisted generated files."
}

try {
  foreach ($relativePath in $targets) {
    $target = Assert-SafeCourseCleanupPath -RelativePath $relativePath
    if (-not (Test-Path -LiteralPath $target)) {
      Write-Host "SKIP $relativePath (not present)" -ForegroundColor DarkGray
      continue
    }

    if ($effectiveDryRun) {
      Write-Host "DRY  $relativePath" -ForegroundColor Yellow
      continue
    }

    if ($PSCmdlet.ShouldProcess($target, "Remove generated RedByte course artifact")) {
      Remove-Item -LiteralPath $target -Recurse -Force
      Write-RbPass "Removed $relativePath"
    }
  }

  if ($effectiveDryRun) {
    Write-Host "No files were removed." -ForegroundColor Green
  }
  else {
    Write-Host "Reset complete. Run .\setup.ps1 if dependencies or build outputs were removed." -ForegroundColor Green
  }

  exit 0
}
catch {
  Write-RbFail $_.Exception.Message
  exit 1
}
