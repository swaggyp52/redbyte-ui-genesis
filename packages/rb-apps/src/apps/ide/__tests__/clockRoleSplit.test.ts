// @vitest-environment jsdom

/**
 * Slice M — Clock model role split
 *
 * Verifies that palette Sim Clocks (role:'sim') and board clocks (role:'board')
 * are treated as distinct model entities:
 *
 *  - defaultNodeConfig('Clock')  → role:'sim'   (browser oscillator, sim-only)
 *  - addDesignBoardIo clock      → role:'board'  (real Basys3 100 MHz input)
 *
 * IR level:
 *  - role:'sim'   → IRPrimitive (internal oscillator, NOT a top-level VHDL port)
 *  - role:'board' → IRPort with kind:'clock'      (VHDL entity port)
 *  - no role      → backward compat, stays as IRPort (existing serialized projects)
 *
 * VHDL export level:
 *  - Board/legacy Clock nodes (boundaryKind:'clock') → entity input port
 *  - Sim-clock primitives (no boundaryKind)          → excluded from entity, warning emitted
 */

import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { elaborateCircuit } from '@redbyte/rb-logic-core';
import { netlistFromIr } from '../../../export/netlistExport';
import { vhdlFromNetlist } from '../../../export/vhdlExport';
import { defaultNodeConfig } from '../defaultNodeConfig';
import { useProjectRuntime } from '../projectRuntime';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSimClockDffCircuit(): Circuit {
  return {
    nodes: [
      {
        id: 'sim_clk',
        type: 'Clock',
        label: 'sim_clk',
        position: { x: 0, y: 0 },
        rotation: 0,
        config: { period: 10, role: 'sim' }, // explicit sim-only
        state: {},
      },
      {
        id: 'in_d',
        type: 'INPUT',
        label: 'D',
        position: { x: 0, y: 80 },
        rotation: 0,
        config: {},
        state: { isOn: 0 },
      },
      {
        id: 'dff1',
        type: 'DFlipFlop',
        position: { x: 160, y: 40 },
        rotation: 0,
        config: {},
        state: {},
      },
      {
        id: 'out_q',
        type: 'OUTPUT',
        label: 'Q',
        position: { x: 300, y: 40 },
        rotation: 0,
        config: {},
        state: {},
      },
    ],
    connections: [
      { id: 'w1', from: { nodeId: 'sim_clk', portName: 'out' }, to: { nodeId: 'dff1', portName: 'CLK' } },
      { id: 'w2', from: { nodeId: 'in_d',    portName: 'out' }, to: { nodeId: 'dff1', portName: 'D' } },
      { id: 'w3', from: { nodeId: 'dff1',    portName: 'Q' },   to: { nodeId: 'out_q', portName: 'in' } },
    ],
  };
}

function makeBoardClockDffCircuit(): Circuit {
  return {
    nodes: [
      {
        id: 'board_clk',
        type: 'Clock',
        label: 'CLK100MHZ',
        position: { x: 0, y: 0 },
        rotation: 0,
        config: { period: 10, role: 'board' }, // explicit board clock
        state: {},
      },
      {
        id: 'in_d',
        type: 'INPUT',
        label: 'D',
        position: { x: 0, y: 80 },
        rotation: 0,
        config: {},
        state: { isOn: 0 },
      },
      {
        id: 'dff1',
        type: 'DFlipFlop',
        position: { x: 160, y: 40 },
        rotation: 0,
        config: {},
        state: {},
      },
      {
        id: 'out_q',
        type: 'OUTPUT',
        label: 'Q',
        position: { x: 300, y: 40 },
        rotation: 0,
        config: {},
        state: {},
      },
    ],
    connections: [
      { id: 'w1', from: { nodeId: 'board_clk', portName: 'out' }, to: { nodeId: 'dff1', portName: 'CLK' } },
      { id: 'w2', from: { nodeId: 'in_d',      portName: 'out' }, to: { nodeId: 'dff1', portName: 'D' } },
      { id: 'w3', from: { nodeId: 'dff1',      portName: 'Q' },   to: { nodeId: 'out_q', portName: 'in' } },
    ],
  };
}

