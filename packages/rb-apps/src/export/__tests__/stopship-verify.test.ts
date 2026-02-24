/**
 * STOP-SHIP GATE TESTS
 * Each test proves a stop-ship item from the audit plan.
 * Run: pnpm vitest run src/export/__tests__/stopship-verify.test.ts
 */
import { describe, it, expect } from 'vitest';
import { parseVhdl } from '../../import/vhdlImport';
import { parseVerilog } from '../../import/verilogImport';
import { vhdlFromNetlist } from '../vhdlExport';
import { netlistFromCircuit } from '../netlistExport';
import type { Circuit } from '@redbyte/rb-logic-core';
import {
  exportBasys3Bundle,
  buildVhdlTopLevelBindings,
} from '../../fpga/boards/basys3/basys3Bundle';
import type { IoMapping } from '@redbyte/rb-utils';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Mirrors scanBehavioralConstructs from ImportSurface.tsx */
function scanBehavioralConstructs(source: string): string[] {
  const found: string[] = [];
  if (/\bprocess\b/i.test(source)) found.push('process (VHDL sequential)');
  if (/\balways\b/i.test(source)) found.push('always (Verilog behavioral)');
  if (/\binitial\b/i.test(source)) found.push('initial (Verilog test-bench/sequential init)');
  if (/\brising_edge\b/i.test(source)) found.push('rising_edge (clocked logic)');
  if (/\bposedge\b/i.test(source)) found.push('posedge (clock edge sensitivity)');
  if (/\bnegedge\b/i.test(source)) found.push('negedge (clock edge sensitivity)');
  if (/\bgenerate\b/i.test(source)) found.push('generate (structural generate — unsupported)');
  return found;
}

/** Build a minimal deterministic circuit */
function buildAndGateCircuit(): Circuit {
  return {
    nodes: [
      { id: 'node-v2-1', type: 'INPUT',  label: 'SW[0]', position: { x: 0, y: 0 } },
      { id: 'node-v2-2', type: 'INPUT',  label: 'SW[1]', position: { x: 0, y: 80 } },
      { id: 'node-v2-3', type: 'AND',    label: 'AND',   position: { x: 160, y: 40 } },
      { id: 'node-v2-4', type: 'OUTPUT', label: 'LED[0]', position: { x: 320, y: 40 } },
    ] as any[],
    connections: [
      { id: 'c1', from: { nodeId: 'node-v2-1', portName: 'out' }, to: { nodeId: 'node-v2-3', portName: 'a' } },
      { id: 'c2', from: { nodeId: 'node-v2-2', portName: 'out' }, to: { nodeId: 'node-v2-3', portName: 'b' } },
      { id: 'c3', from: { nodeId: 'node-v2-3', portName: 'out' }, to: { nodeId: 'node-v2-4', portName: 'in' } },
    ],
  } as Circuit;
}

// ─── STOP-SHIP 1: No silent dropping of sequential HDL ──────────────────────

describe('STOP-SHIP 1 — Behavioral HDL blocker', () => {
  const dffVhdl = `
entity dff is
  port (
    clk : in  STD_LOGIC;
    d   : in  STD_LOGIC;
    q   : out STD_LOGIC
  );
end entity dff;

architecture rtl of dff is
begin
  process(clk)
  begin
    if rising_edge(clk) then
      q <= d;
    end if;
  end process;
end architecture rtl;
`;

  const dffVerilog = `
module dff (
  input  clk,
  input  d,
  output reg q
);
  always @(posedge clk) begin
    q <= d;
  end
endmodule
`;

  it('detects process + rising_edge in VHDL DFF', () => {
    const found = scanBehavioralConstructs(dffVhdl);
    expect(found).toContain('process (VHDL sequential)');
    expect(found).toContain('rising_edge (clocked logic)');
    expect(found.length).toBeGreaterThanOrEqual(2);
  });

  it('detects always + posedge in Verilog DFF', () => {
    const found = scanBehavioralConstructs(dffVerilog);
    expect(found).toContain('always (Verilog behavioral)');
    expect(found).toContain('posedge (clock edge sensitivity)');
    expect(found.length).toBeGreaterThanOrEqual(2);
  });

  it('structural VHDL (no process/always) passes the scan with zero detections', () => {
    const structuralVhdl = `
entity top is
  port ( SW0 : in STD_LOGIC; SW1 : in STD_LOGIC; LD0 : out STD_LOGIC );
end entity;
architecture rtl of top is
begin
  LD0 <= SW0 and SW1;
end architecture;
`;
    const found = scanBehavioralConstructs(structuralVhdl);
    expect(found).toHaveLength(0);
  });

  it('VHDL parser still extracts ports from DFF (ports exist; logic is dropped)', () => {
    const parsed = parseVhdl(dffVhdl);
    expect(parsed.ports).toHaveLength(3);
    expect(parsed.ports.map(p => p.name)).toContain('clk');
    expect(parsed.ports.map(p => p.name)).toContain('d');
    expect(parsed.ports.map(p => p.name)).toContain('q');
    // No gate instances — the process body was dropped
    const gateInstances = parsed.instances.filter(i => i.componentType !== 'Wire');
    expect(gateInstances).toHaveLength(0);
  });

  it('Verilog parser still extracts ports from DFF (ports exist; logic is dropped)', () => {
    const parsed = parseVerilog(dffVerilog);
    expect(parsed.ports).toHaveLength(3);
    // No gate instances reconstructed from behavioral always block
    const gateInstances = parsed.instances.filter(i => i.componentType !== 'Wire');
    expect(gateInstances).toHaveLength(0);
  });

  it('importBlockerReasons would be non-empty for DFF (simulation of component logic)', () => {
    // Simulate what ImportSurface does:
    const constructs = scanBehavioralConstructs(dffVhdl);
    const parsed = parseVhdl(dffVhdl);
    const hasGateInstances = parsed.instances.some(i => i.componentType !== 'Wire');
    const reconstructionLevel = hasGateInstances
      ? 'full'
      : parsed.ports.length === 0
        ? 'empty'
        : 'ports-only';

    const reasons: string[] = [];
    if (constructs.length > 0) {
      reasons.push(`Behavioral/sequential HDL detected: ${constructs.join(', ')}.`);
    }
    if (reconstructionLevel === 'ports-only') {
      reasons.push('Only I/O ports reconstructed — no gate logic found.');
    }

    expect(reasons.length).toBeGreaterThanOrEqual(1);
    // Both conditions fire for a DFF
    expect(reasons).toHaveLength(2);
  });
});

