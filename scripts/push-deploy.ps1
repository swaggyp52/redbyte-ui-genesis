[CmdletBinding(PositionalBinding=$false)]
param(
  [Parameter(Mandatory=$false)]
  [string]$Message,

  [Parameter(Mandatory=$false)]
  [string]$Branch,

  [switch]$DryRun,
  [switch]$Force,
  [switch]$NoTests,
  [switch]$RedeployOnly,
  [switch]$VerifyLive
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Info([string]$m) { Write-Host $m }
function Warn([string]$m) { Write-Warning $m }
function Fail([string]$m) { Write-Error $m; exit 1 }

function Exec([string]$cmd) {
  Info $cmd
  if (-not $DryRun) {
    Invoke-Expression $cmd
  }
}

function Get-HeadSha() {
  return (git rev-parse HEAD).Trim()
}

function Verify-LiveSiteSha([string]$siteUrl, [string]$expectedSha) {
  $url = $siteUrl.TrimEnd("/") + "/build.txt"
  Info "Checking live build SHA at: $url"

  $maxAttempts = 60
  $sleepSeconds = 5

  for ($i = 1; $i -le $maxAttempts; $i++) {
    try {
      $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20

      $live = ""
      if ($null -ne $resp -and $null -ne $resp.Content) { $live = [string]$resp.Content }
      $live = $live.Trim()

      if (-not [string]::IsNullOrWhiteSpace($live)) {
        Info "Live SHA:     $live"
        Info "Expected SHA: $expectedSha"

        if ($live.StartsWith($expectedSha) -or $expectedSha.StartsWith($live)) {
          Info "LIVE VERIFIED: site is serving the expected commit."
          return
        }

        Warn "Live SHA does not match yet (attempt $i/$maxAttempts)."
      } else {
        Warn "build.txt is empty (attempt $i/$maxAttempts)."
      }
    } catch {
      Warn ("Could not fetch build.txt yet (attempt $i/$maxAttempts): " + $_.Exception.Message)
    }

    Start-Sleep -Seconds $sleepSeconds
  }

  Fail "Timed out waiting for live site SHA to match expected commit."
}

# Locate git root
try {
  $gitRoot = (git rev-parse --show-toplevel).Trim()
} catch {
  Fail "Not in a git repo (git rev-parse failed)."
}
Set-Location $gitRoot

Info ""
Info "== Verifying git remote 'origin' =="
$origin = (git remote get-url origin 2>$null)
if (-not $origin) { Fail "Missing git remote 'origin'. Fix: git remote add origin <url>" }

$curBranch = (git rev-parse --abbrev-ref HEAD).Trim()
if (-not $Branch) { $Branch = $curBranch }

Info "Current branch: $curBranch"
Info "Target branch:  $Branch"

# Detect changes
$porcelain = (git status --porcelain)
$hasChanges = -not [string]::IsNullOrWhiteSpace($porcelain)

if ($RedeployOnly -and $hasChanges) {
  Warn "RedeployOnly set but working tree has changes. Use -Force to proceed or commit first."
  if (-not $Force) { Fail "Refusing redeploy-only with dirty tree." }
}

if ($hasChanges) {
  if (-not $Message) { Fail "You have uncommitted changes. Provide -Message `"your commit message`"." }

  Info ""
  Info "== Staging + committing =="
  Exec "git add -A"

  $postAdd = (git status --porcelain)
  if ([string]::IsNullOrWhiteSpace($postAdd)) {
    Warn "No changes after staging."
  } else {
    $safeMsg = $Message -replace '"','\"'
    Exec ("git commit -m " + '"' + $safeMsg + '"')
  }
} else {
  Info ""
  Info "== No working tree changes =="
  Info "Will proceed with push/deploy using current HEAD."
}

Info ""
Info "== Build gate =="

if (-not $NoTests) {
  # IMPORTANT: Build the manual-site package only (prevents pnpm recursive --filter nonsense)
  # This is what actually ships to redbyteapps.dev "Guide" / manual-site.
  if (Test-Path "$gitRoot\apps\manual-site\package.json") {
    Exec "pnpm --filter @redbyte/manual-site run build"
  } else {
    Warn "apps/manual-site not found; skipping targeted build."
  }
} else {
  Warn "NoTests enabled: skipping build gate."
}

Info ""
Info "== Pushing to origin/$Branch =="
Exec "git push origin $Branch"

Info ""
Info "== Triggering deploy =="
if (Test-Path "$gitRoot\deploy.ps1") {
  Exec ("powershell -NoProfile -ExecutionPolicy Bypass -File " + '"' + "$gitRoot\deploy.ps1" + '"')
} else {
  Warn "No deploy.ps1 found. If Cloudflare Pages is GitHub-integrated, push may be enough."
}

# Optional strict verification against the live site
if ($VerifyLive) {
  if ($DryRun) {
    Warn "DryRun: skipping live-site verification."
  } else {
    Info ""
    Info "== Live-site verification =="
    $expectedSha = Get-HeadSha
    Verify-LiveSiteSha -siteUrl "https://redbyteapps.dev" -expectedSha $expectedSha
  }
}

Info "DONE"
