> **SUPERSEDED (historical).** This document describes an earlier RedByte era and does not reflect the current five-workspace product (Project / Design / Simulate / Board & Constraints / Build & Export). Current truth: `docs/manuals/RedByte_Product_Manual.md`.

# RedByte OS Project Model & Export Schema

## Overview

This document defines the **project model** used by RedByte OS Genesis for representing digital logic circuits, lab assignments, evidence capsules, and FPGA synthesis artifacts. All exports use the `.rbx.zip` format with structured JSON schemas.

---

## Table of Contents

1. [Export Format (`.rbx.zip`)](#export-format-rbxzip)
2. [Circuit Schema (`circuit.json`)](#circuit-schema-circuitjson)
3. [Manifest Schema (`manifest.json`)](#manifest-schema-manifestjson)
4. [Evidence Schema (`evidence.json`)](#evidence-schema-evidencejson)
5. [Presets Schema (`presets.json`)](#presets-schema-presetsjson)
6. [Waveform Schema (`waveform.json`)](#waveform-schema-waveformjson)
7. [FPGA Artifacts](#fpga-artifacts)
8. [Fingerprinting Algorithm](#fingerprinting-algorithm)
9. [Version Compatibility](#version-compatibility)

---

## Export Format (`.rbx.zip`)

All circuit exports use ZIP compression with the following structure:

```
project_name.rbx.zip
├── circuit.json         # Required: Circuit topology (nodes, connections)
├── manifest.json        # Required: Metadata (title, description, timestamps)
├── evidence.json        # Required: Cryptographic fingerprints & audit trail
├── presets.json         # Optional: Self-check test cases for labs
├── waveform.json        # Optional: Simulation trace data
└── fpga/                # Optional: FPGA synthesis artifacts
    ├── verilog/
    │   └── top.v        # Synthesizable Verilog module
    └── constraints.xdc  # XDC pin constraints (Basys3/Nexys4)
```

### File Requirements

| File | Required | Description |
|------|----------|-------------|
| `circuit.json` | ✅ Yes | Circuit topology (nodes, connections, chip types) |
| `manifest.json` | ✅ Yes | Project metadata (title, author, description) |
| `evidence.json` | ✅ Yes | Fingerprints, timestamps, version info |
| `presets.json` | ❌ No | Self-check test cases (lab assignments only) |
| `waveform.json` | ❌ No | Simulation trace (for reproducibility) |
| `fpga/` | ❌ No | FPGA synthesis files (Verilog + XDC) |

---

## Circuit Schema (`circuit.json`)

Represents the complete circuit topology with nodes, connections, and metadata.

### Top-Level Structure

```json
{
  "version": "2.0",
  "nodes": [ /* Array of Node objects */ ],
  "connections": [ /* Array of Connection objects */ ],
  "metadata": {
    "created": "2025-06-15T14:32:18Z",
    "modified": "2025-06-15T15:10:42Z",
    "author": "student@university.edu",
    "platform_version": "1.0.0"
  }
}
```

### Node Object

Each node represents a logic gate, I/O, or component:

```json
{
  "id": "node_1a2b3c",
  "type": "chip",
  "chipType": "AND",
  "layer": 2,
  "position": { "x": 250, "y": 180 },
  "inputs": [
    { "id": "in0", "name": "A", "value": 0 },
    { "id": "in1", "name": "B", "value": 1 }
  ],
  "outputs": [
    { "id": "out0", "name": "Y", "value": 0 }
  ],
  "label": "G1",
  "metadata": {
    "description": "Input gate for control logic",
    "group": "input_stage"
  }
}
```

#### Node Types

| Type | Description | Example Chips |
|------|-------------|---------------|
| `chip` | Logic gate or component | AND, OR, XOR, NOT, NAND, NOR, XNOR |
| `input` | Circuit input | Switch, button, external signal |
| `output` | Circuit output | LED, lamp, external connection |
| `clock` | Clock generator | System clock, pulse generator |
| `constant` | Fixed value | VCC (1), GND (0) |
| `module` | Hierarchical sub-circuit | Custom modules, black boxes |

#### Chip Types (Layer 2 - Logic Gates)

- **Basic Gates**: AND, OR, XOR, NOT, NAND, NOR, XNOR
- **Multi-Input**: AND3, AND4, OR3, OR4, NAND3, NAND4
- **Special**: BUF (buffer), TRISTATE (tri-state buffer)

#### Chip Types (Layer 3 - Combinational Circuits)

- **Arithmetic**: HALF_ADDER, FULL_ADDER, ADD4 (4-bit adder), SUB4 (4-bit subtractor)
- **Comparison**: CMP4 (4-bit comparator), EQ (equality), GT (greater-than)
- **Multiplexing**: MUX2 (2:1 mux), MUX4 (4:1 mux), MUX8 (8:1 mux)
- **Decoding**: DEC2 (2:4 decoder), DEC3 (3:8 decoder), ENC8 (8:3 encoder)

#### Chip Types (Layer 4 - Sequential Circuits)

- **Latches**: SR_LATCH (SR latch), D_LATCH (D latch), JK_LATCH
- **Flip-Flops**: DFF (D flip-flop), TFF (T flip-flop), JKFF (JK flip-flop)
- **Registers**: REG4 (4-bit register), REG8 (8-bit register), SHIFT_REG (shift register)
- **Counters**: COUNT4 (4-bit counter), COUNT8 (8-bit counter), UP_DOWN_COUNT

#### Chip Types (Layer 5 - FSM & Complex Circuits)

- **FSM Components**: STATE_REG (state register), NEXT_STATE_LOGIC, OUTPUT_LOGIC
- **Controllers**: TRAFFIC_LIGHT_FSM, VENDING_MACHINE, SEQUENCE_DETECTOR
- **ALU**: ALU4 (4-bit ALU), ALU8 (8-bit ALU), SHIFTER

#### Chip Types (Layer 6 - FPGA Synthesis)

All chips from Layers 2-5, optimized for synthesis:
- Constrained to synthesis-compatible structures
- No behavioral black boxes (all structural)
- Clock domain constraints enforced

### Connection Object

Represents a wire between two nodes:

```json
{
  "id": "conn_x7y8z9",
  "from": {
    "nodeId": "node_1a2b3c",
    "pinId": "out0"
  },
  "to": {
    "nodeId": "node_4d5e6f",
    "pinId": "in0"
  },
  "metadata": {
    "signal_name": "control_enable",
    "bus_width": 1
  }
}
```

#### Connection Rules

- **Fan-out**: One output can connect to multiple inputs
- **Fan-in**: One input can only have one source (no multi-driver)
- **Cycles**: Combinational loops detected and flagged (error in Layer 2-3, allowed with clock in Layer 4-5)
- **Unconnected**: Floating inputs default to `0` (GND)

---

## Manifest Schema (`manifest.json`)

Metadata about the project:

```json
{
  "version": "1.0",
  "title": "4-Bit Ripple Carry Adder",
  "description": "A full adder circuit built from logic gates with carry propagation.",
  "author": "jdoe2025",
  "created": "2025-06-15T14:32:18Z",
  "modified": "2025-06-15T15:10:42Z",
  "lab_id": "lab-03-adder",
  "tags": ["arithmetic", "adder", "layer3"],
  "constraints": {
    "required_inputs": ["A[0:3]", "B[0:3]", "Cin"],
    "required_outputs": ["Sum[0:3]", "Cout"],
    "max_components": 25,
    "allowed_chips": ["AND", "OR", "XOR", "NOT"],
    "forbidden_chips": ["ADD4", "FULL_ADDER"]
  }
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Manifest schema version (currently `1.0`) |
| `title` | string | Human-readable project title |
| `description` | string | Detailed description (markdown supported) |
| `author` | string | Creator username or email |
| `created` | ISO 8601 | Timestamp when project was first created |
| `modified` | ISO 8601 | Timestamp of last modification |
| `lab_id` | string | (Optional) Lab assignment identifier |
| `tags` | string[] | Keywords for categorization |
| `constraints` | object | (Optional) Lab-specific constraints |

---

## Evidence Schema (`evidence.json`)

Cryptographic audit trail for tamper detection and reproducibility:

```json
{
  "version": "1.0",
  "platform": {
    "name": "RedByte OS Genesis",
    "version": "1.0.0",
    "build_hash": "a3f9c8d7b6e5"
  },
  "timestamps": {
    "export_utc": "2025-06-15T15:10:42Z",
    "simulation_start": "2025-06-15T14:55:10Z",
    "simulation_end": "2025-06-15T14:55:15Z"
  },
  "fingerprints": {
    "circuit": "sha256:e8b4f2d9a1c7...",
    "simulation": "sha256:7d3c1a5e9f8b...",
    "presets": "sha256:4a2b8e1c9d7f...",
    "hardware_session": "sha256:9f1e3c5a7d2b..."
  },
  "self_check_results": [
    {
      "preset_id": "test_vector_01",
      "label": "Adder Truth Table",
      "passed": true,
      "score": 1.0,
      "details": "16/16 test cases passed"
    }
  ],
  "hardware_session": {
    "device_id": "basys3-serial-AB12CD34",
    "firmware_version": "2.1.3",
    "deployment_timestamp": "2025-06-15T15:20:00Z",
    "test_results": {
      "passed": 8,
      "failed": 0,
      "total": 8
    }
  }
}
```

### Fingerprint Algorithm

See [Fingerprinting Algorithm](#fingerprinting-algorithm) section below.

---

## Presets Schema (`presets.json`)

Self-check test cases for lab assignments:

```json
{
  "version": "1.0",
  "presets": [
    {
      "id": "preset_001",
      "type": "test-vector",
      "label": "Adder Basic Tests",
      "description": "Exhaustive test of all 4-bit adder combinations",
      "vectors": [
        {
          "inputs": { "A": 0, "B": 0, "Cin": 0 },
          "outputs": { "Sum": 0, "Cout": 0 }
        },
        {
          "inputs": { "A": 15, "B": 15, "Cin": 1 },
          "outputs": { "Sum": 15, "Cout": 1 }
        }
      ],
      "tolerance": "exact"
    },
    {
      "id": "preset_002",
      "type": "waveform",
      "label": "Counter Timing",
      "signals": [
        { "name": "CLK", "pattern": "0101010101" },
        { "name": "Q[0]", "expected": "0011001100" },
        { "name": "Q[1]", "expected": "0000111100" }
      ],
      "tolerance_ticks": 1
    },
    {
      "id": "preset_003",
      "type": "truth-table",
      "label": "XOR Gate Check",
      "inputs": ["A", "B"],
      "outputs": ["Y"],
      "exhaustive": true
    }
  ]
}
```

### Preset Types

#### 1. Test Vector (`test-vector`)

Tests specific input/output combinations:

```json
{
  "type": "test-vector",
  "label": "Basic Adder Tests",
  "vectors": [
    { "inputs": { "A": 3, "B": 5, "Cin": 0 }, "outputs": { "Sum": 8, "Cout": 0 } }
  ],
  "tolerance": "exact" // or "±1", "±10%", etc.
}
```

#### 2. Waveform (`waveform`)

Tests timing and sequential behavior:

```json
{
  "type": "waveform",
  "label": "Clock Sequence",
  "signals": [
    { "name": "CLK", "pattern": "01010101" },
    { "name": "Q", "expected": "00110011" }
  ],
  "tolerance_ticks": 1
}
```

#### 3. Truth Table (`truth-table`)

Exhaustive or sampled truth table verification:

```json
{
  "type": "truth-table",
  "label": "Logic Function",
  "inputs": ["A", "B", "C"],
  "outputs": ["Y"],
  "exhaustive": true // Tests all 2^3 = 8 combinations
}
```

#### 4. Board I/O (`board-io`)

Hardware pin mapping verification:

```json
{
  "type": "board-io",
  "label": "Basys3 Mapping",
  "board": "basys3",
  "required_mappings": {
    "SW[0:7]": "inputs",
    "LED[0:7]": "outputs",
    "BTN[0:4]": "controls"
  }
}
```

---

## Waveform Schema (`waveform.json`)

Simulation trace data for reproducibility:

```json
{
  "version": "1.0",
  "metadata": {
    "start_time": "2025-06-15T14:55:10Z",
    "end_time": "2025-06-15T14:55:15Z",
    "total_ticks": 1000,
    "clock_period_ns": 10
  },
  "signals": [
    {
      "id": "node_1a2b3c.out0",
      "name": "control_enable",
      "type": "digital",
      "data": [0, 0, 1, 1, 1, 0, 0, 1, ...]
    },
    {
      "id": "node_4d5e6f.out0",
      "name": "counter[0]",
      "type": "digital",
      "data": [0, 1, 0, 1, 0, 1, ...]
    }
  ]
}
```

### Signal Data Encoding

- **Digital**: Array of `0` and `1` (one per tick)
- **Bus**: Array of integers (e.g., `[0, 1, 2, 3, 4, ...]` for counter)
- **Analog**: Array of floats (for future mixed-signal support)

---

## FPGA Artifacts

### Verilog Module (`fpga/verilog/top.v`)

Synthesizable Verilog generated from circuit:

```verilog
`timescale 1ns / 1ps

module top (
    input wire CLK,
    input wire RST,
    input wire [7:0] SW,
    output wire [7:0] LED
);

    // Internal signals
    wire enable;
    wire [3:0] counter;

    // Logic implementation
    assign enable = SW[0];
    
    counter_4bit u_counter (
        .clk(CLK),
        .rst(RST),
        .enable(enable),
        .count(counter)
    );

    assign LED[3:0] = counter;
    assign LED[7:4] = 4'b0000;

endmodule
```

### XDC Constraints (`fpga/constraints.xdc`)

Pin mappings for Basys3/Nexys4 boards:

```tcl
## Clock Signal (Basys3: 100 MHz)
set_property -dict { PACKAGE_PIN W5   IOSTANDARD LVCMOS33 } [get_ports CLK]
create_clock -add -name sys_clk_pin -period 10.00 [get_ports CLK]

## Switches
set_property -dict { PACKAGE_PIN V17  IOSTANDARD LVCMOS33 } [get_ports {SW[0]}]
set_property -dict { PACKAGE_PIN V16  IOSTANDARD LVCMOS33 } [get_ports {SW[1]}]
# ... (SW[2] through SW[7])

## LEDs
set_property -dict { PACKAGE_PIN U16  IOSTANDARD LVCMOS33 } [get_ports {LED[0]}]
set_property -dict { PACKAGE_PIN E19  IOSTANDARD LVCMOS33 } [get_ports {LED[1]}]
# ... (LED[2] through LED[7])

## Buttons
set_property -dict { PACKAGE_PIN U18  IOSTANDARD LVCMOS33 } [get_ports RST]
```

---

## Fingerprinting Algorithm

### Circuit Fingerprint

**Purpose**: Detect any changes to circuit topology (nodes, connections, chip types)

**Algorithm**:
```typescript
function computeCircuitFingerprint(circuit: Circuit): string {
  // 1. Canonicalize node order (sort by ID)
  const sortedNodes = circuit.nodes.sort((a, b) => a.id.localeCompare(b.id));
  
  // 2. Extract stable properties (ignore positions, labels)
  const stableData = sortedNodes.map(node => ({
    id: node.id,
    type: node.type,
    chipType: node.chipType,
    layer: node.layer,
    inputs: node.inputs.map(pin => pin.id),
    outputs: node.outputs.map(pin => pin.id)
  }));
  
  // 3. Canonicalize connection order
  const sortedConnections = circuit.connections.sort((a, b) => 
    `${a.from.nodeId}.${a.from.pinId}-${a.to.nodeId}.${a.to.pinId}`
      .localeCompare(`${b.from.nodeId}.${b.from.pinId}-${b.to.nodeId}.${b.to.pinId}`)
  );
  
  // 4. Combine and hash
  const payload = JSON.stringify({ nodes: stableData, connections: sortedConnections });
  return `sha256:${sha256(payload)}`;
}
```

**Invariant Properties** (changes trigger new fingerprint):
- Node IDs, chip types, layers
- Input/output pin configurations
- Connection topology (from/to relationships)

**Ignored Properties** (do NOT affect fingerprint):
- Node positions (x, y)
- Node labels or descriptions
- Visual styling (colors, sizes)

### Simulation Fingerprint

**Purpose**: Verify simulation results haven't been tampered with

**Algorithm**:
```typescript
function computeSimulationFingerprint(waveform: Waveform): string {
  // 1. Canonicalize signal order (sort by signal name)
  const sortedSignals = waveform.signals.sort((a, b) => a.name.localeCompare(b.name));
  
  // 2. Extract tick-by-tick data
  const payload = sortedSignals.map(signal => ({
    name: signal.name,
    data: signal.data // Full waveform array
  }));
  
  // 3. Hash
  return `sha256:${sha256(JSON.stringify(payload))}`;
}
```

### Hardware Session Fingerprint

**Purpose**: Verify FPGA test results

**Algorithm**:
```typescript
function computeHardwareFingerprint(session: HardwareSession): string {
  const payload = {
    device_id: session.device_id,
    firmware: session.firmware_version,
    circuit_fingerprint: session.circuit_fingerprint, // Link to circuit
    test_results: session.test_results.map(test => ({
      inputs: test.inputs,
      expected: test.expected,
      actual: test.actual,
      passed: test.passed
    }))
  };
  return `sha256:${sha256(JSON.stringify(payload))}`;
}
```

---

## Version Compatibility

### Schema Versioning

All schemas use semantic versioning (`MAJOR.MINOR`):

- **MAJOR**: Breaking changes (old exports won't load)
- **MINOR**: Backward-compatible additions (new fields, optional properties)

**Current Versions**:
- `circuit.json`: v2.0
- `manifest.json`: v1.0
- `evidence.json`: v1.0
- `presets.json`: v1.0
- `waveform.json`: v1.0

### Backward Compatibility

RedByte OS v1.0.0 can import:
- Circuit v2.0 (current)
- Circuit v1.x (legacy, auto-migrated)

**Migration Process**:
```typescript
if (circuit.version === "1.0") {
  // Migrate v1 to v2
  circuit.nodes = migrateNodesV1toV2(circuit.nodes);
  circuit.connections = migrateConnectionsV1toV2(circuit.connections);
  circuit.version = "2.0";
}
```

### Forward Compatibility

Older platforms **cannot** load newer schemas:
- Attempting to load v3.0 circuit in v1.0.0 platform → Error: "Unsupported circuit version"

---

## Export/Import API

### Exporting from Platform

**JavaScript API**:
```typescript
import { exportCircuit } from '@redbyte/rb-apps';

const result = await exportCircuit({
  circuit: myCircuit,
  includeWaveform: true,
  includeFPGA: true,
  evidence: {
    author: "jdoe2025",
    lab_id: "lab-03-adder"
  }
});

// result.blob: Blob (ZIP file)
// result.fingerprints: { circuit, simulation, ... }
downloadBlob(result.blob, 'my-circuit.rbx.zip');
```

### Importing into Platform

**JavaScript API**:
```typescript
import { importCircuit } from '@redbyte/rb-apps';

const file = document.querySelector('input[type=file]').files[0];
const result = await importCircuit(file);

// result.circuit: Circuit object
// result.manifest: Manifest metadata
// result.evidence: Evidence audit trail
// result.valid: boolean (fingerprint verification)

if (!result.valid) {
  console.warn('Fingerprint mismatch! Circuit may have been tampered with.');
}
```

---

## Additional Resources

- **Instructor Guide**: [INSTRUCTOR_GUIDE.md](./INSTRUCTOR_GUIDE.md)
- **Example Catalog**: [EXAMPLES_CATALOG.md](./EXAMPLES_CATALOG.md)
- **Deployment Notes**: [DEPLOYMENT_NOTES.md](./DEPLOYMENT_NOTES.md)
- **User Manual**: [REDBYTE_USER_MANUAL.md](./REDBYTE_USER_MANUAL.md)
- **FPGA Validation**: [docs/fpga-validation-guide.md](./docs/fpga-validation-guide.md)

---

**Copyright © 2025 Connor Angiel — RedByte OS Genesis**  
*Use without permission prohibited. Licensed under the RedByte Proprietary License (RPL-1.0).*
