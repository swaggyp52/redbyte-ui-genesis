Write-Host "=== âš¡ MAKING REDBYTE COME ALIVE âš¡ ===" -ForegroundColor Cyan
$root = $PSScriptRoot

Write-Host "`n[1/6] Fixing Vite config..." -ForegroundColor Yellow
@"
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/",        // IMPORTANT for Cloudflare + Custom Domain
  plugins: [react()],
});
"@ | Set-Content "$root\vite.config.ts" -Encoding UTF8


Write-Host "`n[2/6] Creating Cloudflare SPA fallback files..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "$root\public" | Out-Null

# Cloudflare SPA redirect file
@"
# Always serve index.html for ANY path
/*    /index.html   200
"@ | Set-Content "$root\public\_redirects" -Encoding UTF8

# Cloudflare routing rules
@"
{
  "version": 1,
  "include": ["/*"],
  "exclude": []
}
"@ | Set-Content "$root\public\_routes.json" -Encoding UTF8


Write-Host "`n[3/6] Installing dependencies cleanly..." -ForegroundColor Yellow
Remove-Item -Recurse -Force "$root\node_modules" -ErrorAction SilentlyContinue
npm install --legacy-peer-deps


Write-Host "`n[4/6] Building RedByte OS..." -ForegroundColor Yellow
npm run build


Write-Host "`n[5/6] Preparing Cloudflare deployment folder..." -ForegroundColor Yellow
# Copy fallback files into dist
Copy-Item "$root\public\_redirects" "$root\dist\_redirects" -Force
Copy-Item "$root\public\_routes.json" "$root\dist\_routes.json" -Force


Write-Host "`n[6/6] Deploying to Cloudflare Pages..." -ForegroundColor Yellow
Write-Host "âš™ï¸ Running: npx wrangler pages deploy dist --project-name=redbyte-ui-genesis" -ForegroundColor DarkGray

npx wrangler pages deploy dist --project-name=redbyte-ui-genesis

Write-Host "`nðŸŽ‰ SUCCESS! REDBYTE IS NOW ALIVE!" -ForegroundColor Green
Write-Host "Visit temporary Cloudflare domain:" -ForegroundColor White
Write-Host "   https://redbyte-ui-genesis.pages.dev" -ForegroundColor Cyan

Write-Host "`nðŸŒ Your custom domain will activate after DNS finishes:" -ForegroundColor White
Write-Host "   https://redbyteapps.dev" -ForegroundColor Green

Write-Host "`n=== SYSTEM READY ===" -ForegroundColor Cyan