function makeLegacyClockDffCircuit(): Circuit {
  return {
    nodes: [
      {
        // No role field — represents a serialized project from before the split
        id: 'legacy_clk',
        type: 'Clock',
        label: 'clk',
        position: { x: 0, y: 0 },
        rotation: 0,
        config: { period: 10 },
        state: {},
      },
      {
        id: 'in_d',
        type: 'INPUT',
        label: 'D',
        position: { x: 0, y: 80 },
        rotation: 0,
        config: {},
        state: { isOn: 0 },
      },
      {
        id: 'dff1',
        type: 'DFlipFlop',
        position: { x: 160, y: 40 },
        rotation: 0,
        config: {},
        state: {},
      },
      {
        id: 'out_q',
        type: 'OUTPUT',
        label: 'Q',
        position: { x: 300, y: 40 },
        rotation: 0,
        config: {},
        state: {},
      },
    ],
    connections: [
      { id: 'w1', from: { nodeId: 'legacy_clk', portName: 'out' }, to: { nodeId: 'dff1', portName: 'CLK' } },
      { id: 'w2', from: { nodeId: 'in_d',       portName: 'out' }, to: { nodeId: 'dff1', portName: 'D' } },
      { id: 'w3', from: { nodeId: 'dff1',        portName: 'Q' },  to: { nodeId: 'out_q', portName: 'in' } },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Clock role split — config defaults', () => {
  it('defaultNodeConfig Clock returns role:sim', () => {
    const cfg = defaultNodeConfig('Clock');
    expect((cfg as Record<string, unknown>).role).toBe('sim');
    expect((cfg as Record<string, unknown>).period).toBe(10);
  });

  it('defaultNodeConfig non-clock types have no role field', () => {
    const and = defaultNodeConfig('AND') as Record<string, unknown>;
    const reg = defaultNodeConfig('Register1') as Record<string, unknown>;
    expect(and.role).toBeUndefined();
    expect(reg.role).toBeUndefined();
  });
});

describe('Clock role split — addDesignBoardIo stamps board role', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useProjectRuntime.getState().resetToActiveExample();
  });

  it('adding CLK100MHZ board resource stamps config.role:board on the clock node', async () => {
    await act(async () => {
      useProjectRuntime.getState().addDesignBoardIo({
        alias: 'CLK100MHZ',
        direction: 'in',
        kind: 'clock',
        position: { x: 0, y: 0 },
      });
    });

    const state = useProjectRuntime.getState();
    const clockNode = state.circuit.nodes.find((n) => n.type === 'Clock');
    expect(clockNode).toBeDefined();
    expect((clockNode!.config as Record<string, unknown>).role).toBe('board');
  });

  it('non-clock board resources use defaultNodeConfig which carries no role field', () => {
    // Direct contract: INPUT/Switch/LED nodes have no role in their default config.
    // The role field is Clock-specific and must not bleed into other node types.
    const cfgInput = defaultNodeConfig('INPUT') as Record<string, unknown>;
    const cfgSwitch = defaultNodeConfig('Switch') as Record<string, unknown>;
    const cfgOutput = defaultNodeConfig('OUTPUT') as Record<string, unknown>;
    expect(cfgInput.role).toBeUndefined();
    expect(cfgSwitch.role).toBeUndefined();
    expect(cfgOutput.role).toBeUndefined();
  });
});

