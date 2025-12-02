Write-Host "[RedByte] Spawning Nightly Automation Suite..." -ForegroundColor Cyan

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$deployScript    = Join-Path $root "nightly-deploy.ps1"
$optimizeScript  = Join-Path $root "nightly-optimize.ps1"
$lighthouseScript= Join-Path $root "lighthouse-loop.ps1"
$aiScript        = Join-Path $root "nightly-ai-report.ps1"

$jobs = @()

if (Test-Path $deployScript) {
  $jobs += Start-Job -ScriptBlock { param($s) & $s } -ArgumentList $deployScript
}
if (Test-Path $optimizeScript) {
  $jobs += Start-Job -ScriptBlock { param($s) & $s } -ArgumentList $optimizeScript
}
if (Test-Path $lighthouseScript) {
  $jobs += Start-Job -ScriptBlock { param($s) & $s } -ArgumentList $lighthouseScript
}
if (Test-Path $aiScript) {
  $jobs += Start-Job -ScriptBlock { param($s) & $s } -ArgumentList $aiScript
}

Write-Host "[RedByte] Jobs started:" -ForegroundColor Green
$jobs | ForEach-Object {
  Write-Host ("  Job Id={0} State={1}" -f $_.Id, $_.State) -ForegroundColor Gray
}

Write-Host "`nUse 'Get-Job' to inspect, 'Receive-Job -Id <id>' to view logs, 'Stop-Job -Id <id>' to stop." -ForegroundColor Yellow
