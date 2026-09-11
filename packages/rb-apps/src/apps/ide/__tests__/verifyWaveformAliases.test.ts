import { describe, expect, it } from 'vitest';
import { buildCanonicalWaveformSignalAliases } from '../surfaces/VerifySurface';
import { buildRecordedCircuitGeometry, buildRecordedInstanceDrawing } from '../surfaces/verify/recordedCircuitGeometry';
import { findPin, routeCircuit } from '@redbyte/rb-logic-view';

describe('Verify waveform signal aliases', () => {
  it('uses authored logical labels for boundary and internal circuit nodes', () => {
    const aliases = buildCanonicalWaveformSignalAliases({
      inputFields: [{ id: 'a', label: 'A' }],
      outputFields: [{ id: 'sum', label: 'SUM' }],
      mappedSignals: [
        { id: 'a', label: 'A', nodeId: 'input-a', direction: 'in' },
        { id: 'sum', label: 'SUM', nodeId: 'output-sum', direction: 'out' },
      ],
      circuitNodes: [
        { id: 'input-a', type: 'INPUT', label: 'Student A' },
        { id: 'xor-sum', type: 'XOR', label: 'A XOR B' },
        { id: 'output-sum', type: 'OUTPUT', label: 'Student SUM' },
      ],
    });

    expect(aliases.get('xor_sum_out')).toBe('A XOR B');
    expect(aliases.get('xor_sum')).toBe('A XOR B');
    expect(aliases.get('input_a_out')).toBe('A');
    expect(aliases.get('output_sum_in')).toBe('SUM');
  });

  it('uses run evidence to replace generated sequential ids with unique authored names', () => {
    const aliases = buildCanonicalWaveformSignalAliases({
      inputFields: [
        { id: 'd', label: 'D' },
        { id: 'd_2', label: 'CLK' },
        { id: 'reset', label: 'RESET' },
      ],
      outputFields: [{ id: 'q', label: 'Q' }],
      lastRun: {
        evidence: {
          ioRows: [
            { id: 'd', label: 'D', nodeId: 'input-d', direction: 'in' },
            { id: 'd_2', label: 'CLK', nodeId: 'input-clk', direction: 'in' },
            { id: 'reset', label: 'RESET', nodeId: 'input-reset', direction: 'in' },
            { id: 'q', label: 'Q', nodeId: 'output-q', direction: 'out' },
          ],
        },
      } as Parameters<typeof buildCanonicalWaveformSignalAliases>[0]['lastRun'],
    });

    expect(aliases.get('d')).toBe('D');
    expect(aliases.get('d_2')).toBe('CLK');
    expect(aliases.get('reset')).toBe('RESET');
    expect(aliases.get('q')).toBe('Q');
    expect(aliases.get('input_clk_out')).toBe('CLK');
  });

  it('keeps repeated hierarchy instances separate despite identical internal labels', () => {
    const aliases = buildCanonicalWaveformSignalAliases({ inputFields: [], outputFields: [], circuitNodes: [
      { id: 'FA0/xor-sum', type: 'XOR', label: 'SUM' },
      { id: 'FA1/xor-sum', type: 'XOR', label: 'SUM' },
    ] });
    expect(new Set(aliases.values())).toEqual(new Set(['FA0/xor-sum', 'FA1/xor-sum']));
    expect(aliases.has('sum')).toBe(false);
  });

  it('keeps an old recording independent of renamed current boundary mappings', () => {
    const aliases = buildCanonicalWaveformSignalAliases({ inputFields: [], outputFields: [{ id: 'q', label: 'NEW' }],
      mappedSignals: [{ id: 'q', label: 'NEW', nodeId: 'other', direction: 'out' }],
      lastRun: { evidence: { ioRows: [{ id: 'q', label: 'Q', nodeId: 'old', direction: 'out' }] } } as Parameters<typeof buildCanonicalWaveformSignalAliases>[0]['lastRun'],
    });
    expect(aliases.get('q')).toBe('Q');
    expect(aliases.has('new')).toBe(false);
  });

  it('uses the actual register pin contract and keeps complemented output evidence distinct', () => {
    const nodes = [
      { id: 'clock', type: 'INPUT', position: { x: 0, y: 0 } },
      { id: 'ff', type: 'DFlipFlop', label: 'State', position: { x: 200, y: 0 } },
    ];
    const aliases = buildCanonicalWaveformSignalAliases({ inputFields: [], outputFields: [], circuitNodes: nodes });
    expect(aliases.get('ff_q')).toBe('State');
    expect(aliases.get('ff_q_inv')).toBe('ff.Q_inv');
    const geometry = buildRecordedCircuitGeometry(nodes);
    expect(geometry.get('ff')?.geometry.pins.map((pin) => pin.id)).toEqual(['D', 'CLK', 'Q', 'Q_inv']);
    expect(findPin(geometry.get('ff')!.geometry, 'CLK')?.id).toBe('CLK');
    const routed = routeCircuit({ nodes, connections: [{ from: { nodeId: 'clock', portName: 'out' }, to: { nodeId: 'ff', portName: 'CLK' } }] }, geometry);
    expect(routed.flatMap((net) => net.wires).every((wire) => !wire.degenerate)).toBe(true);
  });

  it('separates repeated instance neighbours without changing the recorded topology or owned positions', () => {
    const nodes = ['left', 'owned', 'right'].map((id) => ({ id, type: 'XOR', position: { x: 200, y: 100 }, config: { hierarchyPath: id } }));
    const circuit = { nodes, connections: [
      { from: { nodeId: 'left', portName: 'out' }, to: { nodeId: 'owned', portName: 'a' } },
      { from: { nodeId: 'owned', portName: 'out' }, to: { nodeId: 'right', portName: 'a' } },
    ] };
    const before = JSON.stringify(circuit);
    const drawing = buildRecordedInstanceDrawing(circuit, 'owned');
    expect(JSON.stringify(circuit)).toBe(before);
    expect(drawing.connections).toEqual(circuit.connections);
    expect(drawing.nodes.find((node) => node.id === 'owned')?.position).toEqual({ x: 200, y: 100 });
    const geometry = buildRecordedCircuitGeometry(drawing.nodes);
    const left = geometry.get('left')!; const owned = geometry.get('owned')!; const right = geometry.get('right')!;
    expect(left.x + left.geometry.bounds.maxX).toBeLessThan(owned.x + owned.geometry.bounds.minX);
    expect(right.x + right.geometry.bounds.minX).toBeGreaterThan(owned.x + owned.geometry.bounds.maxX);
  });
});
