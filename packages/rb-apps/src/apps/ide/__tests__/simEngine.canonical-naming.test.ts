/**
 * RED → GREEN: simEngine must use normalizeIoSignalKey from ioLabels.ts.
 *
 * Regression proof that simulateExpectedIoRows and runDeterministicVerifyFromCircuit
 * produce the same signal key format as bringupArtifacts (canonical: bracket-stripping,
 * lowercase, no hyphens). This test was RED when simEngine still used its local
 * normalizeSignalName; it is GREEN once that is replaced with normalizeIoSignalKey.
 */
import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { simulateExpectedIoRows, runDeterministicVerifyFromCircuit } from '../sim/simEngine';
import { normalizeIoSignalKey } from '../ioLabels';
import type { SimulationIoRow } from '../sim/simTypes';

/**
 * Minimal passthrough circuit: one input → one output.
 * Output node has id `ld0_node`, label `LD[0]` (bracket notation as seen
 * in real student projects mapped by the constraint/IO builder).
 */
function buildBracketLabelCircuit(): Circuit {
  return {
    nodes: [
      {
        id: 'sw0_node',
        type: 'INPUT',
        label: 'SW[0]',
        x: 0,
        y: 0,
        config: {},
        state: {},
      },
      {
        id: 'ld0_node',
        type: 'OUTPUT',
        label: 'LD[0]',
        x: 160,
        y: 0,
        config: {},
        state: {},
      },
    ],
    connections: [
      {
        from: { nodeId: 'sw0_node', portName: 'out' },
        to: { nodeId: 'ld0_node', portName: 'in' },
      },
    ],
  };
}

describe('simEngine canonical naming', () => {
  describe('simulateExpectedIoRows', () => {
    it('brackets in label produce the same key as normalizeIoSignalKey', () => {
      const ioRows: SimulationIoRow[] = [
        { id: 'sw0', label: 'SW[0]', direction: 'in', nodeId: 'sw0_node' },
        { id: 'ld0', label: 'LD[0]', direction: 'out', nodeId: 'ld0_node' },
      ];
      const vectors = [
        { tick: 0, inputs: { sw0: 1 }, expected: { ld0: 1 } },
      ];

      const result = simulateExpectedIoRows({
        circuit: buildBracketLabelCircuit(),
        ioRows,
        vectors,
      });

      // The signal key must match what normalizeIoSignalKey produces —
      // bracket-stripping: 'LD[0]' → 'ld'
      const expected = normalizeIoSignalKey('LD[0]');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.signal).toBe(expected);
    });
  });

  describe('runDeterministicVerifyFromCircuit', () => {
    it('signal keys in result rows match normalizeIoSignalKey of the row label', () => {
      const ioRows: SimulationIoRow[] = [
        { id: 'sw0', label: 'SW[0]', direction: 'in', nodeId: 'sw0_node' },
        { id: 'ld0', label: 'LD[0]', direction: 'out', nodeId: 'ld0_node' },
      ];

      const result = runDeterministicVerifyFromCircuit(
        buildBracketLabelCircuit(),
        ioRows,
        [{ tick: 0, inputs: { sw0: 1 }, expected: { ld0: 1 } }],
      );

      const expectedSignal = normalizeIoSignalKey('LD[0]');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.signal).toBe(expectedSignal);
    });

    it('keeps distinct machine signal keys when two outputs share the same normalized label', () => {
      const collisionCircuit: Circuit = {
        nodes: [
          {
            id: 'sw0_node',
            type: 'INPUT',
            label: 'SW0',
            x: 0,
            y: 0,
            config: {},
            state: {},
          },
          {
            id: 'leda_node',
            type: 'OUTPUT',
            label: 'LED-A',
            x: 160,
            y: 0,
            config: {},
            state: {},
          },
          {
            id: 'leda_2_node',
            type: 'OUTPUT',
            label: 'LEDA',
            x: 160,
            y: 96,
            config: {},
            state: {},
          },
        ],
        connections: [
          {
            from: { nodeId: 'sw0_node', portName: 'out' },
            to: { nodeId: 'leda_node', portName: 'in' },
          },
          {
            from: { nodeId: 'sw0_node', portName: 'out' },
            to: { nodeId: 'leda_2_node', portName: 'in' },
          },
        ],
      };
      const ioRows: SimulationIoRow[] = [
        { id: 'sw0', label: 'SW0', direction: 'in', nodeId: 'sw0_node' },
        { id: 'leda', label: 'LED-A', direction: 'out', nodeId: 'leda_node' },
        { id: 'leda_2', label: 'LEDA', direction: 'out', nodeId: 'leda_2_node' },
      ];

      const result = runDeterministicVerifyFromCircuit(
        collisionCircuit,
        ioRows,
        [{ tick: 0, inputs: { sw0: 1 }, expected: { leda: 1, leda_2: 1 } }],
      );

      expect(result.rows).toHaveLength(2);
      expect(result.rows.map((row) => row.signal)).toEqual(['leda', 'leda_2']);
    });
  });
});
