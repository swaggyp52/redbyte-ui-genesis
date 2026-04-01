import { describe, expect, it } from 'vitest';
import { elaborateCircuit } from '@redbyte/rb-logic-core';
import { canonicalizeSemanticCircuit } from '../circuit/semanticCircuit';
import { computeDesignIssues } from '../apps/ide/designIssues';
import type { Circuit } from '@redbyte/rb-logic-core';

/**
 * P2 Design-time feedback tests.
 *
 * These verify that structural circuit problems are surfaced during authoring
 * (Design phase) rather than first appearing at Export or Verify time.
 */

/** Builds a simple combinational loop: NOT gate feeding back into itself through an AND gate. */
function makeCombLoopCircuit(): Circuit {
  return {
    nodes: [
      { id: 'sw0', type: 'Switch', label: 'sw0', x: 0, y: 0, config: {}, state: { isOn: 0 } },
      { id: 'and1', type: 'AND', label: 'and1', x: 100, y: 0, config: {}, state: {} },
      { id: 'not1', type: 'NOT', label: 'not1', x: 200, y: 0, config: {}, state: {} },
      { id: 'led0', type: 'Lamp', label: 'led0', x: 300, y: 0, config: {}, state: {} },
    ],
    connections: [
      { id: 'c1', from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'and1', portName: 'a' } },
      { id: 'c2', from: { nodeId: 'and1', portName: 'out' }, to: { nodeId: 'not1', portName: 'in' } },
      // Feedback loop: NOT output wired back to AND input b
      { id: 'c3', from: { nodeId: 'not1', portName: 'out' }, to: { nodeId: 'and1', portName: 'b' } },
      { id: 'c4', from: { nodeId: 'not1', portName: 'out' }, to: { nodeId: 'led0', portName: 'in' } },
    ],
  };
}

/** Builds a circuit with multiple drivers on one input port. */
function makeMultiDriverCircuit(): Circuit {
  return {
    nodes: [
      { id: 'sw0', type: 'Switch', label: 'sw0', x: 0, y: 0, config: {}, state: { isOn: 0 } },
      { id: 'sw1', type: 'Switch', label: 'sw1', x: 0, y: 80, config: {}, state: { isOn: 0 } },
      { id: 'led0', type: 'Lamp', label: 'led0', x: 200, y: 40, config: {}, state: {} },
    ],
    connections: [
      // Both switches drive the same Lamp input — conflict
      { id: 'c1', from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'led0', portName: 'in' } },
      { id: 'c2', from: { nodeId: 'sw1', portName: 'out' }, to: { nodeId: 'led0', portName: 'in' } },
    ],
  };
}

/** Builds a circuit with a floating output (Lamp not wired). */
function makeFloatingOutputCircuit(): Circuit {
  return {
    nodes: [
      { id: 'sw0', type: 'Switch', label: 'sw0', x: 0, y: 0, config: {}, state: { isOn: 0 } },
      { id: 'led0', type: 'Lamp', label: 'led0', x: 200, y: 0, config: {}, state: {} },
    ],
    connections: [],
  };
}

/** Builds a healthy combinational circuit (no issues). */
function makeHealthyCircuit(): Circuit {
  return {
    nodes: [
      { id: 'sw0', type: 'Switch', label: 'sw0', x: 0, y: 0, config: {}, state: { isOn: 0 } },
      { id: 'not1', type: 'NOT', label: 'not1', x: 100, y: 0, config: {}, state: {} },
      { id: 'led0', type: 'Lamp', label: 'led0', x: 200, y: 0, config: {}, state: {} },
    ],
    connections: [
      { id: 'c1', from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'not1', portName: 'in' } },
      { id: 'c2', from: { nodeId: 'not1', portName: 'out' }, to: { nodeId: 'led0', portName: 'in' } },
    ],
  };
}

describe('P2 design-time feedback: combinational loop IR006', () => {
  it('combinational loop emits IR006 error from elaborator at design time', () => {
    const circuit = makeCombLoopCircuit();
    const semantic = canonicalizeSemanticCircuit(circuit);
    const { ir } = elaborateCircuit(semantic);

    expect(ir.features.hasCombinationalLoop).toBe(true);

    const ir006 = ir.diagnostics.find((d) => d.code === 'IR006');
    expect(ir006).toBeDefined();
    expect(ir006!.severity).toBe('error');
    expect(ir006!.message).toMatch(/combinational feedback loop/i);
    expect(ir006!.nodeId).toBeDefined();
  });

  it('healthy circuit has no IR006', () => {
    const circuit = makeHealthyCircuit();
    const semantic = canonicalizeSemanticCircuit(circuit);
    const { ir } = elaborateCircuit(semantic);

    expect(ir.features.hasCombinationalLoop).toBe(false);
    expect(ir.diagnostics.find((d) => d.code === 'IR006')).toBeUndefined();
  });
});

describe('P2 design-time feedback: authoring issues (designIssues)', () => {
  it('multiple drivers detected as blocking error', () => {
    const issues = computeDesignIssues(makeMultiDriverCircuit());
    const multiDriver = issues.all.find((i) => i.kind === 'multiple-drivers');

    expect(multiDriver).toBeDefined();
    expect(multiDriver!.severity).toBe('error');
    expect(multiDriver!.blocking).toBe(true);
  });

  it('floating output detected as draft', () => {
    const issues = computeDesignIssues(makeFloatingOutputCircuit());
    const floating = issues.all.find((i) => i.kind === 'floating-output');

    expect(floating).toBeDefined();
    expect(floating!.severity).toBe('draft');
    expect(floating!.blocking).toBe(false);
  });

  it('healthy circuit produces no errors', () => {
    const issues = computeDesignIssues(makeHealthyCircuit());
    const errors = issues.all.filter((i) => i.severity === 'error');

    expect(errors).toHaveLength(0);
  });

  it('combinational loop circuit still reports issues through designIssues', () => {
    // designIssues only checks port-level connectivity, not structural loops.
    // The loop itself is caught by the IR elaborator (IR006), not designIssues.
    // This test confirms designIssues doesn't crash on loop circuits.
    const issues = computeDesignIssues(makeCombLoopCircuit());
    // No multi-driver or floating issues expected — the circuit is wired correctly
    // but has a feedback topology issue caught at IR level.
    expect(issues.all.filter((i) => i.severity === 'error')).toHaveLength(0);
  });
});

describe('P2 design-time feedback: downstream alignment', () => {
  it('IR006 from combinational loop blocks IR validity', () => {
    const circuit = makeCombLoopCircuit();
    const { ir } = elaborateCircuit(canonicalizeSemanticCircuit(circuit));

    // IR006 is severity error → blocks
    expect(ir.blockingDiagnosticCount).toBeGreaterThan(0);
    expect(ir.isValid).toBe(false);
  });

  it('healthy circuit remains valid', () => {
    const circuit = makeHealthyCircuit();
    const { ir } = elaborateCircuit(canonicalizeSemanticCircuit(circuit));

    // No errors except possibly IR003/IR005 (not applicable here)
    const blockingNonFloating = ir.diagnostics.filter(
      (d) => d.severity === 'error' && d.code !== 'IR003'
    );
    expect(blockingNonFloating).toHaveLength(0);
  });
});
