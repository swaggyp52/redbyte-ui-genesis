param(
  [Parameter(Mandatory=$true)][string]$Prompt,
  [Parameter(Mandatory=$true)][string]$OutFile
)

$ErrorActionPreference = "Stop"

# Ensure output dir exists
$OutDir = Split-Path -Parent $OutFile
if ($OutDir -and !(Test-Path $OutDir)) { New-Item -ItemType Directory -Force -Path $OutDir | Out-Null }

# Write prompt to temp file (UTF8 no BOM)
$tmp = [System.IO.Path]::GetTempFileName()
try {
  [System.IO.File]::WriteAllText($tmp, $Prompt, (New-Object System.Text.UTF8Encoding($false)))

  # Read it back as ONE string (preserves ? and everything)
  $promptText = [System.IO.File]::ReadAllText($tmp)

  # Call claude using Start-Process so PowerShell never glob-expands anything
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "claude"
  # Use Arguments property with proper quoting for the prompt
  $psi.Arguments = "-p `"$($promptText -replace '"', '\"')`""
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError  = $true
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow  = $true

  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  [void]$p.Start()

  $stdout = $p.StandardOutput.ReadToEnd()
  $stderr = $p.StandardError.ReadToEnd()
  $p.WaitForExit()

  if ($p.ExitCode -ne 0) {
    throw "claude failed (exit $($p.ExitCode)): $stderr"
  }

  $stdout | Out-File -FilePath $OutFile -Encoding utf8
  Write-Host "[CLAUDE] OK -> $OutFile"
  exit 0
}
finally {
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
}