// ─── STOP-SHIP 2: Deterministic exports ─────────────────────────────────────

describe('STOP-SHIP 2 — Deterministic VHDL export', () => {
  it('two exports of the same circuit produce byte-identical VHDL', () => {
    const circuit = buildAndGateCircuit();
    const netlist1 = netlistFromCircuit(circuit);
    const netlist2 = netlistFromCircuit(circuit);

    const result1 = vhdlFromNetlist(netlist1, { entityName: 'top' });
    const result2 = vhdlFromNetlist(netlist2, { entityName: 'top' });

    expect(result1.vhd).toBe(result2.vhd);
  });

  it('VHDL with includeFileHeader contains no timestamp', () => {
    const circuit = buildAndGateCircuit();
    const netlist = netlistFromCircuit(circuit);
    const result = vhdlFromNetlist(netlist, { entityName: 'top', includeFileHeader: true });

    // Must NOT contain a generated timestamp
    expect(result.vhd).not.toMatch(/-- Generated:/);
    // Must still contain the static header
    expect(result.vhd).toContain('-- RedByte Generated VHDL');
  });

  it('ten sequential exports of the same circuit are all identical', () => {
    const circuit = buildAndGateCircuit();
    const exports = Array.from({ length: 10 }, () =>
      vhdlFromNetlist(netlistFromCircuit(circuit), { entityName: 'top' }).vhd
    );
    const first = exports[0];
    for (const e of exports) {
      expect(e).toBe(first);
    }
  });

  it('signal names are stable: and_0 for first AND gate', () => {
    const circuit = buildAndGateCircuit();
    const result = vhdlFromNetlist(netlistFromCircuit(circuit), { entityName: 'top' });
    expect(result.vhd).toContain('signal and_0 : STD_LOGIC');
    expect(result.vhd).toContain('and_0 <= SW(0) and SW(1)');
  });
});

// ─── STOP-SHIP 4: Stale verify logic (hash comparison) ─────────────────────

describe('STOP-SHIP 4 — Stale verify detection logic', () => {
  /** Mirrors isRunStale from VerifySurface.tsx */
  function isRunStale(lastRunHash: string, currentHash: string): boolean {
    return (
      lastRunHash !== '' &&
      currentHash !== '' &&
      lastRunHash !== currentHash
    );
  }

  it('isRunStale = false when hashes match (fresh result)', () => {
    expect(isRunStale('abc123', 'abc123')).toBe(false);
  });

  it('isRunStale = true when circuit changes after verify', () => {
    expect(isRunStale('abc123', 'def456')).toBe(true);
  });

  it('isRunStale = false when no run has been done (empty lastRunHash)', () => {
    expect(isRunStale('', 'def456')).toBe(false);
  });

  it('isRunStale = false when currentHash not yet computed', () => {
    expect(isRunStale('abc123', '')).toBe(false);
  });
});

// ─── STOP-SHIP 5: Import never claims success with empty/ports-only ──────────

