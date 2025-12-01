Write-Host "=== REDBYTE DEPLOY ===" -ForegroundColor Cyan

npm run build

Copy-Item -Path ".\dist\index.html" -Destination ".\dist\404.html" -Force

git add dist -f
git commit -m "auto-deploy" --no-verify

git subtree split --prefix dist -b gh-pages-temp | Out-Null

git push origin gh-pages-temp:gh-pages --force

git branch -D gh-pages-temp 2>$null

Write-Host "=== DEPLOY COMPLETE ===" -ForegroundColor Green
Write-Host "Live at: https://redbyteapps.dev"

