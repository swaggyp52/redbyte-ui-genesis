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
