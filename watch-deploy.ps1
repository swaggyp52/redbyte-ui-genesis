Write-Host "=== REDBYTE AUTO WATCH + DEPLOY ===" -ForegroundColor Cyan
Write-Host "Watching for changes... (CTRL+C to stop)" -ForegroundColor Yellow

$srcPath = Join-Path $PSScriptRoot "src"

if (-not (Test-Path $srcPath)) {
    Write-Host "ERROR: src folder not found at $srcPath" -ForegroundColor Red
    exit
}

$watcher = New-Object IO.FileSystemWatcher $srcPath
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true
$watcher.NotifyFilter = [IO.NotifyFilters]'FileName, LastWrite, Size'

Register-ObjectEvent -InputObject $watcher -EventName Changed -Action {
    Write-Host "`nChange detected! Deploying..." -ForegroundColor Green
    & "$PSScriptRoot\deploy.ps1"
}

while ($true) {
    Start-Sleep 1
}


