# RedByte Product Manual — Claim Audit

**Document:** RB-AUDIT-001 v1.0
**Date:** 2026-03-31
**Auditor:** Claude (automated fact-check against repo source)
**Scope:** Every material claim in `RedByte_Product_Manual.md` v1.0 verified against codebase, tests, and architecture docs.

---

## Audit Method

Three parallel audit passes were run against the repo:

1. **Logic-core & primitives audit** — Verified gate registry, simulation engine, connection format, determinism claims.
2. **FPGA pipeline & export audit** — Verified Vivado export filenames, XDC generation, testbench entity names, pin counts, submission packaging.
3. **UX surface & import audit** — Verified surface names, tab labels, import fidelity levels, hint counts, example catalog.

Each claim is rated:

| Status | Meaning |
|--------|---------|
| **VERIFIED** | Claim matches code exactly. No change needed. |
| **PARTIAL** | Claim is directionally correct but imprecise. Needs tightening. |
| **NEEDS EDIT** | Claim is factually wrong. Must be corrected. |

---

## Findings

### 1. XDC Filename

| Field | Value |
|-------|-------|
| **Claim** | Manual references `constraints.xdc` as the generated constraints file. |
| **Sections** | §11.1 (Generated Files table), §14, Appendix C, multiple inline references |
| **Status** | **NEEDS EDIT** |
| **Source** | `packages/rb-apps/src/fpga/boards/basys3/basys3Bundle.ts` line 191: filename is `top.xdc` |
| **Tests** | Basys3 bundle tests confirm `top.xdc` output |
| **Correction** | Replace all instances of `constraints.xdc` with `top.xdc`. |

---

### 2. Testbench Entity Name

| Field | Value |
|-------|-------|
| **Claim** | Manual references testbench entity as `top_tb`. |
| **Sections** | §11.1, Appendix C, inline code references |
| **Status** | **NEEDS EDIT** |
| **Source** | `packages/rb-apps/src/fpga/boards/basys3/testbenchGenerator.ts` lines 292–293, 402–403: entity is `tb_top`. Confirmed by `packages/rb-apps/src/fpga/vivado/vivadoProjectFolder.ts` line 36: `const TESTBENCH_TOP_MODULE = 'tb_top'`. |
| **Tests** | Testbench generator tests assert `tb_top` entity name |
| **Correction** | Replace all instances of `top_tb` with `tb_top`. |

---

### 3. Import Surface Tab Label

| Field | Value |
|-------|-------|
| **Claim** | Manual references the Import surface tab as "Write HDL". |
| **Sections** | §7.6, §12 |
| **Status** | **NEEDS EDIT** |
| **Source** | `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx` line 1990: tabs are "Upload ZIP", "Paste HDL", "Paste XDC". |
| **Correction** | Replace "Write HDL" with "Paste HDL" throughout. |

---

### 4. NOR and XNOR Gate Availability

| Field | Value |
|-------|-------|
| **Claim** | Manual lists NOR and XNOR as available primitive gates in the palette. |
| **Sections** | §2.2, §7.2 (Component Palette), Appendix A |
| **Status** | **NEEDS EDIT** |
| **Source** | `packages/rb-logic-core/src/builtins.ts` defines AND, OR, NOT, NAND, XOR, AND3, OR3, NAND3, NOR3, XOR3, Clock, Delay, DFlipFlop, TFlipFlop, JKFlipFlop, INPUT, OUTPUT, PowerSource, Ground, Switch, Lamp, Wire. NOR and XNOR exist as type definitions in `nodes.ts` but are **not registered** in the active `builtins.ts` registry. Only NOR3 (three-input) is registered. |
| **Correction** | Remove NOR and XNOR from the basic two-input gates list. Note NOR3 is available as a three-input variant. If the manual lists gate categories, clarify which are registered vs. defined-but-inactive. |

---

### 5. Verification Hint Count

| Field | Value |
|-------|-------|
| **Claim** | Manual states the verify engine provides "up to 7 fact-grounded diagnostic hints." |
| **Sections** | §9 |
| **Status** | **NEEDS EDIT** |
| **Source** | `packages/rb-apps/src/apps/ide/verifyHints.ts` lines 48–121: the HINTS array contains **14 diagnostic conditions**. |
| **Correction** | Replace "up to 7" with "14 diagnostic conditions" or "over a dozen diagnostic conditions." |

