import { describe, expect, it } from 'vitest';
import { CircuitEngine } from '@redbyte/rb-logic-core';
import { parseVhdl } from '../vhdlImport';
import { parsedHdlToCircuit } from '../hdlToCircuit';
import { clockedProcess, expectRefusedByName, read, risingEdge, settle, vhdlTop, wiresOf } from './importTestKit';

/**
 * A register process's next state is an expression: the importer rebuilds it as gates feeding
 * the register's D, or refuses it by name. It used to keep the text ("not q") as a signal name,
 * leave D unconnected and export `reg <= '0'` at every edge with a "full" reconstruction.
 * Expectations are hand-computed clocked sequences from the source VHDL.
 */

const TOGGLE = clockedProcess('CLK100MHZ : in std_logic; SW0 : in std_logic; LD0 : out std_logic', 'not q');
const AND_NEXT = clockedProcess('CLK100MHZ : in std_logic; SW0, SW1, SW2 : in std_logic; LD0 : out std_logic', 'SW1 and SW2');

describe('I2 process register with next state "not q"', () => {
  it('feeds the register D from a NOT of its own output', () => {
    const result = parsedHdlToCircuit(parseVhdl(TOGGLE));
    const register = result.circuit.nodes.find((node) => node.type === 'Register1');
    const not = result.circuit.nodes.find((node) => node.type === 'NOT');
    expect(register && not).toBeTruthy();
    const wires = wiresOf(result.circuit);
    expect(wires).toContain(`${register!.id}.out->${not!.id}.in`);
    expect(wires).toContain(`${not!.id}.out->${register!.id}.D`);
    expect(result.reconstructionLevel).toBe('full');
  });

  it('toggles at every rising edge after reset: 0, 1, 0, 1', () => {
    const engine = new CircuitEngine(parsedHdlToCircuit(parseVhdl(TOGGLE)).circuit);
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

describe('I4 process register with next state "SW1 and SW2"', () => {
  it('feeds the register D from an AND of SW1 and SW2', () => {
    const result = parsedHdlToCircuit(parseVhdl(AND_NEXT));
    const register = result.circuit.nodes.find((node) => node.type === 'Register1');
    const and = result.circuit.nodes.find((node) => node.type === 'AND');
    expect(register && and).toBeTruthy();
    expect(wiresOf(result.circuit)).toEqual(expect.arrayContaining([
      `port_SW1.out->${and!.id}.a`, `port_SW2.out->${and!.id}.b`, `${and!.id}.out->${register!.id}.D`,
    ]));
  });

  it('captures SW1 and SW2 at each rising edge after reset', () => {
    const engine = new CircuitEngine(parsedHdlToCircuit(parseVhdl(AND_NEXT)).circuit);
    settle(engine, { port_SW0: 1, port_SW1: 1, port_SW2: 1 });
    risingEdge(engine, 'port_CLK100MHZ');
    const seen: unknown[] = [read(engine, 'port_out_LD0')];
    const steps: Array<[number, number]> = [[1, 1], [0, 1], [1, 0], [1, 1], [0, 0]];
    settle(engine, { port_SW0: 0 });
    for (const [sw1, sw2] of steps) {
      settle(engine, { port_SW1: sw1, port_SW2: sw2 });
      risingEdge(engine, 'port_CLK100MHZ');
      seen.push(read(engine, 'port_out_LD0'));
    }
    expect(seen).toEqual([0, ...steps.map(([sw1, sw2]) => sw1 & sw2)]);
  });
});

describe('processes and expressions the importer cannot rebuild are refused by name', () => {
  it('a register next state with an operator the importer does not rebuild (nand)', () => {
    expectRefusedByName(
      clockedProcess('CLK100MHZ : in std_logic; SW0, SW1, SW2 : in std_logic; LD0 : out std_logic', 'SW1 nand SW2'),
      /q.*SW1 nand SW2/,
    );
  });

  it('a process that is not the register template', () => {
    expectRefusedByName(
      vhdlTop('SW0, SW1 : in std_logic; LD0 : out std_logic', '', '  process (SW0, SW1)\n  begin\n    LD0 <= SW0 and SW1;\n  end process;'),
      /PROCESS \(SW0, SW1\)/,
    );
  });
});
