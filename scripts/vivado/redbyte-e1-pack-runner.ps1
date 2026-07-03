<#
Create a portable RedByte Vivado E1 runner kit.

The generated folder/ZIP is local proof handoff material under .redbyte/ and
must not be committed. The tracked source of truth remains this script plus the
E1 harness and docs.
#>

[CmdletBinding()]
param(
  [string]$OutDir = '.redbyte/vivado-e1-run-kit',
  [string]$PackageDir = '.redbyte/product-immersion/vivado-grade-export-audit/downloads',
  [string[]]$DesignIds = @('logic-gates', 'half-adder', 'full-adder', 'four-bit-adder', 'two-bit-counter'),
  [string]$ProductionUrl = 'https://redbyteapps.dev/os',
  [string]$ProductionSha = '',
  [string]$VivadoTarget = 'Vivado 2024.2',
  [switch]$NoZip
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$StartedAt = (Get-Date).ToUniversalTime()
$Timestamp = $StartedAt.ToString('yyyyMMddTHHmmssfffZ')

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
  $Value | ConvertTo-Json -Depth 50 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Get-GitValue([string[]]$Arguments) {
  try {
    return ((& git -C $RepoRoot @Arguments 2>$null) | Out-String).Trim()
  } catch {
    return ''
  }
}

function Get-JsonEndpoint([string]$Uri) {
  try {
    return Invoke-RestMethod -Uri $Uri -Method Get -TimeoutSec 20
  } catch {
    return $null
  }
}

function Copy-RepoFile([string]$RelativePath, [string]$KitRoot) {
  $source = Join-Path $RepoRoot $RelativePath
  if (!(Test-Path -LiteralPath $source)) {
    return $false
  }

  $destination = Join-Path $KitRoot $RelativePath
  New-Directory (Split-Path -Parent $destination)
  Copy-Item -LiteralPath $source -Destination $destination -Force
  return $true
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

$KitBase = Resolve-RepoPath $OutDir
$KitRoot = Join-Path $KitBase $Timestamp
$PackagesRoot = Join-Path $KitRoot 'packages'
New-Directory $KitRoot
New-Directory $PackagesRoot

$versionEndpoint = ('{0}/version.json' -f $ProductionUrl.TrimEnd('/'))
$buildEndpoint = ('{0}/build.json' -f $ProductionUrl.TrimEnd('/'))
$productionVersion = Get-JsonEndpoint $versionEndpoint
$productionBuild = Get-JsonEndpoint $buildEndpoint
$gitSha = Get-GitValue @('rev-parse', 'HEAD')
$gitBranch = Get-GitValue @('branch', '--show-current')
$originMain = Get-GitValue @('rev-parse', 'origin/main')
$resolvedProductionSha = if ($ProductionSha.Trim().Length -gt 0) {
  $ProductionSha
} elseif ($null -ne $productionVersion -and $productionVersion.PSObject.Properties.Name -contains 'sha') {
  [string]$productionVersion.sha
} else {
  ''
}

$copiedSourceFiles = @()
foreach ($relative in @(
    'scripts/vivado/redbyte-e1-certify.ps1',
    'scripts/vivado/redbyte-e1-certify.tcl',
    'scripts/vivado/redbyte-e1-collect.ps1',
    'docs/product/RED_BYTE_VIVADO_E1_CERTIFICATION_PROTOCOL.md',
    'docs/product/RED_BYTE_VIVADO_E1_RESULT_TEMPLATE.md',
    'docs/product/RED_BYTE_VIVADO_E1_RUNBOOK_FOR_GANNON.md',
    'docs/product/RED_BYTE_E1_LAB_MACHINE_CHECKLIST.md'
  )) {
  if (Copy-RepoFile $relative $KitRoot) {
    $copiedSourceFiles += $relative
  }
}

$sourcePackageRoot = Resolve-RepoPath $PackageDir
$packageRecords = @()
foreach ($designId in $DesignIds) {
  $zip = Find-DesignZip $sourcePackageRoot $designId
  if ($null -eq $zip) {
    $packageRecords += [ordered]@{
      designId = $designId
      status = 'missing'
      source = $sourcePackageRoot
      copiedTo = $null
    }
    continue
  }

  $destination = Join-Path $PackagesRoot $zip.Name
  Copy-Item -LiteralPath $zip.FullName -Destination $destination -Force
  $packageRecords += [ordered]@{
    designId = $designId
    status = 'copied'
    source = $zip.FullName
    copiedTo = $destination
    sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $destination).Hash.ToLowerInvariant()
  }
}

$packageReadme = @(
  '# RedByte E1 package inputs',
  '',
  'Place the RedByte/Vivado ZIP exports for the five target designs in this folder if they were not copied automatically.',
  '',
  'Expected design IDs:',
  ''
)
foreach ($designId in $DesignIds) {
  $packageReadme += ('- {0}' -f $designId)
}
$packageReadme += ''
$packageReadme += 'Collection command from a full RedByte repo clone:'
$packageReadme += ''
$packageReadme += '```powershell'
$packageReadme += 'powershell -ExecutionPolicy Bypass -File scripts/vivado/redbyte-e1-collect.ps1 -OutDir .redbyte/vivado-e1-packages'
$packageReadme += '```'
Set-Content -LiteralPath (Join-Path $PackagesRoot 'README.md') -Value $packageReadme -Encoding UTF8

$runTimestamp = '<timestamp>'
$readme = @(
  '# RedByte Vivado E1 Run Kit',
  '',
  ('Generated: {0}' -f $StartedAt.ToString('o')),
  ('Production URL: {0}' -f $ProductionUrl),
  ('Production SHA: {0}' -f $(if ($resolvedProductionSha) { $resolvedProductionSha } else { 'unknown' })),
  ('Local HEAD when packed: {0}' -f $gitSha),
  ('Vivado target: {0}' -f $VivadoTarget),
  '',
  '## What This Proves',
  '',
  'This kit is for Vivado E1 only: import/open project, compile-order readiness, behavioral simulation/testbench when present, and synthesis. Optional E1e is an implementation dry run through route_design without claiming bitstream success.',
  '',
  'This kit does not prove E2 bitstream generation, Basys3 programming, or E3 observed board behavior.',
  '',
  '## Preferred Lab-Machine Flow',
  '',
  'Use a Windows lab machine with Vivado 2024.2 installed. Open PowerShell from a full RedByte repo clone, then run:',
  '',
  '```powershell',
  'git fetch origin',
  'git checkout main',
  'git pull --ff-only origin main',
  'git rev-parse HEAD',
  'powershell -ExecutionPolicy Bypass -File scripts/vivado/redbyte-e1-collect.ps1 -OutDir .redbyte/vivado-e1-packages',
  ('powershell -ExecutionPolicy Bypass -File scripts/vivado/redbyte-e1-certify.ps1 -Mode Certify -PackageDir .redbyte/vivado-e1-packages -OutDir .redbyte/vivado-e1/{0}' -f $runTimestamp),
  '```',
  '',
  'The `git rev-parse HEAD` output should match the intended pushed SHA before the run. If it does not, stop and report the mismatch.',
  '',
  '## One-Command Certification Shape',
  '',
  'If ZIPs are already collected in one folder, run this from the repo root:',
  '',
  '```powershell',
  ('powershell -ExecutionPolicy Bypass -File scripts/vivado/redbyte-e1-certify.ps1 -Mode Certify -PackageDir <folder-with-redbyte-zips> -OutDir .redbyte/vivado-e1/{0}' -f $runTimestamp),
  '```',
  '',
  '## Kit Package Folder',
  '',
  'This kit contains a `packages/` folder. If it includes the five ZIPs, the lab machine can use that folder as `<folder-with-redbyte-zips>`. If it does not, collect production ZIPs through RedByte Export and put them there.',
  '',
  '## Required Return Artifacts',
  '',
  'Send back these files from the output folder:',
  '',
  '- `manifest.json`',
  '- `results.md`',
  '- `environment.json`',
  '- `package-summary.json`',
  '- the full `designs/` and `logs/` folders',
  '',
  '## Classifications',
  '',
  '- `PASS_E1`: Vivado E1 completed for that design.',
  '- `FAIL_IMPORT`: package shape, project open, or import failed.',
  '- `FAIL_COMPILE`: compile order/elaboration readiness failed.',
  '- `FAIL_TESTBENCH`: behavioral simulation/testbench failed.',
  '- `FAIL_SYNTH`: synthesis failed.',
  '- `FAIL_IMPL_DRY_RUN`: optional implementation dry run failed.',
  '- `BLOCKED_NO_VIVADO`: Vivado is not installed or discoverable. This is a toolchain blocker, not a product pass.',
  '- `BLOCKED_PACKAGE_MISSING`: no ZIP was available for the design.',
  '- `BLOCKED_UNSUPPORTED_CONSTRUCT`: static audit found a construct that should not be certified.',
  '',
  'If Vivado fails, do not guess. Preserve and send the logs.'
)
Set-Content -LiteralPath (Join-Path $KitRoot 'README.md') -Value $readme -Encoding UTF8

$metadata = [ordered]@{
  schema = 'redbyte.vivado-e1.run-kit.v1'
  generatedAt = $StartedAt.ToString('o')
  kitRoot = $KitRoot
  production = [ordered]@{
    url = $ProductionUrl
    versionEndpoint = $versionEndpoint
    buildEndpoint = $buildEndpoint
    sha = $resolvedProductionSha
    version = $productionVersion
    build = $productionBuild
  }
  git = [ordered]@{
    branch = $gitBranch
    sha = $gitSha
    originMain = $originMain
    statusShort = Get-GitValue @('status', '--short', '--branch')
  }
  vivadoTarget = $VivadoTarget
  designIds = $DesignIds
  sourcePackageRoot = $sourcePackageRoot
  copiedSourceFiles = $copiedSourceFiles
  packageRecords = $packageRecords
  boundaries = @(
    'E1 only',
    'No bitstream E2 claim',
    'No board programming claim',
    'No observed Basys3 E3 claim'
  )
}
Write-JsonFile $metadata (Join-Path $KitRoot 'metadata.json')
Write-JsonFile ([ordered]@{
    schema = 'redbyte.vivado-e1.run-kit.packages.v1'
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    packageRecords = $packageRecords
  }) (Join-Path $PackagesRoot 'package-inventory.json')

$zipPath = $null
if (!$NoZip) {
  $zipPath = "$KitRoot.zip"
  if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
  }
  Compress-Archive -Path (Join-Path $KitRoot '*') -DestinationPath $zipPath -Force
}

Write-Host ("RedByte E1 run kit: {0}" -f $KitRoot)
if ($zipPath) {
  Write-Host ("RedByte E1 run kit ZIP: {0}" -f $zipPath)
}
Write-Host ("RedByte E1 run kit packages copied: {0}" -f (@($packageRecords | Where-Object { $_.status -eq 'copied' }).Count))
