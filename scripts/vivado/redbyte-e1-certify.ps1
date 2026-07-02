<#
Run a RedByte Vivado E1 certification checkpoint.

This wrapper creates a durable proof folder under .redbyte/vivado-e1/<timestamp>/.
It can run as:
  - EnvCheck: records local environment and Vivado discovery only.
  - DryRun: inspects candidate ZIP packages and records whether a real E1 run is blocked.
  - Certify: runs Vivado through E1a-E1d, plus optional E1e route-only implementation dry run.

It never claims E2 bitstream or E3 board observation.
#>

[CmdletBinding()]
param(
  [ValidateSet('EnvCheck', 'DryRun', 'Certify')]
  [string]$Mode = 'Certify',

  [ValidateSet('ExistingZipDir', 'LocalGenerated', 'Production')]
  [string]$PackageSource = 'ExistingZipDir',

  [string]$ZipDir = '.redbyte/product-immersion/vivado-grade-export-audit/downloads',
  [string]$OutputRoot = '.redbyte/vivado-e1',
  [string[]]$DesignIds = @('logic-gates', 'half-adder', 'full-adder', 'four-bit-adder', 'two-bit-counter'),
  [string]$VivadoPath = '',
  [int]$Jobs = 4,
  [switch]$IncludeImplementation,
  [string]$ProductionUrl = 'https://redbyteapps.dev/os'
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

function Get-CommandText([string]$Command, [string[]]$Arguments = @()) {
  try {
    return ((& $Command @Arguments 2>$null) | Out-String).Trim()
  } catch {
    return ''
  }
}

function Get-GitValue([string[]]$Arguments) {
  try {
    return ((& git -C $RepoRoot @Arguments 2>$null) | Out-String).Trim()
  } catch {
    return ''
  }
}

function Resolve-Vivado {
  $candidates = New-Object System.Collections.Generic.List[string]

  if ($VivadoPath.Trim().Length -gt 0) {
    $candidates.Add($VivadoPath)
  }
  if ($env:VIVADO_BAT) {
    $candidates.Add($env:VIVADO_BAT)
  }
  if ($env:VIVADO) {
    $candidates.Add($env:VIVADO)
  }

  foreach ($name in @('vivado.bat', 'vivado')) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) {
      $candidates.Add($cmd.Source)
    }
  }

  foreach ($path in @(
      'C:\Xilinx\Vivado\2025.1\bin\vivado.bat',
      'C:\Xilinx\Vivado\2024.2\bin\vivado.bat',
      'C:\Xilinx\Vivado\2024.1\bin\vivado.bat',
      'C:\Xilinx\Vivado\2023.2\bin\vivado.bat',
      'C:\Xilinx\Vivado\2023.1\bin\vivado.bat',
      'C:\Program Files\Xilinx\Vivado\2024.2\bin\vivado.bat',
      'C:\Program Files\Xilinx\Vivado\2024.1\bin\vivado.bat'
    )) {
    $candidates.Add($path)
  }

  $checked = @()
  foreach ($candidate in ($candidates | Where-Object { $_ } | Select-Object -Unique)) {
    $checked += $candidate
    if (Test-Path -LiteralPath $candidate) {
      $version = ''
      try {
        $version = ((& $candidate -version 2>&1 | Select-Object -First 12) | Out-String).Trim()
      } catch {
        $version = "version probe failed: $($_.Exception.Message)"
      }
      return [ordered]@{
        found = $true
        path = [System.IO.Path]::GetFullPath($candidate)
        version = $version
        checked = $checked
      }
    }
  }

  return [ordered]@{
    found = $false
    path = $null
    version = $null
    checked = $checked
  }
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

function Find-FirstFileByName([string]$Root, [string]$Name) {
  return Get-ChildItem -LiteralPath $Root -Recurse -File |
    Where-Object { $_.Name -ieq $Name } |
    Sort-Object FullName |
    Select-Object -First 1
}

function Find-FirstXpr([string]$Root) {
  return Get-ChildItem -LiteralPath $Root -Recurse -File -Filter '*.xpr' |
    Sort-Object FullName |
    Select-Object -First 1
}

function Read-TextFile($FileInfo) {
  if ($null -eq $FileInfo) {
    return ''
  }
  return Get-Content -LiteralPath $FileInfo.FullName -Raw
}

