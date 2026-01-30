# Quick Install Guide for Students

**Platform:** Windows 10/11 (Recommended)

## 1. Prerequisites

* **Git for Windows:** [Download](https://git-scm.com/download/win)
* **Node.js (LTS):** [Download](https://nodejs.org/en) (v20+)
* **VS Code:** [Download](https://code.visualstudio.com/) (Optional, for editing code)

## 2. One-Command Install

Open **PowerShell** and run:

```powershell
git clone https://github.com/redbyte-org/redbyte-ui-genesis.git
cd redbyte-ui-genesis
.\Start-RedByte.ps1
```

This script will:

1. Check your environment.
2. Install all dependencies (pnpm).
3. Build the core libraries.
4. **Launch the RedByte OS.**

## 3. Connecting Hardware (Lab 1+)

1. Run the install command above.
2. The script will ask if you want to start the **Bridge Agent**.
3. Plug in your board (Basys3 or Arduino Uno).
4. In the RedByte OS, open **Start Here > Virtual Lab**.
5. Click the **Hardware** tab and verify your device appears.

## Troubleshooting

* **"Script is disabled"**: Run `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` in PowerShell.
* **"pnpm not found"**: The script auto-installs it, but you may need to restart PowerShell.
* **White Screen?**: Press `Ctrl+Shift+R` to force reload.
