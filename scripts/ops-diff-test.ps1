param(
  [string] $ZipPath = "packages/ops/labs/fixtures/student-export-pass.rb-lab.zip",
  [string] $GoldenFixture = "lab-traffic-light-minimal",
  [string] $HostAddr = "127.0.0.1",
  [int] $Port = 3001,
  [int] $TimeoutSec = 30,
  [switch] $DebugLog,
  [switch] $UpdateGolden
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function D([string]$msg) {
  if ($DebugLog) { Write-Host ("[DEBUG] {0}" -f $msg) -ForegroundColor DarkGray }
}

function Wait-PortOpen($hostAddr, $port, $timeoutSec) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $tcp = New-Object System.Net.Sockets.TcpClient
      $connect = $tcp.BeginConnect($hostAddr, $port, $null, $null)
      $wait = $connect.AsyncWaitHandle.WaitOne(500, $false)
      if ($wait) {
        try { $tcp.EndConnect($connect); $tcp.Close(); return $true } catch { $tcp.Close() }
      } else {
        $tcp.Close()
      }
    } catch {}
    Start-Sleep -Milliseconds 250
  }
  return $false
}

function Test-PortOpen {
  param([string]$HostAddr="127.0.0.1",[int]$Port=3001)
  try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect($HostAddr, $Port)
    $tcp.Close()
    return $true
  } catch { return $false }
}

function Curl-Json {
  param(
    [Parameter(Mandatory=$true)][string]$Url,
    [string[]]$CurlArgs = @(),
    [int]$MaxTimeSec = 60
  )

  $tmp = Join-Path $env:TEMP ("ops_diff_" + [guid]::NewGuid().ToString("n") + ".txt")
  try {
    $status = & curl.exe -sS --connect-timeout 2 --max-time $MaxTimeSec -o $tmp -w "%{http_code}" @CurlArgs $Url 2>$null
    $curlExit = $LASTEXITCODE

    $body = ""
    if (Test-Path $tmp) { $body = Get-Content $tmp -Raw -ErrorAction SilentlyContinue }

    $statusCode = 0
    if ($curlExit -eq 0 -and $status) {
      try { $statusCode = [int]$status } catch { $statusCode = 0 }
    }

    $json = $null
    if ($body) {
      try { $json = $body | ConvertFrom-Json -ErrorAction Stop } catch { $json = $null }
    }

    return [pscustomobject]@{
      url = $Url
      statusCode = $statusCode
      body = $body
      json = $json
      curlExitCode = $curlExit
    }
  } finally {
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  }
}

$repoRoot = (Get-Location).Path
$goldenFile = Join-Path $repoRoot "scripts/ops-diff-gate.golden.sha256"

function Canonicalize-JsonValue {
  param([Parameter(Mandatory=$true)]$Value)

  if ($null -eq $Value) { return $null }

  if ($Value -is [pscustomobject]) {
    $props = $Value.PSObject.Properties.Name | Sort-Object
    $ordered = [ordered]@{}
    foreach ($p in $props) { $ordered[$p] = Canonicalize-JsonValue -Value $Value.$p }
    return $ordered
  }

  if ($Value -is [System.Collections.IDictionary]) {
    $keys = @($Value.Keys) | Sort-Object
    $ordered = [ordered]@{}
    foreach ($k in $keys) { $ordered[$k] = Canonicalize-JsonValue -Value $Value[$k] }
    return $ordered
  }

  # Arrays: preserve order
  if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
    $out = @()
    foreach ($item in $Value) { $out += ,(Canonicalize-JsonValue -Value $item) }
    return $out
  }

  return $Value
}

function Sha256-Hex {
  param([Parameter(Mandatory=$true)][string]$Text)
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $hash = $sha.ComputeHash($bytes)
    return ([System.BitConverter]::ToString($hash)).Replace("-", "").ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
}

