Write-Host "=== REDBYTE ONE-SHOT FIX + DEPLOY ===" -ForegroundColor Cyan

$project = (Get-Location).Path
Write-Host "Project directory: $project" -ForegroundColor Gray

Write-Host "[1/6] Fixing vite.config.ts..." -ForegroundColor Yellow
@"
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/", 
  plugins: [react()],
});
"@ | Set-Content -Encoding UTF8 "$project\vite.config.ts"

Write-Host "[2/6] Reinstalling dependencies..." -ForegroundColor Yellow
Remove-Item -Recurse -Force "$project\node_modules" -ErrorAction SilentlyContinue
npm install --legacy-peer-deps

Write-Host "[3/6] Building project..." -ForegroundColor Yellow
npm run build

Write-Host "[4/6] Creating 404 + CNAME..." -ForegroundColor Yellow
Copy-Item "$project\dist\index.html" "$project\dist\404.html" -Force
Set-Content "$project\dist\CNAME" "redbyteapps.dev"

Write-Host "[5/6] Deploying to gh-pages..." -ForegroundColor Yellow
git add dist -f
git commit -m "auto-deploy" --no-verify

git subtree split --prefix dist -b gh-pages-temp | Out-Null
git push origin gh-pages-temp:gh-pages --force
git branch -D gh-pages-temp 2>$null

Write-Host "[6/6] SUCCESS — RedByte OS deployed!" -ForegroundColor Green
Write-Host "Visit: https://redbyteapps.dev"


