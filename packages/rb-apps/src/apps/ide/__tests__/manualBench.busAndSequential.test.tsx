// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { createBusBoundary, type BusDeclaration, type Circuit } from '@redbyte/rb-logic-core';
import { ManualBench } from '../surfaces/verify/ManualBench';
import { useProjectRuntime } from '../projectRuntime';
import type { RBProject } from '../../../export/projectFormat';

/**
 * P1-D bus + sequential coverage. The Manual Bench drives whole bus WORDS and
 * reads them back, and drives a sequential Register1 across a clock edge — all
 * over the ONE experiment state, through the real store engine (no mocks). The
 * 4-bit adder arithmetic (A=0xA + B=0xD → SUM=0x7, CARRY=1) and the register
 * capture are the actual engine results, not fixtures.
 */

afterEach(cleanup);

function wrap(circuit: Circuit): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:00:00.000Z',
    name: 'Bench fixture',
    circuit,
  };
}

function loadCircuit(circuit: Circuit): void {
  act(() => {
    useProjectRuntime.getState().loadFromProject(wrap(circuit));
  });
}

/** Programmatic 4-bit ripple-carry adder over first-class A/B/SUM buses. */
function buildFourBitAdder(): { circuit: Circuit } {
  let circuit: Circuit = { nodes: [], connections: [] };
  const A = createBusBoundary(circuit, { name: 'A', direction: 'input', left: 3, right: 0 });
  circuit = A.circuit;
  const B = createBusBoundary(circuit, { name: 'B', direction: 'input', left: 3, right: 0 });
  circuit = B.circuit;
  const S = createBusBoundary(circuit, { name: 'SUM', direction: 'output', left: 3, right: 0 });
  circuit = S.circuit;

  const nodes = [...circuit.nodes];
  const connections = [...circuit.connections];
  const memberId = (bus: BusDeclaration, index: number): string =>
    bus.bits.find((bit) => bit.index === index)!.nodeId;
  const addGate = (id: string, type: string): void => {
    nodes.push({ id, type, config: {}, state: {} });
  };
  const wire = (fromId: string, fromPort: string, toId: string, toPort: string): void => {
    connections.push({ from: { nodeId: fromId, portName: fromPort }, to: { nodeId: toId, portName: toPort } });
  };

  addGate('gnd', 'Ground');
  addGate('cout', 'OUTPUT');
  let cin = { nodeId: 'gnd', port: 'out' };
  for (let i = 0; i < 4; i += 1) {
    const ai = memberId(A.bus, i);
    const bi = memberId(B.bus, i);
    const si = memberId(S.bus, i);
    addGate(`x1_${i}`, 'XOR');
    addGate(`x2_${i}`, 'XOR');
    addGate(`a1_${i}`, 'AND');
    addGate(`a2_${i}`, 'AND');
    addGate(`o_${i}`, 'OR');
    wire(ai, 'out', `x1_${i}`, 'a');
    wire(bi, 'out', `x1_${i}`, 'b');
    wire(`x1_${i}`, 'out', `x2_${i}`, 'a');
    wire(cin.nodeId, cin.port, `x2_${i}`, 'b');
    wire(`x2_${i}`, 'out', si, 'in');
    wire(ai, 'out', `a1_${i}`, 'a');
    wire(bi, 'out', `a1_${i}`, 'b');
    wire(`x1_${i}`, 'out', `a2_${i}`, 'a');
    wire(cin.nodeId, cin.port, `a2_${i}`, 'b');
    wire(`a1_${i}`, 'out', `o_${i}`, 'a');
    wire(`a2_${i}`, 'out', `o_${i}`, 'b');
    cin = { nodeId: `o_${i}`, port: 'out' };
  }
  wire(cin.nodeId, cin.port, 'cout', 'in');

  return { circuit: { nodes, connections, buses: circuit.buses } };
}

function buildRegister1(): { circuit: Circuit } {
  return {
    circuit: {
      nodes: [
        { id: 'd_node', type: 'INPUT', label: 'D', config: {}, state: {} },
        { id: 'clk_node', type: 'INPUT', label: 'CLK', config: {}, state: {} },
        { id: 'reg', type: 'Register1', label: 'REG', config: {}, state: {} },
        { id: 'q_node', type: 'OUTPUT', label: 'Q', config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'd_node', portName: 'out' }, to: { nodeId: 'reg', portName: 'D' } },
        { from: { nodeId: 'clk_node', portName: 'out' }, to: { nodeId: 'reg', portName: 'CLK' } },
        { from: { nodeId: 'reg', portName: 'Q' }, to: { nodeId: 'q_node', portName: 'in' } },
      ],
    },
  };
}

