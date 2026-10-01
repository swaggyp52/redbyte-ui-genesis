param([int]$Port = 5188, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$taskArguments = @((Join-Path $PSScriptRoot 'launch.mjs'), 'start', '--port', "$Port")
if ($NoBrowser) { $taskArguments += '--no-browser' }
& (Join-Path $PSScriptRoot 'runtime/node.exe') @taskArguments
exit $LASTEXITCODE
