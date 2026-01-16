param(
    [Parameter(Mandatory=$true)][string]$ContextFile,
    [Parameter(Mandatory=$true)][string]$Task,
    [string]$RunId = (Get-Date -Format "yyyyMMdd-HHmmss"),
    [int]$TimeoutSec = 45,
    [int]$MaxRetries = 0  # NO RETRIES on rate limit
)

$ErrorActionPreference = "Stop"

Write-Host "=== CLAUDE DECISION ===" -ForegroundColor Cyan

if (-not (Test-Path $ContextFile)) {
    Write-Host "[ERROR] Context file not found: $ContextFile" -ForegroundColor Red
    exit 1
}

# Load context
$context = Get-Content $ContextFile -Raw | ConvertFrom-Json

# Build compact prompt based on task
$localStatus = "OK"
if ($context.local_checks.quality.pass -eq $false) { $localStatus = "QUALITY_FAIL" }
if ($context.local_checks.proof_run.pass -eq $false) { $localStatus = "PROOF_FAIL" }

$prompt = switch ($Task) {
    "proof-audit" {
        "Context: Repo=$($context.commit_short), Status=$localStatus, Changed=$($context.changed_files.Count) files`n`n" +
        "Local checks:" +
        "`n- Quality: $($context.local_checks.quality.pass)" +
        "`n- Proof artifacts: $($context.local_checks.proof_artifacts.count) files" +
        "`n`nDecision needed: Is this proof pipeline safe to merge?" +
        "`n`nRespond JSON: {status:PASS|FAIL|WARN, why:string, actions:[]}"
    }
    "ci-gate" {
        "Context: Commit=$($context.commit_short), Status=$localStatus, Files=$($context.changed_files.Count)`n`n" +
        "Files changed: $($context.changed_files -join ', ')`n`n" +
        "Should this PR merge?`n" +
        "Respond JSON: {status:PASS|FAIL|WARN, risks:[], tests:[]}"
    }
    default {
        "Context packet: $($context | ConvertTo-Json -Compress)`n`nDecide." 
    }
}

Write-Host "Calling Claude (timeout ${TimeoutSec}s, max retries $MaxRetries)..." -ForegroundColor Yellow
Write-Host "Prompt size: $($prompt.Length) chars" -ForegroundColor Cyan

$retryCount = 0
$success = $false
$output = ""

while ($retryCount -le $MaxRetries -and -not $success) {
    try {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = "claude"
        $psi.Arguments = "-p --no-session-persistence `"$($prompt -replace '"', '\"')`""
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.UseShellExecute = $false
        $psi.CreateNoWindow = $true
        
        $p = New-Object System.Diagnostics.Process
        $p.StartInfo = $psi
        [void]$p.Start()
        
        if ($p.WaitForExit($TimeoutSec * 1000)) {
            $stdout = $p.StandardOutput.ReadToEnd()
            $stderr = $p.StandardError.ReadToEnd()
            
            # Check for rate limit
            if ($stderr -match "hit your limit" -or $stdout -match "hit your limit") {
                Write-Host "[RATE LIMIT] Claude API limit hit - stopping (no retries on rate limit)" -ForegroundColor Red
                exit 1
            }
            
            if ($p.ExitCode -ne 0) {
                if ($retryCount -lt $MaxRetries) {
                    Write-Host "[RETRY] Claude exit code $($p.ExitCode)" -ForegroundColor Yellow
                    $retryCount++
                    Start-Sleep -Milliseconds 1000
                    continue
                } else {
                    throw "Claude failed (exit $($p.ExitCode)): $stderr"
                }
            }
            
            $output = $stdout
            $success = $true
            Write-Host "[OK] Claude responded ($($output.Length) chars)" -ForegroundColor Green
        } else {
            $p.Kill()
            if ($retryCount -lt $MaxRetries) {
                Write-Host "[TIMEOUT] Retrying..." -ForegroundColor Yellow
                $retryCount++
                Start-Sleep -Milliseconds 1000
            } else {
                throw "Claude timeout after ${TimeoutSec}s"
            }
        }
    } catch {
        if ($retryCount -lt $MaxRetries) {
            Write-Host "[ERROR] $_" -ForegroundColor Yellow
            $retryCount++
        } else {
            Write-Host "[FAIL] $_" -ForegroundColor Red
            exit 1
        }
    }
}

if (-not $success) {
    Write-Host "[FAIL] All retries exhausted" -ForegroundColor Red
    exit 1
}

# Parse and validate output
$decisionOutput = $output
Write-Host ""
Write-Host "Decision:" -ForegroundColor Cyan
$decisionOutput

# Save decision
$reportDir = "ops/claude/reports"
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
$reportFile = Join-Path $reportDir "$RunId-$Task-decision.txt"
@"
Task: $Task
Timestamp: $(Get-Date -Format 'o')
Commit: $($context.commit)
Local status: $localStatus
Prompt size: $($prompt.Length) chars

--- CLAUDE DECISION ---
$decisionOutput
"@ | Out-File -FilePath $reportFile -Encoding utf8

Write-Host ""
Write-Host "[REPORT] $reportFile" -ForegroundColor Green

exit 0