function Get-RegexValue([string]$Text, [string]$Pattern) {
  $match = [regex]::Match($Text, $Pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($match.Success -and $match.Groups.Count -gt 1) {
    return $match.Groups[1].Value.Trim()
  }
  return $null
}

function Get-PackagePins([string]$XdcText) {
  $values = @()
  foreach ($match in [regex]::Matches($XdcText, 'PACKAGE_PIN\s+([A-Z0-9]+)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
    $values += $match.Groups[1].Value.Trim().ToUpperInvariant()
  }
  return $values
}

function Get-XdcPorts([string]$XdcText) {
  $values = @()
  foreach ($match in [regex]::Matches($XdcText, '\[get_ports\s+\{([^}]+)\}\]', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
    $values += $match.Groups[1].Value.Trim()
  }
  return @($values | Sort-Object -Unique)
}

function Remove-XdcComments([string]$XdcText) {
  return (($XdcText -split "`r?`n") | ForEach-Object { $_ -replace '#.*$', '' }) -join "`n"
}

function Get-UnsupportedTopConstructs([string]$TopText) {
  $constructs = @()
  foreach ($entry in @(
      @{ name = 'after-delay'; pattern = '\bafter\b' },
      @{ name = 'wait-statement'; pattern = '\bwait\b' },
      @{ name = 'textio'; pattern = '\btextio\b' },
      @{ name = 'file-io'; pattern = '\bfile\s+[A-Za-z_]' }
    )) {
    if ([regex]::IsMatch($TopText, $entry.pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
      $constructs += $entry.name
    }
  }
  return $constructs
}

function Get-PackageRoot([string]$ExtractRoot, $XprFile) {
  if ($null -ne $XprFile) {
    return Split-Path -Parent $XprFile.FullName
  }
  $top = Find-FirstFileByName $ExtractRoot 'top.vhd'
  if ($null -ne $top) {
    return Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $top.FullName))
  }
  return $ExtractRoot
}

function Analyze-Package([string]$DesignId, $ZipFile, [string]$RunRoot, $VivadoInfo, [string]$Mode) {
  $designOut = Join-Path $RunRoot ("designs/{0}" -f $DesignId)
  $extractRoot = Join-Path $designOut 'extracted'
  $logsRoot = Join-Path $designOut 'logs'
  New-Directory $designOut
  New-Directory $extractRoot
  New-Directory $logsRoot

  if ($null -eq $ZipFile) {
    return [ordered]@{
      designId = $DesignId
      classification = 'BLOCKED_PACKAGE_MISSING'
      packagePresent = $false
      zipPath = $null
      packageRoot = $null
      issues = @('No ZIP package matched this design id.')
      warnings = @()
      e1 = [ordered]@{ import = $false; compile = $false; testbench = $false; synthesis = $false; implementationDryRun = $false }
    }
  }

  $zipHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $ZipFile.FullName).Hash.ToLowerInvariant()
  Expand-Archive -LiteralPath $ZipFile.FullName -DestinationPath $extractRoot -Force

  $xpr = Find-FirstXpr $extractRoot
  $packageRoot = Get-PackageRoot $extractRoot $xpr
  $rbproj = Find-FirstFileByName $packageRoot 'project.rbproj.json'
  $readme = Find-FirstFileByName $packageRoot 'README.txt'
  $importTcl = Find-FirstFileByName $packageRoot 'vivado_import.tcl'
  $topVhd = Find-FirstFileByName $packageRoot 'top.vhd'
  $topXdc = Find-FirstFileByName $packageRoot 'top.xdc'
  $testbench = Find-FirstFileByName $packageRoot 'testbench.vhd'
  $expectedIo = Find-FirstFileByName $packageRoot 'EXPECTED_IO.json'

  $files = [ordered]@{
    xpr = if ($xpr) { $xpr.FullName } else { $null }
    rbproj = if ($rbproj) { $rbproj.FullName } else { $null }
    readme = if ($readme) { $readme.FullName } else { $null }
    vivadoImportTcl = if ($importTcl) { $importTcl.FullName } else { $null }
    topVhd = if ($topVhd) { $topVhd.FullName } else { $null }
    topXdc = if ($topXdc) { $topXdc.FullName } else { $null }
    testbenchVhd = if ($testbench) { $testbench.FullName } else { $null }
    expectedIo = if ($expectedIo) { $expectedIo.FullName } else { $null }
  }

  $issues = @()
  $warnings = @()
  foreach ($key in $files.Keys) {
    if ($null -eq $files[$key]) {
      $issues += "Missing required package file: $key"
    }
  }

  $topText = Read-TextFile $topVhd
  $xdcText = Read-TextFile $topXdc
  $xdcActiveText = Remove-XdcComments $xdcText
  $xprText = Read-TextFile $xpr
  $tclText = Read-TextFile $importTcl
  $tbText = Read-TextFile $testbench
  $readmeText = Read-TextFile $readme

  $topEntity = Get-RegexValue $topText '\bentity\s+([A-Za-z_][A-Za-z0-9_]*)\s+is\b'
  $xprTop = Get-RegexValue $xprText '<FileSet\s+Name="sources_1"[\s\S]*?<Option\s+Name="TopModule"\s+Val="([^"]+)"'
  $xprPart = Get-RegexValue $xprText '<Option\s+Name="Part"\s+Val="([^"]+)"'
  $tclTop = Get-RegexValue $tclText 'set\s+top_module\s+"([^"]+)"'
  $pins = @(Get-PackagePins $xdcText)
  $duplicatePins = @($pins | Group-Object | Where-Object { $_.Count -gt 1 } | ForEach-Object { $_.Name })
  $xdcPorts = @(Get-XdcPorts $xdcText)
  $unsupported = @(Get-UnsupportedTopConstructs $topText)

  if ($null -eq $topEntity) {
    $issues += 'Could not detect top-level VHDL entity.'
  }
  if ($topEntity -and $xprTop -and $topEntity.ToLowerInvariant() -ne $xprTop.ToLowerInvariant()) {
    $issues += "Top entity $topEntity does not match .xpr sources_1 TopModule $xprTop."
  }
  if ($topEntity -and $tclTop -and $topEntity.ToLowerInvariant() -ne $tclTop.ToLowerInvariant()) {
    $issues += "Top entity $topEntity does not match vivado_import.tcl top_module $tclTop."
  }
  if ($duplicatePins.Count -gt 0) {
    $issues += "Duplicate PACKAGE_PIN assignments: $($duplicatePins -join ', ')"
  }
  if ($xdcPorts.Count -eq 0) {
    $issues += 'No [get_ports {...}] constraints found in top.xdc.'
  }
  if ($tbText.Trim().Length -gt 0 -and ![regex]::IsMatch($tbText, '\bassert\b', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
    $warnings += 'testbench.vhd is present but has no assert statements.'
  }
  if ($readmeText.Trim().Length -gt 0 -and ![regex]::IsMatch($readmeText, 'E0 export package|does not prove Vivado|E1/E2/E3', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
    $warnings += 'README.txt does not clearly state the E0/no-E1 boundary.'
  }

  $projectSummary = [ordered]@{}
  if ($rbproj) {
    try {
      $projectJson = Get-Content -LiteralPath $rbproj.FullName -Raw | ConvertFrom-Json
      $projectSummary = [ordered]@{
        kind = $projectJson.kind
        version = $projectJson.version
        name = $projectJson.name
        sourceExampleId = $projectJson.meta.sourceExampleId
        projectId = $projectJson.meta.projectId
        board = $projectJson.fpga.board
        part = $projectJson.fpga.part
      }
    } catch {
      $issues += "project.rbproj.json could not be parsed: $($_.Exception.Message)"
    }
  }

  $classification = 'BLOCKED_NO_VIVADO'
  if ($unsupported.Count -gt 0) {
    $classification = 'BLOCKED_UNSUPPORTED_CONSTRUCT'
    $issues += "Unsupported top-level construct(s): $($unsupported -join ', ')"
  } elseif ($issues.Count -gt 0) {
    $classification = 'FAIL_IMPORT'
  } elseif ($VivadoInfo.found -and $Mode -eq 'DryRun') {
    $classification = 'READY_FOR_E1_RUN'
  }

  $vivadoRun = [ordered]@{
    attempted = $false
    exitCode = $null
    resultFile = $null
    log = $null
  }

  if ($Mode -eq 'Certify' -and $classification -eq 'BLOCKED_NO_VIVADO' -and $VivadoInfo.found) {
    $classification = 'READY_FOR_E1_RUN'
  }

  if ($Mode -eq 'Certify' -and $classification -eq 'READY_FOR_E1_RUN') {
    $tcl = Join-Path $PSScriptRoot 'redbyte-e1-certify.tcl'
    $logPath = Join-Path $logsRoot 'vivado-e1.log'
    $vivadoArgs = @(
      '-mode', 'batch',
      '-source', $tcl,
      '-notrace',
      '-nojournal',
      '-log', $logPath,
      '-tclargs',
      $xpr.FullName,
      $designOut,
      ([string]$Jobs),
      ([string]([bool]$IncludeImplementation)).ToLowerInvariant()
    )
    $vivadoRun.attempted = $true
    $vivadoRun.log = $logPath
    & $VivadoInfo.path @vivadoArgs
    $vivadoRun.exitCode = $LASTEXITCODE

    $tclResultPath = Join-Path $designOut 'e1-result.json'
    $vivadoRun.resultFile = $tclResultPath
    if (Test-Path -LiteralPath $tclResultPath) {
      $tclResult = Get-Content -LiteralPath $tclResultPath -Raw | ConvertFrom-Json
      $classification = $tclResult.classification
    } elseif ($LASTEXITCODE -eq 0) {
      $classification = 'PASS_E1'
    } else {
      $classification = 'FAIL_SYNTH'
    }
  }

  return [ordered]@{
    designId = $DesignId
    classification = $classification
    packagePresent = $true
    zipPath = $ZipFile.FullName
    zipSha256 = $zipHash
    packageRoot = $packageRoot
    project = $projectSummary
    files = $files
    packageFacts = [ordered]@{
      xprPart = $xprPart
      topEntity = $topEntity
      xprTopModule = $xprTop
      tclTopModule = $tclTop
      constrainedPorts = $xdcPorts
      packagePins = $pins
      duplicatePins = $duplicatePins
      hasCreateClock = [regex]::IsMatch($xdcActiveText, '(^|\s)create_clock\b', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase -bor [System.Text.RegularExpressions.RegexOptions]::Multiline)
      testbenchHasAssertions = [regex]::IsMatch($tbText, '\bassert\b', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
      readmeHasE0Boundary = [regex]::IsMatch($readmeText, 'E0 export package|does not prove Vivado|E1/E2/E3', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
      unsupportedTopConstructs = $unsupported
    }
    issues = $issues
    warnings = $warnings
    vivadoRun = $vivadoRun
    e1 = [ordered]@{
      import = ($classification -eq 'PASS_E1')
      compile = ($classification -eq 'PASS_E1')
      testbench = ($classification -eq 'PASS_E1')
      synthesis = ($classification -eq 'PASS_E1')
      implementationDryRun = (($classification -eq 'PASS_E1') -and [bool]$IncludeImplementation)
    }
  }
}

function Write-ResultsMarkdown($Manifest, [string]$Path) {
  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add('# RedByte Vivado E1 Results')
  $lines.Add('')
  $lines.Add(("Generated: {0}" -f $Manifest.generatedAt))
  $lines.Add(("Mode: {0}" -f $Manifest.mode))
  $lines.Add(("Verdict: {0}" -f $Manifest.verdict))
  $lines.Add(("Git SHA: {0}" -f $Manifest.git.sha))
  $lines.Add('')
  $lines.Add('## Environment')
  $lines.Add('')
  if ($Manifest.environment.vivado.found) {
    $lines.Add(("Vivado: found at {0}" -f $Manifest.environment.vivado.path))
  } else {
    $lines.Add('Vivado: not found. E1 is blocked, not passed.')
  }
  $lines.Add('')
  $lines.Add('## Design Results')
  $lines.Add('')
  $lines.Add('| Design | Classification | Package | Issues |')
  $lines.Add('|---|---|---|---|')
  foreach ($result in @($Manifest.designs)) {
    $package = if ($result.packagePresent) { 'present' } else { 'missing' }
    $issueList = @($result.issues)
    $issueText = if ($issueList.Count -gt 0) { ($issueList -join '; ') } else { 'none' }
    $lines.Add(("| {0} | {1} | {2} | {3} |" -f $result.designId, $result.classification, $package, ($issueText -replace '\|', '/')))
  }
  $lines.Add('')
  $lines.Add('## Boundary')
  $lines.Add('')
  $lines.Add('- E1 means Vivado import, VHDL compile/elaboration readiness, behavioral simulation/testbench when present, and synthesis.')
  $lines.Add('- E1 does not mean bitstream generation, board programming, or observed Basys3 behavior.')
  $lines.Add('- E2 and E3 must be collected separately.')
  Set-Content -LiteralPath $Path -Value $lines -Encoding UTF8
}

$RunRoot = Join-Path (Resolve-RepoPath $OutputRoot) $Timestamp
$LogsRoot = Join-Path $RunRoot 'logs'
New-Directory $RunRoot
New-Directory $LogsRoot

$VivadoInfo = Resolve-Vivado
$gitSha = Get-GitValue @('rev-parse', 'HEAD')
$gitBranch = Get-GitValue @('branch', '--show-current')

$environment = [ordered]@{
  schema = 'redbyte.vivado-e1.environment.v1'
  generatedAt = $StartedAt.ToString('o')
  mode = $Mode
  repoRoot = $RepoRoot
  git = [ordered]@{
    branch = $gitBranch
    sha = $gitSha
    statusShort = Get-GitValue @('status', '--short', '--branch')
  }
  host = [ordered]@{
    os = [System.Runtime.InteropServices.RuntimeInformation]::OSDescription
    architecture = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
    powershell = $PSVersionTable.PSVersion.ToString()
    node = Get-CommandText 'node' @('-v')
    pnpm = Get-CommandText 'corepack' @('pnpm', '-v')
  }
  inputs = [ordered]@{
    packageSource = $PackageSource
    zipDir = $ZipDir
    designIds = $DesignIds
    jobs = $Jobs
    includeImplementation = [bool]$IncludeImplementation
    productionUrl = $ProductionUrl
  }
  vivado = $VivadoInfo
}
Write-JsonFile $environment (Join-Path $RunRoot 'environment.json')

$results = @()
$zipRoot = Resolve-RepoPath $ZipDir

if ($Mode -eq 'EnvCheck') {
  $results += [ordered]@{
    designId = 'environment'
    classification = if ($VivadoInfo.found) { 'READY_FOR_E1_RUN' } else { 'BLOCKED_NO_VIVADO' }
    packagePresent = $false
    issues = if ($VivadoInfo.found) { @() } else { @('Vivado was not found on PATH, VIVADO_BAT, VIVADO, or common install paths.') }
    warnings = @()
    e1 = [ordered]@{ import = $false; compile = $false; testbench = $false; synthesis = $false; implementationDryRun = $false }
  }
} else {
  if ($PackageSource -ne 'ExistingZipDir') {
    $collectedZipDir = Join-Path $RunRoot 'input-zips'
    $collector = Join-Path $PSScriptRoot 'redbyte-e1-collect.ps1'
    $collectArgs = @(
      '-Mode', $PackageSource,
      '-OutputZipDir', $collectedZipDir,
      '-ProductionUrl', $ProductionUrl,
      '-DesignIds'
    ) + $DesignIds
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $collector @collectArgs | Tee-Object -FilePath (Join-Path $LogsRoot 'collection.log') | Out-Null
    $zipRoot = $collectedZipDir
  }

  foreach ($designId in $DesignIds) {
    $zip = Find-DesignZip $zipRoot $designId
    $results += Analyze-Package $designId $zip $RunRoot $VivadoInfo $Mode
  }
}

Write-JsonFile ([ordered]@{
    schema = 'redbyte.vivado-e1.package-summary.v1'
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    zipRoot = $zipRoot
    designs = $results
  }) (Join-Path $RunRoot 'package-summary.json')

$failureCount = @($results | Where-Object { $_.classification -like 'FAIL_*' }).Count
$passCount = @($results | Where-Object { $_.classification -eq 'PASS_E1' }).Count
$blockedCount = @($results | Where-Object { $_.classification -like 'BLOCKED_*' }).Count
$readyCount = @($results | Where-Object { $_.classification -eq 'READY_FOR_E1_RUN' }).Count
$verdict = if ($failureCount -gt 0) {
  'failed'
} elseif ($passCount -gt 0 -and $passCount -eq $DesignIds.Count) {
  'pass-e1'
} elseif ($blockedCount -gt 0) {
  'blocked'
} elseif ($readyCount -gt 0) {
  'ready-for-e1-run'
} else {
  'inconclusive'
}

$manifest = [ordered]@{
  schema = 'redbyte.vivado-e1.manifest.v1'
  generatedAt = (Get-Date).ToUniversalTime().ToString('o')
  runRoot = $RunRoot
  mode = $Mode
  verdict = $verdict
  git = [ordered]@{
    branch = $gitBranch
    sha = $gitSha
  }
  environment = $environment
  classifications = @($results | Group-Object -Property { $_['classification'] } | ForEach-Object {
      [ordered]@{ classification = $_.Name; count = $_.Count }
    })
  artifacts = [ordered]@{
    environment = 'environment.json'
    packageSummary = 'package-summary.json'
    results = 'results.md'
    logs = 'logs/'
  }
  designs = $results
}

Write-JsonFile $manifest (Join-Path $RunRoot 'manifest.json')
Write-ResultsMarkdown $manifest (Join-Path $RunRoot 'results.md')

Write-Host ("RedByte E1: runRoot={0}" -f $RunRoot)
Write-Host ("RedByte E1: verdict={0}" -f $verdict)
foreach ($result in $results) {
  Write-Host ("RedByte E1: {0} => {1}" -f $result.designId, $result.classification)
}

if ($Mode -eq 'Certify' -and $failureCount -gt 0) {
  exit 1
}
exit 0
