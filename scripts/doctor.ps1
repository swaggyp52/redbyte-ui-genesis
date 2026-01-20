# RedByte FPGA MVP doctor script (Windows)
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\doctor.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

$RequiredNodeVersion = "20.19.0"
$RequiredPnpmVersion = "10.24.0"
$RequiredVivadoVersion = "2024.1"
$BridgeHttpPort = 4242
$SkipVivado = $env:RB_FPGA_SIM -in @("1", "true") -or $env:RB_FPGA_SKIP_VIVADO -in @("1", "true")

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

function Get-VivadoInfo {
  $vivadoExe = $null

  if ($env:VIVADO_PATH) {
    $candidate = $env:VIVADO_PATH
    if ($candidate -like "*.bat") {
      $vivadoExe = $candidate
    } else {
      $vivadoExe = Join-Path $candidate "vivado.bat"
    }
    if (-not (Test-Path $vivadoExe)) {
      return $null
    }
  } else {
    $paths = @(
      "C:\Xilinx\Vivado\2024.1\bin\vivado.bat",
      "D:\Xilinx\Vivado\2024.1\bin\vivado.bat",
      "C:\Program Files\Xilinx\Vivado\2024.1\bin\vivado.bat"
    )
    foreach ($candidate in $paths) {
      if (Test-Path $candidate) {
        $vivadoExe = $candidate
        break
      }
    }
  }

  if (-not $vivadoExe) {
    return $null
  }

  $version = $null
  try {
    $out = & $vivadoExe -version 2>$null
    if ($out -match "Vivado v?([0-9.]+)") {
      $version = $Matches[1]
    }
  } catch {
    # Ignore version parse errors
  }

  return @{ Path = $vivadoExe; Version = $version }
}

Write-Section "Core Tools"

try {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Fail "Node.js not found."
  } else {
    $nodeVersion = (node --version).Trim().TrimStart("v")
    if ($nodeVersion -ne $RequiredNodeVersion) {
      Write-Fail "Node.js $RequiredNodeVersion required, found $nodeVersion."
    } else {
      Write-Ok "Node.js v$nodeVersion"
    }
  }
} catch {
  Write-Fail "Node.js check failed: $($_.Exception.Message)"
}

try {
  if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Fail "pnpm not found."
  } else {
    $pnpmVersion = (pnpm --version).Trim()
    if ($pnpmVersion -ne $RequiredPnpmVersion) {
      Write-Fail "pnpm $RequiredPnpmVersion required, found $pnpmVersion."
    } else {
      Write-Ok "pnpm $pnpmVersion"
    }
  }
} catch {
  Write-Fail "pnpm check failed: $($_.Exception.Message)"
}

try {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Fail "Git not found."
  } else {
    $gitVersion = (git --version).Trim()
    Write-Ok $gitVersion
  }
} catch {
  Write-Fail "Git check failed: $($_.Exception.Message)"
}

Write-Section "Vivado"

try {
  if ($SkipVivado) {
    Write-Ok "Vivado check skipped (SIM mode or override)."
  } else {
    $vivado = Get-VivadoInfo
    if (-not $vivado) {
      Write-Fail "Vivado $RequiredVivadoVersion not detected."
    } elseif (-not $vivado.Version) {
      Write-Fail "Vivado detected at $($vivado.Path) but version could not be read."
    } elseif (-not ($vivado.Version -like "$RequiredVivadoVersion*")) {
      Write-Fail "Vivado $RequiredVivadoVersion required, found $($vivado.Version)."
    } else {
      Write-Ok "Vivado $($vivado.Version) ($($vivado.Path))"
    }
  }
} catch {
  Write-Fail "Vivado check failed: $($_.Exception.Message)"
}

Write-Section "Bridge Vivado Discovery"

