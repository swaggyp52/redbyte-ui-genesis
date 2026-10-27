/**
 * B-12 Slice 1 — detectVerifyMode unit tests
 *
 * Verifies that circuit mode detection is:
 * - combinational for circuits with no stateful behavior (including clock-only inputs)
 * - sequential for circuits with supported stateful elements
 * - blocked for circuits with explicitly unsupported node types
 */
import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import {
  BLOCKED_VERIFY_NODE_TYPES,
  describeVerifyBlocker,
  detectVerifyMode,
  findVerifyBlockers,
  SUPPORTED_SEQUENTIAL,
  unsimulatedRunRefusal,
} from '../verifyMode';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCircuit(nodeTypes: string[]): Circuit {
  return {
    nodes: nodeTypes.map((type, i) => ({
      id: `n${i}`,
      type,
      position: { x: i * 100, y: 0 },
      rotation: 0,
      config: {},
      state: {},
    })),
    connections: [],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('detectVerifyMode — combinational', () => {
  it('returns combinational for an empty circuit', () => {
    expect(detectVerifyMode(makeCircuit([]))).toBe('combinational');
  });

  it('returns combinational for a circuit with only logic gates', () => {
    expect(detectVerifyMode(makeCircuit(['AND', 'OR', 'NOT']))).toBe('combinational');
  });

  it('returns combinational for a circuit with INPUT and OUTPUT but no stateful nodes', () => {
    expect(detectVerifyMode(makeCircuit(['INPUT', 'OUTPUT']))).toBe('combinational');
  });

  it('returns combinational for a circuit with a clock-role INPUT but no flip-flops', () => {
    // An INPUT node labeled CLK does not make a circuit sequential — only stateful
    // elements (DFlipFlop etc.) do.
    const circuit: Circuit = {
      nodes: [
        { id: 'clk', type: 'INPUT', label: 'CLK', position: { x: 0, y: 0 }, rotation: 0, config: {}, state: {} },
        { id: 'sw', type: 'INPUT', label: 'SW0', position: { x: 0, y: 80 }, rotation: 0, config: {}, state: {} },
        { id: 'and', type: 'AND', position: { x: 100, y: 40 }, rotation: 0, config: {}, state: {} },
      ],
      connections: [],
    };
    expect(detectVerifyMode(circuit)).toBe('combinational');
  });
});

describe('detectVerifyMode — sequential', () => {
  it('returns sequential for a circuit with a DFlipFlop', () => {
    expect(detectVerifyMode(makeCircuit(['DFlipFlop']))).toBe('sequential');
  });

  it('returns sequential for a mixed circuit: DFlipFlop + combinational gates', () => {
    expect(detectVerifyMode(makeCircuit(['AND', 'DFlipFlop', 'OR']))).toBe('sequential');
  });

  it('returns sequential when hdlScheduleHint is clocked_macro and no stateful nodes', () => {
    // HDL import path: the circuit graph may not carry DFF nodes directly,
    // but the schedule hint from a prior run indicates sequential behavior.
    expect(detectVerifyMode(makeCircuit(['AND', 'OR']), 'clocked_macro')).toBe('sequential');
  });

  it('returns combinational when hdlScheduleHint is combinational', () => {
    // Other schedule hints do not force sequential mode.
    expect(detectVerifyMode(makeCircuit([]), 'combinational')).toBe('combinational');
  });
});

describe('detectVerifyMode — blocked', () => {
  it('returns blocked for a circuit with Counter4Bit', () => {
    expect(detectVerifyMode(makeCircuit(['Counter4Bit']))).toBe('blocked');
  });

  it('blocked wins when a blocked type is present alongside a supported type', () => {
    expect(detectVerifyMode(makeCircuit(['DFlipFlop', 'Counter4Bit']))).toBe('blocked');
  });

  it('blocked wins even if hdlScheduleHint is clocked_macro', () => {
    expect(detectVerifyMode(makeCircuit(['Counter4Bit']), 'clocked_macro')).toBe('blocked');
  });

  it('returns blocked for a combinational part the engine does not simulate (MUX4)', () => {
    expect(detectVerifyMode(makeCircuit(['INPUT', 'MUX4', 'OUTPUT']))).toBe('blocked');
    expect(detectVerifyMode(makeCircuit(['DFlipFlop', 'MUX4']))).toBe('blocked');
  });

  it('does not newly block boundary parts the registry does not simulate (Button, CLOCK)', () => {
    expect(detectVerifyMode(makeCircuit(['Button', 'AND', 'OUTPUT']))).toBe('combinational');
    expect(detectVerifyMode(makeCircuit(['CLOCK', 'DFlipFlop']))).toBe('sequential');
  });
});

describe('verify blockers name the part', () => {
  const labelled = (nodes: Array<[string, string, string?]>): Circuit => ({
    nodes: nodes.map(([id, type, label]) => ({ id, type, label, position: { x: 0, y: 0 }, rotation: 0, config: {}, state: {} })),
    connections: [],
  });

  it('groups each blocked type with its nodes in circuit order', () => {
    const circuit = labelled([['sw0', 'INPUT', 'SW0'], ['m0', 'MUX4', 'MUX[0]'], ['d', 'Delay'], ['m1', 'MUX4', 'MUX[1]']]);
    const blockers = findVerifyBlockers(circuit);
    expect(blockers).toEqual([
      { type: 'MUX4', label: '4:1 multiplexer', simulated: false, nodes: [{ id: 'm0', label: 'MUX[0]' }, { id: 'm1', label: 'MUX[1]' }] },
      { type: 'Delay', label: 'delay', simulated: true, nodes: [{ id: 'd', label: 'd' }] },
    ]);
    expect(describeVerifyBlocker(blockers[0])).toBe('4:1 multiplexer (MUX4) on MUX[0], MUX[1]');
  });

  it('refuses a run only when a part is not simulated at all', () => {
    expect(unsimulatedRunRefusal(labelled([['m0', 'MUX4', 'MUX[0]']]))).toMatch(
      /^Simulation was not run: RedByte does not simulate 4:1 multiplexer \(MUX4\) on MUX\[0\], so a recording would show values it never computed\./,
    );
    // Delay is simulated (Verify still blocks it); ordinary gates run.
    expect(unsimulatedRunRefusal(labelled([['d', 'Delay']]))).toBeNull();
    expect(unsimulatedRunRefusal(labelled([['a', 'AND'], ['b', 'Button']]))).toBeNull();
  });
});

describe('detectVerifyMode — SUPPORTED_SEQUENTIAL and BLOCKED_VERIFY_NODE_TYPES sets', () => {
  it('SUPPORTED_SEQUENTIAL includes DFlipFlop', () => {
    expect(SUPPORTED_SEQUENTIAL.has('DFlipFlop')).toBe(true);
  });

  it('BLOCKED_VERIFY_NODE_TYPES includes Counter4Bit', () => {
    expect(BLOCKED_VERIFY_NODE_TYPES.has('Counter4Bit')).toBe(true);
  });

  it('SUPPORTED_SEQUENTIAL and BLOCKED_VERIFY_NODE_TYPES do not overlap', () => {
    for (const type of SUPPORTED_SEQUENTIAL) {
      expect(BLOCKED_VERIFY_NODE_TYPES.has(type)).toBe(false);
    }
  });
});
