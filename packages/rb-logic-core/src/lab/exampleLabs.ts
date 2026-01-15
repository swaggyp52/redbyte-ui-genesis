// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { SerializedCircuitV1 } from '../types';
import { createTestVector, createCheckpoint, createLabDef, type LabDef } from './LabDefinition';

/**
 * Example Labs for ECE Lab MVP
 * Starter circuit examples with checkpoint definitions
 */

// Empty circuit template for student to build from scratch
const emptyCircuit: SerializedCircuitV1 = {
  nodes: [],
  connections: [],
};

// ============================================================================
// LAB 1: Hello Gates - Introduction to AND/OR/NOT
// ============================================================================

const lab1_helloGates: LabDef = createLabDef(
  'lab-001-hello-gates',
  'Hello Gates: AND/OR/NOT Introduction',
  `
# Hello Gates

Build your first logic gates! In this lab, you'll create basic AND, OR, and NOT gates and verify they work correctly.

## Objectives
1. Create an AND gate that outputs 1 only when both inputs are 1
2. Create an OR gate that outputs 1 when either input is 1
3. Create a NOT gate that inverts its input

## Instructions
1. Drag INPUT nodes onto the canvas for your gate inputs
2. Drag gate nodes (AND, OR, NOT) from the palette
3. Connect inputs to gates using wires
4. Add OUTPUT nodes to see the results
5. Toggle the INPUT switches to test different input combinations
6. Click "Run Checks" to validate your gates

## Tips
- Use the Probe tool to inspect signal values in real-time
- The Oscilloscope view shows signal timing
- Right-click nodes to delete them
- Press Esc to cancel wire drawing
  `,
  emptyCircuit,
  [
    createCheckpoint(
      'cp1-hello-and',
      'AND Gate Test',
      [
        createTestVector('tv1', 'Both 0', { in1: [0], in2: [0] }, { out: [0] }),
        createTestVector('tv2', 'First 1', { in1: [1], in2: [0] }, { out: [0] }),
        createTestVector('tv3', 'Second 1', { in1: [0], in2: [1] }, { out: [0] }),
        createTestVector('tv4', 'Both 1', { in1: [1], in2: [1] }, { out: [1] }),
      ],
      [{ gateName: 'AND', minCount: 1 }]
    ),
    createCheckpoint(
      'cp2-hello-or',
      'OR Gate Test',
      [
        createTestVector('tv1', 'Both 0', { in1: [0], in2: [0] }, { out: [0] }),
        createTestVector('tv2', 'First 1', { in1: [1], in2: [0] }, { out: [1] }),
        createTestVector('tv3', 'Second 1', { in1: [0], in2: [1] }, { out: [1] }),
        createTestVector('tv4', 'Both 1', { in1: [1], in2: [1] }, { out: [1] }),
      ],
      [{ gateName: 'OR', minCount: 1 }]
    ),
    createCheckpoint(
      'cp3-hello-not',
      'NOT Gate Test',
      [
        createTestVector('tv1', 'Input 0', { in: [0] }, { out: [1] }),
        createTestVector('tv2', 'Input 1', { in: [1] }, { out: [0] }),
      ],
      [{ gateName: 'NOT', minCount: 1 }]
    ),
  ]
);

// ============================================================================
// LAB 2: XOR Gate - Building Composite Logic
// ============================================================================

const lab2_xorGate: LabDef = createLabDef(
  'lab-002-xor-gate',
  'XOR Gate: Composite Logic',
  `
# XOR Gate

Build an XOR (exclusive OR) gate from AND, OR, and NOT gates.

## What is XOR?
XOR outputs 1 when exactly one input is 1 (not both, not neither).

## Circuit Design
XOR = (A AND NOT B) OR (NOT A AND B)

## Instructions
1. Create the circuit using the formula above
2. Test all 4 input combinations
3. Click "Run Checks" to validate

## Expected Behavior
- 0 XOR 0 = 0
- 0 XOR 1 = 1
- 1 XOR 0 = 1
- 1 XOR 1 = 0
  `,
  emptyCircuit,
  [
    createCheckpoint(
      'cp1-xor-test',
      'XOR Behavior Test',
      [
        createTestVector('tv1', '0 XOR 0 = 0', { a: [0], b: [0] }, { out: [0] }),
        createTestVector('tv2', '0 XOR 1 = 1', { a: [0], b: [1] }, { out: [1] }),
        createTestVector('tv3', '1 XOR 0 = 1', { a: [1], b: [0] }, { out: [1] }),
        createTestVector('tv4', '1 XOR 1 = 0', { a: [1], b: [1] }, { out: [0] }),
      ],
      [
        { gateName: 'AND', minCount: 2 },
        { gateName: 'OR', minCount: 1 },
        { gateName: 'NOT', minCount: 2 },
      ]
    ),
  ]
);

