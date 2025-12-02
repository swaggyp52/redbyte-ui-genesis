Write-Host "`n=======================" -ForegroundColor Cyan
Write-Host " REDBYTE OPS DAILY RUN " -ForegroundColor Cyan
Write-Host "=======================`n" -ForegroundColor Cyan

Write-Host "10AM    – Morning Boot & Build Check"
Write-Host "12PM    – Class"
Write-Host "5PM     – Home"
Write-Host "5–7PM   – Games"
Write-Host "7–9PM   – Homework"
Write-Host "9–12AM  – Development"
Write-Host "12AM    – Automated Night Ops Start`n"

Write-Host "[RedByte] Scheduling nightly automation at 12AM..." -ForegroundColor Yellow

$taskName = "RedByteNightlyAutomation"
$scriptPath = Join-Path (Get-Location) "tools\automation\run-all-night.ps1"

schtasks /Create /TN $taskName /TR "powershell -NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" /SC DAILY /ST 00:00 /F

Write-Host "`n[RedByte] Daily Ops configured."
Write-Host "[RedByte] Nightly automation will run automatically at midnight." -ForegroundColor Green
