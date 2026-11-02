import { describe, expect, it } from 'vitest';
import { inputPinsOf } from '@redbyte/rb-logic-core';
import { DESIGN_CHIP_METADATA } from '../designChipMetadata';

/**
 * The schematic draws a part's input pins from DESIGN_CHIP_METADATA; the simulator and the VHDL
 * exporter read the inputs inputPinsOf reports. A pin the simulator reads but the drawing lacks
 * leaves a real connection undrawable (until 2026-11-01 DFlipFlop drew no RST or EN, so Lab 8's
 * eight resets were dashed stubs). A pin the drawing has but the simulator ignores invites a
 * wire that does nothing. Parts the simulator does not define or simulate (inputPinsOf null)
 * make no claim here.
 */
const simulatedParts = Object.entries(DESIGN_CHIP_METADATA)
  .map(([type, metadata]) => ({ type, drawn: metadata.inputs.map((pin) => pin.id), reads: inputPinsOf(type, {}) }))
  .filter((part) => part.reads !== null);

const readsPin = (reads: NonNullable<ReturnType<typeof inputPinsOf>>[number], id: string) =>
  reads.names.includes(id) || (reads.bitNames ?? []).includes(id);

describe('drawn input pins match what the simulator reads', () => {
  it('covers the simulated parts', () => {
    expect(simulatedParts.map((part) => part.type)).toEqual(expect.arrayContaining(['AND', 'XOR', 'DFlipFlop', 'Register1', 'TFlipFlop', 'JKFlipFlop']));
  });

  it.each(simulatedParts)('$type draws a pin for every input it reads, and none it ignores', ({ drawn, reads }) => {
    expect(reads!.filter((input) => !drawn.some((id) => readsPin(input, id))).map((input) => input.names[0])).toEqual([]);
    expect(drawn.filter((id) => !reads!.some((input) => readsPin(input, id)))).toEqual([]);
  });

  it('draws DFlipFlop with D, CLK, RST and EN in the order it reads them', () => {
    expect(DESIGN_CHIP_METADATA.DFlipFlop.inputs.map((pin) => pin.id)).toEqual(['D', 'CLK', 'RST', 'EN']);
  });
});

describe('optional inputs are not reported as missing', () => {
  it('reports no "not wired yet" issue for an unwired DFlipFlop RST or EN, and still for D', async () => {
    const { computeDesignIssues } = await import('../designIssues');
    const circuit = {
      nodes: [
        { id: 'clk', type: 'INPUT', x: 0, y: 0, config: {}, state: {} },
        { id: 'ff', type: 'DFlipFlop', x: 200, y: 0, config: {}, state: {} },
        { id: 'led', type: 'OUTPUT', x: 400, y: 0, config: {}, state: {} },
      ],
      connections: [
        { id: 'c1', from: { nodeId: 'clk', portName: 'out' }, to: { nodeId: 'ff', portName: 'CLK' } },
        { id: 'c2', from: { nodeId: 'ff', portName: 'Q' }, to: { nodeId: 'led', portName: 'in' } },
      ],
    };
    const ids = computeDesignIssues(circuit as never).all.filter((issue: { kind: string }) => issue.kind === 'unconnected-input').map((issue: { portKey: string }) => issue.portKey);
    expect(ids.filter((id: string) => /ff\.(RST|EN)$/.test(id))).toEqual([]);
    expect(ids.some((id: string) => /ff\.D$/.test(id))).toBe(true);
  });
});
