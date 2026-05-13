Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:RedByteNodeMinimumVersion = [version]"20.19.0"
$script:RedBytePnpmMinimumVersion = [version]"10.24.0"
$script:RedBytePnpmRequiredVersion = "10.24.0"

function Write-RbSection {
  param([Parameter(Mandatory = $true)][string]$Message)

  Write-Host ""
  Write-Host "== $Message ==" -ForegroundColor Cyan
}

function Write-RbPass {
  param([Parameter(Mandatory = $true)][string]$Message)

  Write-Host "PASS $Message" -ForegroundColor Green
}

function Write-RbWarn {
  param([Parameter(Mandatory = $true)][string]$Message)

  Write-Host "WARN $Message" -ForegroundColor Yellow
}

function Write-RbFail {
  param([Parameter(Mandatory = $true)][string]$Message)

  Write-Host "FAIL $Message" -ForegroundColor Red
}

function Resolve-RedByteRepoRoot {
  param([string]$StartPath = $PSScriptRoot)

  $candidate = Resolve-Path -LiteralPath $StartPath
  if ((Get-Item -LiteralPath $candidate).PSIsContainer -eq $false) {
    $candidate = Split-Path -Parent $candidate
  }

  while ($candidate) {
    $packageJson = Join-Path $candidate "package.json"
    $pnpmWorkspace = Join-Path $candidate "pnpm-workspace.yaml"
    if ((Test-Path -LiteralPath $packageJson) -and (Test-Path -LiteralPath $pnpmWorkspace)) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }

    $parent = Split-Path -Parent $candidate
    if ($parent -eq $candidate) {
      break
    }
    $candidate = $parent
  }

  throw "Could not find the RedByte repo root from $StartPath."
}

function ConvertTo-RbVersionOrNull {
  param([AllowNull()][string]$Raw)

  if ([string]::IsNullOrWhiteSpace($Raw)) {
    return $null
  }

  try {
    $clean = ($Raw.Trim() -replace "^[vV]", "" -replace "[^0-9.].*$", "").Trim(".")
    return [version]$clean
  }
  catch {
    return $null
  }
}

function Test-RbCommand {
  param([Parameter(Mandatory = $true)][string]$Name)

  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Invoke-RbNative {
  param(
    [Parameter(Mandatory = $true)][string]$File,
    [string[]]$Arguments = @(),
    [string]$Display = ""
  )

  $label = $Display
  if ([string]::IsNullOrWhiteSpace($label)) {
    $label = "$File $($Arguments -join ' ')".Trim()
  }

  & $File @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$label failed with exit code $LASTEXITCODE."
  }
}

function Invoke-RbPnpm {
  param(
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [string]$Display = ""
  )

  Invoke-RbNative -File "pnpm" -Arguments $Arguments -Display $Display
}

function Get-RbPackageJson {
  param([Parameter(Mandatory = $true)][string]$RepoRoot)

  $packageJsonPath = Join-Path $RepoRoot "package.json"
  return Get-Content -Raw -LiteralPath $packageJsonPath | ConvertFrom-Json
}

function Test-RbPackageScript {
  param(
    [Parameter(Mandatory = $true)][object]$PackageJson,
    [Parameter(Mandatory = $true)][string]$ScriptName
  )

  return $PackageJson.scripts.PSObject.Properties.Name -contains $ScriptName
}

function Get-RbLogRoot {
  param([Parameter(Mandatory = $true)][string]$RepoRoot)

  $logRoot = Join-Path $RepoRoot ".redbyte/course/logs"
  New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
  return $logRoot
}

function Test-RbNode {
  if (-not (Test-RbCommand "node")) {
    return @{ Ok = $false; Message = "Node.js was not found."; Version = $null }
  }

  $raw = (& node --version).Trim()
  $version = ConvertTo-RbVersionOrNull $raw
  if (-not $version -or $version -lt $script:RedByteNodeMinimumVersion) {
    return @{ Ok = $false; Message = "Node.js $raw is too old; RedByte requires $script:RedByteNodeMinimumVersion or newer."; Version = $raw }
  }

  return @{ Ok = $true; Message = "Node.js $raw"; Version = $raw }
}

function Test-RbPnpm {
  if (-not (Test-RbCommand "pnpm")) {
    return @{ Ok = $false; Message = "pnpm was not found."; Version = $null }
  }

  $raw = (& pnpm --version).Trim()
  $version = ConvertTo-RbVersionOrNull $raw
  if (-not $version -or $version -lt $script:RedBytePnpmMinimumVersion) {
    return @{ Ok = $false; Message = "pnpm $raw is too old; RedByte requires $script:RedBytePnpmRequiredVersion or newer."; Version = $raw }
  }

  return @{ Ok = $true; Message = "pnpm $raw"; Version = $raw }
}

function Ensure-RbNodeOrThrow {
  $result = Test-RbNode
  if (-not $result.Ok) {
    throw $result.Message
  }
  return $result
}

function Ensure-RbPnpmOrThrow {
  $result = Test-RbPnpm
  if (-not $result.Ok) {
    throw $result.Message
  }
  return $result
}

function Test-RbDependenciesInstalled {
  param([Parameter(Mandatory = $true)][string]$RepoRoot)

  return (Test-Path -LiteralPath (Join-Path $RepoRoot "node_modules/.pnpm"))
}

function Test-RbPortOpen {
  param(
    [Parameter(Mandatory = $true)][string]$HostName,
    [Parameter(Mandatory = $true)][int]$Port
  )

  $client = $null
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $async = $client.BeginConnect($HostName, $Port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne(300)) {
      return $false
    }
    $client.EndConnect($async)
    return $true
  }
  catch {
    return $false
  }
  finally {
    if ($client) {
      $client.Close()
    }
  }
}

function Find-RbAvailablePort {
  param(
    [int]$StartPort = 5173,
    [int]$MaxPort = 5199
  )

  for ($port = $StartPort; $port -le $MaxPort; $port++) {
    if (-not (Test-RbPortOpen -HostName "127.0.0.1" -Port $port)) {
      return $port
    }
  }

  throw "No available local port found from $StartPort to $MaxPort."
}

function Wait-RbHttp {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$TimeoutSec = 60,
    [System.Diagnostics.Process]$Process
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    if ($Process -and $Process.HasExited) {
      throw "RedByte server exited before $Url responded. Check the launch logs."
    }

    try {
      $response = Invoke-WebRequest -Uri $Url -Method Head -TimeoutSec 2 -UseBasicParsing
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $true
      }
    }
    catch {
      Start-Sleep -Milliseconds 500
    }
  }

  throw "Timed out waiting for $Url."
}
