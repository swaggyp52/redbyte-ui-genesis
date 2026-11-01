import { describe, expect, it } from 'vitest';
import { NodeRegistry, getComponentSupport, type Circuit } from '@redbyte/rb-logic-core';
import { findVerifyBlockers, unsimulatedRunRefusal } from '../apps/ide/verifyMode';

/**
 * V1 scope: analog simulation is not part of RedByte. The analog node behaviours (LM358, LDR,
 * FixedResistor, VoltageSource, VoltageDivider) were removed from the engine in e6a2df714, which
 * orphaned the rb-logic-core analog tests (they asserted an LM358 that no longer exists, and the
 * engine reads an undefined part as 0). What must hold instead: no analog part is an engine part or
 * a supported component, and a circuit containing one is refused by name before a Run, never
 * recorded as zeros. (labContent "LDR + LM358" is a physical breadboard circuit wired to a Pmod
 * input on the board, not a simulated part.)
 */
const ANALOG_PARTS = ['LM358', 'LDR', 'FixedResistor', 'VoltageSource', 'VoltageDivider'] as const;

describe('analog parts are outside V1 and refused, never simulated as zero', () => {
  it.each(ANALOG_PARTS.map((type) => [type] as const))('%s is neither an engine part nor a supported component', (type) => {
    expect(NodeRegistry.has(type)).toBe(false);
    expect(getComponentSupport(type)).toBeUndefined();
  });

  it('refuses a comparator circuit by naming the analog part', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'ldr', type: 'LDR', label: 'Light sensor', position: { x: 0, y: 0 }, config: {}, state: {} },
        { id: 'cmp', type: 'LM358', label: 'Comparator', position: { x: 100, y: 0 }, config: {}, state: {} },
        { id: 'lamp', type: 'OUTPUT', label: 'LD0', position: { x: 200, y: 0 }, config: {}, state: {} },
      ],
      connections: [
        { id: 'w1', from: { nodeId: 'ldr', portName: 'out' }, to: { nodeId: 'cmp', portName: 'V_plus' } },
        { id: 'w2', from: { nodeId: 'cmp', portName: 'out' }, to: { nodeId: 'lamp', portName: 'in' } },
      ],
    } as Circuit;
    const blockers = findVerifyBlockers(circuit);
    expect(blockers.map((blocker) => blocker.type)).toEqual(['LDR', 'LM358']);
    expect(blockers.every((blocker) => blocker.simulated === false)).toBe(true);
    const refusal = unsimulatedRunRefusal(circuit);
    expect(refusal).toMatch(/LM358|Comparator/);
  });
});
