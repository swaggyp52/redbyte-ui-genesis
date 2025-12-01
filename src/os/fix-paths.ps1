Write-Host "=== REDBYTE PATH REPAIR TOOL v3 ===" -ForegroundColor Cyan

# Step 1 — Locate project root upward from current folder
$dir = Get-Location
$rootDrive = $dir.Drive.Root
$found = $false

while ($true) {
    if (
        (Test-Path (Join-Path $dir "package.json")) -and
        (Test-Path (Join-Path $dir "vite.config.ts")) -and
        (Test-Path (Join-Path $dir "src"))
    ) {
        Write-Host "✔ Found project root: $dir" -ForegroundColor Green
        $Global:REDROOT = $dir
        $found = $true
        break
    }

    if ($dir.Path -eq $rootDrive) { break }

    $dir = $dir.Parent
}

if (-not $found) {
    Write-Host "❌ ERROR: Could not locate project root." -ForegroundColor Red
    Write-Host "You are currently in: $(Get-Location)"
    exit
}

# Step 2 — Remove incorrect nested src/src folder
$bad = Join-Path $Global:REDROOT "src\src"
if (Test-Path $bad) {
    Write-Host "⚠ Removing invalid folder: $bad" -ForegroundColor Yellow
    Remove-Item -Recurse -Force $bad
}

# Step 3 — Ensure required structure exists
$needed = @("src\os", "src\components", "src\apps")
foreach ($f in $needed) {
    $p = Join-Path $Global:REDROOT $f
    if (-not (Test-Path $p)) {
        New-Item -ItemType Directory -Force $p | Out-Null
        Write-Host "Created: $p"
    }
}

# Step 4 — Patch deploy-related script files
$scripts = @("deploy.ps1","watch-deploy.ps1","go.ps1","make-redbyte-alive.ps1","fix-and-deploy.ps1")

foreach ($s in $scripts) {
    $file = Join-Path $Global:REDROOT $s
    if (Test-Path $file) {

        $content = Get-Content $file -Raw
        $fixed = $content -replace "\\\\", "/"

        Set-Content $file $fixed -Encoding UTF8

        Write-Host "Patched: $file"
    }
}

# Step 5 — Verify ability to write to src/os
$testFile = Join-Path $Global:REDROOT "src\os\_path_ok.txt"
"ok" | Set-Content $testFile
if (Test-Path $testFile) {
    Write-Host "✔ Path test success!" -ForegroundColor Green
    Remove-Item $testFile
}

Write-Host "=== PATH REPAIR COMPLETE ===" -ForegroundColor Cyan
