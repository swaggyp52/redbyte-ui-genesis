# supermega-daemon.ps1
# RedByte UI self-healing + auto-deploy daemon

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

function Write-Log {
    param([string]$Message, [string]$Color = "Cyan")
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$ts] $Message" -ForegroundColor $Color
}

function Invoke-SuperMegaHeal {

    Write-Log "=== SUPERMEGA HEAL START ===" "Green"

    # ------------------------
    # 1. Write clean configs
    # ------------------------
    Write-Log "Writing clean configs..."

    Set-Content -Path "$ProjectRoot\postcss.config.cjs" -Encoding UTF8 -Value 'module.exports = {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};'

    Set-Content -Path "$ProjectRoot\vite.config.ts" -Encoding UTF8 -Value 'import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({ plugins: [react()] });'

    Set-Content -Path "$ProjectRoot\tailwind.config.js" -Encoding UTF8 -Value 'export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};'

    # ------------------------
    # 2. Strip BOM
    # ------------------------
    Write-Log "Stripping BOM..."

    Get-ChildItem $ProjectRoot -Recurse -Include *.js,*.ts,*.tsx,*.cjs,*.css,*.json |
      Where-Object { $_.FullName -notmatch "node_modules" } |
      ForEach-Object {
        $file = $_.FullName
        try { $bytes = [IO.File]::ReadAllBytes($file) } catch { return }

        if ($bytes.Length -gt 3 -and $bytes[0] -eq 239 -and $bytes[1] -eq 187 -and $bytes[2] -eq 191) {
            Write-Log "Removing BOM → $file" "Yellow"
            [IO.File]::WriteAllBytes($file, $bytes[3..($bytes.Length-1)])
        }
      }

    # ------------------------
    # 3. Build
    # ------------------------
    Write-Log "Running build..."
    npm run build

    if ($LASTEXITCODE -ne 0) {
        Write-Log "Build failed." "Red"
        return
    }

    # ------------------------
    # 4. Git commit + push
    # ------------------------
    git add -A
    git commit -m "autoheal $(Get-Date)" 2>$null

    if ($LASTEXITCODE -eq 0) {
        git push
        Write-Log "Pushed to GitHub!" "Green"
    } else {
        Write-Log "Nothing to commit." "DarkGray"
    }

    Write-Log "=== SUPERMEGA HEAL COMPLETE ===" "Green"
}

Invoke-SuperMegaHeal
