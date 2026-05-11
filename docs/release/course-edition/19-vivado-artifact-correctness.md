# Vivado Artifact Correctness Sprint

Date: 2026-05-11

Branch: `product/vivado-artifact-correctness-1`

Base commit: `b5e60b4cbb9d5f9aecb5d1339f56dee65c619a75`

Scope: inspect, validate, and harden E0 Vivado handoff packages for the certified starter set: Logic Gates, Half Adder, and 2-Bit Up Counter.

Out of scope: Vivado build/bitstream proof (E1), board programming proof (E2), observed board behavior proof (E3), install scripts, repo cleanup, MarcusRPI, full typecheck drift, and `build:unified` redirect drift.

Ignored artifact path: `.redbyte/product-immersion/sprint5-vivado-artifacts/`

## Preflight And Baseline

| Item | Result |
| --- | --- |
| Branch created | `product/vivado-artifact-correctness-1` from latest `origin/main` |
| Baseline product gates | Existing starter, immersion, counter, map-pins, persistence, import/export, and starter-load gates passed before changes |
| Known failing gate | `pnpm typecheck` still fails in pre-existing `@redbyte/rb-lab-engine` / pulled `rb-logic-core` type-boundary drift |
| Browser tool | Playwright Chromium through `playwright.dev.config.ts` |
| Vivado availability | `where.exe vivado` did not find Vivado; this sprint remains E0 artifact inspection only |

## Export Artifact Inventory

Generated through the browser Export path and inspected from downloaded Vivado project ZIPs. Local sample slugs are dynamic and not part of the contract.

| Starter | ZIP filename | Entries | Manifest present? | VHDL present? | XDC present? | Tcl present? | Expected IO present? | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Logic Gates | `*vivado-project.zip` | `BRINGUP.md`, `EXPECTED_IO.json`, `README.txt`, `program_and_test.tcl`, `project.rbproj.json`, `top.vhd`, `top.xdc`, `testbench.vhd`, `.xpr`, `vivado_import.tcl` | Yes | Yes | Yes | Yes | Yes | Combinational package; executable `create_clock` omitted. |
| Half Adder | `*vivado-project.zip` | Same required package shape | Yes | Yes | Yes | Yes | Yes | Half Adder package uses labeled ports `SW0_A`, `SW1_B`, `LD0_CARRY`, `LD1_SUM`. |
| 2-Bit Up Counter | `*vivado-project.zip` | Same required package shape | Yes | Yes | Yes | Yes | Yes | Sequential package; includes `CLK100MHZ` clock constraint and expected counter output sequence. |

## VHDL Audit

| Starter | Entity | Ports | Logic correctness | Sequential correctness | Risks | Fix needed |
| --- | --- | --- | --- | --- | --- | --- |
| Logic Gates | `logic_gates_and_or_xor` | `SW0`, `SW1`, `LD0`, `LD1`, `LD2` | AND, OR, and XOR assignments match starter intent | N/A | Low | No functional VHDL fix needed. |
| Half Adder | `half_adder` | `SW0_A`, `SW1_B`, `LD0_CARRY`, `LD1_SUM` | `LD0_CARRY <= SW0_A and SW1_B`; `LD1_SUM <= SW0_A xor SW1_B` | N/A | Low | No functional VHDL fix needed. |
| 2-Bit Up Counter | `rb_2_bit_up_counter_basys3` | `SW`, `BTNC`, `CLK100MHZ`, `LED(1 downto 0)` | Counter enable path uses `SW`; reset path gates D inputs through `not BTNC` | Uses rising-edge `CLK100MHZ` processes and matches certified post-rising-edge Compare sequence | Low | No functional VHDL fix needed. |

## XDC Audit

| Starter | Pin count | Missing pins | Duplicate pins | Clock constraint | Board alias parity | Risks | Fix needed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Logic Gates | 5 package pins | None | None | Executable `create_clock` omitted as expected for combinational design | `SW0=V17`, `SW1=V16`, `LD0=U16`, `LD1=E19`, `LD2=U19` | Low | No pin fix needed. |
| Half Adder | 4 package pins | None | None | Executable `create_clock` omitted as expected for combinational design | `SW1_B=V16`; no stale `W16` mapping for input B | Low | No pin fix needed. |
| 2-Bit Up Counter | 5 package pins | None | None | `create_clock -period 10.000` on `CLK100MHZ` | `CLK100MHZ=W5`, `SW=V17`, `BTNC=U18`, `LED[0]=U16`, `LED[1]=E19` | Low | No pin fix needed. |

## Tcl And Handoff Audit