describe('Manual Bench — bus word drive over the shared experiment', () => {
  beforeEach(() => {
    loadCircuit(buildFourBitAdder().circuit);
  });

  it('drives whole hex words and reads the observed SUM word + carry back', () => {
    const { getByTestId } = render(<ManualBench />);

    // Drive A = 0xA and B = 0xD as WORDS through the bench (hex radix default).
    act(() => {
      fireEvent.change(getByTestId('ide-manual-bench-word-input-a'), { target: { value: 'A' } });
    });
    fireEvent.click(getByTestId('ide-manual-bench-drive-apply-a'));
    act(() => {
      fireEvent.change(getByTestId('ide-manual-bench-word-input-b'), { target: { value: 'D' } });
    });
    fireEvent.click(getByTestId('ide-manual-bench-drive-apply-b'));

    // 0xA + 0xD = 0x17 → SUM[3:0] = 0x7, carry out = 1. Real engine result.
    expect(getByTestId('ide-manual-bench-measure-word-sum').textContent).toBe('0x7');
    expect(getByTestId('ide-manual-bench-measure-value-cout').textContent).toBe('1');

    // Per-bit MSB-first readout agrees: 0x7 = 0111.
    expect(getByTestId('ide-manual-bench-measure-bit-sum-3').textContent).toContain('0');
    expect(getByTestId('ide-manual-bench-measure-bit-sum-2').textContent).toContain('1');
    expect(getByTestId('ide-manual-bench-measure-bit-sum-1').textContent).toContain('1');
    expect(getByTestId('ide-manual-bench-measure-bit-sum-0').textContent).toContain('1');
  });

  it('drives the same word in binary and decimal radices', () => {
    const { getByTestId } = render(<ManualBench />);

    fireEvent.click(getByTestId('ide-manual-bench-radix-a-bin'));
    act(() => {
      fireEvent.change(getByTestId('ide-manual-bench-word-input-a'), { target: { value: '1010' } });
    });
    fireEvent.click(getByTestId('ide-manual-bench-drive-apply-a'));

    fireEvent.click(getByTestId('ide-manual-bench-radix-b-dec'));
    act(() => {
      fireEvent.change(getByTestId('ide-manual-bench-word-input-b'), { target: { value: '13' } });
    });
    fireEvent.click(getByTestId('ide-manual-bench-drive-apply-b'));

    expect(getByTestId('ide-manual-bench-measure-word-sum').textContent).toBe('0x7');
    expect(getByTestId('ide-manual-bench-measure-value-cout').textContent).toBe('1');
  });
});

describe('Manual Bench — sequential Register1 over the shared experiment', () => {
  beforeEach(() => {
    loadCircuit(buildRegister1().circuit);
    // Establish a clean baseline (as the board powers up): D=0, CLK=0.
    act(() => {
      const setInput = useProjectRuntime.getState().actions.sim.setInput;
      setInput('clk_node', 0);
      setInput('d_node', 0);
    });
  });

  it('captures D on a rising clock edge and holds it, both directions', () => {
    const { getByTestId } = render(<ManualBench />);
    const q = () => getByTestId('ide-manual-bench-measure-value-q').textContent;

    // D=1, then rising CLK edge (0→1) captures it → Q=1.
    fireEvent.click(getByTestId('ide-manual-bench-drive-toggle-d')); // 0→1
    fireEvent.click(getByTestId('ide-manual-bench-drive-toggle-clk')); // 0→1 rising
    expect(q()).toBe('1');

    // Hold: dropping the clock (1→0) does not change Q.
    fireEvent.click(getByTestId('ide-manual-bench-drive-toggle-clk')); // 1→0
    expect(q()).toBe('1');

    // D=0, next rising edge captures 0 → Q=0.
    fireEvent.click(getByTestId('ide-manual-bench-drive-toggle-d')); // 1→0
    fireEvent.click(getByTestId('ide-manual-bench-drive-toggle-clk')); // 0→1 rising
    expect(q()).toBe('0');
  });
});
