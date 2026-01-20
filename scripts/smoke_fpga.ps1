# RedByte FPGA smoke test script (Windows)
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke_fpga.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

$BridgeUrl = "http://127.0.0.1:4242"
$HealthUrl = "$BridgeUrl/health"
$PortsUrl = "$BridgeUrl/ports"
$ConnectUrl = "$BridgeUrl/connect"
$ProgramUrl = "$BridgeUrl/program"
$TracePath = Join-Path $RepoRoot "trace\hw_trace.ndjson"

$failures = New-Object System.Collections.Generic.List[string]

function Write-Section([string]$Text) {
  Write-Host ""
  Write-Host "=== $Text ===" -ForegroundColor Cyan
}

function Write-Ok([string]$Text) {
  Write-Host "  [OK] $Text" -ForegroundColor Green
}

function Write-Fail([string]$Text) {
  Write-Host "  [FAIL] $Text" -ForegroundColor Red
  $failures.Add($Text) | Out-Null
}

function Write-Warn([string]$Text) {
  Write-Host "  [WARN] $Text" -ForegroundColor Yellow
}

function Write-Advice([string]$Text) {
  Write-Host "       $Text" -ForegroundColor DarkYellow
}

function Require-Success {
  if ($failures.Count -gt 0) {
    throw "Smoke test failed."
  }
}

Write-Section "Doctor"
try {
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "scripts\doctor.ps1")
  if ($LASTEXITCODE -ne 0) {
    Write-Fail "Doctor failed."
    Require-Success
  }
  Write-Ok "Doctor passed."
} catch {
  Write-Fail "Doctor failed: $($_.Exception.Message)"
  Require-Success
}

Write-Section "Start Bridge"
$prevTrace = $env:RB_FPGA_TRACE
$prevDryRun = $env:RB_FPGA_DRYRUN
$env:RB_FPGA_TRACE = "1"
if ($env:RB_FPGA_SMOKE_DRYRUN -eq "1") {
  $env:RB_FPGA_DRYRUN = "1"
}

if (Test-Path $TracePath) {
  Remove-Item -Path $TracePath -Force -ErrorAction SilentlyContinue
}

$bridgePath = Join-Path $RepoRoot "packages\rb-fpga-bridge\src\index.js"
$proc = Start-Process -FilePath "node" -ArgumentList @($bridgePath) -WorkingDirectory $RepoRoot -PassThru -WindowStyle Hidden

