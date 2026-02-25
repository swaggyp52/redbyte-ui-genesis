<#
.SYNOPSIS
  Vivado 2024.2 smoke test — export every shipped RedByte example and build a bitstream.

.DESCRIPTION
  For each example:
    1. Export Verilog + XDC via tools/vivado/export-example.ts
    2. Run Vivado in batch mode using tools/vivado/build_one.tcl
    3. Gate on Vivado exit code AND existence of the .bit file
    4. Write result.json for each example

  Summary table is printed at the end.
  Exit code: 0 = all examples pass, 1 = one or more failed.

.PARAMETER VivadoPath
  Path to vivado.bat. Checked in order:
    1. -VivadoPath argument
    2. VIVADO_PATH environment variable
    3. Common installation paths (Vivado 2024.2 → 2024.1 → 2023.2)

.PARAMETER OutRoot
  Root folder for build artifacts. Defaults to dist\smoke.
  Each example gets its own subfolder: <OutRoot>\<example-id>\

.PARAMETER Examples
  Comma-separated list of example IDs to run.
  Defaults to all three shipped examples: signal-tour,logic-gates,two-bit-counter

.EXAMPLE
  # Run all examples
  .\tools\vivado_smoke.ps1

.EXAMPLE
  # Run only the counter
  .\tools\vivado_smoke.ps1 -Examples two-bit-counter

.EXAMPLE
  # Override Vivado path
  .\tools\vivado_smoke.ps1 -VivadoPath "D:\Xilinx\Vivado\2024.2\bin\vivado.bat"
#>

param(
  [string]$VivadoPath = '',
  [string]$OutRoot    = 'dist\smoke',
  [string]$Examples   = 'signal-tour,logic-gates,two-bit-counter'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── Vivado discovery ──────────────────────────────────────────────────────────

if (-not $VivadoPath) {
  if ($env:VIVADO_PATH) {
    $VivadoPath = $env:VIVADO_PATH
  } else {
    $candidates = @(
      'C:\Xilinx\Vivado\2024.2\bin\vivado.bat',
      'C:\Xilinx\Vivado\2024.1\bin\vivado.bat',
      'C:\Xilinx\Vivado\2023.2\bin\vivado.bat'
    )
    foreach ($c in $candidates) {
      if (Test-Path $c) {
        $VivadoPath = $c
        break
      }
    }
  }
}

if (-not $VivadoPath -or -not (Test-Path $VivadoPath)) {
  Write-Host 'ERROR: Vivado not found.'
  Write-Host '  Set VIVADO_PATH env var, or pass -VivadoPath "C:\Xilinx\Vivado\2024.2\bin\vivado.bat"'
  exit 1
}

Write-Host "Vivado : $VivadoPath"

# ── Paths ─────────────────────────────────────────────────────────────────────

$RepoRoot     = Split-Path -Parent $PSScriptRoot
$TclScript    = Join-Path $PSScriptRoot "vivado\build_one.tcl"
$ExportScript = Join-Path $PSScriptRoot "vivado\export-example.ts"
$OutRootAbs   = Join-Path $RepoRoot $OutRoot
$Part         = 'xc7a35tcpg236-1'
$Top          = 'top'

foreach ($required in @($TclScript, $ExportScript)) {
  if (-not (Test-Path $required)) {
    Write-Host "ERROR: Missing required file: $required"
    exit 1
  }
}

Write-Host "OutRoot: $OutRootAbs"
Write-Host "Part   : $Part"
Write-Host ''

# ── Per-example run ───────────────────────────────────────────────────────────

$ExampleList = $Examples -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }
$Results     = [System.Collections.Generic.List[pscustomobject]]::new()

