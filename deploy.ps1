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

git add . | Out-Null


Write-Host ""
Write-Host "Cloudflare Pages (project: redbyte-ui-genesis → domain: redbyteapps.dev)" -ForegroundColor Green
Write-Host "is now building & deploying this commit automatically." -ForegroundColor Green


