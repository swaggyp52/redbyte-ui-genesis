Param(
  [string]$OutputRoot = '.\artifacts\classroom-rc-v1',
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

if (-not $SkipBuild) {
  Write-Host "[1/4] Building classroom app (@redbyte/playground)..." -ForegroundColor DarkCyan
  pnpm --filter @redbyte/playground build
  if ($LASTEXITCODE -ne 0) { throw "playground build failed with exit code $LASTEXITCODE" }
}

$absOutputRoot = Resolve-Path . | ForEach-Object { Join-Path $_ $OutputRoot.TrimStart('.\\') }
if (Test-Path $absOutputRoot) {
  Remove-Item -Recurse -Force $absOutputRoot
}
New-Item -ItemType Directory -Path $absOutputRoot | Out-Null

Write-Host "[2/4] Copying runtime files..." -ForegroundColor DarkCyan
New-Item -ItemType Directory -Path (Join-Path $absOutputRoot 'os') | Out-Null
Copy-Item -Path '.\apps\playground\dist\*' -Destination (Join-Path $absOutputRoot 'os') -Recurse -Force

Write-Host "[3/4] Copying classroom docs..." -ForegroundColor DarkCyan
New-Item -ItemType Directory -Path (Join-Path $absOutputRoot 'docs') | Out-Null
Copy-Item -Path '.\docs\instructor-pack.md' -Destination (Join-Path $absOutputRoot 'docs\instructor-pack.md') -Force
Copy-Item -Path '.\docs\CLASSROOM_RC_PLAYBOOK.md' -Destination (Join-Path $absOutputRoot 'docs\CLASSROOM_RC_PLAYBOOK.md') -Force
Copy-Item -Path '.\docs\classroom\TA_LOCKDOWN_INSTRUCTIONS.md' -Destination (Join-Path $absOutputRoot 'docs\TA_LOCKDOWN_INSTRUCTIONS.md') -Force
Copy-Item -Path '.\docs\classroom\DIAGNOSTICS_EXPORT_INSTRUCTIONS.md' -Destination (Join-Path $absOutputRoot 'docs\DIAGNOSTICS_EXPORT_INSTRUCTIONS.md') -Force

$runStudent = @'
Param([int]$Port = 4173)
$ErrorActionPreference = 'Stop'
Write-Host "Student mode URL: http://127.0.0.1:$Port/os/"
Write-Host "TA quick switch : http://127.0.0.1:$Port/os/?ta=1"
if (Get-Command py -ErrorAction SilentlyContinue) {
  py -m http.server $Port --bind 127.0.0.1
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
  python -m http.server $Port --bind 127.0.0.1
} elseif (Get-Command npx -ErrorAction SilentlyContinue) {
  npx --yes serve . -l $Port
} else {
  throw "No local static server runtime found. Install Python or Node.js."
}
'@
Set-Content -Path (Join-Path $absOutputRoot 'run-student.ps1') -Value $runStudent -Encoding UTF8

$readme = @'
RedByte Classroom RC v1 Package

1) Start server:
   powershell -ExecutionPolicy Bypass -File .\run-student.ps1

2) Open student mode:
   http://127.0.0.1:4173/os/

3) TA mode switch:
   http://127.0.0.1:4173/os/?ta=1

Included docs:
- docs\instructor-pack.md
- docs\CLASSROOM_RC_PLAYBOOK.md
- docs\TA_LOCKDOWN_INSTRUCTIONS.md
- docs\DIAGNOSTICS_EXPORT_INSTRUCTIONS.md
'@
Set-Content -Path (Join-Path $absOutputRoot 'README.txt') -Value $readme -Encoding UTF8

Write-Host "[4/4] Creating zip archive..." -ForegroundColor DarkCyan
$zipPath = "$absOutputRoot.zip"
if (Test-Path $zipPath) {
  Remove-Item -Force $zipPath
}
$zipItems = Get-ChildItem -Path $absOutputRoot -Recurse -File | Where-Object { $_.Name -ne 'bootstrap.ps1' }
if ($zipItems.Count -eq 0) {
  throw "No files found to package in $absOutputRoot"
}
Compress-Archive -Path ($zipItems | ForEach-Object { $_.FullName }) -DestinationPath $zipPath

Write-Host "Classroom package ready:" -ForegroundColor Green
Write-Host "- Folder: $absOutputRoot" -ForegroundColor Green
Write-Host "- Zip:    $zipPath" -ForegroundColor Green
