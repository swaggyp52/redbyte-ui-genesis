# Claude CLI Wrapper for RedByte
# Usage: .\scripts\claude.ps1 -Prompt "Your prompt here"
#    OR: .\scripts\claude.ps1 -PromptFile path\to\prompt.txt

param(
    [Parameter(Mandatory=$false)]
    [string]$Prompt,
    
    [Parameter(Mandatory=$false)]
    [string]$PromptFile,
    
    [Parameter(Mandatory=$false)]
    [switch]$Help
)

if ($Help) {
    Write-Host @"
Claude CLI Wrapper for RedByte

Usage:
  .\scripts\claude.ps1 -Prompt "Your prompt here"
  .\scripts\claude.ps1 -PromptFile path\to\prompt.txt

Environment:
  ANTHROPIC_API_KEY must be set. To set it:
  [Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY","sk-ant-...","User")
  Then restart your terminal.
"@
    exit 0
}

# Check API key
if ([string]::IsNullOrEmpty($env:ANTHROPIC_API_KEY)) {
    Write-Error @"
ANTHROPIC_API_KEY not found.

To set it (user-scoped, persists across sessions):
  [Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY","PASTE_YOUR_KEY_HERE","User")

Then restart your terminal and try again.
"@
    exit 1
}

# Validate input
if ([string]::IsNullOrEmpty($Prompt) -and [string]::IsNullOrEmpty($PromptFile)) {
    Write-Error "Must provide -Prompt or -PromptFile"
    exit 1
}

# Read prompt from file if specified
if (-not [string]::IsNullOrEmpty($PromptFile)) {
    if (-not (Test-Path $PromptFile)) {
        Write-Error "Prompt file not found: $PromptFile"
        exit 1
    }
    $Prompt = Get-Content $PromptFile -Raw
}

# Execute Claude CLI
Write-Host "Sending prompt to Claude ($($Prompt.Length) chars)..." -ForegroundColor Cyan
claude $Prompt
