import { describe, expect, it } from 'vitest';
import { encodeWireId, parseWireId } from '../wireId';

describe('wireId utilities', () => {
  describe('encodeWireId', () => {
    it('produces the canonical format', () => {
      expect(encodeWireId('node1', 'out', 'node2', 'a')).toBe('node1.out-node2.a');
    });

    it('handles hyphens in node IDs', () => {
      expect(encodeWireId('node-v2-3', 'out', 'node-v2-5', 'a')).toBe(
        'node-v2-3.out-node-v2-5.a'
      );
    });
  });

  describe('parseWireId', () => {
    it('parses a simple wire ID', () => {
      expect(parseWireId('node1.out-node2.a')).toEqual({
        fromNodeId: 'node1',
        fromPort: 'out',
        toNodeId: 'node2',
        toPort: 'a',
      });
    });

    it('parses node IDs containing hyphens (node-v2-*)', () => {
      expect(parseWireId('node-v2-3.out-node-v2-5.a')).toEqual({
        fromNodeId: 'node-v2-3',
        fromPort: 'out',
        toNodeId: 'node-v2-5',
        toPort: 'a',
      });
    });

    it('parses node IDs with many hyphens when ports are clean', () => {
      expect(parseWireId('alu-stage-1-regfile.out-stage-2-input.in')).toEqual({
        fromNodeId: 'alu-stage-1-regfile',
        fromPort: 'out',
        toNodeId: 'stage-2-input',
        toPort: 'in',
      });
    });

    it('parses a-b-c-d style node IDs with single-char ports', () => {
      expect(parseWireId('a-b-c-d.q-e-f-g.r')).toEqual({
        fromNodeId: 'a-b-c-d',
        fromPort: 'q',
        toNodeId: 'e-f-g',
        toPort: 'r',
      });
    });

    it('returns null when the from-node ID is empty (leading dot)', () => {
      // ".out-dst.in" → fromNodeId would be "", length 0 → null
      expect(parseWireId('.out-dst.in')).toBeNull();
    });

    it('returns null for an empty string', () => {
      expect(parseWireId('')).toBeNull();
    });

    it('returns null when there is no hyphen separator', () => {
      expect(parseWireId('node1.out')).toBeNull();
    });

    it('returns null when from side has no dot', () => {
      expect(parseWireId('nodeout-node2.a')).toBeNull();
    });
  });

  describe('encodeWireId → parseWireId roundtrip', () => {
    const cases: Array<[string, string, string, string]> = [
      ['node1', 'out', 'node2', 'a'],
      ['node-v2-3', 'out', 'node-v2-5', 'a'],
      ['alu-stage-1-regfile', 'out', 'stage-2-input', 'in'],
      ['a-b-c-d', 'q', 'e-f-g', 'r'],
    ];

    it.each(cases)(
      'roundtrips fromNodeId=%s fromPort=%s toNodeId=%s toPort=%s',
      (fromNodeId, fromPort, toNodeId, toPort) => {
        const wireId = encodeWireId(fromNodeId, fromPort, toNodeId, toPort);
        expect(parseWireId(wireId)).toEqual({ fromNodeId, fromPort, toNodeId, toPort });
      }
    );
  });
});
