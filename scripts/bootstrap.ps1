# scripts/bootstrap.ps1
# One-command bootstrap for fresh Windows machines.
# Installs: Git, Node LTS, pnpm, (optional) VS Code, clones repo, installs deps, builds, runs.
# Run: powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap.ps1

$ErrorActionPreference = "Stop"

# ====== CONFIG ======
# You should set these to match your repo.
$RepoUrl = "https://github.com/swaggyp52/redbyte-ui-genesis.git" # HTTPS for public/tokenless clone
$RepoFolder = "redbyte-ui-genesis"        # target folder name
$NodeMajor = 20                  # keep aligned with your project
$PnpmVer = "10.24.0"           # keep aligned with packageManager in package.json
$InstallVSCode = $true            # set false if you don't want to install Code
# ====================

function Write-Step($msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

function Write-Ok($msg) {
  Write-Host "    ✔ $msg" -ForegroundColor Green
}

function Write-Warn($msg) {
  Write-Host "    ⚠ $msg" -ForegroundColor Yellow
}

function Write-Fail($msg) {
  Write-Host ""
  Write-Host "✖ $msg" -ForegroundColor Red
  exit 1
}

function Command-Exists($name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Ensure-AdminOrProceed() {
  # We try without admin first; if WinGet needs admin it will prompt.
  $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
  ).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
  if ($isAdmin) { Write-Ok "Running as Administrator." }
  else { Write-Warn "Not running as Administrator. Some installs may prompt or fail. If it fails, re-run PowerShell as Admin." }
}

function Ensure-WinGet() {
  Write-Step "Checking WinGet"
  if (Command-Exists "winget") {
    Write-Ok "WinGet found."
    return
  }

  Write-Warn "WinGet not found. Attempting to enable it via Microsoft App Installer."
  Write-Warn "If this fails, you must install 'App Installer' from Microsoft Store, then rerun."

  # No reliable silent install of App Installer without Store access.
  Write-Fail "WinGet is missing. Install 'App Installer' from Microsoft Store (or update Windows), then rerun this command."
}

function Winget-Install($id, $name) {
  Write-Step "Installing $name"
  # --accept-source-agreements and --accept-package-agreements prevent interactive prompts
  winget install --id $id --exact --silent --accept-source-agreements --accept-package-agreements | Out-Host
  Write-Ok "$name install attempted."
}

function Ensure-Git() {
  Write-Step "Checking Git"
  if (Command-Exists "git") {
    Write-Ok "Git found: $(git --version)"
    return
  }
  Ensure-WinGet
  Winget-Install "Git.Git" "Git"
  if (-not (Command-Exists "git")) {
    Write-Fail "Git install did not succeed. Re-run PowerShell as Admin, or install Git manually, then rerun."
  }
  Write-Ok "Git ready: $(git --version)"
}

function Ensure-Node() {
  Write-Step "Checking Node.js"
  if (Command-Exists "node") {
    $v = (node -v).TrimStart("v")
    $major = [int]($v.Split(".")[0])
    if ($major -eq $NodeMajor) {
      Write-Ok "Node found: v$v"
      return
    }
    else {
      Write-Warn "Node found (v$v) but expected major $NodeMajor. Installing Node $NodeMajor LTS."
    }
  }
  else {
    Write-Warn "Node not found. Installing Node $NodeMajor LTS."
  }

  Ensure-WinGet
  # Node.js LTS package
  Winget-Install "OpenJS.NodeJS.LTS" "Node.js LTS"

  # Refresh PATH for current session (best effort)
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

  if (-not (Command-Exists "node")) {
    Write-Fail "Node install did not succeed. Re-run PowerShell as Admin, then rerun."
  }
  $v2 = (node -v).TrimStart("v")
  $major2 = [int]($v2.Split(".")[0])
  if ($major2 -ne $NodeMajor) {
    Write-Fail "Node version mismatch after install (got v$v2). Install Node $NodeMajor LTS manually, then rerun."
  }
  Write-Ok "Node ready: v$v2"
}

function Ensure-Pnpm() {
  Write-Step "Enabling pnpm via Corepack"
  if (-not (Command-Exists "corepack")) {
    Write-Fail "Corepack not found. This usually means Node install is incomplete. Reboot or reinstall Node, then rerun."
  }

  corepack enable | Out-Null
  corepack prepare "pnpm@$PnpmVer" --activate | Out-Null

  if (-not (Command-Exists "pnpm")) {
    Write-Fail "pnpm not available after Corepack activation."
  }

  $pv = (pnpm -v)
  Write-Ok "pnpm ready: $pv"
}

function Ensure-VSCode() {
  if (-not $InstallVSCode) { return }
  Write-Step "Checking VS Code"
  if (Command-Exists "code") {
    Write-Ok "VS Code found."
    return
  }
  Ensure-WinGet
  Winget-Install "Microsoft.VisualStudioCode" "VS Code"
  Write-Warn "VS Code install attempted. If 'code' isn't on PATH yet, restart PowerShell after install."
}

function Clone-Or-Update-Repo() {
  Write-Step "Cloning repo"
  if ($RepoUrl -eq "REPO_URL") {
    Write-Fail "bootstrap.ps1 not configured: set `$RepoUrl to your real GitHub repo URL."
  }

  $target = Join-Path (Get-Location) $RepoFolder

  if (Test-Path $target) {
    Write-Warn "Folder '$RepoFolder' already exists. Pulling latest."
    Set-Location $target
    git pull | Out-Host
  }
  else {
    git clone $RepoUrl $RepoFolder | Out-Host
    Set-Location $target
  }

  Write-Ok "Repo ready at: $target"
  
  if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
    Write-Step "Creating .env from template"
    Copy-Item ".env.example" ".env"
    Write-Ok ".env created."
  }
}

function Install-And-Build() {
  Write-Step "Installing dependencies (pnpm install --frozen-lockfile)"
  pnpm install --frozen-lockfile | Out-Host
  Write-Ok "Dependencies installed."

  Write-Step "Building workspace packages"
  # Best practice: build everything deterministically so downstream packages have dist/types
  pnpm -r build | Out-Host
  Write-Ok "Build complete."

  Write-Step "Running quick health checks"
  # Optional: if you have a doctor script, keep it here
  if (Test-Path ".\scripts\doctor.mjs") {
    node .\scripts\doctor.mjs | Out-Host
    Write-Ok "Doctor check complete."
  }
  else {
    Write-Warn "No scripts/doctor.mjs found. Skipping doctor check."
  }
}

function Run-Dev() {
  Write-Step "Starting RedByte OS dev server"
  Write-Warn "If ports 5173--5176 are taken, Vite will choose a new port."
  # Use your canonical dev command. Replace if you have a better root-level script.
  pnpm -w dev | Out-Host
}

# ====== MAIN ======
Clear-Host
Write-Host "RedByte Bootstrap (Fresh Machine)" -ForegroundColor White
Write-Host "Repo: $RepoUrl" -ForegroundColor Gray
Write-Host "Folder: $RepoFolder" -ForegroundColor Gray

Ensure-AdminOrProceed
Ensure-Git
Ensure-Node
Ensure-Pnpm
Ensure-VSCode
Clone-Or-Update-Repo
Install-And-Build

Write-Host ""
Write-Host "✔ Setup finished." -ForegroundColor Green
Write-Host "Next: starting the app..." -ForegroundColor Green

Run-Dev