---

### 6. COMPONENT_MAP Size (Import Pipeline)

| Field | Value |
|-------|-------|
| **Claim** | Manual states the import pipeline maps "26 HDL component types." |
| **Sections** | §12, Appendix D/E |
| **Status** | **NEEDS EDIT** |
| **Source** | `packages/rb-apps/src/import/hdlToCircuit.ts` lines 60–97: COMPONENT_MAP contains **37 HDL name variants** (e.g., `and2`, `AND`, `and_gate` all map to the same type) that resolve to **9 distinct RedByte node types**. |
| **Correction** | Replace "26 HDL component types" with "37 HDL name variants mapping to 9 RedByte node types." |

---

### 7. VHDL Keyword Validation

| Field | Value |
|-------|-------|
| **Claim** | Manual states the export pipeline validates entity names against VHDL reserved keywords. |
| **Sections** | §11 |
| **Status** | **NEEDS EDIT** |
| **Source** | No VHDL keyword checking logic found in `basys3Bundle.ts`, `vhdlGenerator.ts`, or `vivadoProjectFolder.ts`. The entity name defaults to `'top'` (line 247 of basys3Bundle.ts) with an optional override, but no keyword validation exists. |
| **Correction** | Remove the VHDL keyword validation claim, or soften to "the default entity name `top` avoids VHDL reserved words." |

---

### 8. SubmissionInspectorApp

| Field | Value |
|-------|-------|
| **Claim** | Manual describes SubmissionInspectorApp as a functioning application context for instructors. |
| **Sections** | §3 (Application Contexts), §13 |
| **Status** | **PARTIAL** |
| **Source** | `docs/ARCHITECTURE.md` defines SubmissionInspectorApp as one of four application contexts. However, no standalone `SubmissionInspectorApp.tsx` implementation file was found. The submission inspection UI appears to be integrated into IdeApp's Project surface rather than existing as a separate app. |
| **Correction** | Clarify that SubmissionInspectorApp is an architecturally defined context whose inspector functionality is currently delivered through the IDE's Project surface. Do not claim it as a separate launchable application. |

---

### 9. Vivado Export ZIP Contents