describe('Clock role split — IR elaborator', () => {
  it('sim-clock (role:sim) becomes an IR primitive, NOT an IRPort', () => {
    const { ir } = elaborateCircuit(makeSimClockDffCircuit());

    // Should NOT appear as a boundary port
    const clockPort = ir.ports.find((p) => p.sourceNodeId === 'sim_clk');
    expect(clockPort).toBeUndefined();
    expect(ir.clocks.find((c) => c.sourceNodeId === 'sim_clk')).toBeUndefined();

    // Should appear as a primitive
    const clockPrim = ir.primitives.find((p) => p.sourceNodeId === 'sim_clk');
    expect(clockPrim).toBeDefined();
    expect(clockPrim!.type).toBe('Clock');
  });

  it('sim-clock (role:sim) DFF still gets clockBinding set — sim still runs', () => {
    const { ir } = elaborateCircuit(makeSimClockDffCircuit());
    const dff = ir.primitives.find((p) => p.sourceNodeId === 'dff1');
    expect(dff).toBeDefined();
    // DFF clock port is driven by the sim-clock's net → clockBinding resolved
    expect(dff!.clockBinding).toBeDefined();
    expect(dff!.clockBinding!.length).toBeGreaterThan(0);
  });

  it('board-clock (role:board) becomes an IRPort with kind:clock', () => {
    const { ir } = elaborateCircuit(makeBoardClockDffCircuit());

    // Should appear as boundary port
    const clockPort = ir.ports.find((p) => p.sourceNodeId === 'board_clk');
    expect(clockPort).toBeDefined();
    expect(clockPort!.kind).toBe('clock');

    // Should NOT be a primitive
    const clockPrim = ir.primitives.find((p) => p.sourceNodeId === 'board_clk');
    expect(clockPrim).toBeUndefined();
  });

  it('legacy clock (no role) stays as IRPort — backward compat for existing projects', () => {
    const { ir } = elaborateCircuit(makeLegacyClockDffCircuit());

    // No role = treat as board-style boundary (old behavior preserved)
    const clockPort = ir.ports.find((p) => p.sourceNodeId === 'legacy_clk');
    expect(clockPort).toBeDefined();
    expect(clockPort!.kind).toBe('clock');
  });
});

describe('Clock role split — VHDL export', () => {
  it('sim-clock circuit: VHDL entity does NOT declare a clock port', () => {
    const { ir } = elaborateCircuit(makeSimClockDffCircuit());
    const netlist = netlistFromIr(ir);
    const result = vhdlFromNetlist(netlist, { entityName: 'top' });

    // No CLK or sim_clk entity port
    expect(result.inputPorts).not.toContain('sim_clk');
    expect(result.inputPorts.some((p) => p.toLowerCase().includes('clk'))).toBe(false);
  });

  it('sim-clock circuit: VHDL export emits a warning about the excluded clock', () => {
    const { ir } = elaborateCircuit(makeSimClockDffCircuit());
    const netlist = netlistFromIr(ir);
    const result = vhdlFromNetlist(netlist, { entityName: 'top' });

    const simClockWarning = result.warnings.find((w) =>
      w.includes('Sim-only clock') && w.includes('CLK100MHZ')
    );
    expect(simClockWarning).toBeDefined();
  });

  it('board-clock circuit: VHDL entity declares a clock entity port', () => {
    const { ir } = elaborateCircuit(makeBoardClockDffCircuit());
    const netlist = netlistFromIr(ir);
    const result = vhdlFromNetlist(netlist, { entityName: 'top' });

    // buildPortGroups extracts the letter-only prefix from the label: 'CLK100MHZ' → 'CLK'
    // The port name will be 'CLK' (uppercase, Basys3 convention).
    expect(result.inputPorts.some((p) => p.toLowerCase().includes('clk'))).toBe(true);
    // No sim-clock warning for a proper board clock
    expect(result.warnings.find((w) => w.includes('Sim-only clock'))).toBeUndefined();
  });

  it('legacy clock (no role): VHDL entity declares clock port — backward compat', () => {
    const { ir } = elaborateCircuit(makeLegacyClockDffCircuit());
    const netlist = netlistFromIr(ir);
    const result = vhdlFromNetlist(netlist, { entityName: 'top' });

    // Legacy clocks should still get a VHDL port (backward compat)
    expect(result.inputPorts.some((p) => p.toLowerCase().includes('clk'))).toBe(true);
  });
});
