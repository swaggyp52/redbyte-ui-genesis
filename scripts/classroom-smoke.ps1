Param(
  [string]$BaseUrl = 'http://127.0.0.1:4173'
)

$ErrorActionPreference = 'Stop'

Write-Host "[PR13] Classroom smoke: build + fail-fast boot checks" -ForegroundColor Cyan

pnpm --filter @redbyte/playground build
if ($LASTEXITCODE -ne 0) { throw "playground build failed with exit code $LASTEXITCODE" }

$env:PLAYWRIGHT_TEST_BASE_URL = $BaseUrl
pnpm exec playwright test tests/e2e/classroom-rc-smoke.spec.ts --project=chromium
