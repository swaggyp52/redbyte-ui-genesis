# scripts/night_shift_worker_anthropic.ps1
# Worker using Anthropic Claude API
param(
  [Parameter(Mandatory=$true)][string]$TicketTitle,
  [Parameter(Mandatory=$true)][string]$TicketBody
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ANTHROPIC_API_KEY = $env:ANTHROPIC_API_KEY
if (-not $ANTHROPIC_API_KEY) {
  throw "ANTHROPIC_API_KEY environment variable not set"
}

# Read system context
$aiState = Get-Content "AI_STATE.md" -Raw
$architectReport = Get-Content "ARCHITECTURAL_REPORT_2026_01_14.md" -Raw -ErrorAction SilentlyContinue
$nightShiftRoles = Get-Content "ops/NIGHT_SHIFT_ROLES.md" -Raw

# Build prompt
$prompt = @"
You are RedByte Night Shift Worker (Anthropic Claude edition).

CONTEXT:
$aiState

ARCHITECTURAL GUIDANCE:
$($architectReport.Substring(0, [Math]::Min(5000, $architectReport.Length)))

NIGHT SHIFT ROLES:
$nightShiftRoles

CURRENT TICKET:
$TicketBody

YOUR TASK:
Implement this ticket by generating a unified diff patch.

RULES:
1) Output ONLY a valid unified diff (git diff format)
2) No explanations, no markdown code blocks, just the raw patch
3) Follow all constraints in the ticket
4) Minimal diffs only (no refactors)
5) New files: use "diff --git a/path/to/new.ts b/path/to/new.ts" with "new file mode 100644"
6) Edited files: include 3+ lines of context before/after changes

OUTPUT FORMAT (example):
diff --git a/packages/rb-logic-core/src/labs/labDefinition.ts b/packages/rb-logic-core/src/labs/labDefinition.ts
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/packages/rb-logic-core/src/labs/labDefinition.ts
@@ -0,0 +1,50 @@
+export interface LabDefinition {
+  labId: string;
+  ...
+}

Generate the patch now.
"@

# Call Anthropic API
$headers = @{
  "x-api-key" = $ANTHROPIC_API_KEY
  "anthropic-version" = "2023-06-01"
  "content-type" = "application/json"
}

$body = @{
  model = "claude-3-5-sonnet-20241022"
  max_tokens = 8192
  messages = @(
    @{
      role = "user"
      content = $prompt
    }
  )
} | ConvertTo-Json -Depth 10

try {
  $response = Invoke-RestMethod -Uri "https://api.anthropic.com/v1/messages" -Method Post -Headers $headers -Body $body -TimeoutSec 120
  $patch = $response.content[0].text
} catch {
  Write-Host "ERROR: Anthropic API call failed: $_"
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
