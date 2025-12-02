param(
    [string]$Url = "https://redbyteapps.dev",
    [int]$IntervalSeconds = 3600
)

Set-Location "$PSScriptRoot\..\.."

function Send-PhoneNotification {
    param(
        [string]$title,
        [string]$message
    )

    # IMPORTANT:
    # 1) Create an IFTTT applet using Webhooks -> Notifications
    # 2) Get your key from https://ifttt.com/maker_webhooks (Docs)
    # 3) Replace PASTE_YOUR_IFTTT_KEY_HERE with your real key.
    $webhookKey = "PASTE_YOUR_IFTTT_KEY_HERE"

    if ([string]::IsNullOrWhiteSpace($webhookKey) -or $webhookKey -eq "PASTE_YOUR_IFTTT_KEY_HERE") {
        return  # silently skip if not configured
    }

    $url = "https://maker.ifttt.com/trigger/redbyte_event/with/key/$webhookKey"
    $payload = @{
        value1 = $title
        value2 = $message
    } | ConvertTo-Json

    try {
        Invoke-RestMethod -Uri $url -Method Post -Body $payload -ContentType "application/json" | Out-Null
        Write-Host "[Notify] $title — sent to phone." -ForegroundColor Green
    }
    catch {
        Write-Host "[Notify ERROR] Failed to send phone notification: $($_.Exception.Message)" -ForegroundColor Red
    }
}

$reportsDir = Join-Path (Get-Location) "reports"
if (-not (Test-Path $reportsDir)) {
    New-Item -ItemType Directory -Path $reportsDir | Out-Null
}

Write-Host "[RedByte] Lighthouse Loop Online (target: $Url)" -ForegroundColor Cyan
Send-PhoneNotification "Lighthouse loop online" "Tracking $Url performance hourly."

while ($true) {
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $reportPath = Join-Path $reportsDir "lighthouse_$timestamp.json"

    Write-Host "
[RedByte] === Lighthouse run @ $timestamp ===" -ForegroundColor Cyan
    try {
        lighthouse $Url --quiet --output json --output-path $reportPath
        Write-Host "[RedByte] Lighthouse report saved: $reportPath" -ForegroundColor Green
        Send-PhoneNotification "Lighthouse COMPLETE" "Report saved: $reportPath"

        git add $reportPath
        git commit -m "auto: lighthouse report $timestamp" 2>$null
        git push
    }
    catch {
        Write-Host "[RedByte] Lighthouse loop error: $(.Exception.Message)" -ForegroundColor Red
        Send-PhoneNotification "Lighthouse ERROR" $_.Exception.Message
    }

    Write-Host "[RedByte] Sleeping $IntervalSeconds seconds..." -ForegroundColor Gray
    Start-Sleep -Seconds $IntervalSeconds
}
