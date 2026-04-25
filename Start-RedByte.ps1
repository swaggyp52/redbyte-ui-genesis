<#
.SYNOPSIS
  One-click local launcher for RedByte IDE.

.DESCRIPTION
  Checks Node and pnpm, installs workspace dependencies with pnpm when needed,
  then starts the RedByte IDE at the correct local URL. Double-click run.bat for
  the default path, or run this script directly for options.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\Start-RedByte.ps1

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\Start-RedByte.ps1 -Production
#>

[CmdletBinding()]
param(
  [switch]$Production,
  [switch]$SkipInstall,
  [switch]$SkipBuild,
  [switch]$NoOpen,
  [switch]$SmokeTest,
  [int]$Port = 5173,
  [int]$SmokeTimeoutSec = 60
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$NodeMinVersion = [version]"20.19.0"
$PnpmVersion = "10.24.0"
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PlaygroundFilter = "@redbyte/playground"
$script:PnpmFile = $null
$script:PnpmPrefix = @()

if ($Production -and -not $PSBoundParameters.ContainsKey("Port")) {
  $Port = 4173
}

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "[RB_START] $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
  Write-Host "  OK  $Message" -ForegroundColor Green
}

function Write-Warn([string]$Message) {
  Write-Host "  WARN $Message" -ForegroundColor Yellow
}

function Write-Fail([string]$Message) {
  Write-Host ""
  Write-Host "  FAIL $Message" -ForegroundColor Red
  exit 1
}

function Get-CommandOrNull([string]$Name) {
  return Get-Command $Name -ErrorAction SilentlyContinue
}

function Invoke-Checked([string]$File, [string[]]$Arguments) {
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) {
    Write-Fail "$File $($Arguments -join ' ') exited with code $LASTEXITCODE."
  }
}

function Set-PnpmInvoker([string]$File, [string[]]$Prefix) {
  $resolved = Get-CommandOrNull $File
  if ($resolved) {
    $script:PnpmFile = $resolved.Source
  }
  else {
    $script:PnpmFile = $File
  }
  $script:PnpmPrefix = $Prefix
}

function Invoke-Pnpm([string[]]$Arguments) {
  if (-not $script:PnpmFile) {
    Write-Fail "pnpm was used before the launcher finished its pnpm check."
  }

  Invoke-Checked $script:PnpmFile ($script:PnpmPrefix + $Arguments)
}

function Get-PnpmVersionRaw {
  if (-not $script:PnpmFile) {
    return $null
  }

  $versionArgs = $script:PnpmPrefix + @("-v")
  return (& $script:PnpmFile @versionArgs).Trim()
}

function ConvertTo-VersionOrNull([string]$Raw) {
  try {
    $clean = ($Raw -replace "[^0-9.].*$", "").Trim(".")
    return [version]$clean
  }
  catch {
    return $null
  }
}

function Ensure-Node {
  Write-Step "Checking Node.js"
  $node = Get-CommandOrNull "node"
  if (-not $node) {
    Write-Fail "Node.js was not found. Install Node.js $NodeMinVersion or newer, then run run.bat again."
  }

  $raw = (& node -v).Trim().TrimStart("v")
  $version = ConvertTo-VersionOrNull $raw
  if (-not $version -or $version -lt $NodeMinVersion) {
    Write-Fail "Node.js $raw is too old. RedByte requires Node.js $NodeMinVersion or newer."
  }

  Write-Ok "Node.js $version"
}

function Ensure-Pnpm {
  Write-Step "Checking pnpm"
  $pnpm = Get-CommandOrNull "pnpm"

  if (-not $pnpm) {
    Write-Warn "pnpm was not found. Trying Corepack for pnpm@$PnpmVersion."
    $corepack = Get-CommandOrNull "corepack"
    if (-not $corepack) {
      Write-Fail "Corepack was not found. Reinstall Node.js $NodeMinVersion or newer with Corepack enabled."
    }

    Invoke-Checked "corepack" @("prepare", "pnpm@$PnpmVersion", "--activate")
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    $pnpm = Get-CommandOrNull "pnpm"
  }

  if ($pnpm) {
    Set-PnpmInvoker $pnpm.Source @()
  }
  else {
    Set-PnpmInvoker "corepack" @("pnpm")
  }

  $raw = Get-PnpmVersionRaw
  $version = ConvertTo-VersionOrNull $raw
  if (-not $version -or $version -lt ([version]$PnpmVersion)) {
    Write-Warn "pnpm $raw detected; activating pnpm@$PnpmVersion with Corepack."
    Invoke-Checked "corepack" @("prepare", "pnpm@$PnpmVersion", "--activate")
    if (Get-CommandOrNull "pnpm") {
      Set-PnpmInvoker (Get-CommandOrNull "pnpm").Source @()
    }
    else {
      Set-PnpmInvoker "corepack" @("pnpm")
    }
    $raw = Get-PnpmVersionRaw
    $version = ConvertTo-VersionOrNull $raw
  }

  if (-not $version -or $version -lt ([version]$PnpmVersion)) {
    Write-Fail "pnpm $raw is too old. RedByte requires pnpm $PnpmVersion or newer."
  }

  Write-Ok "pnpm $version"
}

