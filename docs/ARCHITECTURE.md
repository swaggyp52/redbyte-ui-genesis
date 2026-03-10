# RedByte IDE Architecture

This document defines the five architectural layers of the RedByte IDE system and the explicit
boundaries between them. Use this as the authoritative guide when deciding where new code belongs.

---

## Layer Map

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer E — Student UX Shell                                     │
│  packages/rb-apps/src/apps/IdeApp.tsx + 6 surfaces + components │
├─────────────────────────────────────────────────────────────────┤
│  Layer D — Submission Engine                                    │
│  packages/rb-apps/src/export/ideSubmissionBundle.ts             │
│  packages/rb-apps/src/export/parseIdeSubmission.ts              │
├─────────────────────────────────────────────────────────────────┤
│  Layer C — Vivado Adapter                                       │
│  packages/rb-apps/src/fpga/boards/basys3/                       │
│  (basys3ExportService, basys3Bundle, testbenchGenerator, …)     │
├─────────────────────────────────────────────────────────────────┤
│  Layer B — Verification Engine                                  │
│  packages/rb-apps/src/fpga/boards/basys3/verifySchedule.ts      │
│  packages/rb-lab-engine/src/verification/verifyTruthTable.ts    │
├─────────────────────────────────────────────────────────────────┤
│  Layer A — FPGA Logic Core                                      │
│  packages/rb-logic-core/                                        │
│  packages/rb-lab-engine/  (non-verification modules)            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer A — FPGA Logic Core

**Package(s):** `packages/rb-logic-core`, `packages/rb-lab-engine` (non-verification modules)

**What it does:**
- Deterministic circuit simulation: gate evaluation, node resolution, fan-out propagation
- Lab schema definitions (`labProjectSchema.ts` in `rb-utils`)
- Primitive type definitions: `AND2`, `OR2`, `XOR2`, `NOT`, `DFlipFlop`, `TFlipFlop`, etc.
- Wire connectivity and node graph representation

**What it does NOT do:**
- Any UI rendering
- File I/O or ZIP creation
- FPGA-specific pin mapping or HDL generation
- Truth table comparison

**Depends on:** Nothing above this layer.

---

## Layer B — Verification Engine

**Files:**
- `packages/rb-apps/src/fpga/boards/basys3/verifySchedule.ts`
- `packages/rb-lab-engine/src/verification/verifyTruthTable.ts`
- `packages/rb-utils/src/verifySchedule.ts` (shared types)

**What it does:**
- Runs the student's circuit against expected truth table vectors
- Produces a `VerifyResult` with pass/fail per vector, failing node identification
- Handles both combinational (single-tick) and sequential (multi-tick with clock) schedules
- Deterministic: same circuit + same vectors always produces the same result

**What it does NOT do:**
- Any UI rendering or state management
- File I/O or HDL generation
- Communication with hardware

**Depends on:** Layer A only.

---

## Layer C — Vivado Adapter

**Directory:** `packages/rb-apps/src/fpga/boards/basys3/`

**Key files:**
- `basys3ExportService.ts` — orchestrates HDL/XDC/TCL generation
- `basys3Bundle.ts` — assembles the ZIP artifact for Vivado
- `testbenchGenerator.ts` — generates VHDL testbench from circuit + vectors
- `basys3Pins.ts` — pin mapping database for Basys3 board
- `sequentialAnalysis.ts` — clock domain analysis for sequential circuits
- `vivadoImportTcl.ts` — generates Vivado TCL project script
- `vectorRunner.ts` — runs vectors through the Vivado simulation path
- `portLint.ts` — validates port names and widths against VHDL rules

**What it does:**
- Converts a circuit graph into synthesizable VHDL (`top.vhd`)
- Generates pin constraints (`constraints.xdc`) for Basys3
- Generates a VHDL testbench (`testbench.vhd`) from truth table vectors
- Produces the complete Vivado project ZIP

**What it does NOT do:**
- UI rendering or student-facing state
- Verification (uses Layer B results as input)
- Submission bundling or integrity hashing

**Depends on:** Layers A and B.

---

## Layer D — Submission Engine

**Files:**
- `packages/rb-apps/src/export/ideSubmissionBundle.ts`
- `packages/rb-apps/src/export/parseIdeSubmission.ts`
- `packages/rb-apps/src/export/fileTreeManifest.ts`
- `packages/rb-apps/src/export/deterministicZip.ts`
- `packages/rb-apps/src/export/stableStringify.ts`

**What it does:**
- Bundles the student's work into a deterministic ZIP with integrity hashes
- Embeds: project JSON, verify ledger, gate verdict, run counts, manifest
- Parses and validates imported submission ZIPs (checks `SubmissionIntegrityError`)
- Provides `deriveProofRunFlags` + `validateSubmissionForLab` for gate computation

**What it does NOT do:**
- UI rendering
- HDL generation (delegates to Layer C)
- Verification execution (reads Layer B results)

**Depends on:** Layers A, B, and C.

**Integrity guarantee:** The submission ZIP is deterministic — same inputs always produce the
same bytes. Hash values in the manifest are content-addressed and used for tamper detection.

---

## Layer E — Student UX Shell

**Files:**
- `packages/rb-apps/src/apps/IdeApp.tsx` — main shell, mode routing, state management
- `packages/rb-apps/src/apps/ide/surfaces/*.tsx` — 6 student-facing surfaces
- `packages/rb-apps/src/apps/ide/components/` — surface-specific UI components
- `packages/rb-apps/src/components/` — shared UI primitives (ErrorBoundary, IdePrimitives)

**Surfaces:**

