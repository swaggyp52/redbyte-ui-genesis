---
type: architecture
status: active
area: export
updated: 2026-03-30
related:
  - "[[Connection Model]]"
  - "[[Basys 3 Mapping]]"
  - "[[BUG-011 Export Testbench Stable-ID Stimulus Drift]]"
  - "[[BUG-012 Basys3 Switch and Button Clock Buffer Inference]]"
  - "[[BUG-013 Basys3 Export Port Sanitizer Produced Vivado-Illegal Identifiers]]"
  - "[[RedByte Engineering Brain]]"
---

# Export Contracts

## Overview

RedByte export has two HDL authorities that must stay structurally aligned:

- `top.vhd` / `top.xdc` define the synthesizeable design handoff.
- `testbench.vhd` defines the simulation handoff for Verify-backed export evidence.

The export contract exists so the live UI export surface, the compatibility fallback bundle, and downstream Vivado packaging all describe the same top entity and the same signal names.

## Canonical Shape / Contract

- `top.vhd` entity ports are the naming authority for `testbench.vhd` component ports and signal declarations.
- Basys3 top-level port names derived from labels must already be legal VHDL basic identifiers before they reach `top.vhd`, `top.xdc`, or downstream Vivado packaging.
- `testbench.vhd` may come from either:
  - the runtime-backed scenario path in `buildExportViewModel.ts`
  - the compatibility fallback path in `basys3ExportService.ts`
- Both paths must resolve vector keys onto declared entity refs before VHDL emission.
- Supported vector-key inputs include:
  - stable IO row ids
  - boundary node ids
  - canonical `nodeId_port` names
  - unique student-facing labels
  - Basys3 aliases or package-pin-derived aliases when the entity uses board-grouped ports such as `SW` or `LED`

## Rules

- There are only two valid testbench generation paths: runtime-backed and documented compatibility fallback.
- Export may remain advisory when Verify is stale or missing, but structural artifact mismatches must block export.
- Basys3 switch and button input ports must always emit `CLOCK_BUFFER_TYPE NONE`; only the real board clock input should remain clock-buffer eligible.
- Duplicate student-facing labels are never authoritative lookup keys for HDL emission. Stable ids and node ids must survive label collisions.
- Stimulus targets must resolve to declared testbench input signals.
- Assertion targets must resolve to declared testbench output signals.
- Artifact consistency validation must check both:
  - entity/component/port-map parity
  - stimulus/assertion target validity

## Consumption Sites

- `packages/rb-apps/src/fpga/boards/basys3/testbenchGenerator.ts`
- `packages/rb-apps/src/fpga/boards/basys3/basys3ExportService.ts`
- `packages/rb-apps/src/fpga/boards/basys3/basys3ExportModel.ts`
- `packages/rb-apps/src/fpga/boards/basys3/basys3Bundle.ts`
- `packages/rb-apps/src/apps/ide/viewmodels/buildExportViewModel.ts`
- `packages/rb-apps/src/fpga/vivado/vivadoProjectFolder.ts`

## Open Questions / Stubs

- Duplicate student-facing IO labels across Design / Verify / Map Pins / Export remain a separate student-path cleanup slice.
- Verify compare-state ownership still needs an explicit cross-surface contract so export advisories stay truthful without leaking runtime-only state into HDL generation.
- The current local Vivado proof matrix covers `signal-tour`, `two-bit-counter`, and switch-driven `DLatch` / `DFF` / `TFF` / `JKFF`; broader classroom-starter proof should be automated rather than rerun manually.