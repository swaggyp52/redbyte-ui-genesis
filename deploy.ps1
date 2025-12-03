param(
    [string]$Message = "manual deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
)

Write-Host "=== RedByte One-Shot Deploy ===" -ForegroundColor Cyan

Write-Host "[1/3] Running production build (npm run build)..." -ForegroundColor Yellow
try {
    npm run build
} catch {
    Write-Host "[ERROR] Build failed. Fix errors above before deploying." -ForegroundColor Red
    exit 1
}

Write-Host "[2/3] Committing changes..." -ForegroundColor Yellow
git add . | Out-Null
git commit -m $Message --allow-empty | Out-Null

Write-Host "[3/3] Pushing to origin/main..." -ForegroundColor Yellow
git push origin main

Write-Host ""
Write-Host "✅ Deploy push complete." -ForegroundColor Green
Write-Host "Cloudflare Pages (project: redbyte-ui-genesis → domain: redbyteapps.dev)" -ForegroundColor Green
Write-Host "is now building & deploying this commit automatically." -ForegroundColor Green
