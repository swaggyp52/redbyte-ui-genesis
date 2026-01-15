param()

$ErrorActionPreference = "Stop"

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne "main") { exit 0 }

Write-Host "[pre-push] main push detected. Running pnpm test..."
pnpm test
if ($LASTEXITCODE -ne 0) {
  Write-Host "[pre-push] BLOCKED: tests failed."
  exit $LASTEXITCODE
}

Write-Host "[pre-push] OK: tests passed."
exit 0
