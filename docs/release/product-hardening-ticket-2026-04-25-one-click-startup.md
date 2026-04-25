# Product Hardening Ticket: One-Click Startup

## Ticket

- Title: One-click local startup must boot the current RedByte IDE
- Date: 2026-04-25
- Owner: Connor Angiel
- Surface: Global shell / startup workflow
- Journey segment: First launch / local folder handoff
- Mode: Student and contributor local startup
- Environment:
  - Fresh machine / clean browser profile: unknown
  - OS: Windows
  - Browser: system default browser
  - Node: requires 20.19.0 or newer
  - pnpm: requires 10.24.0 or newer
- Obsidian note: none
- Linked GitHub issue: none

## Problem

- Observed behavior: The root startup path was a stale OS-era PowerShell launcher. It referenced RedByte OS, attempted `npm install -g pnpm`, prompted for the hardware bridge, built through ambiguous scripts, and opened `/os/` as the primary path. There was no root `run.bat` for simple double-click startup.
- Expected behavior: Anyone with access to the folder can double-click `run.bat` or run one clear startup command and reach the current RedByte IDE with plain prerequisite errors if the machine is not ready.
- Why this matters: The repo front door is part of the product trust chain. First launch must not imply obsolete OS-era behavior or require users to know workspace internals.
- Severity: high

## Reproduction

- Exact repro steps:
  1. Open the repository folder on Windows.
  2. Look for a one-click root startup file.
  3. Run the existing `Start-RedByte.ps1`.
- Reproducibility: always
- First known version or date: 2026-04-25 local inspection

## Evidence

- Screenshot / recording: not captured
- Console excerpt: not applicable before fix
- Test / gate output: `pnpm start:smoke` is the minimum automated proof for this slice
- Additional artifacts: `run.bat`, `Start-RedByte.ps1`

## Truth Sources

- Target truth clause(s): `docs/contracts/RedByte_Product_Contract.md` global shell trust/coherence; RedByte is a local-first FPGA educational IDE.
- Current truth doc(s): `docs/manuals/RedByte_Product_Manual.md` Sections 4 and 5 local development startup.
- Gap truth reference(s): `docs/roadmap/RedByte_Gap_Audit.md` workflow coherence and documentation truth posture.
- System map / ownership reference(s): `docs/IDE_SYSTEM_MAP.md` global shell and boot path references.
- QA / rehearsal clause(s): `docs/release/v1-release-checklist.md` startup console banner and first-run launch requirements; `docs/release/manual-assignment-qa-script.md` Project entry precondition.

## Acceptance Proof

- Minimum acceptance proof: `run.bat` delegates to a current PowerShell launcher; `pnpm start` runs the same path; smoke mode serves the IDE locally.
- Required test / gate command(s): `pnpm start:smoke`
- Required manual proof: double-click `run.bat` on Windows and confirm the browser opens the IDE.
- Screenshot or recording expectation: future release evidence should include `/` IDE default and `/?launcher=1` launcher screenshots when running full PR/session evidence.

## Docs Review

- Docs that must be reviewed if behavior changes: `README.md`, `docs/manuals/RedByte_Product_Manual.md`, `docs/release/v1-release-checklist.md`
- Docs that must be updated if behavior changes: `README.md`, `AI_STATE.md`

## Disposition

- Status: fixed
- Fix PR / commit: pending
- Notes: Startup now avoids npm, uses pnpm/Corepack, and keeps bridge launch out of the default path.

## Attribution

Connor Angiel
