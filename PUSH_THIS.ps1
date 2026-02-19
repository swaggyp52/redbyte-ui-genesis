param(
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

Write-Host "[push] branch status"
git status -sb

Write-Host "[push] recent commits"
git log --oneline -20

Write-Host "[push] repository checks"
pnpm repo:status
pnpm gates:import-roundtrip
pnpm -s rc:d2:basys3-bundle-gate

Write-Host "[push] pushing to origin/$Branch"
git push origin $Branch
