# bootstrap.ps1
# RedByte bootstrap: installs Git + Node LTS + pnpm, clones repo, installs deps, runs dev.
# Re-runnable / idempotent.

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# -----------------------------
# Config (EDIT THESE)
# -----------------------------
$REPO_URL  = "https://github.com/swaggyp52/redbyte-ui.git"   # Confirm actual repo URL
$REPO_DIR  = Join-Path $HOME "redbyte-ui"                   # install location
$PNPM_STORE = Join-Path $HOME ".pnpm-store"
$DEV_COMMAND = "pnpm run dev"

# -----------------------------
# Helpers
# -----------------------------
function Write-Section($msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

function Have-Command($name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Require-AdminIfNeeded() {
  $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
    ).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
  return $isAdmin
}

function Ensure-Winget() {
  if (Have-Command "winget") { return $true }
  Write-Host "winget not found." -ForegroundColor Yellow
  Write-Host "This script prefers winget for clean installs." -ForegroundColor Yellow
  Write-Host "Fix options:" -ForegroundColor Yellow
  Write-Host "  1) Install 'App Installer' from Microsoft Store (provides winget), then re-run." -ForegroundColor Yellow
  Write-Host "  2) Or manually install Git + Node.js LTS and re-run this script." -ForegroundColor Yellow
  return $false
}

function Winget-Install($id, $displayName) {
  Write-Host "Installing: $displayName ($id)" -ForegroundColor Gray
  & winget install --id $id --exact --silent --accept-package-agreements --accept-source-agreements | Out-Host
}

function Ensure-Git() {
  if (Have-Command "git") {
    Write-Host "Git already installed: $(git --version)" -ForegroundColor Green
    return
  }
  if (-not (Ensure-Winget)) { throw "Missing dependency: Git. Install winget/App Installer or install Git manually." }
  Winget-Install "Git.Git" "Git"
  $env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
  if (-not (Have-Command "git")) { throw "Git install completed but 'git' not found in PATH. Restart PowerShell and re-run." }
  Write-Host "Git installed: $(git --version)" -ForegroundColor Green
}

function Ensure-Node() {
  if (Have-Command "node") {
    $v = (& node -v)
    Write-Host "Node already installed: $v" -ForegroundColor Green
    return
  }
  if (-not (Ensure-Winget)) { throw "Missing dependency: Node.js. Install winget/App Installer or install Node LTS manually." }
  Winget-Install "OpenJS.NodeJS.LTS" "Node.js LTS"
  $env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
  if (-not (Have-Command "node")) { throw "Node install completed but 'node' not found in PATH. Restart PowerShell and re-run." }
  Write-Host "Node installed: $(& node -v)" -ForegroundColor Green
  Write-Host "npm installed:  $(& npm -v)" -ForegroundColor Green
}

function Ensure-Pnpm() {
  if (Have-Command "pnpm") {
    Write-Host "pnpm already installed: $(& pnpm -v)" -ForegroundColor Green
    return
  }
  Write-Host "Installing pnpm via Corepack (bundled with Node)..." -ForegroundColor Gray
  if (-not (Have-Command "corepack")) {
    throw "corepack not found. Your Node install may be incomplete. Reinstall Node.js LTS and re-run."
  }
  & corepack enable | Out-Host
  & corepack prepare pnpm@latest --activate | Out-Host
  if (-not (Have-Command "pnpm")) {
    $env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
  }
  if (-not (Have-Command "pnpm")) { throw "pnpm install failed. Restart PowerShell and re-run." }
  Write-Host "pnpm installed: $(& pnpm -v)" -ForegroundColor Green
}

function Ensure-Repo() {
  if (-not (Test-Path $REPO_DIR)) {
    Write-Section "Cloning RedByte repo"
    git clone $REPO_URL $REPO_DIR | Out-Host
  } else {
    Write-Section "Updating existing RedByte repo"
    Push-Location $REPO_DIR
    try {
      if (-not (Test-Path (Join-Path $REPO_DIR ".git"))) {
        throw "$REPO_DIR exists but is not a git repo. Move/delete it and re-run."
      }
      git fetch --all --prune | Out-Host
      git pull --rebase | Out-Host
    } finally {
      Pop-Location
    }
  }
}

function Install-Dependencies() {
  Write-Section "Installing JS dependencies (pnpm install)"
  Push-Location $REPO_DIR
  try {
    $env:PNPM_HOME = Join-Path $HOME ".pnpm"
    $env:PNPM_STORE_PATH = $PNPM_STORE
    & pnpm install | Out-Host
  } finally {
    Pop-Location
  }
}

function Write-RunnerScripts() {
  Write-Section "Creating convenience scripts"
  $runDev = @"
`$ErrorActionPreference = "Stop"
Set-Location "$REPO_DIR"
$DEV_COMMAND
"@
  $runDevPath = Join-Path $REPO_DIR "run-dev.ps1"
  Set-Content -Path $runDevPath -Value $runDev -Encoding UTF8
  $update = @"
`$ErrorActionPreference = "Stop"
Set-Location "$REPO_DIR"
git pull --rebase
pnpm install
"@
  $updatePath = Join-Path $REPO_DIR "update.ps1"
  Set-Content -Path $updatePath -Value $update -Encoding UTF8
  Write-Host "Created:" -ForegroundColor Green
  Write-Host "  $runDevPath" -ForegroundColor Green
  Write-Host "  $updatePath" -ForegroundColor Green
}

function Start-Dev() {
  Write-Section "Starting RedByte dev server"
  Push-Location $REPO_DIR
  try {
    Write-Host "If this is your first run, the dev server may take a bit to warm up." -ForegroundColor Gray
    Write-Host "Stop with Ctrl+C. Re-run later with:  powershell -ExecutionPolicy Bypass -File .\run-dev.ps1" -ForegroundColor Gray
    & $DEV_COMMAND
  } finally {
    Pop-Location
  }
}

# -----------------------------
# Run
# -----------------------------
Write-Section "RedByte Bootstrap"
Write-Host "Install location: $REPO_DIR" -ForegroundColor Gray

try {
  $isAdmin = Require-AdminIfNeeded
  if (-not $isAdmin) {
    Write-Host "Running without admin. If installs fail, re-run PowerShell as Administrator." -ForegroundColor Yellow
  }
  Ensure-Git
  Ensure-Node
  Ensure-Pnpm
  Ensure-Repo
  Install-Dependencies
  Write-RunnerScripts
  Write-Section "Done"
  Write-Host "Next time, you can run:" -ForegroundColor Green
  Write-Host "  cd `$REPO_DIR`"" -ForegroundColor Green
  Write-Host "  .\run-dev.ps1" -ForegroundColor Green
  Start-Dev
}
catch {
  Write-Host ""
  Write-Host "BOOTSTRAP FAILED:" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host ""
  Write-Host "Common fixes:" -ForegroundColor Yellow
  Write-Host "  - Restart PowerShell (PATH refresh) and run again." -ForegroundColor Yellow
  Write-Host "  - Install App Installer (winget) from Microsoft Store, then run again." -ForegroundColor Yellow
  Write-Host "  - Run PowerShell as Administrator if installs were blocked." -ForegroundColor Yellow
  throw
}
