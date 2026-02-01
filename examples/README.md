# RedByte Examples Library

This directory contains canonical example projects shipped with RedByte OS Genesis.

## Purpose

Example projects are **fully exportable, verified, lab-ready** circuit designs that:
- Demonstrate circuit design patterns
- Teach digital logic concepts
- Serve as starting points for student work
- Include probes, IO mappings, and recordings for reproducibility

## Structure

Each example is a complete LabProjectV1 that can be:
1. Loaded via `rb://demo/{example-id}` URI
2. Exported as `.rbx.zip` for sharing
3. Opened in Logic Playground, ECE Lab, or Virtual Lab

## Example Catalog

### Layer 0: Foundation
- `01_wire-lamp` - Basic power source and lamp connection
- `02_and-gate` - Two switches with AND logic
- `15_not-gate` - Inverter (NOT gate) demonstration

### Layer 1: Combinational Logic
- `03_half-adder` - 1-bit half adder (sum and carry)
- `06_xor-gate` - XOR built from NAND gates
- `07_2to1-mux` - 2-to-1 multiplexer

### Layer 2: Arithmetic & Logic
- `08_full-adder` - 1-bit full adder with carry-in
- `09_4bit-adder` - 4-bit ripple carry adder

### Layer 3: Memory & State
- `10_sr-latch` - SR latch (basic memory)
- `11_d-flipflop` - D flip-flop with clock
- `04_4bit-counter` - 4-bit binary counter

### Layer 4: Control & Coordination
- `12_2to4-decoder` - 2-to-4 decoder
- `13_4to1-mux` - 4-to-1 multiplexer

### Layer 5: Memory Systems
- `14_4bit-register` - 4-bit register

### Layer 6: Simple Processors
- `05_simple-cpu` - Basic CPU with ALU

## Loading Examples

### From Shell Command Palette
1. Open Command Palette (Cmd/Ctrl+Shift+P)
2. Type "Open Example"
3. Select example from list

### From Logic Playground
1. Open Logic Playground
2. Click Examples button in top bar
3. Browse and select example

### From URI
Navigate to: `http://localhost:5173/?openApp=logic-playground&exampleId=03_half-adder`

## Export Format

Examples are stored as source JSON (legacy circuit format) and can be exported to `.rbx.zip` (LabProjectV1 evidence capsule format) with:
- Full circuit definition
- Probe configurations
- IO mappings for FPGA boards
- Deterministic recordings
- Integrity manifests

## Adding New Examples

1. Create circuit in Logic Playground
2. Add probes and IO mappings
3. Record verification run
4. Export as `.rbx.zip`
5. Add entry to `packages/rb-apps/src/examples/index.ts`
6. Update this README

## Copyright

Copyright © 2025 Connor Angiel — RedByte OS Genesis
