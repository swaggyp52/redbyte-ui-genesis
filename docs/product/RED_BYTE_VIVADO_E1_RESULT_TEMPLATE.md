---
doc_status: current
last_validated: 2026-07-02
owner: Connor Angiel
used_by_claude: true
role: Vivado E1 result template
---

# RedByte Vivado E1 Result Template

## 1. Verdict

Use one:

- `PASS_E1`
- `FAIL_IMPORT`
- `FAIL_COMPILE`
- `FAIL_TESTBENCH`
- `FAIL_SYNTH`
- `BLOCKED_NO_VIVADO`
- `BLOCKED_PACKAGE_MISSING`
- `BLOCKED_UNSUPPORTED_CONSTRUCT`
- `INCONCLUSIVE`

## 2. Environment

- Repo:
- Branch:
- Git SHA:
- Node:
- pnpm:
- OS:
- Vivado path:
- Vivado version:
- Harness output root:

## 3. Package Source

- Source mode: Existing ZIP directory / Production browser ZIPs / Local generated artifacts
- Source URL or generator:
- ZIP directory:
- Designs included:
- Commit/build identity of the app that produced the ZIPs:

## 4. Design Matrix

| Design | ZIP SHA256 | E1a import | E1b compile | E1c testbench | E1d synth | E1e route dry run | Classification |
|---|---|---:|---:|---:|---:|---:|---|
| Logic Gates | | | | | | | |
| Half Adder | | | | | | | |
| Full Adder | | | | | | | |
| 4-Bit Ripple Carry Adder | | | | | | | |
| 2-Bit Up Counter | | | | | | | |

## 5. Logs And Artifacts

- Manifest:
- Environment:
- Package summary:
- Results:
- Per-design Vivado logs:
- Vivado reports:

## 6. Failures Or Blockers

List each failure or blocker with the exact design, classification, relevant log path, and the first useful error line.

## 7. Product Readiness Judgment

State what the E1 result does and does not prove.

Required boundary text:

- E1 does not prove bitstream generation.
- E1 does not prove Basys3 programming.
- E1 does not prove observed board behavior.
- Browser E0 and Vivado E1 must not be merged into one claim.

## 8. Next Step

Use one:

- Fix package/import defect
- Fix generated VHDL/XDC/testbench/Tcl
- Run E1 on a Vivado machine
- Move to E2 bitstream proof
- Move to E3 board observation
- Keep browser-E0 only
