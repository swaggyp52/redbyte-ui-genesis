Write-Host "=== RedByte Automation System V5 (Stable) ===" -ForegroundColor Cyan

# ---------------------------------------
# 1) Fix Engine – gentle, project-wide
# ---------------------------------------
function Invoke-RedByteFix {
    Write-Host "[FixEngine] Running repairs..." -ForegroundColor DarkGray

    # Only touch TSX files – your React/3D front-end
    Get-ChildItem -Recurse -Filter *.tsx | ForEach-Object {
         = .FullName
         = Get-Content  -Raw

        # THREE.js renderer updates (old → new API)
         =  
            -replace "renderer\.outputEncoding", "renderer.outputColorSpace" 
            -replace "THREE\.sRGBEncoding", "THREE.SRGBColorSpace"

        # Fix useRef type patterns that cause TS to scream
         =  -replace "useRef<[^>]+>\(\)", "useRef(null)"

        Set-Content   -Encoding UTF8
    }

    Write-Host "[FixEngine] Completed." -ForegroundColor Green
}

# Run one fix pass on startup
Invoke-RedByteFix

# ---------------------------------------
# 2) File watcher – auto-fix + auto-push
# ---------------------------------------
 = New-Object System.IO.FileSystemWatcher
.Path = (Get-Location).Path
.Filter = "*.tsx"
.IncludeSubdirectories = True
.EnableRaisingEvents = True

Register-ObjectEvent 
    -InputObject  
    -EventName Changed 
    -SourceIdentifier RedByteWatcher 
    -Action {
        Write-Host "
[Watcher] Change detected → auto-fix + git push..." -ForegroundColor Yellow
        Invoke-RedByteFix

        try {
            git add . | Out-Null
            git commit -m "AutoFix: watcher event" --allow-empty | Out-Null
            git push origin main
            Write-Host "[Watcher] Git push OK → Cloudflare will build & deploy." -ForegroundColor Green
        } catch {
            Write-Host "[Watcher] Git push failed: " -ForegroundColor Red
        }
    }

# ---------------------------------------
# 3) Dev server – Vite in a loop
# ---------------------------------------
Start-Job -Name "RedByteDev" -ScriptBlock {
    while (True) {
        try {
            Write-Host "[Dev] Starting Vite (npm run dev)..." -ForegroundColor Cyan
            npm run dev
        } catch {
            Write-Host "[Dev] npm run dev crashed: " -ForegroundColor Red
        }
        Write-Host "[Dev] Restarting dev server in 3s..." -ForegroundColor DarkGray
        Start-Sleep -Seconds 3
    }
}

Write-Host "RedByte Auto Mode ACTIVE." -ForegroundColor Cyan
Write-Host "• Leave this window open while working." -ForegroundColor DarkGray
Write-Host "• Editing/saving .tsx files → auto-fix + git push → Cloudflare deploy." -ForegroundColor DarkGray