// ============================================================================
// LAB 3: Half Adder - Two-Bit Addition
// ============================================================================

const lab3_halfAdder: LabDef = createLabDef(
  'lab-003-half-adder',
  'Half Adder: Two-Bit Addition',
  `
# Half Adder

Build a Half Adder circuit that adds two 1-bit numbers and produces a sum and carry out.

## Truth Table
| A | B | Sum | Carry |
|---|---|-----|-------|
| 0 | 0 |  0  |   0   |
| 0 | 1 |  1  |   0   |
| 1 | 0 |  1  |   0   |
| 1 | 1 |  0  |   1   |

## Circuit Design
- Sum = A XOR B
- Carry = A AND B

## Instructions
1. Implement the Sum output using XOR
2. Implement the Carry output using AND
3. Test all 4 combinations
4. Run Checks to validate

## Hint
You can use the XOR gate as a composite building block!
  `,
  emptyCircuit,
  [
    createCheckpoint(
      'cp1-half-adder',
      'Half Adder Full Test',
      [
        createTestVector('tv1', '0+0=0,C0', { a: [0], b: [0] }, { sum: [0], carry: [0] }),
        createTestVector('tv2', '0+1=1,C0', { a: [0], b: [1] }, { sum: [1], carry: [0] }),
        createTestVector('tv3', '1+0=1,C0', { a: [1], b: [0] }, { sum: [1], carry: [0] }),
        createTestVector('tv4', '1+1=0,C1', { a: [1], b: [1] }, { sum: [0], carry: [1] }),
      ],
      [{ gateName: 'AND', minCount: 1 }]
    ),
  ]
);

// ============================================================================
// LAB 4: Full Adder - Complete Addition with Carry
// ============================================================================

const lab4_fullAdder: LabDef = createLabDef(
  'lab-004-full-adder',
  'Full Adder: Complete 1-Bit Addition',
  `
# Full Adder

Build a Full Adder that adds two 1-bit numbers plus a carry-in bit.

## Truth Table
| A | B | Cin | Sum | Cout |
|---|---|-----|-----|------|
| 0 | 0 |  0  |  0  |  0   |
| 0 | 0 |  1  |  1  |  0   |
| 0 | 1 |  0  |  1  |  0   |
| 0 | 1 |  1  |  0  |  1   |
| 1 | 0 |  0  |  1  |  0   |
| 1 | 0 |  1  |  0  |  1   |
| 1 | 1 |  0  |  0  |  1   |
| 1 | 1 |  1  |  1  |  1   |

## Circuit Design
- Sum = A XOR B XOR Cin
- Cout = (A AND B) OR (Cin AND (A XOR B))

## Instructions
1. Build the Full Adder from Half Adder components or basic gates
2. Test all 8 input combinations
3. Run Checks to validate
  `,
  emptyCircuit,
  [
    createCheckpoint(
      'cp1-full-adder',
      'Full Adder Complete Test',
      [
        createTestVector('tv1', '0+0+0', { a: [0], b: [0], cin: [0] }, { sum: [0], cout: [0] }),
        createTestVector('tv2', '0+0+1', { a: [0], b: [0], cin: [1] }, { sum: [1], cout: [0] }),
        createTestVector('tv3', '0+1+0', { a: [0], b: [1], cin: [0] }, { sum: [1], cout: [0] }),
        createTestVector('tv4', '0+1+1', { a: [0], b: [1], cin: [1] }, { sum: [0], cout: [1] }),
        createTestVector('tv5', '1+0+0', { a: [1], b: [0], cin: [0] }, { sum: [1], cout: [0] }),
        createTestVector('tv6', '1+0+1', { a: [1], b: [0], cin: [1] }, { sum: [0], cout: [1] }),
        createTestVector('tv7', '1+1+0', { a: [1], b: [1], cin: [0] }, { sum: [0], cout: [1] }),
        createTestVector('tv8', '1+1+1', { a: [1], b: [1], cin: [1] }, { sum: [1], cout: [1] }),
      ]
    ),
  ]
);

// ============================================================================
// Export Lab Library
// ============================================================================

/**
 * Built-in lab library with starter examples
 */
export const defaultLabLibrary = [
  lab1_helloGates,
  lab2_xorGate,
  lab3_halfAdder,
  lab4_fullAdder,
];

/**
 * Get lab by ID from default library
 */
export function getDefaultLab(labId: string): LabDef | undefined {
  return defaultLabLibrary.find((lab) => lab.id === labId);
}

/**
 * Get all labs from default library
 */
export function getDefaultLabs(): LabDef[] {
  return defaultLabLibrary;
}
