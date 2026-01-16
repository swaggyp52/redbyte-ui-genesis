param(
    [Parameter(Mandatory=$true)][string]$Prompt,
    [Parameter(Mandatory=$true)][string]$OutFile,
    [string]$Format = "text",
    [int]$TimeoutSec = 45,
    [int]$MaxChars = 1800,
    [int]$MaxRetries = 2
)

$ErrorActionPreference = "Stop"

# Ensure output directory exists
$OutDir = Split-Path -Parent $OutFile
if ($OutDir -and !(Test-Path $OutDir)) { New-Item -ItemType Directory -Force -Path $OutDir | Out-Null }

# Setup logging
$LogDir = "ops/claude/logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir "$((Get-Date -Format 'yyyyMMdd-HHmmss-ffff')).log"

function Log {
    param([string]$msg, [string]$level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    $logMsg = "[$timestamp] [$level] $msg"
    Write-Host $logMsg
    Add-Content -Path $LogFile -Value $logMsg
}

Log "claude_exec started" "EXEC"
Log "Prompt length: $($Prompt.Length) chars" "DEBUG"
Log "TimeoutSec: $TimeoutSec, MaxChars: $MaxChars, MaxRetries: $MaxRetries" "DEBUG"

# Validate prompt length
if ($Prompt.Length -gt $MaxChars) {
    Log "ERROR: Prompt exceeds MaxChars ($($Prompt.Length) > $MaxChars)" "ERROR"
    exit 1
}

$retryCount = 0
$success = $false
$output = ""

while ($retryCount -le $MaxRetries -and -not $success) {
    try {
        Log "Attempt $($retryCount + 1) of $($MaxRetries + 1)" "INFO"
        
        # Setup process info
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = "claude"
        
        # Build arguments with format flag
        if ($Format -eq "json") {
            $psi.Arguments = "-p --output-format json --no-session-persistence `"$($Prompt -replace '"', '\"')`""
        } else {
            $psi.Arguments = "-p --no-session-persistence `"$($Prompt -replace '"', '\"')`""
        }
        
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.UseShellExecute = $false
        $psi.CreateNoWindow = $true
        
        $p = New-Object System.Diagnostics.Process
        $p.StartInfo = $psi
        
        Log "Launching claude with timeout ${TimeoutSec}s" "INFO"
        [void]$p.Start()
        
        # Wait with timeout
        if ($p.WaitForExit($TimeoutSec * 1000)) {
            $stdout = $p.StandardOutput.ReadToEnd()
            $stderr = $p.StandardError.ReadToEnd()
            
            Log "Claude exited with code $($p.ExitCode)" "DEBUG"
            
            if ($p.ExitCode -ne 0) {
                Log "Claude error: $stderr" "WARN"
                throw "Claude failed (exit $($p.ExitCode)): $stderr"
            }
            
            $output = $stdout
            $success = $true
            Log "Success - received $($output.Length) chars" "INFO"
        } else {
            # Timeout occurred
            $p.Kill()
            Log "Timeout after ${TimeoutSec}s - process killed" "WARN"
            $retryCount++
            if ($retryCount -le $MaxRetries) {
                Log "Retrying..." "INFO"
                Start-Sleep -Milliseconds 1000
            }
        }
    } catch {
        Log "Exception: $_" "ERROR"
        $retryCount++
        if ($retryCount -le $MaxRetries) {
            Log "Retrying..." "INFO"
            Start-Sleep -Milliseconds 1000
        }
    }
}

if (-not $success) {
    Log "All retries exhausted - giving up" "ERROR"
    exit 1
}

# Write output file
$output | Out-File -FilePath $OutFile -Encoding utf8
Log "Output written to $OutFile" "INFO"

# Print for visibility
Write-Host ""
Write-Host $output
Write-Host ""

Log "claude_exec completed successfully" "EXEC"
exit 0
