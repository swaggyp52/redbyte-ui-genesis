[CmdletBinding()]
param(
  [int]$Port = 5173,
  [switch]$Production,
  [switch]$Foreground,
  [switch]$NoOpen,
  [switch]$SmokeTest,
  [switch]$StrictPort,
  [int]$TimeoutSec = 60
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

. (Join-Path $PSScriptRoot "common.ps1")

$RepoRoot = Resolve-RedByteRepoRoot -StartPath $PSScriptRoot
$StartScript = Join-Path $RepoRoot "Start-RedByte.ps1"
$LogRoot = Get-RbLogRoot -RepoRoot $RepoRoot
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$OutLog = Join-Path $LogRoot "launch-$Timestamp.out.log"
$ErrLog = Join-Path $LogRoot "launch-$Timestamp.err.log"

Set-Location -LiteralPath $RepoRoot

try {
  Write-Host "RedByte ECE141 launcher" -ForegroundColor Cyan
  Write-Host "Repo: $RepoRoot" -ForegroundColor DarkGray

  if (-not (Test-Path -LiteralPath $StartScript)) {
    throw "Start-RedByte.ps1 was not found at $StartScript."
  }

  $node = Ensure-RbNodeOrThrow
  Write-RbPass $node.Message

  $pnpm = Ensure-RbPnpmOrThrow
  Write-RbPass $pnpm.Message

  if (-not (Test-RbDependenciesInstalled -RepoRoot $RepoRoot)) {
    throw "Dependencies are missing. Run .\setup.ps1 first."
  }

  $SelectedPort = $Port
  if (Test-RbPortOpen -HostName "127.0.0.1" -Port $SelectedPort) {
    if ($StrictPort) {
      throw "Port $SelectedPort is already in use."
    }
    $SelectedPort = Find-RbAvailablePort -StartPort ($Port + 1)
    Write-RbWarn "Port $Port is already in use; using $SelectedPort instead."
  }

  $Url = if ($Production) { "http://127.0.0.1:$SelectedPort/os/" } else { "http://127.0.0.1:$SelectedPort/" }
  Write-RbPass "URL: $Url"
  Write-Host "Course logs folder: .redbyte/course/logs" -ForegroundColor DarkGray
  Write-Host "Logs: $LogRoot" -ForegroundColor DarkGray

  $scriptArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $StartScript, "-SkipInstall", "-NoOpen", "-Port", "$SelectedPort")
  if ($Production) {
    $scriptArgs += "-Production"
  }
  if ($SmokeTest) {
    $scriptArgs += "-SmokeTest"
  }

  if ($SmokeTest -or $Foreground) {
    & powershell.exe @scriptArgs
    if ($LASTEXITCODE -ne 0) {
      throw "Start-RedByte.ps1 failed with exit code $LASTEXITCODE."
    }
    exit 0
  }

  $process = Start-Process -FilePath "powershell.exe" -ArgumentList $scriptArgs -WorkingDirectory $RepoRoot -RedirectStandardOutput $OutLog -RedirectStandardError $ErrLog -PassThru -WindowStyle Hidden
  Wait-RbHttp -Url $Url -TimeoutSec $TimeoutSec -Process $process | Out-Null

  $statePath = Join-Path $LogRoot "launch-latest.json"
  [pscustomobject]@{
    pid = $process.Id
    url = $Url
    startedAt = (Get-Date).ToString("o")
    stdout = $OutLog
    stderr = $ErrLog
    stopCommand = "taskkill /PID $($process.Id) /T /F"
  } | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8

  Write-RbPass "RedByte is running in the background. PID: $($process.Id)"
  Write-Host "Open: $Url" -ForegroundColor Green
  Write-Host "Stop server: taskkill /PID $($process.Id) /T /F" -ForegroundColor Yellow
  Write-Host "Latest launch state: $statePath" -ForegroundColor DarkGray

  if (-not $NoOpen) {
    Start-Process $Url
  }

  exit 0
}
catch {
  Write-RbFail $_.Exception.Message
  Write-Host "Stdout log: $OutLog" -ForegroundColor Yellow
  Write-Host "Stderr log: $ErrLog" -ForegroundColor Yellow
  exit 1
}
