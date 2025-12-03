
Write-Host "=== RedByte Daemon Installer (FINAL STABLE VERSION) ===" -ForegroundColor Cyan
$taskName = "RedByte AutoDeploy"
$repoPath = (Get-Location).Path
$pwsh     = (Get-Command powershell).Source
Write-Host "Repo path: $repoPath" -ForegroundColor DarkGray
Write-Host "PowerShell: $pwsh"   -ForegroundColor DarkGray
try {
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        Write-Host "Removing old task..." -ForegroundColor Yellow
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    }
} catch {
    Write-Host "Warning: Could not remove old task (permissions)." -ForegroundColor DarkYellow
}
$autoScript = Join-Path $repoPath "auto.ps1"
$arguments  = "-NoProfile -ExecutionPolicy Bypass -File `"$autoScript`""
$action  = New-ScheduledTaskAction -Execute $pwsh -Argument $arguments
$trigger = New-ScheduledTaskTrigger -AtLogOn
try {
    $principal = New-ScheduledTaskPrincipal -UserId $env:UserName -RunLevel Highest -LogonType Interactive
} catch {
    Write-Host "ERROR: Unable to create task principal. Run PowerShell as Administrator." -ForegroundColor Red
    exit 1
}
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopOnIdleEnd
try {
    $task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings
} catch {
    Write-Host "ERROR: Failed to create task definition." -ForegroundColor Red
    exit 1
}
try {
    Register-ScheduledTask -TaskName $taskName -InputObject $task -ErrorAction Stop | Out-Null
    Write-Host "SUCCESS: Installed '$taskName'." -ForegroundColor Green
    Write-Host "RedByte Daemon will run automatically on login." -ForegroundColor Green
} catch {
    Write-Host "FAILED TO INSTALL TASK." -ForegroundColor Red
    Write-Host ("Reason: " + $_.Exception.Message) -ForegroundColor DarkRed
    Write-Host "Fix: Run PowerShell as Administrator." -ForegroundColor Yellow
    exit 1
}
Write-Host "To uninstall:" -ForegroundColor Yellow
Write-Host "  Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false" -ForegroundColor Yellow
