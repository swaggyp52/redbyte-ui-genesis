# RedByte Fit/Gap Analysis — ECE141 Lab Requirements

Generated: 2026-02-25

This document assesses RedByte's current capability against each requirement
a typical ECE141 digital logic lab imposes. Grounded in:
- Original lab PDFs (`labs/fac_jung002_ECE141_Lab1-8.pdf`)
- `packages/rb-apps/src/labs/labDefinitions.ts`
- `packages/rb-apps/src/labs/submissionGates.ts`
- `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`
- `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`
- `packages/rb-apps/src/export/ideSubmissionBundle.ts` (exists)
- `packages/rb-apps/src/export/parseIdeSubmission.ts` (exists)

---

## Capability Assessment

### 1. Schematic-Level Circuit Entry (Labs 1-5, 8)

**PDF requirement:** Students draw a gate-level schematic using Xilinx ISE ECS.
Gates are placed from a library (and2, inv, xor2, etc.), wired, and labeled.

| Dimension | Status | Notes |
|---|---|---|
| Can RedByte do it now? | **Yes** | DesignSurface provides drag-and-drop canvas with AND, OR, NOT, XOR, etc. |
| What's missing? | Nothing critical for Labs 1-4. | No schematic capture abstraction—but RedByte's graph model is the equivalent. |
| File/surface | `DesignSurface.tsx`, `circuitStore.ts` | |
| Acceptance test | Place AND2 + INV, wire, verify in VerifySurface | |

**Gap note:** Original labs require hierarchical Macros (Tool > Symbol Wizard in ISE).
RedByte has no explicit Macro/component promotion workflow. Students can reuse examples
but cannot formally create and reuse sub-circuit blocks within a single project.
This is a **Medium gap** for Labs 2 and 5 (hierarchical adders/subtractors).

---

### 2. Truth Table / Functional Verification (All Labs)

**PDF requirement:** Students build truth tables manually, then verify via simulation
(ModelSim waveform or HDL Bencher).

| Dimension | Status | Notes |
|---|---|---|
| Can RedByte do it now? | **Yes** | VerifySurface with truth-table vectors. PASS/FAIL per row. |
| What's missing? | No waveform view. | Original labs show timing waveforms; RedByte shows per-tick table rows. |
| File/surface | `VerifySurface.tsx`, `verifyReport.ts` | |
| Acceptance test | Enter all 4 rows for AND2 truth table, run verify, expect PASS | |

**Gap note:** Labs 6-8 depend heavily on observing waveforms over time
(rising edge behavior, state hold, counter sequences). RedByte's tick-by-tick
table addresses this, but there is no graphical waveform display.
This is a **Medium gap** for Labs 6, 7, 8.

---

### 3. FPGA Synthesis + Pin Assignment (Labs 3-8)

**PDF requirement:** Students synthesize a bitstream, assign FPGA pins via UCF/PACE,
and download to FPGA board (ISE iMPACT via parallel cable).

| Dimension | Status | Notes |
|---|---|---|
| Can RedByte do it now? | **Partial** | RedByte exports structural VHDL + XDC constraints via hardware export path. Vivado must be installed locally to synthesize. |
| What's missing? | Vivado must be invoked manually or via toolchain integration. In-browser synthesis is not possible. | |
| File/surface | `ExportSurface.tsx`, `evidenceCapsule.ts`, `basys3Bundle.ts` | |
| Acceptance test | Export bundle → open in Vivado 2025.1 → synthesize + program Basys3 without errors | |

**Gap note:** RedByte does not drive Vivado directly from the browser. This is **by design**
(Vivado runs locally). The VHDL + XDC export is the bridge. Toolchain doctor checks
whether Vivado is reachable. This gap is **structural** but addressed by the export path.

---

### 4. Basys3 I/O Mapping (Labs 3-8)

**PDF requirement:** Students fill out a pin-assignment table mapping circuit ports
to board peripherals (switches, LEDs, SSD segments, buttons, clock).

| Dimension | Status | Notes |
|---|---|---|
| Can RedByte do it now? | **Yes** | ProjectSurface / hardware tab provides pin mapping. Basys3 board preset applies standard assignments. |
| What's missing? | Lab-specific mapping tables from PDFs are not pre-populated per lab in the UI. Students must consult the Basys3 RM manually. | |
| File/surface | `ProjectSurface.tsx`, `basys3Bundle.ts`, `labDefinitions.ts` (requiredBoardPreset) | |
| Acceptance test | Load `lab-3` starter, apply `basys3-seven-segment` preset, verify seg/an/dp ports appear in XDC | |

**Gap note:** `labDefinitions.ts` already specifies `requiredBoardPreset` and `requiredPorts`
per lab. The submission gate enforces preset selection. Lab handouts should show the exact
SW/LED/SEG pin table from the Basys3 RM to replace the ISE PACE screenshots.

---

### 5. Hierarchical Design / Component Reuse (Labs 2, 5, 7, 8)

**PDF requirement:** Create Macros (sub-circuits) in ISE, instantiate them multiple times
in a top-level schematic (e.g., 4x full_adder Macro in 4-bit adder).

| Dimension | Status | Notes |
|---|---|---|
| Can RedByte do it now? | **No** | RedByte has a flat single-circuit canvas. No sub-circuit/Macro abstraction exists. |
| What's missing? | Component promotion: select nodes → create reusable block → instantiate N times. | |
| File/surface | Would require new feature in `DesignSurface.tsx` + `circuitStore.ts` | |
| Acceptance test | (Future) Create full_adder block, instantiate 4x, verify 4-bit adder behavior | |

