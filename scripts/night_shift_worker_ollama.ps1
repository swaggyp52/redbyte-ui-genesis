# scripts/night_shift_worker_ollama.ps1
# Worker using local Ollama (codellama, deepseek-coder, etc.)
param(
  [Parameter(Mandatory=$true)][string]$TicketTitle,
  [Parameter(Mandatory=$true)][string]$TicketBody
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Verify Ollama is running
try {
  $null = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -TimeoutSec 5
} catch {
  throw "Ollama not running. Start with: ollama serve"
}

# Read system context
$aiState = Get-Content "AI_STATE.md" -Raw
$nightShiftRoles = Get-Content "ops/NIGHT_SHIFT_ROLES.md" -Raw

# Build prompt (shorter for local models)
$prompt = @"
You are a code patch generator for RedByte OS.

TICKET:
$TicketBody

RULES:
- Output ONLY a unified diff (git diff format)
- No markdown code blocks, no explanations
- Minimal changes only
- Include 3+ lines of context

Generate the patch:
"@

# Call Ollama API
$body = @{
  model = "deepseek-coder:6.7b"  # or "codellama:13b" or "qwen2.5-coder:7b"
  prompt = $prompt
  stream = $false
  options = @{
    temperature = 0.2
    num_predict = 4096
  }
} | ConvertTo-Json -Depth 10

try {
  $response = Invoke-RestMethod -Uri "http://localhost:11434/api/generate" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 300
  $patch = $response.response
  
  # Clean markdown if model added it
  if ($patch -match "```diff\s*\n(.*)\n```") {
    $patch = $Matches[1]
  } elseif ($patch -match "```\s*\n(.*)\n```") {
    $patch = $Matches[1]
  }
} catch {
  Write-Host "ERROR: Ollama API call failed: $_"
  throw
}

# Save patch
$slug = ($TicketTitle.ToLowerInvariant() -replace "[^a-z0-9]+","-").Trim("-")
$patchPath = "ops/proof/$slug-patch.diff"
$patch | Set-Content -Path $patchPath -Encoding UTF8 -NoNewline

Write-Host "Generated patch: $patchPath"

# Apply patch
try {
  git apply --check $patchPath
  git apply $patchPath
  Write-Host "Patch applied successfully"
} catch {
  Write-Host "ERROR: Patch failed to apply. Leaving for manual review."
  throw
}