| Starter | Top entity match | File path safety | Board/part metadata | E0 wording | Risks | Fix needed |
| --- | --- | --- | --- | --- | --- | --- |
| Logic Gates | Tcl and `.xpr` top match `logic_gates_and_or_xor` | Relative to extracted ZIP folder | `xc7a35tcpg236-1` | Fixed to state E0 export package only | Low | Fixed README evidence wording. |
| Half Adder | Tcl and `.xpr` top match `half_adder` | Relative to extracted ZIP folder | `xc7a35tcpg236-1` | Fixed to state E0 export package only | Low | Fixed README evidence wording. |
| 2-Bit Up Counter | Tcl and `.xpr` top match `rb_2_bit_up_counter_basys3` | Relative to extracted ZIP folder | `xc7a35tcpg236-1` | Fixed to state E0 export package only | Low | Fixed README evidence wording. |

The Tcl scripts do not assume local machine paths, do not require RedByte runtime files after export, and do not claim bitstream/build success.

## Manifest And Expected IO Audit

| Starter | Manifest fields | Mapping parity | Verify state handling | Expected IO parity | Risks | Fix needed |
| --- | --- | --- | --- | --- | --- | --- |
| Logic Gates | `kind`, `version`, `meta.sourceExampleId`, `fpga.board`, `fpga.top`, circuit, vectors, mappings | Manifest mapping matches XDC package pins | Import does not trust prior Verify PASS until rerun | Fixed `EXPECTED_IO.json` now includes `evidenceLevel: E0` and physical `packagePin` | Low | Fixed metadata clarity. |
| Half Adder | Same required manifest shape | Manifest mapping matches XDC package pins, including `SW1_B=V16` | Import does not trust prior Verify PASS until rerun | Fixed `EXPECTED_IO.json` now includes `evidenceLevel: E0` and physical `packagePin` | Low | Fixed metadata clarity. |
| 2-Bit Up Counter | Same required manifest shape plus counter vectors | Manifest and XDC match clock/reset/output mappings | Import does not trust prior Verify PASS until rerun | Fixed `EXPECTED_IO.json` now distinguishes alias `pin` from physical `packagePin` | Low | Fixed metadata clarity. |

## Fix Selection

| Issue | Severity | Course risk | Fix now? | Files likely touched | Test/gate |
| --- | --- | --- | --- | --- | --- |
| Vivado project README lacked explicit E0-only evidence boundary | P2 | Students could mistake export handoff steps for stronger Vivado/build/board proof | Yes | `vivadoProjectFolder.ts`, `basys3Bundle.ts` | Browser ZIP README assertions |
| `EXPECTED_IO.json` did not label evidence level | P2 | Evidence artifact did not carry the same E0 boundary as the UI | Yes | `bringupArtifacts.ts` | Browser ZIP metadata assertions and focused Vitest |
| `EXPECTED_IO.json` mixed aliases and package pins in `pin` | P2 | Counter expected IO used aliases (`LD0`) while XDC used package pins (`U16`) | Yes, without breaking alias compatibility | `bringupArtifacts.ts` | Browser package-pin parity assertions and focused Vitest |

## Implemented Changes

- Added `pnpm -s ide:gate:ece141-vivado-artifacts`.
- Added browser artifact gate `tests/e2e/ece141-vivado-artifacts.spec.ts`.
- Added explicit E0-only evidence wording to generated Vivado project-folder README output.
- Added matching E0 evidence wording to the flat Basys3 import-kit README output.
- Added `evidenceLevel: "E0"` to `EXPECTED_IO.json`.
- Added `packagePin` to each `EXPECTED_IO.json` signal while preserving the existing `pin` field.
- Updated focused bring-up artifact tests for E0 and package-pin parity.

## Validation Snapshot

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm -s ide:gate:ece141-vivado-artifacts` | Passed | Browser-exported all three certified starter ZIPs and checked package shape, VHDL/XDC/Tcl parity, E0 README wording, manifest fields, `EXPECTED_IO.json`, and starter-specific pins/logic. |
| `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/__tests__/ide-bringup-contract.test.ts packages/rb-apps/src/apps/ide/__tests__/bringupArtifacts.canonical-naming.test.ts` | Passed | 8 focused tests passed. |
| `where.exe vivado` | Not found | Non-blocking; no E1 claim made. |

Full closeout validation is recorded in `08-validation-log.md`.

## Remaining Product Risks

| Severity | Risk | Next action |
| --- | --- | --- |
| P1 | Full workspace `pnpm typecheck` remains red in `@redbyte/rb-lab-engine` / pulled `rb-logic-core`. | Run a focused type-boundary cleanup sprint after this artifact branch is merged. |
| P1 | `pnpm build:unified` remains red on the known `/os/` redirect contract drift. | Handle as release/deploy contract cleanup. |
| P2 | Artifact correctness is E0-only; no Vivado batch import/build proof was collected because Vivado is not available. | If Vivado is available on a Windows lab machine, run a separate E1 exploratory certification task. |
