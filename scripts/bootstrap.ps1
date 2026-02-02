# scripts/bootstrap.ps1
# REDBYTE GOLDEN BOOTSTRAP (Fresh Machine Edition)
# Run: powershell -NoProfile -ExecutionPolicy Bypass -Command "iwr -useb 'https://raw.githubusercontent.com/swaggyp52/redbyte-ui-genesis/main/scripts/bootstrap.ps1' | iex"

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# ====== CONFIG ======
$NodeMinVersion = [version]"20.19.0"
$NodeMsiUrl = "https://nodejs.org/dist/v20.19.0/node-v20.19.0-x64.msi"
$PnpmVersion = "10.24.0"
$RepoZipUrl = "https://github.com/swaggyp52/redbyte-ui-genesis/archive/refs/heads/main.zip"
$InstallRoot = "C:\RedByte"
# ====================

function Write-Step($msg) { Write-Host ""; Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "    v $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    ! $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host ""; Write-Host "X $msg" -ForegroundColor Red; exit 1 }

# 1. Admin Check
Write-Step "Checking Permissions"
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (-not $isAdmin) {
  Write-Host "This script requires Administrator privileges." -ForegroundColor Red
  Write-Fail "Please run as Administrator."
}
Write-Ok "Running as Administrator."

# 2. Node.js Install
Write-Step "Checking Node.js"
$nodeOk = $false
if (Get-Command node -ErrorAction SilentlyContinue) {
  $vRaw = (node -v).TrimStart("v")
  $vCurrent = [version]$vRaw
  if ($vCurrent -ge $NodeMinVersion) { 
    $nodeOk = $true 
    Write-Ok "Node found."
  }
}

if (-not $nodeOk) {
  Write-Warn "Installing Node.js..."
  $msiPath = Join-Path $env:TEMP "node-lts.msi"
  try {
    Invoke-WebRequest -Uri $NodeMsiUrl -OutFile $msiPath -UseBasicParsing
  }
  catch {
    Write-Fail "Failed to download Node MSI."
  }
    
  $msiArgs = "/i " + [char]34 + $msiPath + [char]34 + " /qn /norestart"
  Start-Process msiexec.exe -ArgumentList $msiArgs -Wait
    
  # Refresh PATH
  $pMachine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
  $pUser = [System.Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = $pMachine + ";" + $pUser
    
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Fail "Node install failed. Restart PowerShell."
  }
  Write-Ok "Node installed."
}

# 3. Enable pnpm
Write-Step "Enabling pnpm"
try {
  corepack enable
  corepack prepare "pnpm@$PnpmVersion" --activate
}
catch {
  Write-Fail "Failed to enable corepack."
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Write-Fail "pnpm installation failed."
}
$null = (pnpm -v)
Write-Ok "pnpm ready."

# 4. Download Repo
Write-Step "Setting up Environment"
if (-not (Test-Path $InstallRoot)) { New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null }

$SrcDir = Join-Path $InstallRoot "src"
if (-not (Test-Path $SrcDir)) { New-Item -ItemType Directory -Force -Path $SrcDir | Out-Null }
Set-Location $SrcDir

if (Test-Path "redbyte-ui-genesis-main\package.json") {
  Write-Ok "Repo exists. Skipping download."
  Set-Location "redbyte-ui-genesis-main"
}
else {
  Write-Warn "Downloading latest source code..."
  $zipPath = Join-Path $SrcDir "source.zip"
  Invoke-WebRequest -Uri $RepoZipUrl -OutFile $zipPath -UseBasicParsing
    
  Write-Warn "Extracting..."
  Expand-Archive -Path $zipPath -DestinationPath $SrcDir -Force
  Remove-Item $zipPath
    
  Set-Location "redbyte-ui-genesis-main"
  Write-Ok "Source code ready."
}

$RepoRoot = (Get-Location).Path

# 5. Install & Build
Write-Step "Installing Dependencies"
pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { Write-Fail "Dependency install failed." }
Write-Ok "Dependencies installed."

Write-Step "Approving Build Scripts"
try {
  pnpm approve-builds --all | Out-Null
  Write-Ok "Approved build scripts."
}
catch {
  Write-Warn "Approval skipped (not supported/needed)."
}


Write-Step "Building Workspace"
pnpm -r build
if ($LASTEXITCODE -ne 0) { Write-Fail "Build failed." }
Write-Ok "Build complete."

# 6. Launch
Write-Step "Launching Components"

# Validate Bridge Script
$bridgeExists = (pnpm -w run | Select-String "bridge:dev").Length -gt 0
if (-not $bridgeExists) { Write-Fail "bridge:dev script not found." }

# Launch Bridge
Write-Warn "Launching Hardware Bridge..."
$cmd = "cd '" + $RepoRoot + "'; Write-Host 'Starting Bridge...' -ForegroundColor Cyan; pnpm bridge:dev"
Start-Process powershell -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $cmd -WindowStyle Normal
Write-Ok "Bridge window started."

# Launch OS
Write-Step "Starting OS and detecting URL"

$logPath = Join-Path $InstallRoot "redbyte-dev.log"
if (Test-Path $logPath) { Remove-Item $logPath -Force }

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "pnpm.cmd"
$psi.Arguments = "-w dev"
$psi.WorkingDirectory = $RepoRoot
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $false

$p = New-Object System.Diagnostics.Process
$p.StartInfo = $psi
$p.Start() | Out-Null

Write-Host "    Waiting for Vite..." -ForegroundColor Gray

$opened = $false
while (-not $p.HasExited) {
  while (-not $p.StandardOutput.EndOfStream) {
    try {
      $line = $p.StandardOutput.ReadLine()
    }
    catch {
      break 
    }
    
    if ($line) {
      $line | Tee-Object -FilePath $logPath -Append | Out-Host

      if (-not $opened) {
        if ($line -match "Local:\s+(http://localhost:\d+/os/)") {
          $url = $Matches[1]
          Write-Ok "Detected URL: $url"
          try { Start-Process $url } catch { Write-Warn "Auto-open failed." }
          $opened = $true
        }
      }
    }
  }
  
  # Flush stderr
  while (-not $p.StandardError.EndOfStream) { 
    try { $null = $p.StandardError.ReadLine() } catch { break }
  }
  
  Start-Sleep -Milliseconds 150
}

if ($p.ExitCode -ne 0) { Write-Fail "Dev server exited. See log." }
