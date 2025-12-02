param(
    [int] = 1800
)

# Always run from project root
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

Write-Host "[RedByte] Nightly Deploy Loop Online" -ForegroundColor Cyan
Send-PhoneNotification "Deploy loop online" "RedByte nightly deploy loop started."

while ($true) {
    Write-Host "
[RedByte] === Deploy cycle start ===" -ForegroundColor Cyan
    Send-PhoneNotification "Deploy cycle start" "Nightly deploy cycle triggered."

    try {
        Write-Host "[1/5] git pull" -ForegroundColor Gray
        git pull

        Write-Host "[2/5] npm install" -ForegroundColor Gray
        npm install

        Write-Host "[3/5] npm run build" -ForegroundColor Gray
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Build failed. Sleeping 10 minutes then retrying." -ForegroundColor Red
            Send-PhoneNotification "Deploy build FAILED" "Nightly deploy build failed. Retry in 10 min."
            Start-Sleep -Seconds 600
            continue
        }

        Write-Host "[4/5] git commit" -ForegroundColor Gray
        git add -A
        git commit -m "auto: nightly deployment cycle" 2>$null

        Write-Host "[5/5] git push" -ForegroundColor Gray
        git push

        Write-Host "[RedByte] Deploy cycle complete. Sleeping $IntervalSeconds seconds..." -ForegroundColor Green
        Send-PhoneNotification "Deploy SUCCESS" "Nightly deploy cycle completed and pushed."
    }
    catch {
        Write-Host "[RedByte] Deploy loop error: $(.Exception.Message)" -ForegroundColor Red
        Send-PhoneNotification "Deploy loop ERROR" $_.Exception.Message
    }

    Start-Sleep -Seconds $IntervalSeconds
}
