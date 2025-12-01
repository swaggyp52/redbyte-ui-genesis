Write-Host "=== REDBYTE PATH REPAIR TOOL v5 ===" -ForegroundColor Cyan

# Always start from current directory safely
$dir = Get-Location
$last = $null

# Walk upward safely until project root is found
while ($dir -ne $null -and $dir -ne $last) {

    if (
        (Test-Path "$dir/package.json") -and
        (Test-Path "$dir/vite.config.ts") -and
        (Test-Path "$dir/src")
    ) {
        Write-Host "✔ Project root found: $dir" -ForegroundColor Green
        $Global:REDROOT = $dir
        break
    }

    $last = $dir
    $dir = $dir.Parent
}

if (-not $Global:REDROOT) {
    Write-Host "❌ ERROR: Project root NOT found." -ForegroundColor Red
    Write-Host "Run this script from anywhere INSIDE redbyte-ui folder."
    exit
}

# Fix bad nested src/src folders
$badFolder = Join-Path $Global:REDROOT "src/src"
if (Test-Path $badFolder) {
    Write-Host "⚠ Removing invalid nested folder: $badFolder"
    Remove-Item -Recurse -Force $badFolder
}

# Ensure required structure
$folders = @("src/os", "src/components", "src/apps")
foreach ($f in $folders) {
    $path = Join-Path $Global:REDROOT $f
    if (-not (Test-Path $path)) {
        New-Item -ItemType Directory -Force $path | Out-Null
        Write-Host "✔ Created missing folder: $path"
    }
}

# Patch deploy scripts
$patchTargets = @(
    "deploy.ps1",
    "watch-deploy.ps1",
    "go.ps1",
    "make-redbyte-alive.ps1",
    "fix-and-deploy.ps1"
)

foreach ($fileName in $patchTargets) {
    $file = Join-Path $Global:REDROOT $fileName

    if (Test-Path $file) {
        $raw = Get-Content $file -Raw
        $fixed = $raw -replace "\\\\", "/"
        Set-Content $file $fixed -Encoding UTF8
        Write-Host "✔ Patched slashes in: $file"
    }
}

# Test write
$test = Join-Path $Global:REDROOT "src/os/write-test.txt"
"ok" | Set-Content $test
if (Test-Path $test) {
    Write-Host "✔ Write test successful" -ForegroundColor Green
    Remove-Item $test
}

Write-Host "=== PATH REPAIR COMPLETE ===" -ForegroundColor Cyan

