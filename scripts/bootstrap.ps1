# scripts/bootstrap.ps1
# REDBYTE GOLDEN BOOTSTRAP (Fresh Machine Edition)
# Run: powershell -NoProfile -ExecutionPolicy Bypass -Command "iwr -useb 'https://raw.githubusercontent.com/swaggyp52/redbyte-ui-genesis/main/scripts/bootstrap.ps1' | iex"

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# ====== CONFIG ======
$NodeMinVersion = [version]"20.19.0"
$NodeMsiUrl = "https://nodejs.org/dist/v20.19.0/node-v20.19.0-x64.msi"
$NodeZipUrl = "https://nodejs.org/dist/v20.19.0/node-v20.19.0-win-x64.zip"
$PnpmVersion = "10.24.0"
$RepoZipUrl = "https://github.com/swaggyp52/redbyte-ui-genesis/archive/refs/heads/main.zip"
$InstallRoot = "C:\RedByte"
# ====================

function Write-Step($msg) { Write-Host ""; Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "    v $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    ! $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host ""; Write-Host "X $msg" -ForegroundColor Red; exit 1 }

# 1. Permission Check & Node Strategy
Write-Step "Checking Environment"
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if ($isAdmin) {
  Write-Ok "Running as Administrator (Preferred)."
}
else {
  Write-Warn "Running as User. utilizing Portable Node.js fallback."
}

# 2. Node.js Install (Smart Fallback)
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
  if ($isAdmin) {
    # Admin: MSI Install
    Write-Warn "Installing Node.js (MSI)..."
    $msiPath = Join-Path $env:TEMP "node-lts.msi"
    try { Invoke-WebRequest -Uri $NodeMsiUrl -OutFile $msiPath -UseBasicParsing } catch { Write-Fail "Download failed." }
        
    $msiArgs = "/i " + [char]34 + $msiPath + [char]34 + " /qn /norestart"
    Start-Process msiexec.exe -ArgumentList $msiArgs -Wait
        
    # Refresh PATH
    $pMachine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $pUser = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = $pMachine + ";" + $pUser
  }
  else {
    # User: Portable Install
    Write-Warn "Installing Node.js (Portable)..."
    $toolsDir = Join-Path $InstallRoot "tools"
    if (-not (Test-Path $toolsDir)) { New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null }
        
    $zipPath = Join-Path $toolsDir "node.zip"
    try { Invoke-WebRequest -Uri $NodeZipUrl -OutFile $zipPath -UseBasicParsing } catch { Write-Fail "Download failed." }
        
    Expand-Archive -Path $zipPath -DestinationPath $toolsDir -Force
    Remove-Item $zipPath
        
    # Find extracted dir (e.g., node-v20.19.0-win-x64)
    $nodeDir = Get-ChildItem -Path $toolsDir -Filter "node-v*" -Directory | Select-Object -First 1
    $env:Path = $nodeDir.FullName + ";" + $env:Path
    Write-Ok "Portable access configured for this session."
  }

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Fail "Node install failed."
  }
  Write-Ok "Node installed."
}

# 3. Enable pnpm
Write-Step "Enabling pnpm"
# Set PNPM_HOME for portable/user installs to ensure it finds a writeable path
if (-not $env:PNPM_HOME) {
  $env:PNPM_HOME = Join-Path $InstallRoot "tools\pnpm"
  if (-not (Test-Path $env:PNPM_HOME)) { New-Item -ItemType Directory -Force -Path $env:PNPM_HOME | Out-Null }
  $env:Path = $env:PNPM_HOME + ";" + $env:Path
}

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
  Write-Warn "Downloading source..."
  $zipPath = Join-Path $SrcDir "source.zip"
  Invoke-WebRequest -Uri $RepoZipUrl -OutFile $zipPath -UseBasicParsing
    
  Write-Warn "Extracting..."
  Expand-Archive -Path $zipPath -DestinationPath $SrcDir -Force
  Remove-Item $zipPath
    
  Set-Location "redbyte-ui-genesis-main"
  Write-Ok "Source ready."
}

$RepoRoot = (Get-Location).Path

# 5. Install & Build
Write-Step "Installing Dependencies"
# Create .npmrc if missing to force safe build policy (redundancy for zip download)
if (-not (Test-Path ".npmrc")) {
  Set-Content -Path ".npmrc" -Value "dangerously-allow-all-builds=true"
}

pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { Write-Fail "Install failed." }
Write-Ok "Dependencies installed."

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
Write-Step "Starting OS..."

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

Write-Host "    Waiting for server..." -ForegroundColor Gray

# Polling Loop for Port Detection (5173-5190)
$maxRetries = 60 # 30 seconds (500ms sleep)
$foundUrl = $null

for ($i = 0; $i -lt $maxRetries; $i++) {
  if ($p.HasExited) { break }
    
  foreach ($port in 5173..5190) {
    $url = "http://localhost:" + $port + "/os/"
    try {
      $resp = Invoke-WebRequest -Uri $url -Method Head -TimeoutSec 1 -ErrorAction SilentlyContinue
      if ($resp.StatusCode -eq 200) {
        $foundUrl = $url
        break
      }
    }
    catch {}
  }
    
  if ($foundUrl) { break }
  Start-Sleep -Milliseconds 500
}

# Flush logs just in case
if (-not $p.HasExited) {
  Start-ThreadJob -ScriptBlock {
    param($proc, $log)
    while (-not $proc.HasExited) {
      $l = $proc.StandardOutput.ReadLine()
      if ($l) { $l | Out-File -FilePath $log -Append }
    }
  } -ArgumentList $p, $logPath | Out-Null
}

if ($foundUrl) {
  Write-Ok "Detected OS at: $foundUrl"
  Start-Process $foundUrl
  # Keep script alive to show status
  Write-Host "`n    [Script Running. Close to stop server.]" -ForegroundColor Gray
  $p.WaitForExit()
}
else {
  Write-Fail "Could not detect running server. Check log: $logPath"
}
