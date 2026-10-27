<#
Package-ZIP selection shared by redbyte-e1-certify.ps1, redbyte-e1-collect.ps1 and
redbyte-e1-pack-runner.ps1 (dot-sourced; defines functions only).

A design id selects a ZIP by exact file name, never by substring, so `four-bit-adder` can never
pick up `four-bit-adder-hierarchical`. The accepted names are the ones RedByte's own tools write
for design <id> (case-insensitive, as Windows file names are):

  <id>-vivado-project.zip                       IDE Export of a project whose id is <id>
                                                (ExportSurface: <projectSlug>-vivado-project.zip)
  rb-<id>-<suffix>-vivado-project.zip           IDE Export of example <id> opened as a project
                                                (createProjectId: rb-<id>-<6 base-36 chars>)
  <id>-rb-<id>-<suffix>-vivado-project.zip      a browser proof's saved copy (<id>-<suggested name>)
  <id>.zip                                      scripts/vivado-cert-export-ide-example.ts

A design id must itself be a RedByte project slug: lowercase letters and digits in
dash-separated groups (deriveVivadoProjectSlug).
#>

function Test-RedByteDesignId([string]$DesignId) {
  return [regex]::IsMatch($DesignId, '^[a-z0-9]+(?:-[a-z0-9]+)*$', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
}

function Test-RedByteDesignZipName([string]$FileName, [string]$DesignId) {
  $id = [regex]::Escape($DesignId)
  $pattern = "^(?:(?:$id|rb-$id-[0-9a-z]{6}|$id-rb-$id-[0-9a-z]{6})-vivado-project|$id)\.zip$"
  return [regex]::IsMatch($FileName, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
}

# Every ZIP under Root (recursively) whose name is one of the design's exact names. The caller
# must treat none as missing and more than one as ambiguous; this never picks one by date.
function Find-RedByteDesignZips([string]$Root, [string]$DesignId) {
  if (!(Test-Path -LiteralPath $Root -PathType Container)) {
    return @()
  }
  return @(Get-ChildItem -LiteralPath $Root -File -Recurse |
    Where-Object { Test-RedByteDesignZipName $_.Name $DesignId } |
    Sort-Object FullName)
}
