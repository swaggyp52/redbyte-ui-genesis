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
- `scripts/vivado/redbyte-e1-pack-runner.ps1`
- `scripts/vivado/redbyte-e1-packages.ps1` (shared exact package-ZIP matcher, dot-sourced by the three scripts above)

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
  -PackageDir C:\path\to\downloaded-zips
```

`-PackageDir` is an alias for the older `-ZipDir` parameter. Without `-OutDir` the harness creates a new `.redbyte/vivado-e1/<timestamp>/` run folder and prints it as `runRoot=`. `-OutDir` names the run folder instead; it must not exist yet or be empty. A folder that already holds files is refused before anything is written (exit code 2): a reused folder could hold an earlier run's extraction, logs and manifest.

`-DesignIds` selects ZIPs by exact file name (case-insensitive), never by substring; the matcher is `scripts/vivado/redbyte-e1-packages.ps1`, shared by the certify, collect and pack-runner scripts. For design id `<id>` the accepted names are the ones RedByte's tools write: `<id>-vivado-project.zip` (Export of a project whose id is `<id>`), `rb-<id>-<6-char suffix>-vivado-project.zip` (Export of example `<id>` opened as a project), `<id>-rb-<id>-<suffix>-vivado-project.zip` (a browser proof's saved copy) and `<id>.zip` (`scripts/vivado-cert-export-ide-example.ts`). No match is `BLOCKED_PACKAGE_MISSING`; more than one is `BLOCKED_PACKAGE_AMBIGUOUS`, never "the newest". A design id must be a project slug (lowercase letters and digits in dash-separated groups) and may be listed once; otherwise the run is refused (exit code 2).

Each design's ZIP is copied into `designs/<design-id>/package.zip`, hashed, and extracted into the new folder `designs/<design-id>/extracted/`. The package must hold exactly one `.xpr` project; zero or several is `FAIL_IMPORT`, and Vivado is not started. The manifest binds `zipSha256`, `xprZipEntry` (the `.xpr` path inside the ZIP), `files.xpr` (the extracted path) and `xprSha256` (taken before Vivado opens the project) to that one copy.

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
| `FAIL_SYNTH` | Synthesis failed |
| `FAIL_IMPL_DRY_RUN` | Optional route-only implementation dry run failed |
| `BLOCKED_NO_VIVADO` | Vivado is not installed/discoverable on the machine |
| `BLOCKED_PACKAGE_MISSING` | No ZIP package with one of the design's exact names was available |
| `BLOCKED_PACKAGE_AMBIGUOUS` | More than one ZIP package matched the design id exactly |
| `BLOCKED_UNSUPPORTED_CONSTRUCT` | Static package audit found a construct that should not be sent to Vivado as certified |

E1c is decided by `scripts/vivado/redbyte-e1-classify.tcl` from the testbench's own result file, `redbyte_tb_result.txt`. It must hold exactly one line, exactly `REDBYTE_TB_RESULT v=1 tb=<entity> status=PASS|FAIL|NO_CHECKS checks=<n> failures=<m>` (decimal counts without leading zeros, nothing before or after). Markers are counted, not lines: two markers on one line, a truncated marker, trailing text, or any marker in a simulator log that is not an exact copy of the result line ending its log line is `FAIL_TESTBENCH_CONTRACT`. The wrapper applies the same rule to the Vivado log and console before accepting `PASS_E1`; a contradiction there is `EVIDENCE_CONFLICT`. A log copy is not required, because where xsim routes report lines has not been observed on a real Vivado run.

`READY_FOR_E1_RUN` can appear in dry-run output when packages are structurally ready and Vivado is discoverable, but it is not an E1 pass.

`BLOCKED_TOOLCHAIN` and `BLOCKED_PACKAGE` are acceptable report-level umbrella labels. In harness output, the concrete equivalents are `BLOCKED_NO_VIVADO` and `BLOCKED_PACKAGE_MISSING`.

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
powershell -ExecutionPolicy Bypass -File scripts/vivado/redbyte-e1-certify.ps1 -Mode Certify -PackageDir <folder-with-redbyte-zips>
```

Optional route-only implementation dry run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/vivado/redbyte-e1-certify.ps1 -Mode Certify -IncludeImplementation
```

Portable run kit:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/vivado/redbyte-e1-pack-runner.ps1
```

Do not use this protocol to claim E2 or E3.
