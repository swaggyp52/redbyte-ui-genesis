Write-Host "=== RedByte Auto Mode (Full Repo Watch) ===" -ForegroundColor Cyan

# -------------------------------------------------------
# 1) FIX ENGINE – auto-patches common breakage patterns
# -------------------------------------------------------
function Invoke-RedByteFix {
    Write-Host "[Fix] Scanning & patching..." -ForegroundColor DarkGray

    # Target core source files (TSX/TS/JS/JSX)
    Get-ChildItem -Recurse -Include *.tsx,*.ts,*.jsx,*.js -File | ForEach-Object {
        $path    = $_.FullName
        $content = Get-Content $path -Raw

        # THREE.js renderer updates
        $content = $content -replace "renderer\.outputEncoding", "renderer.outputColorSpace"
        $content = $content -replace "THREE\.sRGBEncoding", "THREE.SRGBColorSpace"

        # React useRef<T>() with no initial value → useRef(null)
        $content = $content -replace "useRef<[^>]+>\(\)", "useRef(null)"

        Set-Content $path $content -Encoding UTF8
    }

    Write-Host "[Fix] Done." -ForegroundColor Green
}

# Run one pass immediately on start
Invoke-RedByteFix

# -------------------------------------------------------
# 2) FILE WATCHER – watch the whole repo for changes
# -------------------------------------------------------
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path                  = (Get-Location).Path
$watcher.Filter                = "*.*"          # any file change triggers
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents   = $true

Register-ObjectEvent `
    -InputObject $watcher `
    -EventName Changed `
    -SourceIdentifier RedByteWatcher `
    -Action {
        Write-Host "`n[Watcher] Change detected → auto-fix + push..." -ForegroundColor Yellow

        # Re-run fix engine
        Invoke-RedByteFix

        try {
            git add . | Out-Null
            git commit -m "AutoFix: file change $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" --allow-empty | Out-Null
            git push origin main | Out-Null
            Write-Host "[Deploy] Pushed to origin/main. Cloudflare will deploy this commit." -ForegroundColor Green
        } catch {
            Write-Host "[Deploy] Git push failed: $($_.Exception.Message)" -ForegroundColor Red
        }
    }

# -------------------------------------------------------
# 3) DEV SERVER LOOP – keeps Vite always running
# -------------------------------------------------------
Start-Job -Name "RedByteDev" -ScriptBlock {
    while ($true) {
        Write-Host "[Dev] Starting dev server (npm run dev)..." -ForegroundColor Cyan
        try {
            npm run dev
        } catch {
            Write-Host "[Dev] Dev server crashed: $($_.Exception.Message)" -ForegroundColor Red
        }
        Write-Host "[Dev] Restarting in 3 seconds..." -ForegroundColor DarkGray
        Start-Sleep -Seconds 3
    }
}

Write-Host "Auto Mode is ACTIVE. Any save → auto-fix + git push → Cloudflare deploy." -ForegroundColor Cyan
