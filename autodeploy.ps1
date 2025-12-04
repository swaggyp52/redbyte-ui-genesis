Write-Host "`n=== RedByte AutoDeploy Daemon (STABLE) ===`n" -ForegroundColor Cyan

# ---------------------------------------
# ROOT PATH
# ---------------------------------------
$root = Get-Location
$srcPath = Join-Path $root "src"

# ---------------------------------------
# DEPLOY LOCK (prevents double execution)
# ---------------------------------------
$global:DeployLock = $false

# ---------------------------------------
# DEPLOY FUNCTION (works exactly as your logs confirmed)
# ---------------------------------------
function Invoke-Deploy {
    if ($global:DeployLock -eq $true) {
        return
    }

    $global:DeployLock = $true

    Write-Host "`n[BUILD] Running production build..." -ForegroundColor Yellow
    $LASTEXITCODE = 0
    npm run build

    if ($LASTEXITCODE -ne 0) {
        Write-Host "[BUILD FAILED] Skipping deploy." -ForegroundColor Red
        $global:DeployLock = $false
        return
    }

    Write-Host "[BUILD OK] Committing & pushing..." -ForegroundColor Green
    git add .
    git commit -m "AutoDeploy $(Get-Date)" --allow-empty
    git push origin main

    Write-Host "[DEPLOY] Cloudflare updating..." -ForegroundColor Cyan

    # cooldown so watcher doesn't instantly re-trigger
    Start-Sleep 2

    $global:DeployLock = $false
}

# ---------------------------------------
# DEBOUNCE TIMER (3 seconds)
# ---------------------------------------
$debounceTimer = New-Object System.Timers.Timer
$debounceTimer.Interval = 3000
$debounceTimer.AutoReset = $false

$debounceTimer.Add_Elapsed({
    Invoke-Deploy
})

# ---------------------------------------
# FILE WATCHER (ONLY src/, proven working)
# ---------------------------------------
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $srcPath
$watcher.Filter = "*.*"
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true

Register-ObjectEvent -InputObject $watcher -EventName Changed -SourceIdentifier "RedByteWatcher" -Action {
    Write-Host "`n[CHANGE] File updated → Running AutoDeploy..." -ForegroundColor Yellow

    # restart debounce timer
    $debounceTimer.Stop()
    $debounceTimer.Start()
}

Write-Host "[WATCHING] src/ folder changes (debounced)" -ForegroundColor Green

# ---------------------------------------
# OPTIONAL DEV SERVER (this worked correctly in your logs)
# ---------------------------------------
Start-Job -ScriptBlock {
    while ($true) {
        npm run dev
        Start-Sleep 3
    }
}

Write-Host "`n[READY] AutoDeploy daemon is running." -ForegroundColor Cyan

# ---------------------------------------
# Keep process alive (this is required)
# ---------------------------------------
while ($true) { Start-Sleep 1 }
