/**
 * Contract tests for resolveVerifyInputNodeIds — the translation layer that
 * converts vectors.inputs keys (IO row `id`, e.g. "sw0") to circuit nodeIds
 * (e.g. "sw0_node") before applying inputs to the runtime simulator.
 *
 * Without this translation the Verify→Design tick-context bridge silently
 * stores inputs under the wrong key and the Design sim never sees them.
 */
import { describe, expect, it } from 'vitest';
import { resolveVerifyInputNodeIds } from '../verifyNodeIdBridge';

const signals = [
  { id: 'sw0', nodeId: 'sw0_node' },
  { id: 'sw1', nodeId: 'sw1_node' },
  { id: 'ld0', nodeId: 'ld0_node' },
];

describe('resolveVerifyInputNodeIds', () => {
  it('maps a single io-row id to its circuit nodeId', () => {
    const result = resolveVerifyInputNodeIds({ sw0: 1 }, signals);
    expect(result).toEqual({ sw0_node: 1 });
    expect(result['sw0']).toBeUndefined();
  });

  it('maps multiple ids to their respective nodeIds', () => {
    const result = resolveVerifyInputNodeIds({ sw0: 0, sw1: 1 }, signals);
    expect(result).toEqual({ sw0_node: 0, sw1_node: 1 });
  });

  it('falls back to signalId when no matching signal is found', () => {
    const result = resolveVerifyInputNodeIds({ unknown_sig: 1 }, signals);
    expect(result).toEqual({ unknown_sig: 1 });
  });

  it('returns an empty object for empty inputs', () => {
    const result = resolveVerifyInputNodeIds({}, signals);
    expect(result).toEqual({});
  });

  it('handles mix of known and unknown signal ids', () => {
    const result = resolveVerifyInputNodeIds({ sw0: 1, orphan: 0 }, signals);
    expect(result['sw0_node']).toBe(1);
    expect(result['orphan']).toBe(0);
    expect(result['sw0']).toBeUndefined();
  });

  it('preserves the 0|1 values without coercion', () => {
    const result = resolveVerifyInputNodeIds({ sw0: 0, sw1: 1 }, signals);
    expect(result['sw0_node']).toBe(0);
    expect(result['sw1_node']).toBe(1);
  });
});
