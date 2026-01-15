# scripts/night_shift_worker_openai.ps1
# Worker using OpenAI API
param(
  [Parameter(Mandatory=$true)][string]$TicketTitle,
  [Parameter(Mandatory=$true)][string]$TicketBody
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$OPENAI_API_KEY = $env:OPENAI_API_KEY
if (-not $OPENAI_API_KEY) {
  throw "OPENAI_API_KEY environment variable not set"
}

# Read system context
$aiState = Get-Content "AI_STATE.md" -Raw
$architectReport = Get-Content "ARCHITECTURAL_REPORT_2026_01_14.md" -Raw -ErrorAction SilentlyContinue
$nightShiftRoles = Get-Content "ops/NIGHT_SHIFT_ROLES.md" -Raw

# Build prompt
$systemPrompt = @"
You are RedByte Night Shift Worker. Generate unified diff patches for tickets.
Output ONLY raw unified diff format (git diff). No markdown, no explanations.
Follow all ticket constraints. Minimal diffs only. Include 3+ lines of context.
"@

$userPrompt = @"
CONTEXT:
$($aiState.Substring(0, [Math]::Min(3000, $aiState.Length)))

TICKET:
$TicketBody

Generate the unified diff patch now.
"@

# Call OpenAI API
$headers = @{
  "Authorization" = "Bearer $OPENAI_API_KEY"
  "Content-Type" = "application/json"
}

$body = @{
  model = "gpt-4-turbo-preview"
  messages = @(
    @{
      role = "system"
      content = $systemPrompt
    }
    @{
      role = "user"
      content = $userPrompt
    }
  )
  temperature = 0.3
  max_tokens = 8000
} | ConvertTo-Json -Depth 10

try {
  $response = Invoke-RestMethod -Uri "https://api.openai.com/v1/chat/completions" -Method Post -Headers $headers -Body $body -TimeoutSec 120
  $patch = $response.choices[0].message.content
  
  # Clean markdown code blocks if model ignored instructions
  if ($patch -match "```diff\s*\n(.*)\n```") {
    $patch = $Matches[1]
  } elseif ($patch -match "```\s*\n(.*)\n```") {
    $patch = $Matches[1]
  }
} catch {
  Write-Host "ERROR: OpenAI API call failed: $_"
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
