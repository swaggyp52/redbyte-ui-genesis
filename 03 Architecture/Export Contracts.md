---
type: architecture
status: active
area: export
updated: 2026-05-02
related:
  - "[[Connection Model]]"
  - "[[Hardware Surface]]"
  - "[[Basys 3 Mapping]]"
  - "[[BUG-011 Export Testbench Stable-ID Stimulus Drift]]"
  - "[[BUG-012 Basys3 Switch and Button Clock Buffer Inference]]"
  - "[[BUG-013 Basys3 Export Port Sanitizer Produced Vivado-Illegal Identifiers]]"
  - "[[BUG-018 Hardware Export Mapping Authority Drift]]"
  - "[[RedByte Engineering Brain]]"
---

# Export Contracts

## Overview

RedByte export has two HDL authorities that must stay structurally aligned:

- `top.vhd` / `top.xdc` define the synthesizeable design handoff.
- `testbench.vhd` defines the simulation handoff for Verify-backed export evidence.

The export contract exists so the live UI export surface, the compatibility fallback bundle, and downstream Vivado packaging all describe the same top entity and the same signal names.

## Canonical Shape / Contract

### Package handoff summary (UI)

- The **Package handoff** card is descriptive only: it composes existing workflow truth (`deriveHardwareExportFailureTruth`), export blockers (`buildExportViewModel`), verify evidence advisories, and a cross-artifact agreement table from `exportPackageHandoffModel.ts`. It does not introduce a parallel authority chain.
- **PACKAGE READY / PARTIAL / BLOCKED** reflects whether the student should treat the ZIP as submission-quality, downloadable-but-incomplete, or structurally blocked. A pending `testbench.vhd` with **no authored vectors** is intentionally **OK** for bitstream-oriented handoff; simulation completeness still comes from Verify + scenario work.
- **Artifact agreement** rows are plain-language checks (top entity, RTL file, I/O mapping, bench vs top, XDC, README / import script, timing structure) so the bundle reads as an engineering package, not a raw diagnostic dump.
- **Manual-event lab + RBEX4200**: Export readiness gates treat **missing clock input** as **advisory** (warn / ADVISORY pill) when `scheduleContract.timingMode` is `manual_event_driven_lab`, not as a hard gate failure — matching relaxed export constraints for lab switches/buttons.

### Export surface role

Export is the deterministic handoff surface.

- its primary job is to tell the student whether the current project can produce a trustworthy package and to build that package when it can
- it may summarize why the handoff is blocked or stale, but it should route back to Design, Verify, or Hardware instead of recreating those surfaces inline
- Export and Hardware share the same dominant workflow condition, but they do not own the same job:
  - Hardware owns physical mapping and board-readiness interpretation
  - Export owns artifact generation, package truth, and submission/program handoff bundles
- Export should read as the end of the workflow, not as another authoring surface

- `top.vhd` entity ports are the naming authority for `testbench.vhd` component ports and signal declarations.
- For board-clocked sequential rows, `testbench.vhd` owns the free-running clock process. Per-vector stimulus must wait on `rising_edge(...)` for the resolved board-clock port instead of reassigning the clock inside every vector body.
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
  - binding-ref-derived aliases (`portName`, `signalRef`, `xdcRef`) from the Basys3 export model

## Rules

- There are only two valid testbench generation paths: runtime-backed and documented compatibility fallback.
- Export may remain advisory when Verify is stale or missing, but structural artifact mismatches must block export.
- Export must not become a second Verify workbench or a second pin-mapping editor. When upstream work is needed, explain it and route back to the owning surface.
- The visible Export pin table is naming authority for row editability. Pin overrides and mapped-row detection must key from the same live row names the student sees, not stale saved labels.
- Basys3 switch and button input ports must always emit `CLOCK_BUFFER_TYPE NONE`; only the real board clock input should remain clock-buffer eligible.
- Duplicate student-facing labels are never authoritative lookup keys for HDL emission. Stable ids and node ids must survive label collisions.
- Binding-ref-derived aliases must resolve to the same entity refs in validation and testbench generation, so sanitized names such as `RST_BTNC` remain equivalent to the live mapped row they came from.
- Stimulus targets must resolve to declared testbench input signals.
- Assertion targets must resolve to declared testbench output signals.
- Artifact consistency validation must check both:
  - entity/component/port-map parity
  - stimulus/assertion target validity

## Hardware / Export Failure Truth

- Hardware and Export must read the same dominant workflow condition from `packages/rb-apps/src/apps/ide/projectWorkflowAuthority.ts`.
- Shared readiness must treat required missing rows in Export pin-table authority as mapping-incomplete across Project, Map Pins, and Export, even when local required IO rows are pinned.
- The shared dominant taxonomy is:
  - `BLOCKED`
  - `NEEDS REVIEW`
  - `READY`
- Condition precedence is fixed:
  1. required mapping incomplete
  2. other design/export blockers
  3. export stale
  4. export missing
  5. verify not run
  6. verify stale
  7. assertions differ / verify error
  8. trace-only evidence
  9. compare pass with mapping review still required
  10. ready/current handoff
- Dominant CTA labels are shared across both surfaces:
  - `Open Map Pins`
  - `Open Design`
  - `Re-export Current Bundle`
  - `Build Current Bundle`
  - `Open Verify`
  - `Open Program Handoff`
- Export may keep download/build controls visible as secondary actions, but the dominant status label, title, message, and primary CTA must still match Hardware for the same workflow condition.
- This contract is UI workflow authority only. It must not leak compare/runtime state back into HDL generation semantics.

## Consumption Sites

- `packages/rb-apps/src/fpga/boards/basys3/testbenchGenerator.ts`
- `packages/rb-apps/src/fpga/boards/basys3/basys3ExportService.ts`
- `packages/rb-apps/src/fpga/boards/basys3/basys3ExportModel.ts`
- `packages/rb-apps/src/fpga/boards/basys3/basys3Bundle.ts`
- `packages/rb-apps/src/apps/ide/viewmodels/buildExportViewModel.ts`
- `packages/rb-apps/src/fpga/vivado/vivadoProjectFolder.ts`

## Open Questions / Stubs

- Duplicate student-facing IO labels across Design / Verify / Map Pins / Export remain a separate student-path cleanup slice.
- The current local Vivado proof matrix covers `signal-tour`, `two-bit-counter`, and switch-driven `DLatch` / `DFF` / `TFF` / `JKFF`; broader classroom-starter proof should be automated rather than rerun manually.