| Surface | Mode | Student Purpose |
|---------|------|-----------------|
| `ProjectSurface.tsx` | `project` | Enter name, view lab info, export submission |
| `DesignSurface.tsx` | `design` | Build circuit with drag-and-drop gate editor |
| `VerifySurface.tsx` | `verify` | Run simulation, see pass/fail, jump to failures |
| `HardwareSurface.tsx` | `hardware` | Map circuit ports to Basys3 physical pins |
| `ExportSurface.tsx` | `export` | Download Vivado Kit, view generated HDL |
| `ImportSurface.tsx` | `import` | Import VHDL, ZIP, or XDC into circuit |

**What it does:**
- Student-appropriate views with no internal diagnostic language
- Orchestrates calls to Layers B, C, D on user actions
- Maintains UI state: `IdeMode`, `verifyLedger`, `diagnosticRouteRequest`
- Wraps all surfaces in `ErrorBoundary`

**What it does NOT do:**
- Logic simulation (delegates to Layer A)
- Verification math (delegates to Layer B)
- HDL generation (delegates to Layer C)
- Submission hashing (delegates to Layer D)

**Content rules for this layer:**
- No manifest hashes, bundle hashes, or capsule state language in default view
- No "Pipeline Stage", "WAITING", "not sealed" diagnostic text
- Integrity/hash data belongs in collapsed "Advanced" accordions only
- Maximum 3 status pills per surface

---

## Application Contexts

**`IdeApp`** — student lab tool. Always-on simplified view. Used directly by students.

**`LabWorkspaceApp`** — guided lab context with lab step tracking. Used in structured assignments.

**`SubmissionInspectorApp`** — instructor grading tool. Full diagnostic view including all hashes,
gate verdicts, and submission details. Not student-facing.

**`LogicPlaygroundApp`** — open-ended sandbox, no submission system.

---

## Legacy / Non-Existent Packages (not part of the active IDE)

These names appear in historical configs (tsconfig paths, vitest aliases) but the packages **do not exist** as source trees:
- `rb-analog-sim` — analog simulation prototype (never built)
- `rb-logic-3d` — 3D voxel logic visualizer (removed)
- `rb-windowing` — OS-era window manager (removed; a minimal stub exists at `packages/rb-windowing/src/index.ts` for vitest alias resolution only)
- `rb-shell` — OS-era app shell (removed)

These exist as standalone services, not part of the student IDE:
- `rb-fpga-bridge` — hardware bridge agent (standalone service)
- `ops-server` — ops backend (standalone service)

**Dead code quarantined** to `archive/dead-legacy-components/`:
- `OscilloscopeView.tsx`, `OscilloscopePanel.jsx`, `SplitViewLayout.tsx` — OS-era visualizer components
- `BoardIOPanel.js`, `TestVectorPanel.js`, `TruthTableAnalyzer.js` — legacy JS panels
- 31 OS-era test files that referenced deleted apps/components

---

## Data Flow: Student Submission

```
Student designs circuit (Layer E DesignSurface)
    ↓
Runs verification (Layer B verifyTruthTable + verifySchedule)
    ↓ verify ledger stored in IdeApp state
Maps pins in HardwareSurface (Layer E)
    ↓
Clicks "Download Vivado Kit" (Layer E ExportSurface)
    ↓
Layer C generates top.vhd + constraints.xdc + testbench.vhd
    ↓
Layer D wraps in ZIP with integrity manifest
    ↓
Student downloads ZIP → imports into Vivado
```

---

---

## Import Fidelity

RedByte defines three fidelity levels for project import. These are set on `project.meta.importFidelity` and surfaced in the Project panel.

### Level 1 — Full (`'full'`)

**Source:** `project.rbproj.json` manifest inside a RedByte-exported ZIP.

The manifest is the canonical authority. All circuit state, node positions, IO mapping, test vectors, and metadata are fully restored.

**Automated test:** `src/__tests__/rbproject-roundtrip-gate.test.ts`

### Level 2 — Reconstructed (`'reconstructed'`)

**Source:** Structural VHDL with component instantiation (`U1: AND2 port map (...)`), optionally with an `.xdc` constraint file.

RedByte's `parsedHdlToCircuit` maps HDL component names through `COMPONENT_MAP` (26 types). Node layout is auto-assigned. Test vectors must be re-authored.

**Documented limitation:** Structural VHDL imported this way will reconstruct topology correctly but will NOT have saved node positions or test vectors.

**Automated test:** `src/__tests__/export-reimport-roundtrip.test.ts` — "Reconstructed fidelity" suite.

### Level 3 — Partial (`'partial'`)

**Sources:**

- Behavioral VHDL (`process` blocks, `rising_edge`, `always_ff`)
- RedByte's own exported `top.vhd` (uses concurrent signal assignments, not component instantiation)

Only I/O port names and directions are extracted. Internal logic cannot be reconstructed.

> **Important:** RedByte's `vhdlFromNetlist` export generates concurrent signal assignments
> (`and_0 <= SW0 and SW1`), not component instantiation blocks. This is correct for Vivado
> synthesis but means the generated VHDL **cannot be re-imported** through the HDL import
> pipeline. Use `project.rbproj.json` (always included in the exported ZIP) for full-fidelity
> re-import.

**Automated test:** `src/__tests__/export-reimport-roundtrip.test.ts` — "Partial fidelity" suite.

---

## See Also

- `docs/STUDENT_UX_LAYER.md` — student/instructor content rules per surface
- `docs/VIVADO_INTEGRATION.md` — step-by-step Vivado workflow spec
- `AI_STATE.md` — running log of architectural decisions and changes
- `AGENTS.md` — agent navigation guide
