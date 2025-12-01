Set-ExecutionPolicy Bypass -Scope Process -Force

Write-Host "=== REDBYTE AUTO DEPLOY SYSTEM ===" -ForegroundColor Cyan

Write-Host "`n[1/2] Running initial deploy..." -ForegroundColor Yellow
& "$PSScriptRoot\deploy.ps1"

Write-Host "`n[2/2] Starting auto-watch..." -ForegroundColor Yellow
& "$PSScriptRoot\watch-deploy.ps1"