try {
  if ($SkipVivado) {
    Write-Ok "Bridge Vivado detection skipped (SIM mode or override)."
  } else {
    $script = "import { findVivado } from './packages/rb-fpga-bridge/src/vivado/findVivado.js'; console.log(findVivado());"
    $bridgeVivado = node --input-type=module -e $script
    if ($LASTEXITCODE -ne 0 -or -not $bridgeVivado) {
      Write-Fail "Bridge Vivado detection failed."
    } else {
      Write-Ok "Bridge findVivado: $bridgeVivado"
    }
  }
} catch {
  Write-Fail "Bridge Vivado detection failed: $($_.Exception.Message)"
}

Write-Section "USB and COM Ports"

try {
  $usbDevices = Get-PnpDevice -PresentOnly -Class USB -ErrorAction Stop
  if ($usbDevices.Count -gt 0) {
    Write-Ok "USB devices present: $($usbDevices.Count)"
  } else {
    Write-Fail "No USB devices detected."
  }
} catch {
  Write-Fail "USB device check failed: $($_.Exception.Message)"
}

try {
  $serialPorts = Get-CimInstance Win32_SerialPort -ErrorAction SilentlyContinue
  if ($null -ne $serialPorts -and $serialPorts.Count -gt 0) {
    $portList = ($serialPorts | Select-Object -ExpandProperty DeviceID) -join ", "
    Write-Ok "COM ports: $portList"
  } else {
    Write-Fail "No COM ports detected. Connect the Basys 3 board."
  }
} catch {
  Write-Fail "COM port check failed: $($_.Exception.Message)"
}

Write-Section "Node Modules"

try {
  if (Test-Path "node_modules") {
    Write-Ok "node_modules present at repo root."
  } else {
    Write-Fail "node_modules missing at repo root. Run pnpm install --frozen-lockfile."
  }
} catch {
  Write-Fail "node_modules check failed: $($_.Exception.Message)"
}

try {
  if (Test-Path "packages\\rb-fpga-bridge\\node_modules") {
    Write-Ok "rb-fpga-bridge node_modules present."
  } else {
    Write-Fail "rb-fpga-bridge node_modules missing. Run pnpm install --frozen-lockfile."
  }
} catch {
  Write-Fail "rb-fpga-bridge node_modules check failed: $($_.Exception.Message)"
}

Write-Section "Bridge Smoke"

$bridgePath = Join-Path $RepoRoot "packages\\rb-fpga-bridge\\src\\index.js"
if (-not (Test-Path $bridgePath)) {
  Write-Fail "Bridge entrypoint not found: $bridgePath"
} else {
  $prevMock = $env:RB_FPGA_MOCK
  $env:RB_FPGA_MOCK = "1"
  $proc = $null
  try {
    $proc = Start-Process -FilePath "node" -ArgumentList @($bridgePath) -WorkingDirectory $RepoRoot -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 2
    $portOpen = Test-NetConnection -ComputerName "127.0.0.1" -Port $BridgeHttpPort -InformationLevel Quiet
    if ($portOpen) {
      Write-Ok "Bridge HTTP port $BridgeHttpPort is reachable (mock mode)."
    } else {
      Write-Fail "Bridge HTTP port $BridgeHttpPort not reachable."
    }
  } catch {
    Write-Fail "Bridge launch failed: $($_.Exception.Message)"
  } finally {
    if ($proc -and -not $proc.HasExited) {
      Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
    if ($null -ne $prevMock) {
      $env:RB_FPGA_MOCK = $prevMock
    } else {
      Remove-Item Env:RB_FPGA_MOCK -ErrorAction SilentlyContinue
    }
  }
}

Write-Host ""
if ($failures.Count -eq 0) {
  Write-Host "=== DOCTOR PASSED ===" -ForegroundColor Green
  exit 0
}

Write-Host "=== DOCTOR FAILED ===" -ForegroundColor Red
Write-Host "Failures:"
foreach ($item in $failures) {
  Write-Host " - $item"
}
exit 1
