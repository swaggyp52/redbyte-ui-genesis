param(
    [string]$Phase = "current",
    [string]$OutFile = "audit-results\proof-audit-$(Get-Date -Format 'yyyy-MM-dd-HHmmss').md",
    [switch]$FailOnIssues
)

$ErrorActionPreference = "Continue"

Write-Host "[PROOF AUDIT] Starting Claude-powered proof audit for Phase: $Phase" -ForegroundColor Yellow

# Ensure output directory exists
$outDir = Split-Path $OutFile -Parent
if ($outDir -and !(Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

# The critical question
$auditPrompt = @"
Analyze this redbyte-ui repository's proof system for Phase $Phase.

Answer these questions:

1. **Proof Integrity**: Could the proof artifacts withstand external auditing? Explain the reasoning.

2. **Reproducibility**: Can every proof artifact be regenerated deterministically from source? List any exceptions.

3. **Failure Modes**: Identify one failure mode not currently tested in the proof pipeline.

4. **Implicit Assumptions**: What critical assumptions are implicit but not validated?

5. **Production Risks**: What could fail in production that would pass CI today?

Return detailed markdown with specific file/line references. Be direct and precise.
"@

Write-Host "[PROMPT]" -ForegroundColor Cyan
Write-Host $auditPrompt
Write-Host ""

# Run analysis
& "$PSScriptRoot\claude-analyze.ps1" -Prompt $auditPrompt -OutFile $OutFile

# Check for critical issues if requested
if ($FailOnIssues) {
    $auditContent = Get-Content $OutFile -Raw
    
    $criticalPatterns = @(
        "would NOT hold up",
        "cannot be regenerated",
        "critical assumption",
        "CI gap",
        "missing invariant"
    )
    
    $foundIssues = $false
    foreach ($pattern in $criticalPatterns) {
        if ($auditContent -match $pattern) {
            $foundIssues = $true
            Write-Host "[FAIL] Critical issue detected: $pattern" -ForegroundColor Red
        }
    }
    
    if ($foundIssues) {
        Write-Error "Proof audit failed. Review $OutFile for details."
        exit 1
    }
}

Write-Host "[PROOF AUDIT] Complete. Results: $OutFile" -ForegroundColor Green
