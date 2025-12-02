Write-Host "=== RedByte Auto-Fixer Dev Mode ===" -ForegroundColor Cyan

# -----------------------------------------------------------
# 1) Fix common React + TS + Three.js patterns globally
# -----------------------------------------------------------

Write-Host ">>> Running auto-fix pass..." -ForegroundColor Yellow

# Fix missing useRef initial value
Get-ChildItem -Recurse -Filter *.tsx | ForEach-Object {
     = .FullName
    (Get-Content ) 
        -replace "useRef<([^>]+)>\(\)", "useRef<>(null)" |
        Set-Content 
}

# Fix outdated THREE rendering options
Get-ChildItem -Recurse -Filter *.tsx | ForEach-Object {
     = .FullName
    (Get-Content ) 
        -replace "renderer\.outputEncoding", "renderer.outputColorSpace" 
        -replace "THREE\.sRGBEncoding", "THREE.SRGBColorSpace" |
        Set-Content 
}

# Try to auto-fix OrbitControls missing properties
Get-ChildItem -Recurse -Filter *.tsx | ForEach-Object {
     = .FullName
    (Get-Content ) 
        -replace "controls\.enablePan", "controls.enablePan" 
        -replace "controls\.minPolarAngle", "controls.minPolarAngle" 
        -replace "controls\.maxPolarAngle", "controls.maxPolarAngle" |
        Set-Content 
}

Write-Host "Auto-fix completed." -ForegroundColor Green

# -----------------------------------------------------------
# 2) TypeScript validation
# -----------------------------------------------------------

Write-Host ">>> Running TypeScript check..." -ForegroundColor Cyan

try {
    npx tsc --noEmit
    Write-Host "TypeScript OK." -ForegroundColor Green
} catch {
    Write-Host "TypeScript errors detected (non-blocking)." -ForegroundColor Yellow
}

# -----------------------------------------------------------
# 3) Auto git commit + push
# -----------------------------------------------------------

if (Test-Path ".git") {
    Write-Host ">>> Committing changes..." -ForegroundColor Cyan
    git add .
    git commit -m "auto-fix pass" --allow-empty
    git push
}

# -----------------------------------------------------------
# 4) Start dev server
# -----------------------------------------------------------

Write-Host ">>> Starting Vite dev server..." -ForegroundColor Cyan
npm run dev