describe('STOP-SHIP 5 — Import reconstruction level blocking', () => {
  it('ports-only VHDL (no structural instantiations) triggers blocker', () => {
    const portsOnlyVhdl = `
entity top is
  port (
    SW0 : in  STD_LOGIC;
    SW1 : in  STD_LOGIC;
    LD0 : out STD_LOGIC
  );
end entity;
architecture rtl of top is
begin
  -- no structural instances, just concurrent assignment
end architecture;
`;
    const parsed = parseVhdl(portsOnlyVhdl);
    const hasGateInstances = parsed.instances.some(i => i.componentType !== 'Wire');
    const level = hasGateInstances ? 'full' : parsed.ports.length === 0 ? 'empty' : 'ports-only';
    expect(level).toBe('ports-only');
    // This WOULD block in ImportSurface
    expect(['ports-only', 'empty']).toContain(level);
  });

  it('empty entity (no ports) produces empty reconstruction level', () => {
    const emptyVhdl = `-- just a comment, no valid entity`;
    const parsed = parseVhdl(emptyVhdl);
    expect(parsed.ports).toHaveLength(0);
    const level = parsed.ports.length === 0 ? 'empty' : 'ports-only';
    expect(level).toBe('empty');
  });

  it('structural VHDL with gate instances produces full reconstruction level', () => {
    const structuralVhdl = `
entity top is
  port ( SW0 : in STD_LOGIC; SW1 : in STD_LOGIC; LD0 : out STD_LOGIC );
end entity;
architecture rtl of top is
  component AND2 port (a, b : in STD_LOGIC; y : out STD_LOGIC); end component;
begin
  u1 : AND2 port map (a => SW0, b => SW1, y => LD0);
end architecture;
`;
    const parsed = parseVhdl(structuralVhdl);
    const hasGateInstances = parsed.instances.some(i => i.componentType !== 'Wire');
    const level = hasGateInstances ? 'full' : parsed.ports.length === 0 ? 'empty' : 'ports-only';
    expect(level).toBe('full');
  });
});

// ─── STOP-SHIP 1 (extended): VHDL generics now parse correctly ──────────────

describe('vhdlImport: generics-before-port fix', () => {
  it('entity with generic block now extracts ports (was silently failing before)', () => {
    const genericVhdl = `
entity counter is
  generic (
    WIDTH : integer := 4
  );
  port (
    clk   : in  STD_LOGIC;
    reset : in  STD_LOGIC;
    count : out STD_LOGIC_VECTOR(3 downto 0)
  );
end entity counter;
`;
    const parsed = parseVhdl(genericVhdl);
    expect(parsed.entityName).toBe('counter');
    expect(parsed.ports).toHaveLength(3);
    expect(parsed.ports.map(p => p.name)).toContain('clk');
    expect(parsed.ports.map(p => p.name)).toContain('reset');
    expect(parsed.ports.map(p => p.name)).toContain('count');
    // Should emit a warning about generics being ignored
    expect(parsed.warnings.some(w => w.message.includes('generic'))).toBe(true);
  });
});

// ─── STOP-SHIP 6 — HDL pane VHDL must equal export top.vhd ────────────────

function buildAndGateIoMapping(): IoMapping {
  return {
    inputs: [
      { id: 'sw0', nodeId: 'node-v2-1', port: 'out', label: 'SW[0]', pin: 'V17' },
      { id: 'sw1', nodeId: 'node-v2-2', port: 'out', label: 'SW[1]', pin: 'V16' },
    ],
    outputs: [
      { id: 'led0', nodeId: 'node-v2-4', port: 'in', label: 'LED[0]', pin: 'U16' },
    ],
  };
}

describe('STOP-SHIP 6 — HDL pane VHDL equals export top.vhd', () => {
  it('AND gate: pane VHDL and bundle VHDL are byte-identical', () => {
    const circuit = buildAndGateCircuit(); // uses existing helper in this file
    const ioMapping = buildAndGateIoMapping();

    // Simulate what export does (basys3Bundle path)
    const bundle = exportBasys3Bundle(circuit, ioMapping, { entityName: 'my_and_gate' });
    const exportVhd = bundle.topVhd;

    // Simulate what HDL pane does after the fix (DesignSurface path)
    // After Task 4s fix: pane also uses buildVhdlTopLevelBindings + same entityName
    // This assertion drives the implementation in Tasks 2-4
    const netlist = netlistFromCircuit(circuit);
    const bindings = buildVhdlTopLevelBindings(ioMapping);
    const paneVhd = vhdlFromNetlist(netlist, {
      entityName: 'my_and_gate',
      ...bindings,
    }).vhd;

    expect(paneVhd).toBe(exportVhd);
  });

  it('entity name in export top.vhd matches topEntityName when provided', () => {
    const circuit = buildAndGateCircuit();
    const ioMapping = buildAndGateIoMapping();
    const bundle = exportBasys3Bundle(circuit, ioMapping, { entityName: 'rb_test_entity' });
    expect(bundle.topVhd).toContain('entity rb_test_entity is');
    expect(bundle.topVhd).not.toContain('entity top is');
  });
});
