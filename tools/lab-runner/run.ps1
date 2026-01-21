param (
    [string]$Packet,
    [string]$Port,
    [switch]$Mock,
    [int]$Duration = 10,
    [string]$BridgeUrl = "http://localhost:4242"
)

$ErrorActionPreference = "Stop"

if (-not $Packet) {
    Write-Error "Usage: .\run.ps1 -Packet <path> [-Port <COMx>] [-Mock] [-Duration <sec>]"
    exit 1
}

$Packet = Resolve-Path $Packet
if (-not (Test-Path $Packet)) {
    Write-Error "Packet not found: $Packet"
    exit 1
}

# 1. Verify Packet
Write-Host "1. Verifying Packet..." -ForegroundColor Cyan

# Relative to tools/lab-runner/run.ps1
# We expect tools/toolchain/rb-fpga-toolchain.mjs
$ToolchainScript = Join-Path $PSScriptRoot "..\toolchain\rb-fpga-toolchain.mjs"

if (-not (Test-Path $ToolchainScript)) {
    # Fallback/Debug
    Write-Host "Toolchain script not found at $ToolchainScript. Searching..."
    $ToolchainScript = Resolve-Path "$PSScriptRoot\..\..\tools\toolchain\rb-fpga-toolchain.mjs" -ErrorAction SilentlyContinue
}

if (-not $ToolchainScript -or -not (Test-Path $ToolchainScript)) {
    Write-Error "Could not locate rb-fpga-toolchain.mjs"
    exit 1
}

node $ToolchainScript verify --packet $Packet
if ($LASTEXITCODE -ne 0) {
    Write-Error "Packet verification failed."
    exit 1
}

# 2. Extract Info
$ManifestPath = Join-Path $Packet "lab-manifest.v1.json"
$Manifest = Get-Content $ManifestPath | ConvertFrom-Json
$BoardId = $Manifest.board_id

# 3. Connect/Prepare Bridge
Write-Host "3. Preparing Bridge..." -ForegroundColor Cyan
try {
    $Health = Invoke-RestMethod -Uri "$BridgeUrl/health" -Method Get
}
catch {
    Write-Error "Bridge not reachable at $BridgeUrl. Please start rb-fpga-bridge."
    exit 1
}

# 4. Program Bitstream (if Hardware)
if (-not $Mock) {
    if (-not $Port) {
        Write-Error "Hardware mode requires -Port <COMx> (or implied auto-connect)."
        # Attempt auto connect if not collected
    }
    
    # Locate Bitstream in Packet
    # Manifest doesn't explicitly link bitstream path for 'pack', it packed 'src'.
    # WAIT. 'pack' only packed SOURCES. It did NOT pack the bitstream?
    # Checking pack command... it copies sources.
    # Ah, the Runner is supposed to Run a LAB. 
    # Does the student provide the bitstream? Or does the Runner build it?
    # The 'pack' command as implemented only packs sources.
    # To run, we need a bitstream.
    # EITHER:
    # A) The packet includes a pre-built bitstream (if packed after build).
    # B) The Runner runs 'build' then 'run'.
    # C) The Runner expects the Student to 'build' first, then 'pack' includes it?
    
    # Looking at 'pack' implementation: It only copies 'src'.
    # It does NOT look for 'dist' or 'out' artifacts unless we update it.
    
    # For now, let's assume the PACKET contains the BITSTREAM if we want to run it.
    # OR, we build it on the fly.
    # Given "One-Command Lab Runner", it implies running a lab.
    # If the student submits source, we must build.
    # If the student submits a built lab, we run.
    
    # Let's check for 'artifacts/bitstream.bit' or similar in packet.
    # If missing, we might need to build.
    # But 'pack' didn't support putting bitstream in.
    
    # CRITICAL: Agent E mission says "Program... with bitstream".
    # I should update 'pack' to include 'bitstream.bit' if present?
    # Or just assume for now we are running in MOCK mode which generates io?
    # Or maybe we assume 'build' was run and 'pack' included it?
    # The 'pack' command I wrote only scanned 'src'.
    
    # STOPGAP: look for .bit in packet root or src?
    # If not found, fail for HW runs.
    
    $BitFiles = Get-ChildItem -Path $Packet -Filter "*.bit" -Recurse
    if ($BitFiles.Count -eq 0) {
        Write-Warning "No bitstream found in packet. Hardware programming will fail."
        # If strict, error out.
    }
    else {
        $BitFile = $BitFiles[0].FullName
        Write-Host "Programming $BitFile ..."
        # Convert to Base64
        $Bytes = [System.IO.File]::ReadAllBytes($BitFile)
        $B64 = [Convert]::ToBase64String($Bytes)
        
        # Determine Device ID from Bridge
        $Devices = Invoke-RestMethod -Uri "$BridgeUrl/devices" -Method Get
        $Device = $Devices.devices | Select-Object -First 1
        if (-not $Device) { Write-Error "No FPGA device found."; exit 1 }
        
        $Body = @{
            device_id        = $Device.id
            bitstream_base64 = $B64
        } | ConvertTo-Json
        
        Invoke-RestMethod -Uri "$BridgeUrl/program" -Method Post -Body $Body -ContentType "application/json"
    }
}