**Workaround available:** `labDefinitions.ts` provides pre-built starter examples
(e.g., `starterExampleId: '09_4bit-adder'`) that pre-place the hierarchical structure.
Students wire it rather than building from scratch. This is the **current mitigation**.
Risk: students do not practice the Macro/hierarchy workflow the original lab required.

---

### 6. Sequential Logic Simulation with Clock (Labs 6, 7, 8)

**PDF requirement:** Use HDL Bencher with Single Clock mode. Observe Q changes
only on rising clock edges. Test D latch (level-sensitive) vs. DFF (edge-sensitive).

| Dimension | Status | Notes |
|---|---|---|
| Can RedByte do it now? | **Partial** | RedByte has DFlipFlop node type (`hasDff` flag in IdeApp). Tick-based simulation steps. |
| What's missing? | (1) No visual distinction between clock ticks and data assignment ticks. (2) No T flip-flop or JK flip-flop node type. (3) D latch (level-sensitive) not present as a primitive. | |
| File/surface | `VerifySurface.tsx` (tick banner), circuit node registry | |
| Acceptance test | Build DFF circuit, set D=1, step clock tick, verify Q=1; step again with D=0, verify Q=0 | |

**Gap note:** Lab 6 requires D latch, D flip-flop, T flip-flop, and JK flip-flop.
RedByte currently has only DFlipFlop. Labs 6 is **partially blocked** without
T-FF and JK-FF node types. Lab 6 can still demonstrate D latch behavior via
combinational feedback, but this is inauthentic to the expected learning outcome.
This is the **highest-priority capability gap** for completing the full 8-lab sequence.

---

### 7. FSM Design (Lab 8)

**PDF requirement:** State diagram → state table → reduced states → flip-flop input equations →
schematic in ISE → simulate → hardware test.

| Dimension | Status | Notes |
|---|---|---|
| Can RedByte do it now? | **Partial** | Students can build an FSM from DFFs + combinational logic on the canvas. No visual state-machine editor exists. |
| What's missing? | No state-diagram editor. No FSM template or wizard. Student must manually implement next-state logic from flip-flop equations. | |
| File/surface | `DesignSurface.tsx`, example starter `23_lab8-fsm-lock-starter-basys3` | |
| Acceptance test | Implement 3-state FSM for sequence detector 010/100, verify on test vectors in VerifySurface | |

**Workaround:** The Lab 8 starter (`lab-8` definition) provides a pre-scaffolded FSM
lock circuit. Students complete the transitions rather than building from scratch.

---

### 8. Submission / Grading Artifact Export (All Labs)

**PDF requirement:** Lab report (Word doc) + lab notebook signed by instructor.

| Dimension | Status | Notes |
|---|---|---|
| Can RedByte do it now? | **Yes (PR15 infrastructure exists)** | `ideSubmissionBundle.ts` and `parseIdeSubmission.ts` are present. ZIP export includes circuit, vectors, verify report, run ledger, grade summary JSON. |
| What's missing? | (1) Student name input not yet confirmed wired. (2) Lab code field. (3) Instructor-side import viewer confirmed via PRs 7-15 plan. | |
| File/surface | `ideSubmissionBundle.ts`, `parseIdeSubmission.ts`, `ProjectSurface.tsx` | |
| Acceptance test | Click "Export Submission ZIP" → ZIP contains `grade/summary.json` with `overallGateVerdict: 'pass'` when all gates satisfied | |

---

### 9. Waveform Display (Labs 6, 7)

**PDF requirement:** HDL Bencher shows timing waveforms (signal vs. time graph).
Students paste waveform screenshots into lab report.

| Dimension | Status | Notes |
|---|---|---|
| Can RedByte do it now? | **No** | VerifySurface shows a tick-by-tick table. No waveform/signal graph display. |
| What's missing? | SVG or canvas waveform rendering from VerifyReport tick data. | |
| File/surface | Would be a new component in `VerifySurface.tsx` | |
| Acceptance test | After PASS/FAIL run, waveform pane shows signal transitions over time as a step-function graph | |

**Priority:** Medium. The tick table is functionally equivalent for grading. Waveform display
would improve Lab 6-7 pedagogical fidelity significantly. This is the **second-highest**
leverage UI improvement.

---

## Summary Table

| Capability | Status | Priority |
|---|---|---|
| Gate-level circuit entry | Yes | — |
| Truth table verification | Yes | — |
| FPGA synthesis (Vivado) | Partial — export bridge | Already addressed |
| Basys3 I/O mapping | Yes (preset system) | — |
| Hierarchical Macros | No — starter workaround | Low (mitigated by starters) |
| DFF sequential simulation | Partial — DFF only | Medium |
| T flip-flop / JK flip-flop nodes | No | **High** — blocks Lab 6 fidelity |
| D latch node | No | **High** — blocks Lab 6 fidelity |
| FSM design workflow | Partial — starter scaffolds | Medium |
| Submission ZIP export | Yes (PR15 infrastructure) | — |
| Waveform display | No | Medium — Lab 6/7 fidelity |

---

## Highest-Leverage Gap

**Add T flip-flop and JK flip-flop primitive node types** (and a D latch node).

Lab 6 is the gateway to Labs 7 and 8. Without T-FF and JK-FF nodes, Lab 6 cannot
be completed authentically in RedByte. Adding these three node types would:
1. Unblock Lab 6 (Latches and Flip-Flops) completely
2. Give Lab 7 (Synchronous Counter) richer building blocks
3. Make Lab 8 (Security Lock FSM) easier to scaffold

The node types would be added to the circuit node registry and exposed in the palette.
Each requires a characteristic table entry in `verifyHints.ts` and a new primitive
in the `@redbyte/rb-logic-core` node library.

**Second-highest:** Waveform display in VerifySurface for Labs 6-7.
