param(
    [Parameter(Mandatory=$true)]
    [string]$Question,
    
    [switch]$BlockOnNo
)

$ErrorActionPreference = "Stop"

Write-Host "[CI GATE] Asking Claude..." -ForegroundColor Cyan
Write-Host "Question: $Question"
Write-Host ""

$prompt = @"
$Question

Answer with EXACTLY one of: YES or NO
Then on a new line, provide a 2-3 sentence justification.

Be conservative. If uncertain, answer NO.
"@

$tempOut = [System.IO.Path]::GetTempFileName()
& "$PSScriptRoot\claude-analyze.ps1" -Prompt $prompt -OutFile $tempOut

$response = Get-Content $tempOut -Raw
Remove-Item $tempOut -Force

Write-Host "[RESPONSE]" -ForegroundColor Yellow
Write-Host $response
Write-Host ""

# Parse answer
if ($response -match "^\s*(YES|NO)") {
    $answer = $matches[1]
    
    if ($answer -eq "NO" -and $BlockOnNo) {
        Write-Error "[CI GATE] Claude rejected: Build blocked"
        exit 1
    }
    
    if ($answer -eq "YES") {
        Write-Host "[CI GATE] ✓ Passed" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "[CI GATE] ⚠ Claude answered NO (not blocking)" -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Error "[CI GATE] Could not parse Claude response"
    exit 1
}
