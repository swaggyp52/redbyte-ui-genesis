<# 
Collect or generate RedByte Vivado E1 candidate ZIP packages.

This helper is intentionally only a package collector. It does not run Vivado
and does not make E1/E2/E3 claims.
#>

[CmdletBinding()]
param(
  [ValidateSet('ExistingZipDir', 'LocalGenerated', 'Production')]
  [string]$Mode = 'ExistingZipDir',

  [string]$InputZipDir = '.redbyte/product-immersion/vivado-grade-export-audit/downloads',
  [string]$OutputZipDir = '.redbyte/vivado-e1-inputs',
  [string[]]$DesignIds = @('logic-gates', 'half-adder', 'full-adder', 'four-bit-adder', 'two-bit-counter'),
  [string]$ProductionUrl = 'https://redbyteapps.dev/os'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))

function Resolve-RepoPath([string]$Path) {
  if ([System.IO.Path]::IsPathRooted($Path)) {
    return [System.IO.Path]::GetFullPath($Path)
  }
  return [System.IO.Path]::GetFullPath((Join-Path $RepoRoot $Path))
}

function New-Directory([string]$Path) {
  if (!(Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Write-JsonFile($Value, [string]$Path) {
  $Value | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Find-DesignZip([string]$Root, [string]$DesignId) {
  if (!(Test-Path -LiteralPath $Root)) {
    return $null
  }
  return Get-ChildItem -LiteralPath $Root -Filter '*.zip' -File -Recurse |
    Where-Object { $_.Name -like "*$DesignId*" } |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1
}

$OutputZipDir = Resolve-RepoPath $OutputZipDir
New-Directory $OutputZipDir

$records = @()

switch ($Mode) {
  'ExistingZipDir' {
    $sourceRoot = Resolve-RepoPath $InputZipDir
    foreach ($designId in $DesignIds) {
      $zip = Find-DesignZip $sourceRoot $designId
      if ($null -eq $zip) {
        $records += [ordered]@{
          designId = $designId
          status = 'missing'
          source = $sourceRoot
          copiedTo = $null
        }
        continue
      }

      $destination = Join-Path $OutputZipDir $zip.Name
      Copy-Item -LiteralPath $zip.FullName -Destination $destination -Force
      $records += [ordered]@{
        designId = $designId
        status = 'copied'
        source = $zip.FullName
        copiedTo = $destination
        sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $destination).Hash.ToLowerInvariant()
      }
    }
  }

  'LocalGenerated' {
    foreach ($designId in $DesignIds) {
      $script = Join-Path $RepoRoot 'scripts/vivado-cert-export-ide-example.ts'
      $args = @('pnpm', 'exec', 'tsx', $script, $designId)
      $output = & corepack @args 2>&1
      $exitCode = $LASTEXITCODE
      if ($exitCode -ne 0) {
        $records += [ordered]@{
          designId = $designId
          status = 'generation-failed'
          exitCode = $exitCode
          output = ($output | Out-String).Trim()
        }
        continue
      }

      $generatedRoot = Join-Path $RepoRoot ("out/vivado-cert/examples/{0}" -f $designId)
      $zip = Find-DesignZip $generatedRoot $designId
      if ($null -eq $zip) {
        $records += [ordered]@{
          designId = $designId
          status = 'generated-but-zip-missing'
          source = $generatedRoot
        }
        continue
      }

      $destination = Join-Path $OutputZipDir $zip.Name
      Copy-Item -LiteralPath $zip.FullName -Destination $destination -Force
      $records += [ordered]@{
        designId = $designId
        status = 'generated'
        source = $zip.FullName
        copiedTo = $destination
        sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $destination).Hash.ToLowerInvariant()
      }
    }
  }

  'Production' {
    $records += [ordered]@{
      status = 'production-browser-collection-not-run'
      productionUrl = $ProductionUrl
      note = 'Mode accepted for E1 workflow bookkeeping. Use an explicit browser proof/download pass, then rerun ExistingZipDir against the downloaded ZIP directory.'
      designIds = $DesignIds
    }
  }
}

$summary = [ordered]@{
  schema = 'redbyte.vivado-e1.collect.v1'
  generatedAt = (Get-Date).ToUniversalTime().ToString('o')
  mode = $Mode
  outputZipDir = $OutputZipDir
  records = $records
}

Write-JsonFile $summary (Join-Path $OutputZipDir 'collection-summary.json')
$summary | ConvertTo-Json -Depth 20
