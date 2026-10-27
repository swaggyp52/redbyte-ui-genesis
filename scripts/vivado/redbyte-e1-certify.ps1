<#
Run a RedByte Vivado E1 certification checkpoint.

This wrapper creates a durable proof folder under .redbyte/vivado-e1/<timestamp>/ (or -OutDir,
which must not exist yet or be empty: a reused folder is refused with exit 2). Each design's ZIP is
copied, hashed and extracted into a new folder, and must hold exactly one .xpr project.
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

  # Wall-clock limit for one design's Vivado batch run; a hung run is TIMEOUT, never a pass.
  [double]$TimeoutMinutes = 45,

  [Alias('PackageDir')]
  [string]$ZipDir = '.redbyte/product-immersion/vivado-grade-export-audit/downloads',
  [string]$OutputRoot = '.redbyte/vivado-e1',
  [string]$OutDir = '',
  [string[]]$DesignIds = @('logic-gates', 'half-adder', 'full-adder', 'four-bit-adder', 'two-bit-counter'),
  [string]$VivadoPath = '',
  [int]$Jobs = 4,
  [switch]$IncludeImplementation,
  [string]$ProductionUrl = 'https://redbyteapps.dev/os'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'redbyte-e1-packages.ps1')

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

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Write-JsonFile($Value, [string]$Path) {
  [System.IO.File]::WriteAllText($Path, ($Value | ConvertTo-Json -Depth 50), $Utf8NoBom)
}

# Every classification redbyte-e1-certify.tcl may write, with the exit code it must exit with.
$TclClassificationExitCodes = @{
  'PASS_E1' = 0
  'FAIL_IMPORT' = 2
  'FAIL_COMPILE' = 3
  'FAIL_SYNTH' = 5
  'FAIL_IMPL_DRY_RUN' = 6
  'HARNESS_ERROR' = 10
  'BLOCKED_NO_SIM' = 20
  'BLOCKED_NO_TESTBENCH' = 21
  'FAIL_TESTBENCH_COMPILE' = 22
  'FAIL_TESTBENCH_ELAB' = 23
  'FAIL_TESTBENCH_LAUNCH' = 24
  'FAIL_TESTBENCH_RUNTIME' = 25
  'FAIL_TESTBENCH_TIMEOUT' = 26
  'FAIL_TESTBENCH_CONTRACT' = 27
  'FAIL_TESTBENCH_ASSERTION' = 28
  'FAIL_TESTBENCH_NO_CHECKS' = 29
}

# Classifications that are failures of the run itself rather than of one stage.
$RunFailureClassifications = @('TIMEOUT', 'INTERRUPTED', 'HARNESS_ERROR', 'EVIDENCE_CONFLICT')

function Read-JsonFileOrNull([string]$Path) {
  if (!(Test-Path -LiteralPath $Path)) { return $null }
  try {
    return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
  } catch {
    return $null
  }
}

function Get-StagePassed($TclResult, [string]$Stage) {
  if ($null -eq $TclResult -or $null -eq $TclResult.stages) { return $false }
  $entry = $TclResult.stages.PSObject.Properties[$Stage]
  return ($null -ne $entry -and $entry.Value.status -eq 'pass')
}

function Quote-ProcessArgument([string]$Value) {
  return '"' + ($Value -replace '"', '\"') + '"'
}

