param(
    [string]$Message = "manual deploy"
)

Write-Host "=== RedByte Deploy ===" -ForegroundColor Cyan

Write-Host "[1/3] Building (npm run build)..." -ForegroundColor Yellow
try {
    npm run build
} catch {
    Write-Host "[ERROR] Build failed." -ForegroundColor Red
    exit 1
}

Write-Host "[2/3] Committing..." -ForegroundColor Yellow
git add . | Out-Null
git commit -m "$Message" --allow-empty | Out-Null

Write-Host "[3/3] Pushing to main..." -ForegroundColor Yellow
git push origin main

Write-Host ""
Write-Host "Deployment triggered on Cloudflare." -ForegroundColor Green
