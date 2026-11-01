param([int]$Port = 5188)
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'runtime/node.exe') (Join-Path $PSScriptRoot 'launch.mjs') stop --port "$Port"
exit $LASTEXITCODE
