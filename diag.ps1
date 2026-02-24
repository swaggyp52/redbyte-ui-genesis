Write-Output "=== PLAYGROUND SRC STRUCTURE ==="
Get-ChildItem -Path "C:\Users\conno\redbyte-ui\apps\playground\src" -Recurse -Include "*.tsx","*.ts" | Where-Object { extglob.FullName.Replace("C:\Users\conno\redbyte-ui\", "") }

Write-Output "extglob.Path -notmatch "node_modules" } | Select-Object -First 30 | ForEach-Object { n=== PLAYGROUND - circuit designer surfaces ==="
Get-ChildItem -Path "C:\Users\conno\redbyte-ui\apps\playground\src" -Recurse -Include "*.tsx","*.ts" | Select-String -Pattern "CircuitDesign|circuit.design|DesignSurface|circuit.canvas|LogicDesign" | Where-Object { extglob.ToString().Replace("C:\Users\conno\redbyte-ui\", "") }

Write-Output "extglob.Name } }
if (Test-Path "C:\Users\conno\redbyte-ui\packages\rb-apps\src\apps") { Get-ChildItem "C:\Users\conno\redbyte-ui\packages\rb-apps\src\apps" | ForEach-Object { n=== packages/rb-apps - lab3/circuit designer surfaces ==="
if (Test-Path "C:\Users\conno\redbyte-ui\packages\rb-apps\src") { Get-ChildItem -Path "C:\Users\conno\redbyte-ui\packages\rb-apps\src" -Recurse -Include "*.tsx","*.ts" | Where-Object { extglob.ToString().Replace("C:\Users\conno\redbyte-ui\", "") } }

Write-Output "n=== Is lab3-webapp embedded in playground? ==="
Get-ChildItem -Path "C:\Users\conno\redbyte-ui\apps\playground" -Recurse -Include "*.ts","*.tsx","*.json" | Where-Object { extglob.ToString().Replace("C:\Users\conno\redbyte-ui\", "") }
if (Test-Path "C:\Users\conno\redbyte-ui\package.json") { Select-String -Path "C:\Users\conno\redbyte-ui\package.json" -Pattern "lab3-webapp|@redbyte/lab3" | Select-Object -First 10 }
if (Test-Path "C:\Users\conno\redbyte-ui\packages\rb-apps\package.json") { Select-String -Path "C:\Users\conno\redbyte-ui\packages\rb-apps\package.json" -Pattern "lab3-webapp|@redbyte/lab3" | Select-Object -First 10 }
