param(
    [int] = 7200
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

Write-Host "[RedByte] Nightly Optimize Loop Online" -ForegroundColor Cyan
Send-PhoneNotification "Optimize loop online" "RedByte nightly optimize loop started."

while ($true) {
    Write-Host "
[RedByte] === Optimize cycle start ===" -ForegroundColor Cyan

    try {
        Write-Host "[1/4] npm run build" -ForegroundColor Gray
        npm run build

        Write-Host "[2/4] prettier" -ForegroundColor Gray
        npx prettier --write "src/**/*.{ts,tsx,js,jsx,css,md}" 2>$null

        Write-Host "[3/4] eslint --fix" -ForegroundColor Gray
        npx eslint "src/**/*.{ts,tsx,js,jsx}" --fix 2>$null

        Write-Host "[4/4] git commit + push" -ForegroundColor Gray
        git add -A
        git commit -m "auto: nightly format + lint sweep" 2>$null
        git push

        Write-Host "[RedByte] Optimize cycle complete. Sleeping $IntervalSeconds seconds..." -ForegroundColor Green
        Send-PhoneNotification "Optimize SUCCESS" "Nightly formatting/linting completed and pushed."
    }
    catch {
        Write-Host "[RedByte] Optimize loop error: $(.Exception.Message)" -ForegroundColor Red
        Send-PhoneNotification "Optimize loop ERROR" $_.Exception.Message
    }

    Start-Sleep -Seconds $IntervalSeconds
}