try {
  $deadline = (Get-Date).AddSeconds(15)
  $health = $null
  while ((Get-Date) -lt $deadline) {
    try {
      $health = Invoke-RestMethod -Method Get -Uri $HealthUrl -TimeoutSec 2
      break
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  if (-not $health) {
    Write-Fail "Bridge health check failed."
    Write-Advice "Check that the bridge process started without errors."
    Require-Success
  }
  Write-Ok "Bridge health OK."
  $simMode = $false
  if ($health.sim_mode -eq $true) {
    $simMode = $true
    Write-Ok "SIM mode active."
  } else {
    Write-Ok "Hardware mode active."
  }
  $framesBefore = [int]$health.frames_ok_count
  $crcBefore = [int]$health.crc_fail_count

  Write-Section "Ports"
  $portsResponse = Invoke-RestMethod -Method Get -Uri $PortsUrl -TimeoutSec 5
  $ports = $portsResponse.ports
  if ($null -eq $ports) {
    Write-Fail "Ports response missing."
    Write-Advice "Bridge /ports endpoint returned no data."
    Require-Success
  }
  Write-Ok "Ports returned: $($ports.Count)"
  foreach ($p in $ports) {
    Write-Host ("  - {0} {1}" -f $p.path, $p.manufacturer)
  }
  if (-not $simMode) {
    if ($ports.Count -eq 0) {
      Write-Fail "No COM ports found."
      Write-Advice "Check the Basys 3 USB cable and Windows Device Manager."
      Require-Success
    }
  }

  if ($env:RB_FPGA_SMOKE_PORT -and -not $simMode) {
    $portMatch = $ports | Where-Object { $_.path -eq $env:RB_FPGA_SMOKE_PORT }
    if (-not $portMatch) {
      Write-Fail "Selected COM port not found: $($env:RB_FPGA_SMOKE_PORT)"
      Write-Advice "Use /ports output to choose a valid port or check drivers."
      Require-Success
    }
    Write-Section "Connect"
    $connectBody = @{
      portPath = $env:RB_FPGA_SMOKE_PORT
    }
    if ($env:RB_FPGA_SMOKE_BAUD) {
      $connectBody.baud = [int]$env:RB_FPGA_SMOKE_BAUD
    }
    $connect = Invoke-RestMethod -Method Post -Uri $ConnectUrl -ContentType "application/json" -Body (ConvertTo-Json $connectBody)
    if (-not $connect.ok) {
      Write-Fail "Connect failed: $($connect.error)"
      Write-Advice "Ensure the board is connected and no other app has the port open."
      Require-Success
    }
    Write-Ok "Connected to $($connect.connected_port)"
  } elseif ($simMode) {
    Write-Ok "SIM mode - skipping hardware connect."
  }

  if ($env:RB_FPGA_SMOKE_DRYRUN -eq "1") {
    Write-Section "Program (Dry Run)"
    $tmpDir = Join-Path $RepoRoot ".redbyte\tmp"
    if (-not (Test-Path $tmpDir)) {
      New-Item -ItemType Directory -Path $tmpDir | Out-Null
    }
    $bitPath = Join-Path $tmpDir "smoke.bit"
    Set-Content -Path $bitPath -Value "dummy" -Encoding ascii

    $programBody = @{ bitPath = $bitPath }
    $program = Invoke-RestMethod -Method Post -Uri $ProgramUrl -ContentType "application/json" -Body (ConvertTo-Json $programBody)
    if (-not $program.ok) {
      Write-Fail "Program dry-run failed: $($program.error)"
      Require-Success
    }
    Write-Ok "Program dry-run OK. Log: $($program.logPath)"
  }

  Write-Section "Trace Capture"
  Start-Sleep -Seconds 10

  $healthAfter = Invoke-RestMethod -Method Get -Uri $HealthUrl -TimeoutSec 5
  $framesAfter = [int]$healthAfter.frames_ok_count
  $crcAfter = [int]$healthAfter.crc_fail_count
  $framesDelta = $framesAfter - $framesBefore
  $crcDelta = $crcAfter - $crcBefore

  if ($framesDelta -le 0) {
    Write-Fail "UART not producing RB frames."
    Write-Advice "Check the UART wiring and ensure FPGA firmware is sending binary packets."
    Require-Success
  } else {
    Write-Ok "Frames received: +$framesDelta"
  }

  if ($crcDelta -gt 10 -and $crcDelta -gt $framesDelta) {
    Write-Fail "CRC failures exploding (delta=$crcDelta)."
    Write-Advice "Check baud rate, packet format, and UART signal integrity."
    Require-Success
  } elseif ($crcDelta -gt 0) {
    Write-Warn "CRC failures detected (delta=$crcDelta)."
  }

  $packetAge = $healthAfter.last_packet_age_ms
  if ($packetAge -gt 3000) {
    Write-Fail "Packet age too high: $packetAge ms."
    Write-Advice "Bridge isn't receiving data; check FPGA stream and COM port."
    Require-Success
  } elseif ($packetAge -gt 1000) {
    Write-Warn "Packet age high: $packetAge ms."
  } else {
    Write-Ok "Packet age OK: $packetAge ms."
  }

  if (-not (Test-Path $TracePath)) {
    Write-Fail "Trace file not found: $TracePath"
    Write-Advice "Ensure RB_FPGA_TRACE=1 is set and binary packets are being parsed."
    Require-Success
  }

  $lines = Get-Content -Path $TracePath | Where-Object { $_.Trim().Length -gt 0 }
  if ($lines.Count -lt 5) {
    Write-Fail "Trace has fewer than 5 events."
    Write-Advice "Trace file not growing; check binary packet stream."
    Require-Success
  }

  $prevSeq = [int64]::MinValue
  foreach ($line in $lines) {
    try {
      $event = $line | ConvertFrom-Json -ErrorAction Stop
    } catch {
      Write-Fail "Invalid NDJSON line in trace."
      Require-Success
    }
    $seq = [int64]$event.mono_seq
    if ($seq -lt $prevSeq) {
      Write-Fail "mono_seq is not nondecreasing."
      Require-Success
    }
    $prevSeq = $seq
  }

  Write-Ok "Trace NDJSON valid with nondecreasing mono_seq."
} catch {
  Write-Fail "Smoke test failed: $($_.Exception.Message)"
} finally {
  if ($proc -and -not $proc.HasExited) {
    Stop-Process -Id $proc.Id -ErrorAction SilentlyContinue
  }

  if ($null -ne $prevTrace) {
    $env:RB_FPGA_TRACE = $prevTrace
  } else {
    Remove-Item Env:RB_FPGA_TRACE -ErrorAction SilentlyContinue
  }

  if ($null -ne $prevDryRun) {
    $env:RB_FPGA_DRYRUN = $prevDryRun
  } else {
    Remove-Item Env:RB_FPGA_DRYRUN -ErrorAction SilentlyContinue
  }
}

Write-Host ""
if ($failures.Count -eq 0) {
  Write-Host "=== SMOKE TEST PASSED ===" -ForegroundColor Green
  exit 0
}

Write-Host "=== SMOKE TEST FAILED ===" -ForegroundColor Red
Write-Host "Failures:"
foreach ($item in $failures) {
  Write-Host " - $item"
}
exit 1
