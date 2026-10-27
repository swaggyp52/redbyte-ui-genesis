import { describe, expect, it } from 'vitest';
import { CircuitEngine } from '@redbyte/rb-logic-core';
import { parseVhdl } from '../vhdlImport';
import { parsedHdlToCircuit } from '../hdlToCircuit';
import { expectRefusedByName, read, risingEdge, settle, vhdlTop, wiresOf } from './importTestKit';

/**
 * An instance port is an input or an output because the engine reads or publishes it
 * (inputPinsOf / outputPortsOf), not because of its spelling; what the importer cannot rebuild
 * exactly is refused by name. Every expectation is computed from the source VHDL by hand (a truth
 * table or a clocked sequence), never from the engine, which is only the thing measured.
 */

// ── I1: FullAdder outputs are sources under the engine's names (Sum, Cout) ──────────────────

const RIPPLE = vhdlTop(
  'SW0, SW1, SW2, SW3, SW4 : in std_logic; LD0, LD1, LD2 : out std_logic',
  '  signal c1 : std_logic;',
  [
    '  u0 : entity work.FullAdder port map (A => SW0, B => SW2, Cin => SW4, Sum => LD0, Cout => c1);',
    '  u1 : entity work.FullAdder port map (A => SW1, B => SW3, Cin => c1, Sum => LD1, Cout => LD2);',
  ].join('\n'),
);

describe('I1 two-bit ripple adder: the internal carry is a source', () => {
  it('wires u0.Cout into u1.Cin and never wires into a FullAdder output', () => {
    const result = parsedHdlToCircuit(parseVhdl(RIPPLE));
    const wires = wiresOf(result.circuit);
    expect(wires).toContain('u0.Cout->u1.Cin');
    expect(wires.filter((wire) => /->u[01]\.(Sum|Cout)$/.test(wire))).toEqual([]);
    expect(result.warnings.filter((warning) => warning.includes('not driven'))).toEqual([]);
    expect(result.reconstructionLevel).toBe('full');
  });

  it('computes (SW1 SW0) + (SW3 SW2) + SW4 for all 32 inputs', () => {
    const engine = new CircuitEngine(parsedHdlToCircuit(parseVhdl(RIPPLE)).circuit);
    for (let n = 0; n < 32; n += 1) {
      const [sw0, sw1, sw2, sw3, sw4] = [0, 1, 2, 3, 4].map((bit) => (n >> bit) & 1);
      settle(engine, { port_SW0: sw0, port_SW1: sw1, port_SW2: sw2, port_SW3: sw3, port_SW4: sw4 });
      const total = sw0 + 2 * sw1 + sw2 + 2 * sw3 + sw4;
      expect([read(engine, 'port_out_LD0'), read(engine, 'port_out_LD1'), read(engine, 'port_out_LD2')], `n=${n}`)
        .toEqual([total & 1, (total >> 1) & 1, (total >> 2) & 1]);
    }
  });
});

// ── I3: a flip-flop's Q_inv is a source ─────────────────────────────────────────────────────

const DFF_QINV = vhdlTop(
  'CLK100MHZ : in std_logic; SW0 : in std_logic; LD0 : out std_logic',
  '  signal qb : std_logic;',
  '  u0 : entity work.DFlipFlop port map (D => qb, CLK => CLK100MHZ, RST => SW0, Q => LD0, Q_inv => qb);',
);

describe('I3 DFlipFlop whose Q_inv feeds its D', () => {
  it('wires u0.Q_inv into u0.D', () => {
    const result = parsedHdlToCircuit(parseVhdl(DFF_QINV));
    expect(wiresOf(result.circuit)).toContain('u0.Q_inv->u0.D');
    expect(result.warnings.filter((warning) => warning.includes('not driven'))).toEqual([]);
  });

  it('toggles at every rising edge after reset: 0, 1, 0, 1', () => {
    const engine = new CircuitEngine(parsedHdlToCircuit(parseVhdl(DFF_QINV)).circuit);
    const seen: unknown[] = [];
    settle(engine, { port_SW0: 1 });
    risingEdge(engine, 'port_CLK100MHZ');
    seen.push(read(engine, 'port_out_LD0'));
    settle(engine, { port_SW0: 0 });
    for (let edge = 0; edge < 3; edge += 1) {
      risingEdge(engine, 'port_CLK100MHZ');
      seen.push(read(engine, 'port_out_LD0'));
    }
    expect(seen).toEqual([0, 1, 0, 1]);
  });
});

// ── Constants in a port map are ties, not unconnected pins ──────────────────────────────────

describe("a port tied to '1' is driven high", () => {
  const TIED = vhdlTop(
    'SW0, SW1 : in std_logic; LD0, LD1 : out std_logic',
    '',
    "  u0 : entity work.FullAdder port map (A => SW0, B => SW1, Cin => '1', Sum => LD0, Cout => LD1);",
  );

  it('computes SW0 + SW1 + 1 for all four inputs', () => {
    const result = parsedHdlToCircuit(parseVhdl(TIED));
    expect(result.reconstructionLevel).toBe('full');
    const engine = new CircuitEngine(result.circuit);
    for (let n = 0; n < 4; n += 1) {
      const [sw0, sw1] = [n & 1, (n >> 1) & 1];
      settle(engine, { port_SW0: sw0, port_SW1: sw1 });
      const total = sw0 + sw1 + 1;
      expect([read(engine, 'port_out_LD0'), read(engine, 'port_out_LD1')], `n=${n}`).toEqual([total & 1, total >> 1]);
    }
  });
});

// ── Fail closed: what cannot be rebuilt exactly is refused by name ──────────────────────────

describe('instances the importer cannot wire exactly are refused by name', () => {
  it('an instance input that reads a signal nothing drives', () => {
    expectRefusedByName(
      vhdlTop('SW0 : in std_logic; LD0 : out std_logic', '  signal ghost : std_logic;', '  u0 : entity work.AND2 port map (A => SW0, B => ghost, Y => LD0);'),
      /ghost/,
    );
  });

  it('an instance of a component the importer does not know', () => {
    expectRefusedByName(
      vhdlTop('SW0, SW1 : in std_logic; LD0, LD1 : out std_logic', '  signal t : std_logic;', [
        '  u0 : entity work.my_mystery port map (a => SW0, y => t);',
        '  u1 : entity work.AND2 port map (A => t, B => SW1, Y => LD0);',
        '  u2 : entity work.OR2 port map (A => SW0, B => SW1, Y => LD1);',
      ].join('\n')),
      /my_mystery/,
    );
  });
});
