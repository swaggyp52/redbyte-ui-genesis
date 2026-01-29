# RedByte OS - Lab Bundle Installer (Production)
# Usage: Right-click -> Run with PowerShell

$ErrorActionPreference = "Stop"
$ScriptPath = $PSScriptRoot
$LauncherPath = Join-Path $ScriptPath "launcher.bat"
$IconPath = Join-Path $ScriptPath "public\icon.ico" # Fallback if specific icon missing
$ShortcutPath = "$HOME\Desktop\Start RedByte.lnk"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   RedByte OS - Lab Installation" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Check Node.js
Write-Host "[1/3] Checking Prerequisites..."
try {
    $nodeVersion = node -v
    Write-Host "      Node.js found: $nodeVersion" -ForegroundColor Green
}
catch {
    Write-Host "ERROR: Node.js is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install Node.js LTS from https://nodejs.org/"
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# 2. Check Bundle Integrity
Write-Host "[2/3] Verifying Bundle..."
if (-not (Test-Path $LauncherPath)) {
    Write-Host "ERROR: launcher.bat not found in $ScriptPath" -ForegroundColor Red
    exit 1
}

# 3. Create Shortcut
Write-Host "[3/3] Creating Desktop Shortcut..."
try {
    $WshShell = New-Object -comObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = $LauncherPath
    $Shortcut.WorkingDirectory = $ScriptPath
    $Shortcut.WindowStyle = 7 # Minimized (let launcher handle windows)
    $Shortcut.Description = "Launch RedByte OS Logic Playground"
    if (Test-Path $IconPath) {
        $Shortcut.IconLocation = $IconPath
    }
    $Shortcut.Save()
    Write-Host "      Shortcut created at: $ShortcutPath" -ForegroundColor Green
}
catch {
    Write-Host "WARNING: Failed to create shortcut. You can run launcher.bat directly." -ForegroundColor Yellow
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Installation Complete!" -ForegroundColor Green
Write-Host "   Double-click 'Start RedByte' on your desktop." -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Start-Sleep -Seconds 5