$serverProc = $null
try {
  if (-not (Test-Path -LiteralPath $ZipPath)) { throw "ZipPath not found: $ZipPath" }
  if ($GoldenFixture -match "[/\\\\]" -or $GoldenFixture.Contains("..")) { throw "GoldenFixture must not contain slashes or .." }

  $base = "http://$HostAddr`:$Port"

  if (Test-PortOpen -HostAddr $HostAddr -Port $Port) {
    throw "Port already in use: $Port (stop existing server and retry)"
  }

  D "Starting ops server (node api/server.mjs) on $base"
  $serverProc = Start-Process -FilePath "node" -ArgumentList @("api/server.mjs") -WorkingDirectory (Get-Location).Path -PassThru -NoNewWindow

  if (-not (Wait-PortOpen $HostAddr $Port $TimeoutSec)) {
    throw "Server did not open port $Port within $TimeoutSec seconds"
  }

  $ingestUrl = "$base/api/labs/ingest"
  D "POST $ingestUrl (zip=$ZipPath)"
  $ingest = Curl-Json -Url $ingestUrl -CurlArgs @("-X","POST","-H","Content-Type: application/zip","--data-binary","@$ZipPath") -MaxTimeSec 120
  if ($ingest.statusCode -ne 200) { throw "Ingest failed: HTTP $($ingest.statusCode) body=$($ingest.body)" }
  if (-not $ingest.json -or -not $ingest.json.run_id) { throw "Ingest returned no run_id" }
  $runId = [string]$ingest.json.run_id
  Write-Host ("[OK] ingest run_id={0}" -f $runId) -ForegroundColor Green

  $runDir = Join-Path "packages/ops/labs/runs" $runId
  $submissionPath = Join-Path $runDir "submission.rb-lab.zip"
  if (-not (Test-Path -LiteralPath $submissionPath)) { throw "submission.rb-lab.zip not found after ingest: $submissionPath" }

  $diffUrl = "$base/api/labs/diff"
  $payload = @{ run_id = $runId; golden_fixture = $GoldenFixture } | ConvertTo-Json -Compress
  $payloadPath = Join-Path $env:TEMP ("ops_diff_payload_" + [guid]::NewGuid().ToString("n") + ".json")
  try {
    [System.IO.File]::WriteAllText($payloadPath, $payload, (New-Object System.Text.UTF8Encoding($false)))
    D "POST $diffUrl (fixture=$GoldenFixture)"
    $diff = Curl-Json -Url $diffUrl -CurlArgs @("-X","POST","-H","Content-Type: application/json","--data-binary","@$payloadPath") -MaxTimeSec 30
  } finally {
    Remove-Item $payloadPath -Force -ErrorAction SilentlyContinue
  }
  if ($diff.statusCode -ne 200) {
    $errPath = Join-Path $runDir "diff-error.txt"
    $stdoutPath = Join-Path $runDir "diff-stdout.txt"
    throw ("Diff failed: HTTP {0} body={1} (run_dir={2} diff-error={3} diff-stdout={4})" -f $diff.statusCode, $diff.body, $runDir, $errPath, $stdoutPath)
  }
  if (-not $diff.json -or -not $diff.json.ok) { throw "Diff returned ok=false or invalid JSON" }
  Write-Host ("[OK] diff verdict={0} exit_code={1}" -f $diff.json.summary.verdict, $diff.json.summary.exit_code) -ForegroundColor Green

  $artifactUrl = "$base/api/labs/runs/$runId/artifacts/diff.json"
  D "GET $artifactUrl"
  $artifact = Curl-Json -Url $artifactUrl -CurlArgs @() -MaxTimeSec 10
  if ($artifact.statusCode -ne 200) { throw "Artifact fetch failed: HTTP $($artifact.statusCode) body=$($artifact.body)" }
  if (-not $artifact.json -or $artifact.json.run_id -ne $runId) { throw "Artifact JSON invalid or run_id mismatch" }
  Write-Host ("[OK] diff.json artifact retrievable") -ForegroundColor Green

  $diffPath = Join-Path $runDir "diff.json"
  if (-not (Test-Path -LiteralPath $diffPath)) { throw "diff.json not found on disk: $diffPath" }

  # Deterministic gate hash: exclude run_id (changes every run), hash only stable fields
  $hashPayload = [ordered]@{
    golden_fixture = [string]$artifact.json.golden_fixture
    strict_hash = [bool]$artifact.json.strict_hash
    summary = $artifact.json.summary
    diff = $artifact.json.diff
  }
  $canonical = Canonicalize-JsonValue -Value $hashPayload | ConvertTo-Json -Depth 20 -Compress
  $hash = Sha256-Hex -Text $canonical
  Write-Host ("[INFO] diff canonical sha256={0}" -f $hash) -ForegroundColor Cyan

  if ($UpdateGolden) {
    $lines = @(
      ("fixture={0} golden={1} strict_hash=false" -f (Split-Path -Leaf $ZipPath), $GoldenFixture),
      ("sha256={0}" -f $hash),
      ""
    )
    [System.IO.File]::WriteAllLines($goldenFile, $lines, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host ("[OK] updated golden hash -> {0}" -f $goldenFile) -ForegroundColor Green
  } else {
    if (-not (Test-Path -LiteralPath $goldenFile)) { throw "Golden hash file missing: $goldenFile (run with -UpdateGolden to create)" }
    $goldenText = Get-Content -LiteralPath $goldenFile -Raw
    $m = [regex]::Match($goldenText, "sha256=([0-9a-f]{64})", "IgnoreCase")
    if (-not $m.Success) { throw "Golden hash file invalid (expected sha256=...): $goldenFile" }
    $expected = $m.Groups[1].Value.ToLowerInvariant()
    if ($hash -ne $expected) {
      throw ("Diff hash mismatch: expected={0} got={1}. To update intentionally: run scripts/ops-diff-test.ps1 -UpdateGolden" -f $expected, $hash)
    }
    Write-Host "[OK] diff hash matches golden" -ForegroundColor Green
  }

  Write-Host "[PASS] ops diff endpoint verified" -ForegroundColor Green
  exit 0
} catch {
  Write-Host ("[FAIL] {0}" -f $_.Exception.Message) -ForegroundColor Red
  exit 1
} finally {
  if ($serverProc -ne $null -and -not $serverProc.HasExited) {
    try { Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue } catch {}
  }
}
