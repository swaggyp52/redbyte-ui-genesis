/**
 * B3: Vivado export + re-import fidelity contract tests.
 *
 * Three fidelity levels are tested here (matching docs/ARCHITECTURE.md):
 *
 *   Full fidelity  — project.rbproj.json manifest round-trip:
 *     circuit → encode(RBProject) → decode → same circuit (node/conn count)
 *
 *   Reconstructed  — structural VHDL with component instantiation:
 *     hand-crafted structural VHDL → parseVhdl → parsedHdlToCircuit →
 *     reconstructionLevel === 'full', correct gate/connection count
 *
 *   Partial        — RedByte-exported VHDL (concurrent signal assignments)
 *     or behavioral process blocks → reconstructionLevel !== 'full'
 *     (documented limitation: use rbproj.json for round-trips)
 */

import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { IoMapping } from '@redbyte/rb-utils';
import { exportBasys3Bundle } from '../fpga/boards/basys3/basys3Bundle';
import { parseVhdl } from '../import/vhdlImport';
import { parsedHdlToCircuit } from '../import/hdlToCircuit';
import { encodeRBProject, decodeRBProject } from '../export/projectFormat';
import type { RBProject } from '../export/projectFormat';

// ─── Minimal AND gate circuit ─────────────────────────────────────────────────

function buildAndGateCircuit(): { circuit: Circuit; ioMapping: IoMapping } {
  const circuit: Circuit = {
    nodes: [
      { id: 'sw0', type: 'INPUT', position: { x: 0, y: 0 } },
      { id: 'sw1', type: 'INPUT', position: { x: 0, y: 80 } },
      { id: 'and0', type: 'AND', position: { x: 160, y: 40 } },
      { id: 'ld0', type: 'OUTPUT', position: { x: 320, y: 40 } },
    ],
    connections: [
      { from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'and0', portName: 'a' } },
      { from: { nodeId: 'sw1', portName: 'out' }, to: { nodeId: 'and0', portName: 'b' } },
      { from: { nodeId: 'and0', portName: 'out' }, to: { nodeId: 'ld0', portName: 'in' } },
    ],
  };

  const ioMapping: IoMapping = {
    inputs: [
      { id: 'sw0', nodeId: 'sw0', port: 'out', label: 'SW0', pin: 'V17' },
      { id: 'sw1', nodeId: 'sw1', port: 'out', label: 'SW1', pin: 'V16' },
    ],
    outputs: [
      { id: 'ld0', nodeId: 'ld0', port: 'in', label: 'LD0', pin: 'U16' },
    ],
  };

  return { circuit, ioMapping };
}

function countGateNodes(circuit: Circuit): number {
  return circuit.nodes.filter((n) => n.type !== 'INPUT' && n.type !== 'OUTPUT').length;
}

// ─── Structural VHDL (component instantiation — what Vivado generates back) ──

// Output port LD0 is wired directly in the port map (no intermediate signal)
// so that no Wire pass-through instances are created in the imported circuit.
const STRUCTURAL_VHDL_AND = `
library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
entity top is
  Port ( SW0 : in STD_LOGIC; SW1 : in STD_LOGIC; LD0 : out STD_LOGIC );
end top;
architecture rtl of top is
  component AND2 port ( A : in STD_LOGIC; B : in STD_LOGIC; Y : out STD_LOGIC ); end component;
begin
  U1: AND2 port map ( A => SW0, B => SW1, Y => LD0 );
end rtl;
`;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Vivado export + re-import fidelity contract (B3)', () => {

  // ── Fidelity Level 1: manifest round-trip ──────────────────────────────────

  describe('Full fidelity — rbproj.json manifest round-trip', () => {
    it('encode → decode → encode is idempotent', () => {
      const { circuit } = buildAndGateCircuit();
      const project: RBProject = {
        kind: 'rb-project',
        version: 1,
        name: 'AND test',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        circuit,
      };
      const encoded1 = encodeRBProject(project);
      const decoded = decodeRBProject(encoded1);
      const encoded2 = encodeRBProject(decoded);
      expect(encoded2).toBe(encoded1);
    });

    it('decoded project preserves node and connection count', () => {
      const { circuit } = buildAndGateCircuit();
      const project: RBProject = {
        kind: 'rb-project',
        version: 1,
        name: 'AND test',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        circuit,
      };
      const decoded = decodeRBProject(encodeRBProject(project));
      expect(decoded.circuit.nodes.length).toBe(circuit.nodes.length);
      expect(decoded.circuit.connections.length).toBe(circuit.connections.length);
    });
  });

  // ── Fidelity Level 2: structural VHDL with component instantiation ─────────

  describe('Reconstructed fidelity — structural VHDL (component instantiation)', () => {
    it('achieves reconstructionLevel === "full"', () => {
      const parsed = parseVhdl(STRUCTURAL_VHDL_AND);
      const result = parsedHdlToCircuit(parsed);
      expect(result.reconstructionLevel).toBe('full');
      expect(result.unmappedComponents).toHaveLength(0);
    });

    it('correct gate count (1 AND gate)', () => {
      const parsed = parseVhdl(STRUCTURAL_VHDL_AND);
      const result = parsedHdlToCircuit(parsed);
      expect(countGateNodes(result.circuit)).toBe(1);
    });

    it('connections are generated between nodes', () => {
      const parsed = parseVhdl(STRUCTURAL_VHDL_AND);
      const result = parsedHdlToCircuit(parsed);
      expect(result.circuit.connections.length).toBeGreaterThan(0);
    });
  });

  // ── Fidelity Level 3: concurrent-assignment VHDL (RedByte export format) ──

  describe('Partial fidelity — concurrent-assignment VHDL (documented limitation)', () => {
    it('RedByte exported VHDL produces non-full reconstruction — use rbproj.json for round-trips', () => {
      // RedByte's vhdlFromNetlist emits concurrent signal assignments (and_0 <= A and B),
      // not component instantiation. parseVhdl+parsedHdlToCircuit requires structural VHDL.
      // Full fidelity round-trips must go through project.rbproj.json (the manifest).
      const { circuit, ioMapping } = buildAndGateCircuit();
      const bundle = exportBasys3Bundle(circuit, ioMapping, { entityName: 'top' });
      expect(bundle.topVhd).toBeTruthy();

      const parsed = parseVhdl(bundle.topVhd);
      const result = parsedHdlToCircuit(parsed);

      // Concurrent-assignment VHDL has no component instances — ports-only level expected
      expect(result.reconstructionLevel).not.toBe('full');
    });

    it('behavioral process-block VHDL also cannot be round-tripped', () => {
      const behavioralVhdl = `
        library IEEE;
        use IEEE.STD_LOGIC_1164.ALL;
        entity top is
          Port ( SW0 : in STD_LOGIC; SW1 : in STD_LOGIC; LD0 : out STD_LOGIC );
        end top;
        architecture Behavioral of top is
        begin
          process(SW0, SW1) begin LD0 <= SW0 and SW1; end process;
        end Behavioral;
      `;
      const parsed = parseVhdl(behavioralVhdl);
      const result = parsedHdlToCircuit(parsed);
      expect(result.reconstructionLevel).not.toBe('full');
    });
  });
});