# Runs Vivado with its console redirected to files (so output never leaks into this script's
# pipeline) and a wall-clock limit. Returns exit code, or timedOut when the process was killed.
function Invoke-VivadoBatch([string]$VivadoExe, [string[]]$Arguments, [string]$StdoutPath, [string]$StderrPath, [int]$TimeoutMs) {
  $process = Start-Process -FilePath $VivadoExe -ArgumentList ($Arguments | ForEach-Object { Quote-ProcessArgument $_ }) `
    -RedirectStandardOutput $StdoutPath -RedirectStandardError $StderrPath -NoNewWindow -PassThru
  $null = $process.Handle
  if (!$process.WaitForExit($TimeoutMs)) {
    & taskkill.exe /PID $process.Id /T /F 2>&1 | Out-Null
    $null = $process.WaitForExit(30000)
    return [ordered]@{ exitCode = $null; timedOut = $true }
  }
  $process.WaitForExit()
  return [ordered]@{ exitCode = $process.ExitCode; timedOut = $false }
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

function Find-FirstFileByName([string]$Root, [string]$Name) {
  return Get-ChildItem -LiteralPath $Root -Recurse -File |
    Where-Object { $_.Name -ieq $Name } |
    Sort-Object FullName |
    Select-Object -First 1
}

# Every .xpr in a freshly extracted package; E1 analyses a package only when there is exactly one.
function Find-XprFiles([string]$Root) {
  return @(Get-ChildItem -LiteralPath $Root -Recurse -File |
    Where-Object { $_.Extension -ieq '.xpr' } |
    Sort-Object FullName)
}

function Get-Sha256([string]$Path) {
  return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

# Refuses the whole run before anything is written; nonzero, and never a pass.
function Stop-E1Run([string]$Message) {
  [Console]::Error.WriteLine("RedByte E1: refused: $Message")
  exit 2
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

function New-UnanalysedResult([string]$DesignId, [string]$Classification, [string[]]$Issues) {
  return [ordered]@{
    designId = $DesignId
    classification = $Classification
    packagePresent = $false
    zipPath = $null
    packageRoot = $null
    issues = $Issues
    warnings = @()
    e1 = [ordered]@{ import = $false; compile = $false; testbench = $false; synthesis = $false; implementationDryRun = $false }
  }
}

function Analyze-Package([string]$DesignId, $ZipCandidates, [string]$RunRoot, $VivadoInfo, [string]$Mode) {
  $designOut = [System.IO.Path]::GetFullPath((Join-Path $RunRoot ("designs\{0}" -f $DesignId)))
  $extractRoot = Join-Path $designOut 'extracted'
  $logsRoot = Join-Path $designOut 'logs'
  # The run folder started empty, so an existing design folder can only be a reuse; never analyse it.
  if (Test-Path -LiteralPath $designOut) {
    return New-UnanalysedResult $DesignId 'HARNESS_ERROR' @("$designOut already exists; E1 never reuses an extraction.")
  }
  New-Directory $designOut
  New-Directory $logsRoot

  $ZipCandidates = @($ZipCandidates)
  if ($ZipCandidates.Count -eq 0) {
    return New-UnanalysedResult $DesignId 'BLOCKED_PACKAGE_MISSING' @("No ZIP package is named for design id $DesignId (exact names only; see redbyte-e1-packages.ps1).")
  }
  if ($ZipCandidates.Count -gt 1) {
    $names = @($ZipCandidates | ForEach-Object { $_.FullName })
    return New-UnanalysedResult $DesignId 'BLOCKED_PACKAGE_AMBIGUOUS' @("$($ZipCandidates.Count) ZIP packages match design id ${DesignId}; keep exactly one: $($names -join '; ')")
  }
  $ZipFile = $ZipCandidates[0]

  # Hash, extract and inspect one private copy, so every recorded fact comes from the same bytes,
  # extracted into a folder that did not exist before this run.
  $packageZip = Join-Path $designOut 'package.zip'
  Copy-Item -LiteralPath $ZipFile.FullName -Destination $packageZip
  $zipHash = Get-Sha256 $packageZip
  New-Item -ItemType Directory -Path $extractRoot | Out-Null
  $extractIssue = $null
  try {
    Expand-Archive -LiteralPath $packageZip -DestinationPath $extractRoot
  } catch {
    $extractIssue = "The ZIP could not be extracted: $($_.Exception.Message)"
  }

  $xprFiles = @(Find-XprFiles $extractRoot)
  $xpr = if ($xprFiles.Count -eq 1) { $xprFiles[0] } else { $null }
  $xprSha256 = if ($xpr) { Get-Sha256 $xpr.FullName } else { $null }
  $xprZipEntry = if ($xpr) { $xpr.FullName.Substring($extractRoot.Length).TrimStart('\', '/').Replace('\', '/') } else { $null }
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
  if ($null -ne $extractIssue) {
    $issues += $extractIssue
  }
  if ($xprFiles.Count -gt 1) {
    $relative = @($xprFiles | ForEach-Object { $_.FullName.Substring($extractRoot.Length).TrimStart('\', '/') })
    $issues += "A package must hold exactly one .xpr project; found $($xprFiles.Count): $($relative -join ', ')"
  }
  foreach ($key in $files.Keys) {
    if ($null -eq $files[$key] -and !($key -eq 'xpr' -and $xprFiles.Count -gt 1)) {
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
  $tbEntity = Get-RegexValue $tbText '(?m)^\s*entity\s+([A-Za-z][A-Za-z0-9_]*)\s+is\b'
  $xprSimTop = Get-RegexValue $xprText '<FileSet\s+Name="sim_1"[\s\S]*?<Option\s+Name="TopModule"\s+Val="([^"]+)"'
  $tclSimTop = Get-RegexValue $tclText 'set_property\s+top\s+"([^"]+)"\s+\[get_filesets\s+sim_1\]'
  $tbHasContract = $tbText.Contains('REDBYTE_TB_RESULT v=1')
  $tbVectorCount = [regex]::Matches($tbText, '--\s*Vector\s+\d+').Count
  # Simulation-time bound: each generated vector takes at most ~11 ns; allow a wide margin.
  $simBoundNs = 2000 + (100 * $tbVectorCount)
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
  $contractIssue = $null
  if ($tbText.Trim().Length -gt 0) {
    if ($null -eq $tbEntity) {
      $issues += 'Could not detect the testbench entity in testbench.vhd.'
    } else {
      if ($null -eq $xprSimTop -or $tbEntity.ToLowerInvariant() -ne $xprSimTop.ToLowerInvariant()) {
        $issues += "Testbench entity $tbEntity does not match .xpr sim_1 TopModule $xprSimTop."
      }
      if ($null -eq $tclSimTop -or $tbEntity.ToLowerInvariant() -ne $tclSimTop.ToLowerInvariant()) {
        $issues += "Testbench entity $tbEntity does not match the vivado_import.tcl sim_1 top $tclSimTop."
      }
    }
    if (!$tbHasContract) {
      $contractIssue = 'testbench.vhd has no REDBYTE_TB_RESULT self-check (exported by an older RedByte); re-export the package.'
    }
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
  } elseif ($null -ne $contractIssue) {
    $classification = 'FAIL_TESTBENCH_CONTRACT'
    $issues += $contractIssue
  } elseif ($VivadoInfo.found -and $Mode -eq 'DryRun') {
    $classification = 'READY_FOR_E1_RUN'
  }

  $vivadoRun = [ordered]@{
    attempted = $false
    runId = $null
    exitCode = $null
    timedOut = $false
    resultFile = $null
    log = $null
    stdout = $null
    lastStage = $null
    resultLinesInLog = $null
    acceptance = $null
  }
  $tclResult = $null
  $stageSource = $null

  if ($Mode -eq 'Certify' -and $classification -eq 'BLOCKED_NO_VIVADO' -and $VivadoInfo.found) {
    $classification = 'READY_FOR_E1_RUN'
  }

  if ($Mode -eq 'Certify' -and $classification -eq 'READY_FOR_E1_RUN') {
    $tcl = Join-Path $PSScriptRoot 'redbyte-e1-certify.tcl'
    $logPath = Join-Path $logsRoot 'vivado-e1.log'
    $stdoutPath = Join-Path $logsRoot 'vivado-console.out.log'
    $stderrPath = Join-Path $logsRoot 'vivado-console.err.log'
    $tclResultPath = Join-Path $designOut 'e1-result.json'
    $progressPath = Join-Path $designOut 'e1-progress.json'
    # A run identity, not a hash input: it ties the result file to this invocation.
    $runId = [guid]::NewGuid().ToString('N')
    foreach ($stale in @($tclResultPath, "$tclResultPath.tmp", $progressPath, "$progressPath.tmp")) {
      if (Test-Path -LiteralPath $stale) { Remove-Item -LiteralPath $stale -Force }
    }
    $vivadoArgs = @(
      '-mode', 'batch',
      '-source', $tcl,
      '-notrace',
      '-nojournal',
      '-log', $logPath,
      '-tclargs',
      $xpr.FullName,
      $designOut,
      $runId,
      ([string]$Jobs),
      ([string]([bool]$IncludeImplementation)).ToLowerInvariant(),
      ([string]$simBoundNs)
    )
    $vivadoRun.attempted = $true
    $vivadoRun.runId = $runId
    $vivadoRun.log = $logPath
    $vivadoRun.stdout = $stdoutPath
    $vivadoRun.resultFile = $tclResultPath
    $invocation = Invoke-VivadoBatch $VivadoInfo.path $vivadoArgs $stdoutPath $stderrPath ($TimeoutMinutes * 60 * 1000)
    $vivadoRun.exitCode = $invocation.exitCode
    $vivadoRun.timedOut = $invocation.timedOut
    $progress = Read-JsonFileOrNull $progressPath
    if ($null -ne $progress -and $progress.runId -eq $runId) { $vivadoRun.lastStage = $progress.stage }

    $tclResult = Read-JsonFileOrNull $tclResultPath
    if ($invocation.timedOut) {
      $classification = 'TIMEOUT'
      $vivadoRun.acceptance = "Vivado exceeded $TimeoutMinutes minutes at stage $($vivadoRun.lastStage) and was stopped."
      $tclResult = $null
    } elseif ($null -eq $tclResult) {
      $classification = 'INTERRUPTED'
      $vivadoRun.acceptance = "No readable e1-result.json from this run (exit $($invocation.exitCode), last stage $($vivadoRun.lastStage))."
    } elseif ($tclResult.schema -ne 'redbyte.vivado-e1.tcl-result.v2' -or $tclResult.runId -ne $runId) {
      $classification = 'HARNESS_ERROR'
      $vivadoRun.acceptance = "e1-result.json is not this run's v2 result (schema $($tclResult.schema), runId $($tclResult.runId))."
      $tclResult = $null
    } elseif (!$TclClassificationExitCodes.ContainsKey([string]$tclResult.classification)) {
      $classification = 'HARNESS_ERROR'
      $vivadoRun.acceptance = "Unknown classification '$($tclResult.classification)'."
      $tclResult = $null
    } elseif ($TclClassificationExitCodes[[string]$tclResult.classification] -ne $invocation.exitCode -or [int]$tclResult.exitCode -ne $invocation.exitCode) {
      $classification = 'HARNESS_ERROR'
      $vivadoRun.acceptance = "Classification $($tclResult.classification) disagrees with Vivado exit code $($invocation.exitCode)."
      $tclResult = $null
    } else {
      $classification = [string]$tclResult.classification
      $vivadoRun.acceptance = 'accepted'
      $stageSource = $tclResult
    }

    # Independent cross-check of a pass against everything Vivado printed.
    $consoleText = (@($logPath, $stdoutPath) | Where-Object { Test-Path -LiteralPath $_ } | ForEach-Object { Get-Content -LiteralPath $_ -Raw }) -join "`n"
    $logResultLines = @([regex]::Matches($consoleText, 'REDBYTE_TB_RESULT v=1 tb=\S+ status=(\S+) checks=\d+ failures=\d+') | ForEach-Object { $_.Value })
    $vivadoRun.resultLinesInLog = $logResultLines
    if ($classification -eq 'PASS_E1') {
      $nonPass = @($logResultLines | Where-Object { $_ -notmatch 'status=PASS ' })
      $mismatchCount = [regex]::Matches($consoleText, 'Vector \d+ failed on ').Count
      if ($nonPass.Count -gt 0 -or $mismatchCount -gt 0) {
        $classification = 'EVIDENCE_CONFLICT'
        $stageSource = $null
        $vivadoRun.acceptance = "PASS_E1 contradicted by the Vivado log: $($nonPass.Count) non-PASS result line(s), $mismatchCount mismatch report(s)."
      }
    }
  }

  return [ordered]@{
    designId = $DesignId
    classification = $classification
    packagePresent = $true
    zipPath = $ZipFile.FullName
    # zipSha256, xprZipEntry and xprSha256 all describe package.zip, the copy extracted into the
    # fresh extractRoot; the .xpr hash is taken before Vivado opens (and may rewrite) the project.
    zipSha256 = $zipHash
    packageZip = $packageZip
    extractRoot = $extractRoot
    xprZipEntry = $xprZipEntry
    xprSha256 = $xprSha256
    packageRoot = $packageRoot
    project = $projectSummary
    files = $files
    packageFacts = [ordered]@{
      xprPart = $xprPart
      topEntity = $topEntity
      xprTopModule = $xprTop
      tclTopModule = $tclTop
      testbenchEntity = $tbEntity
      xprSimulationTopModule = $xprSimTop
      tclSimulationTop = $tclSimTop
      testbenchHasResultContract = $tbHasContract
      testbenchVectorCount = $tbVectorCount
      simBoundNs = $simBoundNs
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
    e1c = if ($null -ne $tclResult) { $tclResult.e1c } else { $null }
    # Stage flags come from the accepted result's own stages, never from the classification
    # alone, and are all false unless this run's result was accepted.
    e1 = [ordered]@{
      import = (Get-StagePassed $stageSource 'E1a')
      compile = (Get-StagePassed $stageSource 'E1b')
      testbench = (Get-StagePassed $stageSource 'E1c')
      synthesis = (Get-StagePassed $stageSource 'E1d')
      implementationDryRun = (Get-StagePassed $stageSource 'E1e')
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
  $lines.Add('- E1 means Vivado import, VHDL compile/elaboration readiness, a self-checking behavioral simulation whose REDBYTE_TB_RESULT line says PASS, and synthesis.')
  $lines.Add('- E1 does not mean bitstream generation, board programming, or observed Basys3 behavior.')
  $lines.Add('- E2 and E3 must be collected separately.')
  [System.IO.File]::WriteAllLines($Path, $lines, $Utf8NoBom)
}

if ($OutDir.Trim().Length -gt 0) {
  $RunRoot = Resolve-RepoPath $OutDir
} else {
  $RunRoot = Join-Path (Resolve-RepoPath $OutputRoot) $Timestamp
}
# Design ids name ZIPs exactly and become designs/<id> folders, so each must be a project slug.
$seenDesignIds = @{}
foreach ($designId in $DesignIds) {
  if (!(Test-RedByteDesignId $designId)) {
    Stop-E1Run "design id '$designId' is not a RedByte project slug (lowercase letters and digits in dash-separated groups)."
  }
  if ($seenDesignIds.ContainsKey($designId.ToLowerInvariant())) {
    Stop-E1Run "design id '$designId' is listed twice."
  }
  $seenDesignIds[$designId.ToLowerInvariant()] = $true
}
# Every run writes into a folder of its own. A reused folder still holds an earlier run's
# extraction, logs and manifest, which a new run could silently analyse or mix with its own.
if (Test-Path -LiteralPath $RunRoot) {
  if (!(Test-Path -LiteralPath $RunRoot -PathType Container) -or @(Get-ChildItem -LiteralPath $RunRoot -Force).Count -gt 0) {
    Stop-E1Run "output folder $RunRoot is not empty. E1 never reuses a run folder: omit -OutDir to get a new .redbyte/vivado-e1/<timestamp>/ folder, or pass a folder that does not exist yet."
  }
}
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
    outDir = $OutDir
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
    $candidates = @(Find-RedByteDesignZips $zipRoot $designId)
    $results += Analyze-Package $designId $candidates $RunRoot $VivadoInfo $Mode
  }
}

Write-JsonFile ([ordered]@{
    schema = 'redbyte.vivado-e1.package-summary.v1'
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    zipRoot = $zipRoot
    designs = $results
  }) (Join-Path $RunRoot 'package-summary.json')

$failureCount = @($results | Where-Object { $_.classification -like 'FAIL_*' -or $RunFailureClassifications -contains $_.classification }).Count
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

# Certify succeeds only when every requested design earned PASS_E1; blocked, ready and
# inconclusive runs are not passes.
if ($Mode -eq 'Certify' -and $verdict -ne 'pass-e1') {
  exit 1
}
exit 0
