param(
  [switch]$Everything = $true
)

$apiToken = $env:CF_API_TOKEN
$zoneId = $env:CF_ZONE_ID

if (-not $apiToken) {
  Write-Error "CF_API_TOKEN is required."
  exit 1
}

if (-not $zoneId) {
  Write-Error "CF_ZONE_ID is required."
  exit 1
}

$body = if ($Everything) { @{ purge_everything = $true } } else { @{ purge_everything = $true } }

try {
  $response = Invoke-RestMethod \
    -Method Post \
    -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/purge_cache" \
    -Headers @{ Authorization = "Bearer $apiToken" } \
    -ContentType "application/json" \
    -Body ($body | ConvertTo-Json)

  if (-not $response.success) {
    $errors = ($response.errors | ConvertTo-Json -Compress)
    Write-Error "Cloudflare purge failed: $errors"
    exit 1
  }

  Write-Output "Cloudflare purge success."
} catch {
  Write-Error "Cloudflare purge request failed: $($_.Exception.Message)"
  exit 1
}
