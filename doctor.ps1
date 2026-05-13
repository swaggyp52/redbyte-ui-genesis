Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$relativeScript = "scripts/course/windows/doctor.ps1"
$target = Join-Path $PSScriptRoot $relativeScript
& $target @args
if ($null -ne $LASTEXITCODE) {
  exit $LASTEXITCODE
}
