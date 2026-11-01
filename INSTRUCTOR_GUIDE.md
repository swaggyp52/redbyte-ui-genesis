> **SUPERSEDED (historical).** This document describes an earlier RedByte era and does not reflect the current five-workspace product (Project / Design / Simulate / Board & Constraints / Build & Export). Current truth: `docs/course/INSTRUCTOR_QUICKSTART.md`.

# RedByte OS Instructor Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Creating Lab Assignments](#creating-lab-assignments)
4. [Grading Student Work](#grading-student-work)
5. [Export & Reproducibility](#export--reproducibility)
6. [Hardware Integration](#hardware-integration)
7. [Evidence Capsules](#evidence-capsules)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)

---

## Introduction

RedByte OS Genesis is a browser-based digital logic laboratory platform designed for teaching digital design fundamentals through interactive circuit simulation, FPGA synthesis, and lab-based assessment workflows.

### Key Features for Instructors

- **Lab Workbench**: Create lab assignments with constraints and automated grading
- **Self-Check Presets**: Define test vectors, waveform patterns, truth tables for instant feedback
- **Evidence Capsules**: Tamper-proof `.rbx.zip` submissions with cryptographic fingerprinting
- **FPGA Export**: Synthesis-ready Verilog and XDC constraints for hardware deployment
- **Hardware Bridge**: Live FPGA validation with device-in-the-loop testing
- **Reproducibility**: All student work includes exact timestamps, circuit topology, and simulation traces

---

## Getting Started

### Platform Access

1. **Launch RedByte OS**: Navigate to your deployment URL (e.g., `https://redbyteapps.dev`)
2. **Boot Sequence**: Wait for OS boot animation (3-4 seconds)
3. **Launch Apps**: Double-click icons or use Shell commands:
   - Logic Playground: Interactive circuit editor
   - Lab Workbench: Assignment creation tool
   - Virtual Lab: 3D hardware simulation
   - FPGA Proof Viewer: Synthesis verification

### Instructor Mode

Access instructor features through:
- **Instructor App**: Launch from app drawer or Shell command `open instructor`
- **Lab Examiner**: Review student submissions via `open lab-examiner`
- **System Log**: Monitor platform events via `open system-log`

---

## Creating Lab Assignments

### Lab Workflow Overview

1. **Design Reference Circuit**: Use Logic Playground to create golden reference
2. **Define Constraints**: Specify required inputs, outputs, logic gates, chip types
3. **Create Self-Check Presets**: Define automated test cases
4. **Export Lab Bundle**: Generate `.rbx.zip` with circuit + presets
5. **Distribute to Students**: Share via LMS or file system

### Step-by-Step Lab Creation

#### 1. Open Lab Workbench

```shell
open lab
```

Or double-click "Lab Workbench" icon in app drawer.

#### 2. Start with Template or Example

**Option A: Load Example**
- Click **Load Example** button
- Select from 18 pre-built circuits (e.g., `08_sr-latch-nand` for SR Latch)

**Option B: Import Existing Circuit**
- Click **Import** button
- Select `.rbx.zip` file from previous lab

**Option C: Start Blank**
- Use IO panel to add inputs/outputs
- Drag gates from chip palette
- Wire connections by clicking node terminals

#### 3. Define Lab Constraints

In Lab Workbench sidebar:

```yaml
Lab ID: lab-03-adder
Title: 4-Bit Ripple Carry Adder
Description: Design a 4-bit adder with carry-in and carry-out

Constraints:
  Required Inputs: A[0:3], B[0:3], Cin
  Required Outputs: Sum[0:3], Cout
  Allowed Gates: AND, OR, XOR, NOT
  Max Components: 25
  Min Full Adders: 4
```

**Constraint Types:**
- **I/O Requirements**: Specific input/output names and widths
- **Component Limits**: Max gates, specific chip types, layer restrictions
- **Topology Checks**: Required sub-circuits (e.g., "must include 4 full adders")
- **Forbidden Elements**: Chips students cannot use (e.g., no built-in adders)

#### 4. Create Self-Check Presets

Self-checks provide instant feedback to students. Define test cases:

**Test Vector Preset** (Exhaustive Input Testing):
```json
{
  "type": "test-vector",
  "label": "Adder Truth Table (16 cases)",
  "vectors": [
    { "inputs": { "A": 0, "B": 0, "Cin": 0 }, "outputs": { "Sum": 0, "Cout": 0 } },
    { "inputs": { "A": 1, "B": 1, "Cin": 0 }, "outputs": { "Sum": 2, "Cout": 0 } },
    { "inputs": { "A": 15, "B": 15, "Cin": 1 }, "outputs": { "Sum": 15, "Cout": 1 } }
  ]
}
```

**Waveform Preset** (Sequential Timing):
```json
{
  "type": "waveform",
  "label": "Counter Sequence",
  "signals": [
    { "name": "CLK", "pattern": "01010101" },
    { "name": "Q[0]", "expected": "00110011" },
    { "name": "Q[1]", "expected": "00001111" }
  ],
  "tolerance_ticks": 1
}
```

**Truth Table Preset** (Logic Function):
```json
{
  "type": "truth-table",
  "label": "XOR Gate Verification",
  "inputs": ["A", "B"],
  "outputs": ["Y"],
  "exhaustive": true
}
```

**Board I/O Preset** (Hardware Mapping):
```json
{
  "type": "board-io",
  "label": "Basys3 Switch Test",
  "board": "basys3",
  "required_mappings": {
    "SW[0:7]": "inputs",
    "LED[0:7]": "outputs"
  }
}
```

#### 5. Test Self-Checks

Before exporting, verify presets work:

1. Click **Run Self-Check** in Lab Workbench
2. Select preset from dropdown
3. Review pass/fail results
4. Check diagnostic messages
5. Iterate on constraints if needed

#### 6. Export Lab Bundle

When satisfied:

1. Click **Export** button
2. Browser downloads `lab-03-adder.rbx.zip` (example name)
3. Verify bundle contains:
   - `circuit.json` (reference circuit)
   - `manifest.json` (lab metadata)
   - `presets.json` (self-check definitions)
   - `evidence.json` (fingerprints and timestamps)

---

## Grading Student Work

### Import Student Submission

1. **Open Instructor App or Lab Examiner**
   ```shell
   open lab-examiner
   ```

2. **Import `.rbx.zip`**:
   - Click **Import Submission**
   - Select student's exported file
   - Platform loads circuit and evidence manifest

### Review Circuit Topology

**Visual Inspection:**
- Review circuit layout in schematic view
- Check for required components (gates, I/O, connections)
- Verify constraint compliance (e.g., max 25 gates)

**Constraint Report:**
```
✅ Required Inputs: A[0:3], B[0:3], Cin present
✅ Required Outputs: Sum[0:3], Cout present
⚠️  Component Count: 28/25 (3 over limit)
❌ Forbidden Chip: Student used built-in ADD4 (not allowed)
```

### Run Self-Checks

Execute all presets defined in lab spec:

1. **Batch Run**: Click **Run All Presets**
2. **Individual Run**: Select specific preset from dropdown
3. **Review Results**:
   ```
   Test Vector (16 cases): 14/16 passed ✅
   Waveform Timing: PASS ✅
   Truth Table: 7/8 passed ⚠️
   Board I/O Mapping: FAIL ❌ (LED[7] not mapped)
   ```

### Evidence Verification

Every `.rbx.zip` includes cryptographic evidence:

**Fingerprints:**
- `circuit_fingerprint`: SHA-256 of circuit topology
- `simulation_fingerprint`: Hash of waveform data
- `timestamp_utc`: Exact submission time
- `platform_version`: RedByte OS version used

**Reproducibility Check:**
1. Re-run simulation with identical inputs
2. Compare output fingerprints
3. Verify no tampering (mismatched hashes trigger warnings)

**Audit Trail:**
```json
{
  "student_id": "jdoe2025",
  "lab_id": "lab-03-adder",
  "submission_timestamp": "2025-06-15T14:32:18Z",
  "circuit_fingerprint": "a3f9c8d...",
  "self_check_results": {
    "test_vector": { "passed": 14, "total": 16, "score": 0.875 },
    "waveform": { "passed": true, "score": 1.0 }
  },
  "constraint_violations": ["component_count_exceeded"],
  "final_score": 0.82
}
```

### Assign Grade

**Automated Scoring:**
- Platform calculates score based on preset pass rates and constraint compliance
- Suggested score displayed: `82/100`

**Manual Adjustments:**
- Award partial credit for creative solutions
- Deduct points for violations (e.g., -5 for exceeding gate limit)
- Add comments via Instructor App notes field

---

## Export & Reproducibility

### What Students Export

When students click **Export** in Logic Playground or Lab Workbench:

1. **Circuit Definition** (`circuit.json`):
   - All nodes (gates, I/O, connections)
   - Positions, chip types, pin configurations
   - Hierarchical structure (modules, layers)

2. **Evidence Manifest** (`evidence.json`):
   - Cryptographic fingerprints (circuit, simulation, hardware)
   - Timestamps (UTC, ISO 8601 format)
   - Platform version and build hash
   - Self-check results (if run before export)

3. **Waveform Data** (optional, `waveform.json`):
   - Simulation trace for reproducibility
   - Tick-by-tick signal values

4. **FPGA Artifacts** (if exported):
   - `verilog/top.v` (synthesizable Verilog)
   - `fpga/constraints.xdc` (Basys3/Nexys4 pin mappings)

### Reproducibility Workflow

**Scenario**: Verify student's simulation results

1. **Import `.rbx.zip`** into Logic Playground
2. **Load Circuit**: Platform reconstructs exact topology
3. **Run Simulation**: Execute with same inputs (from evidence manifest)
4. **Compare Fingerprints**:
   ```bash
   Student's simulation_fingerprint: b7d4e9a...
   Instructor's re-run fingerprint:  b7d4e9a... ✅ MATCH
   ```

If fingerprints mismatch:
- Student may have modified circuit after simulation
- Waveform data corrupted
- Platform version differences (rare, logged in evidence)

### Evidence Capsule Structure

```
submission.rbx.zip
├── circuit.json          # Circuit topology (nodes, connections)
├── manifest.json         # Metadata (title, description, author)
├── presets.json          # Self-check test cases
├── evidence.json         # Fingerprints, timestamps, audit trail
├── waveform.json         # Optional: simulation trace
└── fpga/
    ├── verilog/
    │   └── top.v         # Synthesizable Verilog
    └── constraints.xdc   # Pin mappings
```

---

## Hardware Integration

### FPGA Export Workflow

Students can export synthesis-ready Verilog:

1. **Design Circuit** in Logic Playground (Layer 6: FPGA synthesis compatible)
2. **Click "Build Bitstream" or Export → FPGA**
3. Platform generates:
   - **Verilog Module** (`top.v`): Structural HDL with port declarations
   - **XDC Constraints** (`constraints.xdc`): Basys3/Nexys4 pin mappings

**Validation Before Export:**
- Syntax checking (module structure, port declarations, signal declarations)
- Constraint validation (all circuit signals mapped to board pins)
- Readiness score (0-100%, synthesis likelihood indicator)

### Hardware Bridge (Live FPGA Testing)

For advanced labs, enable device-in-the-loop validation:

1. **Connect Basys3/Nexys4** via USB
2. **Launch Hardware Panel** (`open hardware`)
3. **Deploy Circuit** to FPGA
4. **Run Tests** with live feedback:
   ```
   Test 1: Set SW[0]=1 → Verify LED[0]=1 ✅
   Test 2: Clock 10 ticks → Verify counter increments ✅
   ```

**Hardware Session Evidence:**
- Device ID, firmware version, deployment timestamp
- Test vector results from physical hardware
- Included in evidence capsule for grading

---

## Evidence Capsules

### Tamper Detection

RedByte OS uses cryptographic fingerprinting to prevent cheating:

**How It Works:**
1. **Circuit Fingerprint**: Hash of node IDs, connections, chip types (order-independent)
2. **Simulation Fingerprint**: Hash of waveform data (all signals, all ticks)
3. **Timestamp**: UTC timestamp at export (server-synced if available)

**Tamper Scenarios:**

| Scenario | Detection Method |
|----------|------------------|
| Student edits circuit after simulation | Circuit fingerprint mismatch |
| Student modifies waveform data | Simulation fingerprint mismatch |
| Student changes timestamps | Chronological inconsistency (submit before create) |
| Student copies another's work | Identical fingerprints flag plagiarism |

**Instructor Actions:**
- Review evidence mismatches in Lab Examiner
- Check audit log for modifications
- Confront student with proof (hash values, timestamps)

### Plagiarism Detection

**Unique Fingerprints:**
Even small circuit changes produce different hashes.

**Collision Detection:**
```bash
# Two students with identical circuits
Student A: circuit_fingerprint = a3f9c8d...
Student B: circuit_fingerprint = a3f9c8d... 🚨 IDENTICAL

# Platform flags: "Submission fingerprints match 100%"
```

**Recommended Process:**
1. Sort submissions by fingerprint
2. Group duplicates
3. Interview students
4. Apply academic integrity policy

---

## Troubleshooting

### Common Student Issues

#### "Export button disabled"

**Cause**: Circuit validation errors block export
**Solution**:
1. Check error messages in Shell output
2. Review validation warnings (e.g., "Signal X undeclared")
3. Fix issues, re-run validation
4. Export button enables when score > 70%

#### "Self-check fails but circuit looks correct"

**Cause**: Timing issues, signal naming mismatches
**Solution**:
1. Open Waveform Viewer (`Ctrl+W`)
2. Compare expected vs actual signals
3. Check for:
   - Off-by-one tick errors (clock edge timing)
   - Case-sensitive signal names (`Cout` vs `cout`)
   - Floating (unconnected) inputs

#### "FPGA export produces errors in Vivado"

**Cause**: Validation passed but synthesis fails (tool limitations)
**Solution**:
1. Check Verilog syntax manually
2. Verify XDC constraints match board (Basys3 vs Nexys4)
3. Look for:
   - Multiple drivers on same signal
   - Combinational loops
   - Clock domain crossing issues

### Platform Issues

#### "OS won't boot"

**Causes**: Browser compatibility, JavaScript disabled, cache corruption
**Solutions**:
1. Clear browser cache (Ctrl+Shift+Delete)
2. Try incognito/private window
3. Use supported browsers: Chrome 90+, Edge 90+, Firefox 88+
4. Check console for errors (F12 → Console tab)

#### "Apps freeze or crash"

**Causes**: Runaway simulation loop, out of memory
**Solutions**:
1. Reload page (F5)
2. Check for loops without clock gates (watchdog triggers)
3. Reduce circuit size (< 500 nodes)
4. Close other browser tabs

#### "Evidence fingerprints don't match"

**Causes**: Platform version mismatch, corrupted export
**Solutions**:
1. Check `evidence.json` → `platform_version`
2. Verify instructor and student use same RedByte OS version
3. Re-export circuit with latest version
4. Contact IT if persistent (possible bug)

---

## Best Practices

### Lab Design

**Start Simple, Scale Gradually:**
- Lab 1: Combinational logic (AND, OR, NOT gates)
- Lab 2: Multi-level circuits (adders, comparators)
- Lab 3: Sequential logic (latches, flip-flops)
- Lab 4: FSMs (traffic lights, vending machines)
- Lab 5: FPGA deployment (real hardware)

**Define Clear Constraints:**
```yaml
❌ Bad: "Build an adder"
✅ Good: "Build a 4-bit ripple carry adder using exactly 4 full adder circuits (each with 2 XOR, 2 AND, 1 OR). Max 25 gates."
```

**Test Your Own Labs:**
- Complete the lab as a student would
- Run all self-checks (ensure they pass)
- Export and verify evidence capsule integrity
- Deploy to FPGA (if hardware lab)

### Grading Efficiency

**Batch Processing:**
1. Collect all `.rbx.zip` files in folder
2. Use Lab Examiner **Import Folder** feature
3. Run all presets in batch mode
4. Export grade report as CSV

**Rubric Template:**
```
Self-Check Score:     ___ / 40 pts (40% of grade)
Constraint Compliance: ___ / 30 pts (no violations = 30)
Design Quality:        ___ / 20 pts (clean layout, efficient)
Documentation:         ___ / 10 pts (comments, signal names)
──────────────────────────────────────────────
Total:                 ___ / 100 pts
```

### Academic Integrity

**Prevent Cheating:**
- Assign unique circuits per student (vary constraints)
- Rotate lab topics each semester
- Require in-class demonstrations
- Compare fingerprints across submissions

**Educate Students:**
- Explain evidence capsules in syllabus
- Demonstrate tamper detection in class
- Show consequences of plagiarism (policy link)

### Hardware Labs

**Equipment Setup:**
- Use Basys3 or Nexys4 boards (supported by XDC export)
- Provide USB cables and drivers (Xilinx documentation)
- Reserve lab hours for hardware access

**Safety Protocols:**
- No food/drinks near FPGAs
- Verify power supply voltages
- Supervised deployment (instructor present)

---

## Additional Resources

- **Platform Documentation**: [PROJECT_MODEL.md](./PROJECT_MODEL.md)
- **Example Catalog**: [EXAMPLES_CATALOG.md](./EXAMPLES_CATALOG.md)
- **Deployment Guide**: [DEPLOYMENT_NOTES.md](./DEPLOYMENT_NOTES.md)
- **User Manual**: [REDBYTE_USER_MANUAL.md](./REDBYTE_USER_MANUAL.md)
- **Validation Guide**: [docs/fpga-validation-guide.md](./docs/fpga-validation-guide.md)

---

**Copyright © 2025 Connor Angiel — RedByte OS Genesis**  
*Use without permission prohibited. Licensed under the RedByte Proprietary License (RPL-1.0).*
