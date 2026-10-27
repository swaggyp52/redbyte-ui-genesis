import { describe, expect, it } from 'vitest';
import { unconnectedInputText, unconnectedSummaryText } from '../Inspector';

// RB-DEBT-028: the Meridian inspector states what an unconnected input reads in the simulator,
// from the engine's pin description, instead of "read as 0" for every input.
describe('unconnected inputs in the Meridian inspector', () => {
  it('states the level each part reads', () => {
    expect(unconnectedInputText({ type: 'AND', config: {} }, 'a')).toBe('unconnected · read as 0');
    expect(unconnectedInputText({ type: 'DFlipFlop', config: {} }, 'EN')).toBe('unconnected · read as 1');
    expect(unconnectedInputText({ type: 'Register1', config: { hasEnable: true } }, 'EN')).toBe('unconnected · read as 0');
  });

  it('says a pin the settings disable is not read, and claims no level for a pin it cannot describe', () => {
    expect(unconnectedInputText({ type: 'Register1', config: { hasEnable: false } }, 'EN')).toBe("unconnected · not read (off in this part's settings)");
    expect(unconnectedInputText({ type: 'MyModule', config: { moduleDefinitionId: 'm1' } }, 'A')).toBe('unconnected');
  });

  it('names one level in the status count only when every unconnected input reads it', () => {
    const and = { type: 'AND', config: {} };
    expect(unconnectedSummaryText([{ node: and, pin: 'a' }, { node: and, pin: 'b' }])).toBe('2 unconnected inputs · read as 0');
    expect(unconnectedSummaryText([{ node: { type: 'DFlipFlop', config: {} }, pin: 'EN' }])).toBe('1 unconnected input · read as 1');
    // Mixed levels, a pin the settings disable, or an undescribed module input: the count claims no level.
    expect(unconnectedSummaryText([{ node: and, pin: 'a' }, { node: { type: 'DFlipFlop', config: {} }, pin: 'EN' }])).toBe('2 unconnected inputs');
    expect(unconnectedSummaryText([{ node: and, pin: 'a' }, { node: { type: 'Register1', config: { hasEnable: false } }, pin: 'EN' }])).toBe('2 unconnected inputs');
    expect(unconnectedSummaryText([{ node: { type: 'MyModule', config: { moduleDefinitionId: 'm1' } }, pin: 'A' }])).toBe('1 unconnected input');
  });
});
