Param(
  [int]$Port = 4173,
  [switch]$SkipInstall,
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

Write-Host "[PR13] Classroom RC boot (student mode default)" -ForegroundColor Cyan

if (-not $SkipInstall) {
  Write-Host "[1/3] Installing workspace deps with pnpm..." -ForegroundColor DarkCyan
  pnpm install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { throw "pnpm install failed with exit code $LASTEXITCODE" }
}

if (-not $SkipBuild) {
  Write-Host "[2/3] Building classroom app (@redbyte/playground)..." -ForegroundColor DarkCyan
  pnpm --filter @redbyte/playground build
  if ($LASTEXITCODE -ne 0) { throw "playground build failed with exit code $LASTEXITCODE" }
}

Write-Host "[3/3] Starting preview server..." -ForegroundColor DarkCyan
Write-Host "" 
Write-Host "Classroom URL (student mode default): http://127.0.0.1:$Port/os/" -ForegroundColor Green
Write-Host "TA mode (temporary):                http://127.0.0.1:$Port/os/?ta=1" -ForegroundColor Yellow
Write-Host "TA mode (persistent):               localStorage set rb:mode:v1 to ta" -ForegroundColor Yellow
Write-Host "" 

pnpm --filter @redbyte/playground exec vite preview --host 127.0.0.1 --port $Port --strictPort