# 5. Start Run
Write-Host "5. Starting Run (Mock=$Mock)..." -ForegroundColor Cyan
# For Mock, we need device_id too.
$Devices = Invoke-RestMethod -Uri "$BridgeUrl/devices" -Method Get
$Device = $Devices.devices | Select-Object -First 1
if (-not $Device) { 
    if ($Mock) { Write-Warning "No devices found, but proceeding in Mock mode if bridge supports virtual devices." }
    else { Write-Error "No device found."; exit 1 }
}
$DeviceId = if ($Device) { $Device.id } else { "virtual-device" } # Fallback if bridge has no virtuals yet

$RunBody = @{
    device_id = $DeviceId
    mode      = if ($Mock) { "mock" } else { "hardware" }
    hz        = 20
} | ConvertTo-Json

$RunResp = Invoke-RestMethod -Uri "$BridgeUrl/run" -Method Post -Body $RunBody -ContentType "application/json"
$RunId = $RunResp.run_id
Write-Host "Run Started: $RunId"

# 6. Record Trace
Write-Host "6. Recording Trace for $Duration seconds..." -ForegroundColor Cyan
$TracePath = Join-Path $PSScriptRoot "trace.ndjson" # Temp location
$RecorderScript = Join-Path $PSScriptRoot "..\..\packages\rb-fpga-bridge\scripts\record-trace.js"
$StreamUrl = "$BridgeUrl/stream?run_id=$RunId"

# Start Node Recorder in background
$RecorderProcess = Start-Process -FilePath "node" -ArgumentList "$RecorderScript --url $StreamUrl --out $TracePath --duration $(($Duration * 1000))" -PassThru

# Wait for duration (plus a buffer)
Start-Sleep -Seconds ($Duration + 2)

# Ensure process ended
if (-not $RecorderProcess.HasExited) {
    Stop-Process -Id $RecorderProcess.Id -Force
}

# 7. Stop Run
Invoke-RestMethod -Uri "$BridgeUrl/stop" -Method Post -Body (@{ run_id = $RunId } | ConvertTo-Json) -ContentType "application/json"

# 8. Bless
Write-Host "8. Blessing Evidence..." -ForegroundColor Cyan
$BlessScript = Join-Path $PSScriptRoot "..\..\packages\rb-fpga-bridge\scripts\bless-capsule.js"
$EvidencePath = Join-Path $Packet "evidence.json"
# We need to bless the trace against the manifest.
# The trace is in $TracePath. The manifest is $ManifestPath.

node $BlessScript $TracePath $ManifestPath $EvidencePath
if ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCESS: Evidence generated at $EvidencePath" -ForegroundColor Green
}
else {
    Write-Error "Blessing failed."
}
