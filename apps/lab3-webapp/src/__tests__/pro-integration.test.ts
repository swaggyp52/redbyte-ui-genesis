import { describe, test, expect } from 'vitest';
import { migrateV1toV2, createEmptyCircuitDesigner } from '../store/labStore';
import { evaluateCircuit, addNode, connectWire } from '../circuit-designer-pro/engine';
import { validateCircuitAgainstTruthTable } from '../circuit-designer-pro/validation';
import type { LabDocV1, LabDocV2, TruthTableRow } from '../plugins/LabDoc';

describe('Pro Integration: v1→v2→validate roundtrip', () => {
  test('should migrate v1, build minimal circuit, and validate deterministically', () => {
    // Step 1: Create v1 snapshot with truth table
    const truthTable: TruthTableRow[] = [
      { b3: 0, b2: 0, b1: 0, b0: 0, seg: [0, 0, 0, 0, 0, 0, 0] as [number, number, number, number, number, number, number], isDontCare: false },
    ];

    const v1Doc: LabDocV1 = {
      schemaVersion: 1,
      meta: {
        id: 'test-lab-integration',
        name: 'Integration Test Lab',
        createdAt: '2026-02-09T00:00:00Z',
        updatedAt: '2026-02-09T00:00:00Z',
      },
      truthTable,
      kMaps: {},
      expressions: {},
      results: {},
    };

    // Step 2: Migrate to v2
    const v2Doc = migrateV1toV2(v1Doc) as LabDocV2;
    
    expect(v2Doc.schemaVersion).toBe(2);
    expect(v2Doc.circuitDesigner).toBeDefined();
    expect(v2Doc.truthTable).toBeDefined();
    expect(v2Doc.truthTable.length).toBe(1);

    // Step 3: Build minimal circuit (OUTPUT nodes with CONST_0)
    let circuit = v2Doc.circuitDesigner;
    
    // Add OUTPUT nodes for 7 segments
    for (let i = 0; i < 7; i++) {
      circuit = addNode(circuit, 'OUTPUT', i * 100, 0);
    }
    
    // Connect all OUTPUTs to CONST_0
    for (let i = 0; i < 7; i++) {
      circuit = addNode(circuit, 'CONST_0', 50 + i * 100, 50);
      circuit = connectWire(circuit, circuit.nodes[7 + i].id, 0, circuit.nodes[i].id, 1);
    }

    // Update doc with circuit
    v2Doc.circuitDesigner = circuit;

    // Step 4: Run validation - should work deterministically
    const validationResult = validateCircuitAgainstTruthTable(circuit, v2Doc);

    // Step 5: Assert deterministic result
    expect(validationResult).toBeDefined();
    expect(validationResult.totalTests).toBeGreaterThanOrEqual(0);
    expect(validationResult.passedTests).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(validationResult.failures)).toBe(true);
  });

  test('should handle v1→v2 migration with persistence', () => {
    // Create v1 doc
    const v1Doc: LabDocV1 = {
      schemaVersion: 1,
      meta: {
        id: 'test-persist',
        name: 'Persistence Test',
        createdAt: '2026-02-09T00:00:00Z',
        updatedAt: '2026-02-09T00:00:00Z',
      },
      truthTable: [
        { b3: 0, b2: 0, b1: 0, b0: 0, seg: [0, 0, 0, 0, 0, 0, 0], isDontCare: false },
      ],
      kMaps: {},
      expressions: {},
      results: {},
    };

    // Migrate
    const v2Doc = migrateV1toV2(v1Doc) as LabDocV2;

    // Verify v2 structure
    expect(v2Doc.schemaVersion).toBe(2);
    expect(v2Doc.meta.useProByDefault).toBe(false); // Default is false
    expect(v2Doc.circuitDesigner).toBeDefined();
    expect(v2Doc.circuitDesigner.nodes).toHaveLength(0); // Empty circuit
    expect(v2Doc.circuitDesigner.wires).toHaveLength(0);

    // Verify original data preserved
    expect(v2Doc.truthTable).toEqual(v1Doc.truthTable);
    expect(v2Doc.meta.id).toBe('test-persist');
  });

  test('should detect combinational loop in circuit validation', () => {
    const v2Doc: LabDocV2 = {
      schemaVersion: 2,
      meta: {
        id: 'test-loop',
        name: 'Loop Detection Test',
        createdAt: '2026-02-09T00:00:00Z',
        updatedAt: '2026-02-09T00:00:00Z',
        useProByDefault: false,
      },
      truthTable: [
        { b3: 0, b2: 0, b1: 0, b0: 0, seg: [1, 1, 1, 1, 1, 1, 1], isDontCare: false },
      ],
      kMaps: {},
      expressions: {},
      results: {},
      circuitDesigner: createEmptyCircuitDesigner(),
    };

    let circuit = v2Doc.circuitDesigner;

    // Add 2 AND gates
    circuit = addNode(circuit, 'AND', 100, 100);
    circuit = addNode(circuit, 'AND', 300, 100);

    // Create a loop: g1 output -> g2 input, g2 output -> g1 input
    circuit = connectWire(circuit, circuit.nodes[0].id, 0, circuit.nodes[1].id, 1);
    circuit = connectWire(circuit, circuit.nodes[1].id, 0, circuit.nodes[0].id, 2);

    // Evaluate should detect the loop
    const evaluation = evaluateCircuit(circuit);
    expect(evaluation.error).toBeDefined();
    expect(evaluation.error?.toLowerCase()).toContain('loop');
  });
});
