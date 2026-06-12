---
doc_status: current
last_validated: 2026-06-12
owner: Connor Angiel
used_by_claude: true
role: local dev server startup and troubleshooting note
---

# RedByte Local Dev Server

This note records the current Windows desktop startup path for the RedByte FPGA clone.

## Current Working Command

From the repo root:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm run dev
```

On 2026-06-12, this served the playground at:

```text
http://localhost:5173/
```

`Invoke-WebRequest http://localhost:5173/` returned HTTP 200.

## Package Script Repair

The root `dev`, `dev:lab3`, `dev:manual`, and `dev:playground` scripts now call `corepack pnpm --filter ...` internally. This keeps `corepack pnpm run dev` working in shells where the bare `pnpm` shim is missing.

## Bare pnpm Caveat

In this shell, bare `pnpm` is still unavailable:

```text
pnpm : The term 'pnpm' is not recognized as the name of a cmdlet, function, script file, or operable program.
```

`corepack enable` was attempted and failed because Corepack could not write the global shim:

```text
EPERM: operation not permitted, open 'C:\Program Files\nodejs\pnpm'
```

`corepack prepare pnpm@10.24.0 --activate` completed, but did not put a bare `pnpm` command on PATH. Treat `corepack pnpm ...` as the canonical command for this desktop until the Windows Node/Corepack shim is repaired outside the repo.

## Course And Production-Style Launchers

Use the course launcher when you need a student/professor safe wrapper with logs and smoke checks:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\launch.ps1 -NoOpen -Port 5173
powershell -NoProfile -ExecutionPolicy Bypass -File .\launch.ps1 -SmokeTest -NoOpen -Port 5197
```

Use the developer launcher when you need the production build/preview path:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Start-RedByte.ps1 -Production -Port 4173
powershell -NoProfile -ExecutionPolicy Bypass -File .\Start-RedByte.ps1 -SmokeTest -NoOpen -SkipInstall -Port 5197
```

If port `5173` is occupied, choose a different port with the launcher scripts. Vite may also choose a nearby available port for direct dev-server runs; record the URL that it prints.

## Evidence Boundary

The local dev server proves that the browser app starts and can be visually inspected. It does not prove Vivado synthesis, bitstream generation, Basys3 programming, or E3 physical board behavior.
