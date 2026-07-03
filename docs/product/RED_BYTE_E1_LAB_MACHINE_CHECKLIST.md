---
doc_status: current
last_validated: 2026-07-02
owner: Connor Angiel
used_by_claude: true
role: one-page Vivado E1 lab checklist
---

# RedByte E1 Lab Machine Checklist

## Before You Start

- Use a Windows lab machine with Vivado 2024.2.
- Do not claim board success from this run.
- Do not install Vivado unless the lab owner explicitly approves it.
- Keep the whole `.redbyte/vivado-e1/<timestamp>/` output folder.

## Steps

1. Open PowerShell.

2. Clone or update RedByte:

```powershell
git clone https://github.com/swaggyp52/redbyte-ui-genesis.git redbyte-ui-genesis-main
cd redbyte-ui-genesis-main
git fetch origin
git checkout main
git pull --ff-only origin main
git rev-parse HEAD
```

3. Check production identity:

```powershell
(Invoke-WebRequest -Uri 'https://redbyteapps.dev/os/version.json' -UseBasicParsing).Content
```

4. Check Vivado:

```powershell
where.exe vivado
powershell -ExecutionPolicy Bypass -File scripts/vivado/redbyte-e1-certify.ps1 -Mode EnvCheck
```

5. Collect packages:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/vivado/redbyte-e1-collect.ps1 -OutDir .redbyte/vivado-e1-packages
```

6. Run this command:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/vivado/redbyte-e1-certify.ps1 -Mode Certify -PackageDir .redbyte/vivado-e1-packages -OutDir .redbyte/vivado-e1/<timestamp>
```

7. Attach `results.md` and `manifest.json`.

8. Also attach `environment.json`, `package-summary.json`, and the `designs/` and `logs/` folders.

## If Something Fails

- If Vivado fails, do not guess; send the logs.
- If a package is missing, send `package-summary.json`.
- If the SHA is wrong, stop and report the SHA mismatch.
- If Vivado is not found, report `BLOCKED_NO_VIVADO`.

## Boundary

This is E1 only: Vivado import/open, compile-order readiness, behavioral testbench when present, and synthesis. It does not prove bitstream generation, Basys3 programming, or observed board behavior.
