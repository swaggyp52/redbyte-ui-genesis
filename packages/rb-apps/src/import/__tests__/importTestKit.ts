// Shared helpers for the importer regression tests (not a test file itself).
import { expect } from 'vitest';
import type { Circuit, CircuitEngine } from '@redbyte/rb-logic-core';
import { parseVhdl } from '../vhdlImport';
import { buildImportedProjectCompilerResult } from '../importCompiler';
import { exportProjectAsBasys3 } from '../../fpga/boards/basys3/basys3ExportService';

type End = { nodeId: string; portName: string };

export const wiresOf = (circuit: Circuit): string[] =>
  circuit.connections.map((c) => `${(c.from as End).nodeId}.${(c.from as End).portName}->${(c.to as End).nodeId}.${(c.to as End).portName}`);

export function vhdlTop(ports: string, declarations: string, body: string): string {
  return ['library ieee;', 'use ieee.std_logic_1164.all;', 'entity top is', `  port (${ports});`, 'end entity top;',
    'architecture rtl of top is', declarations, 'begin', body, 'end architecture rtl;', ''].join('\n');
}

/** A clocked process with an asynchronous active-high reset on SW0, then `LD0 <= q`. */
export const clockedProcess = (ports: string, nextState: string): string => vhdlTop(ports, '  signal q : std_logic;', [
  '  process (CLK100MHZ, SW0)', '  begin', "    if SW0 = '1' then", "      q <= '0';",
  '    elsif rising_edge(CLK100MHZ) then', `      q <= ${nextState};`, '    end if;', '  end process;', '  LD0 <= q;',
].join('\n'));

/** Drive INPUT nodes and settle. */
export function settle(engine: CircuitEngine, inputs: Record<string, number>): void {
  for (const [id, value] of Object.entries(inputs)) engine.setNodeState(id, { isOn: value });
  engine.stabilize();
}

export function risingEdge(engine: CircuitEngine, clock: string): void {
  settle(engine, { [clock]: 0 });
  settle(engine, { [clock]: 1 });
}

export const read = (engine: CircuitEngine, id: string): unknown => engine.getNodeState(id)?.isOn;

/**
 * Import as the IDE does (buildImportedProjectCompilerResult), then export the project for the
 * Basys3: the construct must be named by a blocking diagnostic, the circuit must be the port
 * scaffold, and Export must refuse it by naming LD0 rather than ship LD0 tied low.
 */
export function expectRefusedByName(vhdl: string, named: RegExp) {
  const parsedHdl = parseVhdl(vhdl);
  const result = buildImportedProjectCompilerResult({ sourceName: 'top.vhd', topPath: 'top.vhd', topText: vhdl, parsedHdl });
  const project = result.project;
  project.ioMapping = {
    inputs: parsedHdl.ports.filter((p) => p.direction === 'in').map((p, i) => ({ id: p.name, nodeId: `port_${p.name}`, port: 'out', label: p.name, pin: p.name === 'CLK100MHZ' ? 'CLK100MHZ' : `SW${i}` })),
    outputs: parsedHdl.ports.filter((p) => p.direction === 'out').map((p, i) => ({ id: p.name, nodeId: `port_out_${p.name}`, port: 'in', label: p.name, pin: `LD${i}` })),
  };
  const exported = exportProjectAsBasys3(project);

  expect(result.reconstructionLevel).toBe('ports-only');
  expect(result.status.reconstruction).toBe('partial');
  // Nothing of the body is kept: a partial body would simulate and export logic the source does not describe.
  expect(result.circuit.nodes.every((node) => node.type === 'INPUT' || node.type === 'OUTPUT')).toBe(true);
  expect(result.circuit.connections).toEqual([]);
  const blocking = result.parserDiagnostics.filter((d) => d.severity === 'error' && d.blocking === true);
  expect(blocking.map((d) => d.message).join('\n')).toMatch(named);
  expect(exported.success).toBe(false);
  expect(exported.errors.filter((e) => e.severity === 'error').map((e) => e.message).join('\n')).toMatch(/LD0/);
  expect(exported.bundle?.topVhd ?? '').not.toMatch(/<= '0';/);
  return result;
}