function Ensure-Dependencies {
  if ($SkipInstall) {
    Write-Warn "Skipping dependency check because -SkipInstall was supplied."
    return
  }

  Write-Step "Checking workspace dependencies"
  $pnpmStore = Join-Path $RepoRoot "node_modules\.pnpm"
  if (Test-Path $pnpmStore) {
    Write-Ok "pnpm workspace dependencies are present."
    return
  }

  Write-Warn "Dependencies are missing. Running pnpm install --frozen-lockfile."
  Invoke-Pnpm @("install", "--frozen-lockfile")
  Write-Ok "Dependencies installed."
}

function Build-ForProduction {
  if (-not $Production) {
    return
  }

  if ($SkipBuild) {
    Write-Warn "Skipping production build because -SkipBuild was supplied."
    return
  }

  Write-Step "Building RedByte IDE production bundle"
  Invoke-Pnpm @("--filter", $PlaygroundFilter, "build")
  Write-Ok "Production bundle built."
}

function Get-LaunchUrl {
  if ($Production) {
    return "http://127.0.0.1:$Port/os/"
  }

  return "http://127.0.0.1:$Port/"
}

function Start-ServerSmoke {
  param([string[]]$Arguments, [string]$ExpectedUrl)

  Write-Step "Smoke-testing startup"
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $invocationArgs = $script:PnpmPrefix + $Arguments
  $quotedRepo = $RepoRoot.Replace("'", "''")
  $quotedPnpm = $script:PnpmFile.Replace("'", "''")
  $quotedArgs = ($invocationArgs | ForEach-Object { "'" + ($_.Replace("'", "''")) + "'" }) -join " "
  $command = "Set-Location -LiteralPath '$quotedRepo'; & '$quotedPnpm' $quotedArgs"
  $encodedCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
  $psi.FileName = "powershell.exe"
  $psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -EncodedCommand $encodedCommand"
  $psi.WorkingDirectory = $RepoRoot
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $psi
  $null = $process.Start()

  try {
    $deadline = (Get-Date).AddSeconds($SmokeTimeoutSec)
    while ((Get-Date) -lt $deadline) {
      if ($process.HasExited) {
        $stderr = $process.StandardError.ReadToEnd()
        $stdout = $process.StandardOutput.ReadToEnd()
        Write-Host $stdout
        Write-Host $stderr
        Write-Fail "Startup process exited before serving $ExpectedUrl."
      }

      try {
        $response = Invoke-WebRequest -Uri $ExpectedUrl -Method Head -TimeoutSec 2 -UseBasicParsing
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
          Write-Ok "Startup served $ExpectedUrl with HTTP $($response.StatusCode)."
          return
        }
      }
      catch {
        Start-Sleep -Milliseconds 500
      }
    }

    Write-Fail "Timed out waiting for $ExpectedUrl."
  }
  finally {
    if (-not $process.HasExited) {
      & taskkill.exe /PID $process.Id /T /F | Out-Null
    }
  }
}

Set-Location $RepoRoot

Write-Host "RedByte IDE local launcher" -ForegroundColor Cyan
Write-Host "Repo: $RepoRoot" -ForegroundColor DarkGray

Ensure-Node
Ensure-Pnpm
Ensure-Dependencies
Build-ForProduction

$launchUrl = Get-LaunchUrl
Write-Step "Starting RedByte IDE"
Write-Ok "URL: $launchUrl"

if ($Production) {
  $serverArgs = @("--filter", $PlaygroundFilter, "exec", "vite", "preview", "--host", "127.0.0.1", "--port", "$Port")
  if (-not $NoOpen -and -not $SmokeTest) {
    $serverArgs += @("--open", "/os/")
  }
}
else {
  $serverArgs = @("--filter", $PlaygroundFilter, "exec", "vite", "--config", "vite.config.ts", "--host", "127.0.0.1", "--port", "$Port")
  if (-not $NoOpen -and -not $SmokeTest) {
    $serverArgs += @("--open", "/")
  }
}

if ($SmokeTest) {
  Start-ServerSmoke -Arguments $serverArgs -ExpectedUrl $launchUrl
  exit 0
}

Write-Host ""
Write-Host "Leave this window open while using RedByte. Press Ctrl+C to stop the server." -ForegroundColor Yellow
Write-Host ""

Invoke-Pnpm $serverArgs
