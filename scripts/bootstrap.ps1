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
# $InstallRoot determined dynamically below
# ====================

function Write-Step($msg) { Write-Host ""; Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "    v $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    ! $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host ""; Write-Host "X $msg" -ForegroundColor Red; exit 1 }

# 1. Environment Strategy
Write-Step "Checking Environment"
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if ($isAdmin) {
  Write-Ok "Running as Administrator."
  $InstallRoot = "C:\RedByte"
  $UsePortableNode = $false
}
else {
  Write-Warn "Not running as Administrator. Switching to User Mode."
  $InstallRoot = Join-Path $env:USERPROFILE "RedByte"
  $UsePortableNode = $true
}
Write-Ok "Install Root: $InstallRoot"

if (-not (Test-Path $InstallRoot)) {
  try { New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null }
  catch { Write-Fail "Could not create install directory." }
}

# 2. Node.js Install
Write-Step "Checking Node.js"
$nodeOk = $false
if (Get-Command node -ErrorAction SilentlyContinue) {
  try {
    $vRaw = (node -v).TrimStart("v")
    $vCurrent = [version]$vRaw
    if ($vCurrent -ge $NodeMinVersion) { 
      $nodeOk = $true 
      Write-Ok "Node v$vCurrent found."
    }
  }
  catch {}
}

if (-not $nodeOk) {
  if ($UsePortableNode) {
    # Portable Install
    Write-Warn "Installing Portable Node..."
    $toolsDir = Join-Path $InstallRoot "tools"
    if (-not (Test-Path $toolsDir)) { New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null }
        
    $zipPath = Join-Path $toolsDir "node.zip"
    try { Invoke-WebRequest -Uri $NodeZipUrl -OutFile $zipPath -UseBasicParsing } catch { Write-Fail "Download failed." }
        
    Write-Warn "Extracting..."
    Expand-Archive -Path $zipPath -DestinationPath $toolsDir -Force
    Remove-Item $zipPath -Force
        
    $nodeDir = Get-ChildItem -Path $toolsDir -Filter "node-v*-win-x64" -Directory | Select-Object -First 1
    if (-not $nodeDir) { Write-Fail "Extraction failed." }
        
    # Configure PATH
    $env:Path = $nodeDir.FullName + ";" + $env:Path
    Write-Ok "Portable access configured."
  }
  else {
    # MSI Install
    Write-Warn "Installing Node MSI..."
    $msiPath = Join-Path $env:TEMP "node-lts.msi"
    try { Invoke-WebRequest -Uri $NodeMsiUrl -OutFile $msiPath -UseBasicParsing } catch { Write-Fail "Download failed." }
        
    $msiArgs = "/i " + [char]34 + $msiPath + [char]34 + " /qn /norestart"
    Start-Process msiexec.exe -ArgumentList $msiArgs -Wait
        
    # Refresh PATH
    $pMachine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $pUser = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = $pMachine + ";" + $pUser
  }

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Fail "Node install failed." }
  Write-Ok "Node installed."
}

# 3. Enable pnpm
Write-Step "Enabling pnpm"
# Configure PNPM_HOME for user install
if ($UsePortableNode -or (-not $env:PNPM_HOME)) {
  $env:PNPM_HOME = Join-Path $InstallRoot "tools\pnpm"
  if (-not (Test-Path $env:PNPM_HOME)) { New-Item -ItemType Directory -Force -Path $env:PNPM_HOME | Out-Null }
  if ($env:Path -notmatch [regex]::Escape($env:PNPM_HOME)) {
    $env:Path = $env:PNPM_HOME + ";" + $env:Path
  }
}

try {
  corepack enable
  corepack prepare "pnpm@$PnpmVersion" --activate
}
catch {
  Write-Fail "Failed to enable corepack."
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { Write-Fail "pnpm failed." }
$null = (pnpm -v)
Write-Ok "pnpm ready."

# 4. Download Repo
Write-Step "Setting up Source"
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
  try { Invoke-WebRequest -Uri $RepoZipUrl -OutFile $zipPath -UseBasicParsing } catch { Write-Fail "Download failed." }
    
  Write-Warn "Extracting..."
  try { Expand-Archive -Path $zipPath -DestinationPath $SrcDir -Force } catch { Write-Fail "Extraction failed." }
  Remove-Item $zipPath -Force
    
  Set-Location "redbyte-ui-genesis-main"
  Write-Ok "Source ready."
}

$RepoRoot = (Get-Location).Path

# 5. Install & Build
Write-Step "Installing Dependencies"
# Enforce trusted builds
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

# Validate Bridge
$bridgeExists = (pnpm -w run | Select-String "bridge:dev").Length -gt 0
if (-not $bridgeExists) { Write-Fail "bridge:dev not found." }

# Launch Bridge
Write-Warn "Launching Hardware Bridge..."
$cmd = "cd '" + $RepoRoot + "'; Write-Host 'Starting Bridge...' -ForegroundColor Cyan; pnpm bridge:dev"
Start-Process powershell -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $cmd -WindowStyle Normal
Write-Ok "Bridge started."

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

# Polling Loop
$maxRetries = 60
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

if ($foundUrl) {
  Write-Ok "OS Running: $foundUrl"
  Start-Process $foundUrl
  Write-Host "`n    [Script Running. Close window to stop server.]" -ForegroundColor Gray
    
  # Process Loop
  while (-not $p.HasExited) {
    while (-not $p.StandardOutput.EndOfStream) { 
      $null = $p.StandardOutput.ReadLine() 
    }
    Start-Sleep -Milliseconds 500
  }
}
else {
  Write-Fail "Server start failed. Check log: $logPath"
}
