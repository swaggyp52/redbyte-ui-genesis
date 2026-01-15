param()

$ErrorActionPreference = "Stop"

# Absolute tool paths (hooks do NOT inherit your interactive PATH reliably)
$git  = "C:\Users\angiel001\AppData\Local\Programs\Git\bin\git.exe"
$pnpm = "C:\Users\angiel001\AppData\Roaming\npm\pnpm.cmd"

# Always run from repo root
$repoRoot = (& "C:\Users\angiel001\AppData\Local\Programs\Git\bin\git.exe" rev-parse --show-toplevel).Trim()
Set-Location ""

# Consume stdin lines if present (Git provides them). DO NOT block if none.
try {
  while ([Console]::In.Peek() -ge 0) {
    [Console]::In.ReadLine() | Out-Null
  }
} catch {}# Only gate pushes *from* main
$branch = (& "C:\Users\angiel001\AppData\Local\Programs\Git\bin\git.exe" rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne "main") { exit 0 }

Write-Host "[pre-push] main push detected -> running: pnpm quality"

if (-not (Test-Path "C:\Users\angiel001\AppData\Roaming\npm\pnpm.cmd")) {
  Write-Host "[pre-push] pnpm not found at: "C:\Users\angiel001\AppData\Roaming\npm\pnpm.cmd""
  exit 1
}

& "C:\Users\angiel001\AppData\Roaming\npm\pnpm.cmd" quality
exit $LASTEXITCODE

