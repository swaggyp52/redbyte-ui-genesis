param(
  [switch] $StartServer,
  [string] $ZipPath = "",
  [switch] $CheckArtifacts,
  [int[]] $ExpectExitCodes,
  [int] $Port = 3001,
  [string] $HostAddr = "127.0.0.1",
  [int] $TimeoutSec = 20,
  [string] $JsonOut = "",
  [switch] $Verbose
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function D([string]$msg) {
  if ($Verbose) { Write-Host ("[DEBUG] {0}" -f $msg) -ForegroundColor DarkGray }
}

function Write-Step($name, $ok, $details) {
  $status = if ($ok) { "PASS" } else { "FAIL" }
  $color = if ($ok) { "Green" } else { "Red" }
  Write-Host ("[{0}] {1} - {2}" -f $status, $name, $details) -ForegroundColor $color
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

function Invoke-HttpJson {
  param(
    [Parameter(Mandatory=$true)][string]$Url,
    [int]$MaxTimeSec = 5
  )

  $tmp = Join-Path $env:TEMP ("ops_liveness_" + [guid]::NewGuid().ToString("n") + ".txt")
  try {
    $status = & curl.exe -sS --connect-timeout 2 --max-time $MaxTimeSec -o $tmp -w "%{http_code}" $Url 2>$null
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

function Invoke-HttpIngestZip {
  param(
    [Parameter(Mandatory=$true)][string]$Url,
    [Parameter(Mandatory=$true)][string]$ZipPath,
    [int]$MaxTimeSec = 60
  )

  if (-not (Test-Path -LiteralPath $ZipPath)) { throw "ZipPath not found: $ZipPath" }

  $tmp = Join-Path $env:TEMP ("ops_liveness_ingest_" + [guid]::NewGuid().ToString("n") + ".txt")
  try {
    $status = & curl.exe -sS --connect-timeout 2 --max-time $MaxTimeSec -o $tmp -w "%{http_code}" -X POST -H "Content-Type: application/zip" --data-binary "@$ZipPath" $Url 2>$null
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
      statusCode = $statusCode
      body = $body
      json = $json
      curlExitCode = $curlExit
    }
  } finally {
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  }
}

function Test-PortOpen {
  param([string]$HostAddr="127.0.0.1",[int]$Port=3001)
  try {
    $r = Test-NetConnection $HostAddr -Port $Port -WarningAction SilentlyContinue
    return [bool]$r.TcpTestSucceeded
  } catch { return $false }
}

function Write-JsonFile {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)]$Object
  )
  $full = [System.IO.Path]::GetFullPath($Path)
  $dir = [System.IO.Path]::GetDirectoryName($full)
  if ($dir -and !(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }

    $json = $Object | ConvertTo-Json -Depth 12 -Compress
  [System.IO.File]::WriteAllText($full, $json, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "[ops:liveness] wrote JSON -> $full" -ForegroundColor Cyan
}

$serverProc = $null
$results = [ordered]@{
  timestamp = (Get-Date).ToString("o")
  startedServer = $false
  serverPid = $null
  portOpen = $false
  health = $null
  root = $null
  runs = $null
  ingest = $null
  runDetail = $null
  artifacts = $null
  error = $null
  overallPass = $false
}

$exitCode = 1
$ingestOk = $true
$health = $null
$root = $null
$runs = $null
# gradingPass: ingest succeeded and exit_code is not INVALID (2); indicates grading produced a verdict
$gradingPass = $false
$verdictMappingConsistent = $true
$ingest = $null
$runId = $null
$exitCodeVal = $null
$verdict = ""

try {
  $base = "http://$HostAddr`:$Port"

  if ($StartServer) {
    if (Test-PortOpen -HostAddr $HostAddr -Port $Port) {
      throw "Port $Port already in use. Stop the existing node server first (EADDRINUSE prevention)."
    }
    $results.startedServer = $true
    $node = "node"
    $serverPath = Join-Path $PSScriptRoot "..\api\server.mjs" | Resolve-Path
    $serverProc = Start-Process -FilePath $node -ArgumentList @("$serverPath") -PassThru -NoNewWindow
    $results.serverPid = $serverProc.Id
    Write-Host ("[ops:liveness] started server PID {0}" -f $serverProc.Id) -ForegroundColor Cyan
  }

  $open = Wait-PortOpen -hostAddr $HostAddr -port $Port -timeoutSec $TimeoutSec
  $results.portOpen = $open
  Write-Step "PortOpen" $open ("{0}:{1}" -f $HostAddr, $Port)
  if (-not $open) { throw "Port did not open within $TimeoutSec seconds." }

  $health = Invoke-HttpJson "$base/health"
  $results.health = $health
  $hStatus = ""
  if ($health.json -ne $null -and ($health.json.PSObject.Properties.Name -contains 'status')) { $hStatus = $health.json.status }
  $healthOk = ($health.statusCode -eq 200) -and ($health.json -ne $null) -and ($hStatus -eq "ok")
  Write-Step "GET /health" $healthOk ("statusCode={0}, status={1}" -f $health.statusCode, $hStatus)

  $root = Invoke-HttpJson "$base/"
  $results.root = $root
  $rStatus = ""
  if ($root.json -ne $null -and ($root.json.PSObject.Properties.Name -contains 'status')) { $rStatus = $root.json.status }
  $rootOk = ($root.statusCode -eq 200) -and ($root.json -ne $null) -and ($rStatus -eq "ok")
  Write-Step "GET /" $rootOk ("statusCode={0}, status={1}" -f $root.statusCode, $rStatus)

  $runs = Invoke-HttpJson "$base/api/labs/runs"
  $results.runs = $runs
  $count = 0
  if ($runs.json -is [System.Array]) { $count = $runs.json.Length }
  $runsOk = ($runs.statusCode -eq 200) -and ($runs.json -ne $null)
  Write-Step "GET /api/labs/runs" $runsOk ("statusCode={0}, count={1}" -f $runs.statusCode, $count)

  $ingestOk = $true
  $runId = $null
  $exitCodeIsInt = $true
  $gradeExitMatches = $true
  $verdictMappingConsistent = $true
  $shouldCheckArtifacts = $CheckArtifacts -or ($ZipPath -and $ZipPath.Trim().Length -gt 0)

  if ($ZipPath -and $ZipPath.Trim().Length -gt 0) {
    D "Ingesting zip $ZipPath"
    $ingest = Invoke-HttpIngestZip -Url "$base/api/labs/ingest" -ZipPath $ZipPath
    $runId = if ($ingest.json -ne $null) { $ingest.json.run_id } else { $null }
    $ingestOk = ($ingest.statusCode -ge 200 -and $ingest.statusCode -lt 300) -and ($ingest.json -ne $null) -and ($runId -ne $null)
    $verdict = if ($ingest.json -ne $null) { $ingest.json.verdict } else { "" }
    $exitCodeVal = if ($ingest.json -ne $null) { $ingest.json.exit_code } else { "" }
    $expectedList = $null
    if ($ExpectExitCodes -and $ExpectExitCodes.Length -gt 0) {
      $expectedList = @($ExpectExitCodes | ForEach-Object { try { [int]$_ } catch { $_ } })
    }

    $results.ingest = @{
      statusCode = $ingest.statusCode
      run_id = $runId
      verdict = $verdict
      exit_code = $exitCodeVal
      expected = $expectedList
    }

    # Verify verdict/exit_code contract consistency
    $verdictMappingConsistent = $true
    if ($ingest.json -and $ingest.json.contracts) {
      $exitCodeIsInt = [bool]$ingest.json.contracts.exitCodeIsInt
      $gradeExitMatches = [bool]$ingest.json.contracts.gradeExitMatches
      $verdictMappingConsistent = [bool]$ingest.json.contracts.verdictMappingConsistent
    }

    if ($ingestOk -and $ExpectExitCodes -and $ExpectExitCodes.Length -gt 0) {
      $exitCodeInt = $exitCodeVal
      try { $exitCodeInt = [int]$exitCodeVal } catch {}
      $expectedOk = $ExpectExitCodes -contains $exitCodeInt
      if (-not $expectedOk) {
        $ingestOk = $false
        Write-Host "[ops:liveness] CONTRACT VIOLATION: exit_code=$exitCodeVal not in ExpectExitCodes=$($ExpectExitCodes -join ',')" -ForegroundColor Red
      }
    }

    if ($ingestOk) {
      if ($exitCodeVal -eq 0 -and $verdict -ne "PASS") {
        $verdictMappingConsistent = $false
        Write-Host "[ops:liveness] CONTRACT VIOLATION: exit_code=0 but verdict=$verdict (expected PASS)" -ForegroundColor Red
      }
      if ($exitCodeVal -eq 1 -and $verdict -ne "FAIL") {
        $verdictMappingConsistent = $false
        Write-Host "[ops:liveness] CONTRACT VIOLATION: exit_code=1 but verdict=$verdict (expected FAIL)" -ForegroundColor Red
      }
      if ($exitCodeVal -eq 2 -and $verdict -ne "INVALID") {
        $verdictMappingConsistent = $false
        Write-Host "[ops:liveness] CONTRACT VIOLATION: exit_code=2 but verdict=$verdict (expected INVALID)" -ForegroundColor Red
      }
    }

    $gradingPass = ($ingestOk -and ($exitCodeVal -ne 2))
    Write-Step "POST /api/labs/ingest" $ingestOk ("statusCode={0}, run_id={1}, verdict={2}, exit_code={3}" -f $ingest.statusCode, $runId, $verdict, $exitCodeVal)

    if ($ingestOk) {
      $detail = Invoke-HttpJson "$base/api/labs/runs/$runId"
      $detailOk = ($detail.statusCode -eq 200) -and ($detail.json -ne $null) -and ($detail.json.run_id -eq $runId)
      $results.runDetail = @{
        statusCode = $detail.statusCode
        run_id = if ($detail.json) { $detail.json.run_id } else { $null }
        verdict = if ($detail.json) { $detail.json.verdict } else { "" }
        lab_id = if ($detail.json) { $detail.json.lab_id } else { "" }
      }
      Write-Step "GET /api/labs/runs/<run_id>" $detailOk ("statusCode={0}, run_id={1}" -f $detail.statusCode, $detail.json.run_id)
      # Verify verdict/exit_code contract consistency + invariants
      if ($ingestOk) {
        $gjson = Invoke-HttpJson "$base/api/labs/runs/$runId/artifacts/grade.json"
        $gmd   = Invoke-HttpJson "$base/api/labs/runs/$runId/artifacts/grade.md"
        $okA = ($gjson.statusCode -eq 200) -and ($gjson.body.Trim().Length -gt 0)
        $okB = ($gmd.statusCode -eq 200) -and ($gmd.body.Trim().Length -gt 0)

        # Fallback local contract checks if server did not supply
        if (-not $ingest.json.contracts) {
          $exitCodeIsInt = ($exitCodeVal -is [int]) -or ($exitCodeVal -is [long]) -or ($exitCodeVal -is [double] -and ([math]::Floor($exitCodeVal) -eq $exitCodeVal))
          if ($gjson.json) {
            try { $gradeExitMatches = ($gjson.json.exit_code -eq $exitCodeVal) } catch {}
          }
        }

        $results.artifacts = @{
          grade_json = @{ statusCode = $gjson.statusCode; bytes = $gjson.body.Length }
          grade_md   = @{ statusCode = $gmd.statusCode; bytes = $gmd.body.Length }
        }

        Write-Step "GET grade.json" $okA ("statusCode={0}, bytes={1}" -f $gjson.statusCode, $gjson.body.Length)
        Write-Step "GET grade.md" $okB ("statusCode={0}, bytes={1}" -f $gmd.statusCode, $gmd.body.Length)
        if (-not $exitCodeIsInt) { Write-Host "[ops:liveness] CONTRACT VIOLATION: ingest.exit_code missing/not integer" -ForegroundColor Red }
        if (-not $gradeExitMatches) { Write-Host "[ops:liveness] CONTRACT VIOLATION: grade.json.exit_code != ingest.exit_code" -ForegroundColor Red }
        $ingestOk = $ingestOk -and $okA -and $okB
      }
    }
  } else {
    Write-Host "[ops:liveness] ZipPath not provided; skipping ingest." -ForegroundColor Yellow
  }

  $overall = $open -and $healthOk -and $rootOk -and $runsOk -and $ingestOk -and $verdictMappingConsistent -and $exitCodeIsInt -and $gradeExitMatches
  $results.overallPass = $overall
  Write-Host ""
  Write-Step "OVERALL" $overall "ops server + endpoints + optional ingest"
  if (-not $verdictMappingConsistent) {
    Write-Host "[ops:liveness] overallPass=false due to verdict/exit_code contract violation" -ForegroundColor Red
  }

  if ($overall) { $exitCode = 0 }
}
catch {
  $results.error = $_.Exception.Message
  Write-Host ("[ops:liveness] ERROR: {0}" -f $_.Exception.Message) -ForegroundColor Red
  $exitCode = 1
}
finally {
  # Stop server if we started it
  if ($serverProc -ne $null -and -not $serverProc.HasExited) {
    try {
      Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
      Start-Sleep -Milliseconds 200
      Write-Host ("[ops:liveness] stopped server PID {0}" -f $serverProc.Id) -ForegroundColor DarkGray
    } catch {
      Write-Host ("[ops:liveness] failed to stop PID {0}: {1}" -f $serverProc.Id, $_.Exception.Message) -ForegroundColor Yellow
    }
  }

  # Always write JSON
  if ($JsonOut -and $JsonOut.Trim().Length -gt 0) {
      # Sanitize: extract only primitives/strings to avoid ConvertTo-Json hanging
      $sanitized = [ordered]@{
        timestamp = $results.timestamp
        startedServer = [bool]$results.startedServer
        serverPid = $results.serverPid
        portOpen = [bool]$results.portOpen
        health = if ($results.health) { @{
          statusCode = [int]$results.health.statusCode
          status = if ($results.health.json) { "$($results.health.json.status)" } else { "" }
        }} else { $null }
        root = if ($results.root) { @{
          statusCode = [int]$results.root.statusCode
          status = if ($results.root.json) { "$($results.root.json.status)" } else { "" }
        }} else { $null }
        runs = if ($results.runs) { @{
          statusCode = [int]$results.runs.statusCode
          count = if ($results.runs.json -is [array]) { $results.runs.json.Length } else { 0 }
        }} else { $null }
        ingest = if ($results.ingest) {
          @{
            statusCode = [int]$results.ingest.statusCode
            run_id = if ($results.ingest.run_id) { "$($results.ingest.run_id)" } else { $null }
            verdict = if ($results.ingest.verdict) { "$($results.ingest.verdict)" } else { "" }
            exit_code = if ($results.ingest.exit_code -ne $null) { [int]$results.ingest.exit_code } else { $null }
            expected = if ($ExpectExitCodes -and $ExpectExitCodes.Length -gt 0) {
              @($ExpectExitCodes | ForEach-Object { try { [int]$_ } catch { $_ } })
            } elseif ($null -ne $results.ingest.expected) {
              @($results.ingest.expected | ForEach-Object { try { [int]$_ } catch { $_ } })
            } else { $null }
          }
        } else { $null }
        runDetail = $results.runDetail
        artifacts = $results.artifacts
        error = if ($results.error) { "$($results.error)" } else { $null }
        overallPass = [bool]$results.overallPass
        gradingPass = [bool]$gradingPass
        contracts = @{
          schemaStable = [bool]($results.health -and $results.root -and $results.runs)
          exitCodeIsInt = [bool]$exitCodeIsInt
          verdictMappingConsistent = [bool]$verdictMappingConsistent
          gradeExitMatches = [bool]$gradeExitMatches
          version = if ($ingest.json -and $ingest.json.contracts) { $ingest.json.contracts.version } else { $null }
          gradingPassSemantics = "ingestOk && exit_code != 2"
        }
      }
    try {
        Write-JsonFile -Path $JsonOut -Object $sanitized
    } catch {
      Write-Host ("[ops:liveness] JSON write failed: {0}" -f $_.Exception.Message) -ForegroundColor Red
      $exitCode = 1
    }
  }
}

Write-Host ("[ops:liveness] exiting with code {0}" -f $exitCode) -ForegroundColor DarkGray
$finalJsonPath = if ($JsonOut -and $JsonOut.Trim().Length -gt 0) { [System.IO.Path]::GetFullPath($JsonOut) } else { "" }
$runsCount = if ($runs -and $runs.json -is [array]) { $runs.json.Length } else { 0 }
$ingStatus = if ($ingestOk -and $runId) { "OK" } elseif ($ZipPath -and $ZipPath.Trim().Length -gt 0) { "FAIL" } else { "SKIP" }
$gradeJsonCode = if ($results.artifacts -and $results.artifacts.grade_json) { $results.artifacts.grade_json.statusCode } else { "" }
$gradeMdCode = if ($results.artifacts -and $results.artifacts.grade_md) { $results.artifacts.grade_md.statusCode } else { "" }
$finalRunId = if ($results.ingest) { $results.ingest.run_id } elseif ($results.runDetail) { $results.runDetail.run_id } else { $runId }
 $healthCode = 0; if ($health) { try { $healthCode = [int]$health.statusCode } catch {} }
 $rootCode = 0; if ($root) { try { $rootCode = [int]$root.statusCode } catch {} }
 $runsCode = 0; if ($runs) { try { $runsCode = [int]$runs.statusCode } catch {} }
Write-Host ("[ops:liveness] FINAL overallPass={0} exit={1} startedServer={2} portOpen={3} health={4} root={5} runs={6} count={7} ingest={8} run={9} gradeJson={10} gradeMd={11} gradingPass={12} json={13}" -f $results.overallPass, $exitCode, $results.startedServer, $results.portOpen, $healthCode, $rootCode, $runsCode, $runsCount, $ingStatus, $finalRunId, $gradeJsonCode, $gradeMdCode, $gradingPass, $finalJsonPath)
exit $exitCode