foreach ($exId in $ExampleList) {

  $ExOutDir   = Join-Path $OutRootAbs $exId
  $SrcPath    = Join-Path $ExOutDir 'top.v'
  $XdcPath    = Join-Path $ExOutDir 'constraints.xdc'
  $BitPath    = Join-Path $ExOutDir "${exId}.bit"
  $LogPath    = Join-Path $ExOutDir 'vivado.log'
  $ResultPath = Join-Path $ExOutDir 'result.json'

  New-Item -ItemType Directory -Force -Path $ExOutDir | Out-Null

  $startTime   = Get-Date -Format 'o'
  $exportOk    = $false
  $vivadoOk    = $false
  $bitExists   = $false
  $failReason  = ''

  Write-Host "── $exId ─────────────────────────────────────────────────"

  # ── Step 1: export bundle ─────────────────────────────────────────────────

  Write-Host "  [1/2] Exporting bundle..."

  try {
    $exportOut = pnpm exec tsx $ExportScript $exId $ExOutDir 2>&1
    if ($LASTEXITCODE -ne 0) {
      $failReason = "Export exited $LASTEXITCODE`: $exportOut"
    } else {
      $exportOk = $true
      Write-Host "        OK — $SrcPath"
    }
  } catch {
    $failReason = "Export threw: $_"
  }

  # ── Step 2: run Vivado ───────────────────────────────────────────────────

  if ($exportOk) {
    Write-Host "  [2/2] Running Vivado (synth + impl + bitstream)..."

    try {
      $vivadoArgs = @(
        '-mode',   'batch',
        '-nolog',  '-nojournal',
        '-source', $TclScript,
        '-tclargs', $exId, $Part, $Top, $SrcPath, $XdcPath, $ExOutDir
      )

      $vivadoOutput = & $VivadoPath @vivadoArgs 2>&1
      $vivadoExit   = $LASTEXITCODE

      # Save full Vivado output for post-mortem
      $vivadoOutput | Out-File -FilePath $LogPath -Encoding utf8

      $bitExists = Test-Path $BitPath

      if ($vivadoExit -ne 0) {
        $failReason = "Vivado exited $vivadoExit (see $LogPath)"
      } elseif (-not $bitExists) {
        $failReason = "Vivado exited 0 but .bit not found: $BitPath"
      } else {
        $vivadoOk = $true
        Write-Host "        OK — $BitPath"
      }

      if (-not $vivadoOk) {
        Write-Host "        FAILED: $failReason"
      }

    } catch {
      $failReason = "Vivado threw exception: $_"
      Write-Host "        FAILED (exception): $failReason"
    }
  }

  $passed = $exportOk -and $vivadoOk -and $bitExists

  # ── Read manifest for sha values ──────────────────────────────────────────

  $srcSha = ''; $xdcSha = ''
  $manifestFile = Join-Path $ExOutDir 'manifest.json'
  if (Test-Path $manifestFile) {
    try {
      $mJson  = Get-Content $manifestFile -Raw | ConvertFrom-Json
      $srcSha = $mJson.srcSha256
      $xdcSha = $mJson.xdcSha256
    } catch {
      # non-fatal — hashes will be empty in result.json
    }
  }

  # ── Write result.json ─────────────────────────────────────────────────────

  $resultObj = [ordered]@{
    schemaVersion = 1
    exampleId     = $exId
    part          = $Part
    top           = $Top
    pass          = $passed
    failReason    = if ($passed) { $null } else { $failReason }
    srcPath       = $SrcPath
    xdcPath       = $XdcPath
    bitPath       = if ($bitExists) { [string]$BitPath } else { $null }
    logPath       = $LogPath
    srcSha256     = $srcSha
    xdcSha256     = $xdcSha
    startedAt     = $startTime
    finishedAt    = (Get-Date -Format 'o')
  }

  $resultObj | ConvertTo-Json | Out-File -FilePath $ResultPath -Encoding utf8
  Write-Host "        result.json → $ResultPath"

  $Results.Add([pscustomobject]@{
    ExampleId  = $exId
    Pass       = $passed
    FailReason = $failReason
  })
}

# ── Summary table ─────────────────────────────────────────────────────────────

Write-Host ''
Write-Host '══════════════════════════════════════════════════'
Write-Host '  VIVADO SMOKE SUMMARY'
Write-Host '══════════════════════════════════════════════════'

$allPassed = $true
foreach ($r in $Results) {
  if (-not $r.Pass) {
    $allPassed = $false
    Write-Host ("  [FAIL]  {0}  ← {1}" -f $r.ExampleId, $r.FailReason)
  } else {
    Write-Host ("  [PASS]  {0}" -f $r.ExampleId)
  }
}

Write-Host '══════════════════════════════════════════════════'

if ($allPassed) {
  Write-Host '  ALL PASSED'
  exit 0
} else {
  Write-Host '  ONE OR MORE EXAMPLES FAILED'
  exit 1
}
