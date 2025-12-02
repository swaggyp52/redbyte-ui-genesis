Write-Host "=== RedByte Automation System V4 (Daemon Core) ===" -ForegroundColor Cyan

$ErrorActionPreference = "Continue"

# -----------------------------------------------------
# Simple logfile in the repo
# -----------------------------------------------------
$logFile = Join-Path (Get-Location).Path "redbyte-auto.log"
function Write-Log {
    param([string]$Message)
    $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$stamp  $Message" | Add-Content $logFile
}

# -----------------------------------------------------
# 1) FIX ENGINE – automated code repairs
# -----------------------------------------------------
function Invoke-RedByteFix {
    Write-Host "[FixEngine] Running repairs..." -ForegroundColor DarkGray
    Write-Log "[FixEngine] Start"

    Get-ChildItem -Recurse -Filter *.tsx | ForEach-Object {
        $path = $_.FullName
        $content = Get-Content $path -Raw

        # THREE.js renderer updates
        $content = $content `
            -replace "renderer.outputEncoding", "renderer.outputColorSpace" `
            -replace "THREE.sRGBEncoding", "THREE.SRGBColorSpace"

        # OrbitControls API changes
        $content = $content `
            -replace "\benablePan\b", "enablePan" `
            -replace "\bminPolarAngle\b", "minPolarAngle" `
            -replace "\bmaxPolarAngle\b", "maxPolarAngle"

        # Invalid useRef() patterns
        $content = $content -replace "useRef<[^>]+>\(\)", "useRef(null)"

        Set-Content $path $content -Encoding UTF8
    }

    Write-Host "[FixEngine] Completed." -ForegroundColor Green
    Write-Log "[FixEngine] Completed"
}

# Run one pass at startup
Invoke-RedByteFix

# -----------------------------------------------------
# 2) FILE SYSTEM WATCHER – watches .tsx changes
# -----------------------------------------------------
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = (Get-Location).Path
$watcher.Filter = "*.tsx"
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true

Register-ObjectEvent `
    -InputObject $watcher `
    -EventName Changed `
    -SourceIdentifier RedByteWatcher `
    -Action {
        Write-Host "`n[Watcher] File changed → running autofix..." -ForegroundColor Yellow
        Write-Log "[Watcher] Change detected"

        Invoke-RedByteFix

        try {
            git add .
            git commit -m "AutoFix: watcher event" --allow-empty | Out-Null
            git push | Out-Null
            Write-Host "[Watcher] Auto-pushed update." -ForegroundColor Green
            Write-Log "[Watcher] git push success"
        } catch {
            Write-Host "[Watcher] Git push failed." -ForegroundColor Red
            Write-Log "[Watcher] git push FAILED: $($_.Exception.Message)"
        }
    }

# -----------------------------------------------------
# 3) DEV SERVER LOOP – keeps npm run dev alive
# -----------------------------------------------------
Start-Job -Name "RedByteDev" -ScriptBlock {
    $ErrorActionPreference = "Continue"
    while ($true) {
        try {
            Write-Host "[Dev] Starting Vite (npm run dev)..." -ForegroundColor Cyan
            npm run dev
        } catch {
            Write-Host "[Dev] npm run dev crashed: $($_.Exception.Message)" -ForegroundColor Red
        }
        Write-Host "[Dev] Restarting dev server in 3s..." -ForegroundColor DarkGray
        Start-Sleep -Seconds 3
    }
}

Write-Host "RedByte Automation System ACTIVE (watcher + auto-fix + auto-push + dev loop)." -ForegroundColor Cyan
Write-Log "Daemon core started."
