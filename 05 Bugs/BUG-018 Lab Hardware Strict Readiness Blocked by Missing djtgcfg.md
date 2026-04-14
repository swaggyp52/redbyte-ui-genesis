---
type: bug
status: blocked
area: bridge
priority: high
source: manual-debug
updated: 2026-04-14
related:
  - "[[Hardware Surface]]"
  - "[[Test Infrastructure]]"
  - "[[Basys 3 Mapping]]"
---

# BUG-018 Lab Hardware Strict Readiness Blocked by Missing djtgcfg

## Summary

The Windows lab machine can run RedByte, Vivado, and the real FPGA bridge, but strict Basys3 readiness still fails because the attached Digilent-class FTDI device is only visible through the USB/serial driver layer. The bridge cannot identify or program it as a Basys3 until the Digilent JTAG CLI `djtgcfg` is installed.

## Root Cause

- the machine shell/runtime blockers were real but are now resolved: `pnpm`, `python`, and `vivado` all resolve from PowerShell, Playwright Chromium is installed, and the root workspace now declares `tsx`
- the live bridge starts in `Mode: REAL`, serves `http://127.0.0.1:4242/`, and reports a Digilent-class FTDI device on `COM4`
- bridge device diagnostics still show `programming.status = missing_driver`, `tool = djtgcfg`, and `error = missing_tool`
- `C:\Program Files (x86)\Digilent\Runtime` contains the Digilent USB driver package, but no `djtgcfg.exe` / Adept utilities are installed on disk or on PATH
- without the JTAG CLI layer, strict hardware checks never upgrade the attached device from generic FTDI visibility to a strict-ready `basys3` target

## System Truth

Strict classroom hardware readiness on Windows requires all of the following to be true at the same time:

- shell/runtime dependencies resolve normally (`pnpm`, `python`, `vivado`, root `tsx` scripts)
- Vivado is discoverable (`VIVADO_PATH` or PATH)
- the bridge can see the FTDI/USB serial side of the connected board
- Digilent JTAG CLI tooling (`djtgcfg`, or an explicit override via `RB_DJTGCFG_PATH` / `DJTGCFG_PATH`) is installed so the bridge can identify and program the board as Basys3

Driver-only Digilent Runtime installation is not sufficient for strict Basys3 readiness.

## Fix

Applied during this pass:

- created a user-local `pnpm` shim so `pnpm` resolves normally in PowerShell
- repaired Python 3.11 command resolution to `C:\Program Files\Python311\python.exe`
- set user PATH and `VIVADO_PATH` to the installed Vivado 2024.2 bin directory
- added root `devDependency` `tsx@4.19.2` so existing root scripts such as `classroom:hw:check` run

Still required to close this bug:

- install Digilent Adept / Adept Utilities (or otherwise provide `djtgcfg.exe`)
- if the tool is installed outside PATH, set `RB_DJTGCFG_PATH` or `DJTGCFG_PATH` to that executable
- rerun `pnpm -s classroom:hw:check -- --strict` and bridge smoke validation with the physical board attached

## Links

- [[Hardware Surface]]
- [[Test Infrastructure]]
- [[Basys 3 Mapping]]