| Field | Value |
|-------|-------|
| **Claim** | Manual states the export ZIP contains three files: `top.vhd`, `constraints.xdc` (see finding #1), `testbench.vhd`. |
| **Sections** | §11.1, §14, Appendix C |
| **Status** | **PARTIAL** |
| **Source** | `packages/rb-apps/src/fpga/vivado/vivadoProjectFolder.ts` generates a ZIP containing: `top.vhd`, `top.xdc`, `testbench.vhd`, `vivado_import.tcl`, `README.txt`, `BRINGUP.md`, `EXPECTED_IO.json`, `program_and_test.tcl`, `project.rbproj.json`. |
| **Correction** | List all generated files. The three HDL/XDC files are the primary deliverables; the remaining files are support/automation files. Describe both tiers. |

---

### 10. Import Fidelity Levels

| Field | Value |
|-------|-------|
| **Claim** | Manual uses fidelity labels "Full," "Reconstructed," "Partial." |
| **Sections** | §12, Appendix D/E |
| **Status** | **VERIFIED** |
| **Source** | Internal code uses `'full' | 'ports-only' | 'empty'` (`hdlToCircuit.ts` line 43). The UI layer in `IdeApp.tsx` line 101 maps these to `'full' | 'reconstructed' | 'partial'`. The manual correctly documents the user-facing labels. |
| **Correction** | None needed. Optionally add a developer note about the internal mapping. |

---

### 11. Starter Examples

| Field | Value |
|-------|-------|
| **Claim** | Manual lists 5 starter examples: Signal Tour, Logic Gates, Half Adder, Full Adder, Two-Bit Counter. |
| **Sections** | §5.3 |
| **Status** | **VERIFIED** |
| **Source** | `packages/rb-apps/src/apps/ide/examplesCatalog.ts` contains exactly these 5 examples: `signal-tour`, `logic-gates`, `half-adder`, `full-adder`, `two-bit-counter`. Additionally, `packages/rb-apps/src/fpga/boards/basys3/examples.ts` has 3 board-specific examples (Switches→LEDs, Seven-Seg Counter, Debounced Button Toggle) which are separate from the IDE examples. |
| **Correction** | None needed for IDE examples. Consider mentioning the 3 Basys3-specific examples separately. |

---

### 12. Six IDE Surfaces

| Field | Value |
|-------|-------|
| **Claim** | Manual documents six surfaces: Project, Design, Verify, Hardware, Export, Import. |
| **Sections** | §6, §7.1–7.6 |
| **Status** | **VERIFIED** |
| **Source** | `packages/rb-apps/src/apps/ide/workflowStages.ts`: `IdeMode = 'project' | 'design' | 'verify' | 'hardware' | 'export' | 'import'`. Left rail in `IdeLeftRail.tsx` lines 181–234 confirms 6 entries. |
| **Correction** | None. |

---

### 13. Hardware Surface Tabs

| Field | Value |
|-------|-------|
| **Claim** | Manual describes Hardware surface tabs. |
| **Sections** | §7.4, §10 |
| **Status** | **VERIFIED** |
| **Source** | `HardwareSurface.tsx` lines 1256–1270 confirm tabs: Map Pins, Prepare Board, Program Checklist, Live Details. |
| **Correction** | None. |

---

### 14. Basys 3 Pin Counts

| Field | Value |
|-------|-------|
| **Claim** | 16 switches, 16 LEDs, 5 buttons, 7-segment display, CLK100MHZ at W5. |
| **Sections** | §10, Appendix B |
| **Status** | **VERIFIED** |
| **Source** | `basys3Bundle.ts` pin definitions match these counts. W5 clock confirmed. LVCMOS33 I/O standard confirmed at line 158. |
| **Correction** | None. |

---

### 15. Connection Format

| Field | Value |
|-------|-------|
| **Claim** | Manual documents nested connection format `{ id, from: { nodeId, portName }, to: { nodeId, portName } }`. |
| **Sections** | §4, developer references |
| **Status** | **VERIFIED** |
| **Source** | `CLAUDE.md` explicitly states this is the canonical format. `normalizePortRef` in `projectFormat.ts` enforces it. |
| **Correction** | None. |

---

### 16. SHA-256 Submission Hashing

| Field | Value |
|-------|-------|
| **Claim** | Submission packaging uses SHA-256 deterministic hashing. |
| **Sections** | §13, §14 |
| **Status** | **VERIFIED** |
| **Source** | `packages/rb-apps/src/export/submissionBundle.ts` lines 114–120, 284–291: uses `crypto.subtle.digest('SHA-256', bytes)`. |
| **Correction** | None. |

---

### 17. Deterministic Simulation (Topological Sort)

| Field | Value |
|-------|-------|
| **Claim** | Simulation uses topological sort (Kahn's algorithm) for deterministic evaluation. |
| **Sections** | §4.2 |
| **Status** | **VERIFIED** |
| **Source** | Logic core implements topological sort for node evaluation ordering. Determinism contract documented in `docs/00-canon/02-determinism-contract.md`. |
| **Correction** | None. |

---

### 18. Five-Layer Architecture

| Field | Value |
|-------|-------|
| **Claim** | Five layers: A (Logic Core), B (Verification), C (Vivado Adapter), D (Submission Engine), E (Student UX Shell). |
| **Sections** | §4.4 |
| **Status** | **VERIFIED** |
| **Source** | `docs/ARCHITECTURE.md` confirms the five-layer model with these exact names and responsibilities. |
| **Correction** | None. |

---

## Summary

| Status | Count | Findings |
|--------|-------|----------|
| **NEEDS EDIT** | 7 | #1 XDC filename, #2 testbench entity, #3 Import tab label, #4 NOR/XNOR, #5 hint count, #6 COMPONENT_MAP size, #7 VHDL keyword validation |
| **PARTIAL** | 2 | #8 SubmissionInspectorApp, #9 ZIP contents |
| **VERIFIED** | 9 | #10–#18 (fidelity levels, examples, surfaces, tabs, pins, connection format, SHA-256, topological sort, architecture) |

**Total claims audited:** 18
**Accuracy rate (VERIFIED):** 50%
**Requiring correction:** 9 of 18

---

## Correction Priority

1. **P0 — Factual errors** (will confuse users): #1, #2, #3, #5
2. **P1 — Overclaims** (promise features that don't exist as described): #4, #6, #7
3. **P2 — Imprecision** (directionally correct but misleading): #8, #9

---

*End of Audit*
