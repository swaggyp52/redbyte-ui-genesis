param(
  [ValidateSet("quality","factory")]
  [string]$Action = "quality"
)

$ErrorActionPreference = "Stop"
$ts = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$proof = "ops\proof\nightshift-$Action-$ts.txt"
$pnpm = "C:\Users\angiel001\AppData\Roaming\npm\pnpm.cmd"
$git = "C:\Users\angiel001\AppData\Local\Programs\Git\bin\git.exe"

"=== NIGHT SHIFT ($Action) ===" | Tee-Object -FilePath $proof
"TIME: $(Get-Date)" | Tee-Object -FilePath $proof -Append
"PWD:  $(Get-Location)" | Tee-Object -FilePath $proof -Append

& $git status -sb | Tee-Object -FilePath $proof -Append

# Always sync main first
"[sync] Fetching origin..." | Tee-Object -FilePath $proof -Append
& $git fetch origin --prune | Tee-Object -FilePath $proof -Append
& $git checkout main | Tee-Object -FilePath $proof -Append
& $git reset --hard origin/main | Tee-Object -FilePath $proof -Append

# Run the canonical factory quality gate (build + test:ci + lint)
"[gate] Running pnpm quality..." | Tee-Object -FilePath $proof -Append
& $pnpm quality 2>&1 | Tee-Object -FilePath $proof -Append

"EXITCODE=$LASTEXITCODE" | Tee-Object -FilePath $proof -Append
if ($LASTEXITCODE -ne 0) { 
  " Gate failed" | Tee-Object -FilePath $proof -Append
  throw "Gate failed" 
}

" DONE" | Tee-Object -FilePath $proof -Append
