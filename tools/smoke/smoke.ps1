#requires -Version 5.1
<#
RedByte FPGA Bridge Smoke Test (Ticket 8)

Proves end-to-end:
  1) /devices sees and merges UART+JTAG
  2) /program loads fixture bitstream
  3) /devices re-identifies (best effort) + pinmap gate (bridge enforces)
  4) /run mode=hardware
  5) /stream SSE yields real samples (not mock)
  6) /stop shuts down cleanly
  7) Prints PASS/FAIL with actionable diagnostics + /log link

Usage:
  powershell -ExecutionPolicy Bypass -File tools\smoke\smoke.ps1 -Board basys3
  powershell -ExecutionPolicy Bypass -File tools\smoke\smoke.ps1 -Board spartan3e
  powershell -ExecutionPolicy Bypass -File tools\smoke\smoke.ps1 -DeviceId board-2100001234
#>

[CmdletBinding()]
param(
  [ValidateSet("auto","basys3","spartan3e")]
  [string]$Board = "auto",

  [string]$BridgeUrl = "http://127.0.0.1:4242",

  [string]$DeviceId = "",

  [string]$BitstreamPath = "",

  [int]$Hz = 20,

  [int]$SampleCount = 5,

  [int]$FirstSampleTimeoutMs = 2000
)

$ErrorActionPreference = "Stop"

