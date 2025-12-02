Write-Host "=== RedByte Daemon Installer ===" -ForegroundColor Cyan

$taskName = "RedByte AutoDeploy"
$repoPath = (Get-Location).Path
$pwsh     = (Get-Command powershell).Source

Write-Host "Repo path: $repoPath" -ForegroundColor DarkGray
Write-Host "PowerShell: $pwsh"   -ForegroundColor DarkGray

# Remove old task if it exists
try {
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        Write-Host "Removing existing scheduled task '$taskName'..." -ForegroundColor Yellow
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    }
} catch {}

# Create action: run auto.ps1 at logon
$autoScript = Join-Path $repoPath "auto.ps1"
$arguments  = "-NoProfile -ExecutionPolicy Bypass -File `"$autoScript`""

$action  = New-ScheduledTaskAction -Execute $pwsh -Argument $arguments
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId $env:UserName -RunLevel Highest -LogonType InteractiveToken

$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal `
    -Settings (New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopOnIdleEnd)

Register-ScheduledTask -TaskName $taskName -InputObject $task | Out-Null

Write-Host "Installed scheduled task '$taskName'." -ForegroundColor Green
Write-Host "This will start auto.ps1 automatically every time you log in." -ForegroundColor Green
Write-Host "To uninstall later, run:" -ForegroundColor Yellow
Write-Host "  Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false" -ForegroundColor Yellow
