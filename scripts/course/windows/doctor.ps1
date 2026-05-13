[CmdletBinding()]
param(
  [switch]$SkipSmoke,
  [switch]$SkipRouteTest,
  [switch]$RequireVivado,
  [switch]$RequireGit
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

. (Join-Path $PSScriptRoot "common.ps1")

$RepoRoot = Resolve-RedByteRepoRoot -StartPath $PSScriptRoot
Set-Location -LiteralPath $RepoRoot

$script:Failures = New-Object System.Collections.Generic.List[string]
$script:Warnings = New-Object System.Collections.Generic.List[string]

function Add-DoctorPass {
  param([string]$Message)
  Write-RbPass $Message
}

function Add-DoctorWarn {
  param([string]$Message)
  Write-RbWarn $Message
  $script:Warnings.Add($Message) | Out-Null
}

function Add-DoctorFail {
  param([string]$Message)
  Write-RbFail $Message
  $script:Failures.Add($Message) | Out-Null
}

function Test-OptionalVivado {
  $candidates = @()
  if ($env:VIVADO_PATH) {
    $candidates += $env:VIVADO_PATH
  }
  if (Test-RbCommand "vivado") {
    $candidates += (Get-Command vivado).Source
  }
  $candidates += @(
    "C:\Xilinx\Vivado\2024.2\bin\vivado.bat",
    "D:\Xilinx\Vivado\2024.2\bin\vivado.bat",
    "C:\Program Files\Xilinx\Vivado\2024.2\bin\vivado.bat"
  )

  foreach ($candidate in $candidates) {
    if ([string]::IsNullOrWhiteSpace($candidate)) {
      continue
    }
    $path = $candidate
    if ((Test-Path -LiteralPath $path) -and ((Get-Item -LiteralPath $path).PSIsContainer)) {
      $path = Join-Path $path "bin\vivado.bat"
    }
    if (Test-Path -LiteralPath $path) {
      return $path
    }
  }

  return $null
}

Write-Host "RedByte ECE141 doctor" -ForegroundColor Cyan
Write-Host "Repo: $RepoRoot" -ForegroundColor DarkGray

Write-RbSection "Core tools"
$node = Test-RbNode
if ($node.Ok) { Add-DoctorPass $node.Message } else { Add-DoctorFail $node.Message }

$pnpm = Test-RbPnpm
if ($pnpm.Ok) { Add-DoctorPass $pnpm.Message } else { Add-DoctorFail $pnpm.Message }

if (Test-RbCommand "git") {
  Add-DoctorPass "Git $((git --version).Trim())"
}
elseif ($RequireGit) {
  Add-DoctorFail "Git was not found."
}
else {
  Add-DoctorWarn "Git was not found. ZIP distributions can still launch, but update.ps1 needs Git for clone updates."
}

Write-RbSection "Workspace"
if (Test-RbDependenciesInstalled -RepoRoot $RepoRoot) {
  Add-DoctorPass "pnpm dependency install state is present."
}
else {
  Add-DoctorFail "Dependencies are missing. Run .\setup.ps1."
}

try {
  $packageJson = Get-RbPackageJson -RepoRoot $RepoRoot
  foreach ($scriptName in @("start:smoke", "rb:site:start:test", "build:unified", "typecheck")) {
    if (Test-RbPackageScript -PackageJson $packageJson -ScriptName $scriptName) {
      Add-DoctorPass "package.json has $scriptName."
    }
    else {
      Add-DoctorFail "package.json is missing $scriptName."
    }
  }
}
catch {
  Add-DoctorFail "Could not inspect package.json: $($_.Exception.Message)"
}

Write-RbSection "Cheap product checks"
if ($SkipRouteTest) {
  Add-DoctorWarn "Skipped pnpm -s rb:site:start:test."
}
elseif ($pnpm.Ok) {
  try {
    Invoke-RbPnpm -Arguments @("-s", "rb:site:start:test") -Display "pnpm -s rb:site:start:test"
    Add-DoctorPass "Public start route contract passed."
  }
  catch {
    Add-DoctorFail $_.Exception.Message
  }
}

if ($SkipSmoke) {
  Add-DoctorWarn "Skipped pnpm start:smoke."
}
elseif ($pnpm.Ok -and (Test-RbDependenciesInstalled -RepoRoot $RepoRoot)) {
  try {
    Invoke-RbPnpm -Arguments @("start:smoke") -Display "pnpm start:smoke"
    Add-DoctorPass "Local startup smoke passed."
  }
  catch {
    Add-DoctorFail $_.Exception.Message
  }
}

Write-RbSection "Optional hardware"
$vivadoPath = Test-OptionalVivado
if ($vivadoPath) {
  Add-DoctorPass "Vivado detected at $vivadoPath."
}
elseif ($RequireVivado) {
  Add-DoctorFail "Vivado was not detected, but -RequireVivado was supplied."
}
else {
  Add-DoctorWarn "Vivado was not detected. Normal app launch still works; Vivado is needed later for E1 build/bitstream evidence."
}

try {
  if (Get-Command Get-PnpDevice -ErrorAction SilentlyContinue) {
    $basys = Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue | Where-Object {
      $_.FriendlyName -match "Basys|Digilent|Xilinx" -or $_.InstanceId -match "Digilent|Xilinx"
    } | Select-Object -First 3
    if ($basys) {
      Add-DoctorPass "Basys3/Digilent/Xilinx-like USB device detected."
    }
    else {
      Add-DoctorWarn "Basys3 was not detected. This is not a launch failure; hardware evidence needs a board later."
    }
  }
  else {
    Add-DoctorWarn "Basys3 USB check skipped because Get-PnpDevice is unavailable."
  }
}
catch {
  Add-DoctorWarn "Basys3 USB check could not complete: $($_.Exception.Message)"
}

Write-RbSection "Summary"
Write-Host "PASS/WARN/FAIL summary" -ForegroundColor Cyan
Write-Host "Warnings: $($script:Warnings.Count)" -ForegroundColor Yellow
Write-Host "Failures: $($script:Failures.Count)" -ForegroundColor $(if ($script:Failures.Count -eq 0) { "Green" } else { "Red" })

if ($script:Failures.Count -gt 0) {
  foreach ($failure in $script:Failures) {
    Write-Host " - $failure" -ForegroundColor Red
  }
  exit 1
}

exit 0
