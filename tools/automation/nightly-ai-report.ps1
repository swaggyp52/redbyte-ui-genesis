param(
  [int]$IntervalSeconds = 5400,
  [string]$Model = "gpt-4.1-mini"
)

$reportsDir = Join-Path (Get-Location) "ai-reports"
if (-not (Test-Path $reportsDir)) {
  New-Item -ItemType Directory -Path $reportsDir | Out-Null
}

Write-Host "[RedByte] Nightly AI Review Loop Online" -ForegroundColor Cyan
Write-Host "Uses OpenAI CLI: \`openai\` must be installed and configured." -ForegroundColor Yellow

while ($true) {
  $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $reportPath = Join-Path $reportsDir "ai-review_$timestamp.md"

  Write-Host "`n[RedByte] === AI review cycle @ $timestamp ===" -ForegroundColor Cyan

  try {
    $prompt = @"
You are Marcus, the Executive Systems AI for RedByte.

You are given the source tree of a NeonOS-style web UI at ./src.

Produce a concise markdown report with:
- critical UX/architecture issues
- performance risks
- file-specific improvement suggestions (with paths)
- 3–5 concrete action items for tomorrow

Be opinionated. Keep it under 800 words.
"@

    # Run OpenAI CLI (assumes `openai` is configured with API key)
    $tempInput = Join-Path $env:TEMP "rb_ai_prompt_$timestamp.txt"
    $prompt | Set-Content -Encoding UTF8 $tempInput

    openai api chat.completions.create `
      -m $Model `
      -g "RedByte nightly UX/dev review" `
      -f $tempInput `
      --output $reportPath

    Write-Host "[RedByte] AI review saved: $reportPath" -ForegroundColor Green

    git add $reportPath
    git commit -m "auto: nightly AI review $timestamp" 2>$null
    git push
  }
  catch {
    Write-Host "[RedByte] AI review loop error: $($_.Exception.Message)" -ForegroundColor Red
  }

  Write-Host "[RedByte] Sleeping $IntervalSeconds seconds..." -ForegroundColor Gray
  Start-Sleep -Seconds $IntervalSeconds
}
