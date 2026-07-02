---
doc_status: current
last_validated: 2026-07-02
owner: Connor Angiel
used_by_claude: true
role: Vivado E1 certification protocol
---

# RedByte Vivado E1 Certification Protocol

## Purpose

This protocol turns RedByte export-package confidence into real Vivado evidence. Browser E0 proves the app can generate coherent packages. E1 requires Vivado itself to import, compile, simulate where a testbench exists, and synthesize the exported design.

E1 still does not prove bitstream generation, board programming, or physical Basys3 observation.

## Required Designs

The current E1 certification set is:

1. Logic Gates
2. Half Adder
3. Full Adder
4. 4-Bit Ripple Carry Adder
5. 2-Bit Up Counter, when exportable

Minimum release-relevant E1 proof should include Logic Gates, Full Adder, 4-Bit Ripple Carry Adder, and 2-Bit Up Counter. Half Adder is a useful simple arithmetic control.

## Evidence Levels

| Level | Meaning | Required evidence |
|---|---|---|
| E1a | Import | Vivado opens the `.xpr` or imports the project without Tcl/project errors |
| E1b | VHDL compile readiness | Vivado accepts the source files and compile order |
| E1c | Behavioral simulation/testbench | Vivado/XSim runs the included testbench when present |
| E1d | Synthesis | `synth_1` completes successfully |
| E1e | Optional implementation dry run | `impl_1` runs through route/design dry run without bitstream claim |

E2 starts only when a bitstream is generated. E3 starts only when physical board behavior is observed.

## Harness

Tracked entry points:

- `scripts/vivado/redbyte-e1-certify.ps1`
- `scripts/vivado/redbyte-e1-certify.tcl`
- `scripts/vivado/redbyte-e1-collect.ps1`

Default proof output:

```text
.redbyte/vivado-e1/<timestamp>/
  manifest.json
  environment.json
  package-summary.json
  results.md
  logs/
  designs/<design-id>/
```

Generated `.redbyte/` output is proof evidence, not source. Do not commit downloaded ZIPs, Vivado logs, extracted packages, screenshots, or generated manifests unless a future release policy explicitly asks for a curated proof note.

## Package Sources

Mode A, existing ZIP directory:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/vivado/redbyte-e1-certify.ps1 `
  -Mode Certify `
  -PackageSource ExistingZipDir `
  -ZipDir C:\path\to\downloaded-zips
```

Mode B, production browser ZIPs:

Use a browser proof/download pass to place production ZIPs in a directory, then run Mode A against that directory. `redbyte-e1-collect.ps1 -Mode Production` records the accepted production URL and design set, but it does not replace a real browser export proof.

Mode C, local generated artifacts:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/vivado/redbyte-e1-certify.ps1 `
  -Mode DryRun `
  -PackageSource LocalGenerated
```

Local-generated packages are useful for harness rehearsal. Production certification should identify whether the ZIPs came from the public app, a local preview at a known SHA, or a tracked generator script.

## Classifications

| Classification | Meaning |
|---|---|
| `PASS_E1` | Vivado E1 completed for the design |
| `FAIL_IMPORT` | Package shape, `.xpr`, or Vivado import failed |
| `FAIL_COMPILE` | Vivado compile order/elaboration readiness failed |
| `FAIL_TESTBENCH` | Behavioral simulation/testbench failed |
| `FAIL_SYNTH` | Synthesis or optional route dry run failed |
| `BLOCKED_NO_VIVADO` | Vivado is not installed/discoverable on the machine |
| `BLOCKED_PACKAGE_MISSING` | No ZIP package was available for the design |
| `BLOCKED_UNSUPPORTED_CONSTRUCT` | Static package audit found a construct that should not be sent to Vivado as certified |

`READY_FOR_E1_RUN` can appear in dry-run output when packages are structurally ready and Vivado is discoverable, but it is not an E1 pass.

## Required Commands

Environment only:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/vivado/redbyte-e1-certify.ps1 -Mode EnvCheck
```

Static package audit:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/vivado/redbyte-e1-certify.ps1 -Mode DryRun
```

Real E1:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/vivado/redbyte-e1-certify.ps1 -Mode Certify
```

Optional route-only implementation dry run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/vivado/redbyte-e1-certify.ps1 -Mode Certify -IncludeImplementation
```

Do not use this protocol to claim E2 or E3.
