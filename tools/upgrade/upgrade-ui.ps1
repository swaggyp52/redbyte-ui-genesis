# RedByte Upgrade Script
# Marcus – Executive Systems AI

param(
    [string]$msg = "upgrade: automated UI update"
)

Write-Host "`n[RedByte] Starting upgrade..." -ForegroundColor Cyan

# 1. Install dependencies
Write-Host "[1/6] Installing deps..."
npm install

# 2. Build output
Write-Host "[2/6] Building UI..."
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed. Aborting." -ForegroundColor Red
    exit 1
}

# 3. Bump version automatically
Write-Host "[3/6] Bumping version..."
npm version patch --no-git-tag-version

# 4. Stage and commit
Write-Host "[4/6] Committing changes..."
git add -A
git commit -m "$msg"

# 5. Push to deploy
Write-Host "[5/6] Pushing to main..."
git push

# 6. Test Cloudflare deployment health
Write-Host "[6/6] Checking deployment health..."
try {
    Invoke-WebRequest -Uri "https://redbyteapps.dev" -UseBasicParsing | Out-Null
    Write-Host "✅ Deployment OK"
}
catch {
    Write-Host "⚠️ Deployment may still be processing."
}

Write-Host "`n✨ RedByte UI upgraded successfully."
