# Deployment Readiness Tracker

## Purpose
Track classroom deployment invariants and the exact implementation/gate locations for D0–D4.

## Gates
| Area | Exists? | Where? | Verified? | Gated? |
| --- | --- | --- | --- | --- |
| D0 Project Determinism | Yes | `packages/rb-apps/src/__tests__/project-determinism-gate.test.ts` | Yes (Vitest pass) | Yes (`rc:d0:project-determinism-gate`) |
| D1 Verilog Determinism | Yes | `packages/rb-fpga-toolchain/src/__tests__/verilog-determinism-gate.test.ts` | Yes (Vitest pass) | Yes (`rc:d1:verilog-determinism-gate`) |
| D2 Basys3 Bundle | Yes | `packages/rb-apps/src/fpga/boards/basys3/basys3Bundle.ts` + `packages/rb-apps/src/__tests__/basys3-bundle-gate.test.ts` | Yes (Vitest pass) | Yes (`rc:d2:basys3-bundle-gate`) |
| D3 Projection Consistency | Yes | `packages/rb-apps/src/__tests__/projection-consistency-gate.test.ts` | Yes (Vitest pass) | Yes (`rc:d3:projection-consistency-gate`) |
| D4 Workflow Stress | Yes | `packages/rb-apps/src/__tests__/workflow-stress-gate.test.ts` | Yes (Vitest pass) | Yes (`rc:d4:workflow-stress-gate`) |

## Export
| Check | Exists? | Where? | Verified? | Gated? |
| --- | --- | --- | --- | --- |
| `circuitToVerilog` entrypoint | Yes | `packages/rb-fpga-toolchain/src/verilog-generator.ts` | Yes | Indirect (D1/D2) |
| Basys3 constraints contract + linter | Yes | `packages/rb-apps/src/fpga/boards/basys3/basys3Contract.ts`, `packages/rb-apps/src/fpga/boards/basys3/portLint.ts` | Yes | D2 |
| Basys3 bundle export | Yes | `packages/rb-apps/src/fpga/boards/basys3/basys3Bundle.ts` | Yes | D2 |
| Lab 4 ALU classroom fixture | Yes | `packages/rb-apps/src/fixtures/classroom/golden-basys3-alu.rbproj` | Pending run | `rc:e1:golden-basys3-alu-export-gate` |
| Lab 4 ALU deterministic export hash gate | Yes | `packages/rb-apps/src/__tests__/classroom-golden-basys3-alu-export-gate.test.ts` | Pending run | `rc:e1:golden-basys3-alu-export-gate` |

## Persistence
| Check | Exists? | Where? | Verified? | Gated? |
| --- | --- | --- | --- | --- |
| Project encoding/decoding | Yes | `packages/rb-apps/src/export/projectFormat.ts` | Yes | D0 + existing `rbproj:roundtrip-gate` |
| Circuit conversion canonical path | Yes | `packages/rb-logic-core/src/convertCircuitV1.ts` | Yes | `rc:p2:position-gate` + D3/D4 |

## Projections
| Check | Exists? | Where? | Verified? | Gated? |
| --- | --- | --- | --- | --- |
| Graph → Netlist | Yes | `packages/rb-apps/src/export/netlistExport.ts` | Yes | D3 |
| Graph → Verilog projection | Yes | `packages/rb-apps/src/export/verilogExport.ts` | Yes | D3 |
| Graph → Simulation projection | Yes | `packages/rb-logic-core/src/CircuitEngine.ts` | Yes | D3 |

## UX
| Check | Exists? | Where? | Verified? | Gated? |
| --- | --- | --- | --- | --- |
| Start Here card + first-run quality | Yes | `packages/rb-apps/src/apps/HomeApp.tsx`, `packages/rb-shell/src/__tests__/ui-quality-gate.test.ts` | Yes | Existing UI gates |
| Screenshot automation | Yes | `tests/e2e/ui-screenshots.spec.ts` | Existing | `ui:screenshots` (non-blocking) |

## Performance
| Check | Exists? | Where? | Verified? | Gated? |
| --- | --- | --- | --- | --- |
| Tick sanity under stress | Yes | `packages/rb-apps/src/__tests__/workflow-stress-gate.test.ts` | Yes | D4 |

## FPGA
| Check | Exists? | Where? | Verified? | Gated? |
| --- | --- | --- | --- | --- |
| Deterministic Verilog generation | Yes | `packages/rb-fpga-toolchain/src/verilog-generator.ts` | Yes | D1 |
| Basys3 deterministic classroom bundle | Yes | `packages/rb-apps/src/fpga/boards/basys3/basys3Bundle.ts` | Yes | D2 |

## Quick Location Index (requested)
- `circuitToVerilog` entrypoint: `packages/rb-fpga-toolchain/src/verilog-generator.ts`
- Basys3 constraints template + linter: `packages/rb-apps/src/fpga/boards/basys3/basys3Contract.ts`, `packages/rb-apps/src/fpga/boards/basys3/portLint.ts`
- Project encoding/decoding: `packages/rb-apps/src/export/projectFormat.ts`
- Engine tick API: `packages/rb-logic-core/src/CircuitEngine.ts` (`tick()`)
- Oscilloscope signal source path: `packages/rb-apps/src/stores/probeStore.ts` (probe signal wiring) + `packages/rb-logic-core/src/CircuitEngine.ts` (runtime signals)