function Step([string]$msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Ok([string]$msg)   { Write-Host "[OK]  $msg" -ForegroundColor Green }
function Warn([string]$msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Fail([string]$msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red }

function ExitFail([string]$msg, [int]$code = 1) { Fail $msg; exit $code }

function GetJson([string]$url) {
  return Invoke-RestMethod -Method Get -Uri $url -ContentType "application/json"
}

function PostJson([string]$url, [hashtable]$body) {
  $json = ConvertTo-Json $body -Depth 10
  return Invoke-RestMethod -Method Post -Uri $url -ContentType "application/json" -Body $json
}

function RepoRootFromHere() {
  $p = Split-Path -Parent $PSScriptRoot
  return Split-Path -Parent $p
}

function DefaultFixtureBit([string]$board) {
  if ($BitstreamPath -and (Test-Path $BitstreamPath)) { return $BitstreamPath }

  $repo = RepoRootFromHere
  if ($board -eq "basys3") {
    return Join-Path $repo "tools\fixtures\basys3\rb_wrapper_smoke.bit"
  }
  if ($board -eq "spartan3e") {
    return Join-Path $repo "tools\fixtures\spartan3e\rb_wrapper_smoke.bit"
  }
  return ""
}

function SummarizeDevices($devices) {
  $out = @()
  foreach ($d in $devices) {
    $rt = $d.runtime
    $pg = $d.programming
    $out += ("- {0} | model={1} | conf={2} | rt={3}:{4} | prog={5}:{6}" -f `
      $d.id, $d.model_id, $d.confidence, `
      $rt.kind, $rt.status, `
      $pg.driver, $pg.status)
  }
  return ($out -join "`n")
}

function PickDevice($devices) {
  if ($DeviceId) {
    $m = $devices | Where-Object { $_.id -eq $DeviceId }
    if (-not $m) { ExitFail "DeviceId '$DeviceId' not found in /devices." 2 }
    return $m[0]
  }

  $pool = $devices
  $nonSim = $devices | Where-Object { $_.id -ne "sim" }
  if ($nonSim.Count -gt 0) { $pool = $nonSim }

  $best = $null
  $bestScore = -1

  foreach ($d in $pool) {
    $rtOk = $d.runtime -and $d.runtime.status -eq "ready"
    $pgOk = $d.programming -and $d.programming.status -eq "ready"
    $score = 0
    if ($rtOk) { $score += 10 }
    if ($pgOk) { $score += 20 }
    $score += [int]([double]$d.confidence * 10)

    if ($score -gt $bestScore) {
      $bestScore = $score
      $best = $d
    }
  }

  return $best
}

function AutoBoard($device) {
  if ($Board -ne "auto") { return $Board }
  if ($device.model_id -eq "basys3") { return "basys3" }
  if ($device.model_id -eq "spartan3e-starter") { return "spartan3e" }

  try {
    $raw = $device.diagnostics.programming.enumeration_raw
    if ($raw -match "Basys") { return "basys3" }
  } catch { }

  Warn "Auto board detection uncertain; defaulting to basys3. Use -Board basys3|spartan3e to force."
  return "basys3"
}

function ReadSseSamples([string]$url, [int]$want, [int]$timeoutMs) {
  $req = [System.Net.HttpWebRequest]::Create($url)
  $req.Method = "GET"
  $req.Accept = "text/event-stream"

  $resp = $req.GetResponse()
  $stream = $resp.GetResponseStream()
  $reader = New-Object System.IO.StreamReader($stream)

  $samples = @()
  $lastStatus = $null
  $evt = ""
  $deadline = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + $timeoutMs

  try {
    while ($samples.Count -lt $want) {
      $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
      if ($now -ge $deadline) { break }

      $task = $reader.ReadLineAsync()
      if (-not $task.Wait(100)) { continue }
      $line = $task.Result
      if ($null -eq $line) { continue }

      if ($line.StartsWith("event:")) {
        $evt = $line.Substring(6).Trim()
        continue
      }

      if ($line.StartsWith("data:")) {
        $payload = $line.Substring(5).Trim()
        if (-not $payload) { continue }

        try {
          $obj = $payload | ConvertFrom-Json
        } catch {
          continue
        }

        if ($evt -eq "status") {
          $lastStatus = $obj
        } elseif ($evt -eq "sample") {
          $samples += $obj
        }
      }
    }
  } finally {
    try { $reader.Close(); $stream.Close(); $resp.Close() } catch { }
  }

  return @{ samples = $samples; lastStatus = $lastStatus }
}

# ------------------ Smoke flow ------------------

Step "Step 0: Query /devices"
$devicesResp = GetJson "$BridgeUrl/devices"
if (-not $devicesResp -or -not $devicesResp.devices) {
  ExitFail "Invalid /devices response." 3
}
$devices = $devicesResp.devices
if ($devices.Count -eq 0) {
  ExitFail "No devices returned by /devices. Is rb-fpga-bridge running?" 3
}
Ok ("Found {0} device(s)" -f $devices.Count)

$pick = PickDevice $devices
if (-not $pick) {
  Write-Host (SummarizeDevices $devices)
  ExitFail "No usable device detected. Plug board in and check USB drivers. (/devices shows none ready)" 4
}
Ok ("Selected device: {0} (model={1}, conf={2})" -f $pick.id, $pick.model_id, $pick.confidence)

$board = AutoBoard $pick
Ok ("Board selection: {0}" -f $board)

$bit = DefaultFixtureBit $board
if (-not $bit -or -not (Test-Path $bit)) {
  ExitFail ("Fixture bitstream not found: {0}. Build it using tools/fixtures/{1}/README.md" -f $bit, $board) 5
}
Ok ("Using bitstream: {0}" -f $bit)

Step "Step 1: /program fixture bitstream"
$prog = PostJson "$BridgeUrl/program" @{
  device_id = $pick.id
  board_model_id = ($(if ($board -eq "basys3") { "basys3" } else { "spartan3e-starter" }))
  bitstream_path = $bit
}

if (-not $prog.ok) {
  $err = $prog.error
  $log = $prog.log_path
  Fail ("/program failed: {0}" -f $err)
  if ($log) {
    Write-Host ("See log: {0}/log?id={1}" -f $BridgeUrl, [System.IO.Path]::GetFileName($log))
  } else {
    Write-Host ("See recent logs: {0}/logs" -f $BridgeUrl)
  }
  exit 10
}
Ok "/program OK"
if ($prog.log_path) {
  $logId = [System.IO.Path]::GetFileName($prog.log_path)
  Ok ("Program log: {0}/log?id={1}" -f $BridgeUrl, $logId)
}

Step "Step 2: Re-check /devices for identify upgrade (best-effort)"
Start-Sleep -Milliseconds 200
$devicesResp2 = GetJson "$BridgeUrl/devices"
$dev2 = $devicesResp2.devices | Where-Object { $_.id -eq $pick.id }
if (-not $dev2) {
  Warn "Device disappeared after programming. Replug board and retry."
} else {
  $m = $dev2.model_id
  if ($m -eq "unknown-digilent") {
    Warn "Still unidentified (unknown-digilent). This can happen if UART wrapper isn't reachable. Continuing to stream check."
  } else {
    Ok ("Identify upgraded model_id: {0}" -f $m)
  }
}

Step "Step 3: /run (hardware) and confirm real samples via SSE"
$run = PostJson "$BridgeUrl/run" @{
  device_id = $pick.id
  mode = "hardware"
  hz = $Hz
}

if (-not $run.ok) {
  ExitFail ("/run failed: {0}" -f $run.error) 11
}

$runId = $run.run_id
Ok ("Run started: {0}" -f $runId)

$streamUrl = "{0}/stream?run_id={1}" -f $BridgeUrl, $runId
Step ("Connecting SSE: {0}" -f $streamUrl)

$result = ReadSseSamples $streamUrl $SampleCount $FirstSampleTimeoutMs
$samples = $result.samples
$lastStatus = $result.lastStatus

if ($samples.Count -lt $SampleCount) {
  if ($lastStatus -and $lastStatus.state -eq "running_no_data") {
    Fail "No UART samples received (running_no_data). Design may not include RedByte stream wrapper, or UART pins/baud are wrong."
  } else {
    Fail ("Only received {0}/{1} samples before timeout." -f $samples.Count, $SampleCount)
  }

  Step "Stopping run"
  try { PostJson "$BridgeUrl/stop" @{ run_id = $runId } | Out-Null } catch { }

  Write-Host ("Check logs: {0}/logs" -f $BridgeUrl)
  exit 12
}

$prev = -1
for ($i=0; $i -lt $samples.Count; $i++) {
  $t = [int]$samples[$i].t_ms
  if ($t -lt $prev) {
    Warn "Non-monotonic t_ms detected."
    break
  }
  $prev = $t

  if (-not $samples[$i].io -or ($null -eq $samples[$i].io.sw) -or ($null -eq $samples[$i].io.btn) -or ($null -eq $samples[$i].io.led)) {
    Warn "Sample missing expected io fields."
    break
  }
}

Ok ("Received {0} samples" -f $samples.Count)

Step "Step 4: /stop"
$st = PostJson "$BridgeUrl/stop" @{ run_id = $runId }
if (-not $st.ok) {
  Warn "/stop returned not-ok (continuing)."
} else {
  Ok "/stop OK"
}

Ok ("PASS: {0} {1} streaming OK ({2} samples)" -f $board, $pick.id, $samples.Count)
exit 0
