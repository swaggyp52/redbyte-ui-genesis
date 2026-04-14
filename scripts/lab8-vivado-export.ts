/**
 * Lab 8 Security Lock — Full Vivado Export Kit
 *
 * Builds the solved FSM circuit from the RedByte circuit graph,
 * runs it through the real export pipeline, and writes:
 *   out/lab8/top.vhd          — synthesizable VHDL top module
 *   out/lab8/top.xdc          — Basys3 pin constraints
 *   out/lab8/vivado_import.tcl — Vivado project creation script
 *   out/lab8/testbench.vhd    — simulation testbench
 *   out/lab8/README.md        — pin map + quickstart
 *   out/lab8/lab8_security_lock.rb-lab.zip — importable Vivado kit
 *   out/lab8/run-log.txt      — this run's diagnostics
 *
 * Usage:
 *   pnpm exec tsx scripts/lab8-vivado-export.ts
 *
 * Then in Vivado:
 *   vivado -mode batch -source out/lab8/vivado_import.tcl -notrace -nojournal -log vivado_import.log
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDeterministicZip, sha256Hex } from '../packages/rb-apps/src/export/deterministicZip';
import { exportBasys3Bundle } from '../packages/rb-apps/src/fpga/boards/basys3/basys3Bundle';
import { generateVivadoImportTcl } from '../packages/rb-apps/src/fpga/boards/basys3/vivadoImportTcl';
// NOTE: generateTestbenchVhdl is intentionally NOT imported here.
// verifySchedule.ts has a runtime re-export from @redbyte/rb-utils which uses
// import.meta.env (Vite-only), crashing under tsx/Node. A hand-written testbench
// is generated inline instead — it is functionally equivalent and Vivado-compatible.
import type { Circuit } from '@redbyte/rb-logic-core';

type IoMappingEntry = { id: string; nodeId: string; port: string; label?: string; pin?: string };
type IoMapping = { inputs: IoMappingEntry[]; outputs: IoMappingEntry[] };

// ---------------------------------------------------------------------------
// Circuit definition — Lab 8 FSM solved solution
// Exact same topology as lab8-export-validation.test.ts buildLab8Circuit()
// ---------------------------------------------------------------------------
function buildLab8Circuit(): Circuit {
  let connSeq = 0;
  const cid = () => `conn_${++connSeq}`;

  return {
    nodes: [
      { id: 'sw_in2',  type: 'Switch', label: 'IN2 (SW8)', position: { x: 80,  y: 70  }, rotation: 0, config: {} },
      { id: 'sw_in1',  type: 'Switch', label: 'IN1 (SW7)', position: { x: 80,  y: 140 }, rotation: 0, config: {} },
      { id: 'sw_in0',  type: 'Switch', label: 'IN0 (SW6)', position: { x: 80,  y: 210 }, rotation: 0, config: {} },
      { id: 'sw_enter',type: 'Switch', label: 'ENTER (SW5)', position: { x: 80, y: 280 }, rotation: 0, config: {} },
      { id: 'sw_reset',type: 'Switch', label: 'RESET (SW4)', position: { x: 80, y: 350 }, rotation: 0, config: {} },
      { id: 'led_lock', type: 'Lamp',  label: 'LOCK (LED1)', position: { x: 920, y: 220 }, rotation: 0, config: {} },
      { id: 'not_in0',  type: 'NOT',   label: '',            position: { x: 260, y: 210 }, rotation: 0, config: {} },
      { id: 'or_pos',       type: 'OR',  label: '', position: { x: 300, y: 470 }, rotation: 0, config: {} },
      { id: 'nor_pos_next', type: 'NOT', label: '', position: { x: 380, y: 470 }, rotation: 0, config: {} },
      { id: 'not_p0',       type: 'NOT', label: '', position: { x: 300, y: 510 }, rotation: 0, config: {} },
      { id: 'not_p1',       type: 'NOT', label: '', position: { x: 300, y: 550 }, rotation: 0, config: {} },
      { id: 'and_at_p0',    type: 'AND', label: '', position: { x: 380, y: 530 }, rotation: 0, config: {} },
      { id: 'and_at_p1',    type: 'AND', label: '', position: { x: 380, y: 570 }, rotation: 0, config: {} },
      { id: 'and_at_p2',    type: 'AND', label: '', position: { x: 380, y: 590 }, rotation: 0, config: {} },
      { id: 'xor_bits',     type: 'XOR', label: '', position: { x: 420, y: 310 }, rotation: 0, config: {} },
      { id: 'and_gv1',      type: 'AND', label: '', position: { x: 500, y: 380 }, rotation: 0, config: {} },
      { id: 'and_gv_final', type: 'AND', label: '', position: { x: 580, y: 350 }, rotation: 0, config: {} },
      { id: 'and_m2d', type: 'AND', label: '', position: { x: 680, y: 330 }, rotation: 0, config: {} },
      { id: 'and_m3d', type: 'AND', label: '', position: { x: 680, y: 380 }, rotation: 0, config: {} },
      { id: 'and_m4d', type: 'AND', label: '', position: { x: 680, y: 430 }, rotation: 0, config: {} },
      { id: 'dff_b_at_p0', type: 'DFlipFlop', label: '', position: { x: 480, y: 530 }, rotation: 0, config: {} },
      { id: 'dff_b_at_p1', type: 'DFlipFlop', label: '', position: { x: 480, y: 590 }, rotation: 0, config: {} },
      { id: 'dff_pos1',    type: 'DFlipFlop', label: '', position: { x: 480, y: 490 }, rotation: 0, config: {} },
      { id: 'dff_pos0',    type: 'DFlipFlop', label: '', position: { x: 560, y: 470 }, rotation: 0, config: {} },
      { id: 'dff_m1', type: 'DFlipFlop', label: '', position: { x: 760, y: 300 }, rotation: 0, config: {} },
      { id: 'dff_m2', type: 'DFlipFlop', label: '', position: { x: 760, y: 340 }, rotation: 0, config: {} },
      { id: 'dff_m3', type: 'DFlipFlop', label: '', position: { x: 760, y: 380 }, rotation: 0, config: {} },
      { id: 'dff_m4', type: 'DFlipFlop', label: '', position: { x: 760, y: 420 }, rotation: 0, config: {} },
    ],
    connections: [
      { id: cid(), from: { nodeId: 'sw_in0',  portName: 'out' }, to: { nodeId: 'not_in0',    portName: 'in'  } },
      { id: cid(), from: { nodeId: 'sw_enter', portName: 'out' }, to: { nodeId: 'dff_b_at_p0', portName: 'CLK' } },
      { id: cid(), from: { nodeId: 'sw_enter', portName: 'out' }, to: { nodeId: 'dff_b_at_p1', portName: 'CLK' } },
      { id: cid(), from: { nodeId: 'sw_enter', portName: 'out' }, to: { nodeId: 'dff_pos0',    portName: 'CLK' } },
      { id: cid(), from: { nodeId: 'sw_enter', portName: 'out' }, to: { nodeId: 'dff_pos1',    portName: 'CLK' } },
      { id: cid(), from: { nodeId: 'sw_enter', portName: 'out' }, to: { nodeId: 'dff_m1',      portName: 'CLK' } },
      { id: cid(), from: { nodeId: 'sw_enter', portName: 'out' }, to: { nodeId: 'dff_m2',      portName: 'CLK' } },
      { id: cid(), from: { nodeId: 'sw_enter', portName: 'out' }, to: { nodeId: 'dff_m3',      portName: 'CLK' } },
      { id: cid(), from: { nodeId: 'sw_enter', portName: 'out' }, to: { nodeId: 'dff_m4',      portName: 'CLK' } },
      { id: cid(), from: { nodeId: 'sw_reset', portName: 'out' }, to: { nodeId: 'dff_b_at_p0', portName: 'RST' } },
      { id: cid(), from: { nodeId: 'sw_reset', portName: 'out' }, to: { nodeId: 'dff_b_at_p1', portName: 'RST' } },
      { id: cid(), from: { nodeId: 'sw_reset', portName: 'out' }, to: { nodeId: 'dff_pos0',    portName: 'RST' } },
      { id: cid(), from: { nodeId: 'sw_reset', portName: 'out' }, to: { nodeId: 'dff_pos1',    portName: 'RST' } },
      { id: cid(), from: { nodeId: 'sw_reset', portName: 'out' }, to: { nodeId: 'dff_m1',      portName: 'RST' } },
      { id: cid(), from: { nodeId: 'sw_reset', portName: 'out' }, to: { nodeId: 'dff_m2',      portName: 'RST' } },
      { id: cid(), from: { nodeId: 'sw_reset', portName: 'out' }, to: { nodeId: 'dff_m3',      portName: 'RST' } },
      { id: cid(), from: { nodeId: 'sw_reset', portName: 'out' }, to: { nodeId: 'dff_m4',      portName: 'RST' } },
      { id: cid(), from: { nodeId: 'sw_in0',      portName: 'out' }, to: { nodeId: 'dff_b_at_p0', portName: 'D' } },
      { id: cid(), from: { nodeId: 'sw_in0',      portName: 'out' }, to: { nodeId: 'dff_b_at_p1', portName: 'D' } },
      { id: cid(), from: { nodeId: 'dff_pos0',     portName: 'Q' }, to: { nodeId: 'or_pos',       portName: 'a' } },
      { id: cid(), from: { nodeId: 'dff_pos1',     portName: 'Q' }, to: { nodeId: 'or_pos',       portName: 'b' } },
      { id: cid(), from: { nodeId: 'or_pos',       portName: 'out' }, to: { nodeId: 'nor_pos_next', portName: 'in' } },
      { id: cid(), from: { nodeId: 'nor_pos_next', portName: 'out' }, to: { nodeId: 'dff_pos0',    portName: 'D' } },
      { id: cid(), from: { nodeId: 'dff_pos0',     portName: 'Q' }, to: { nodeId: 'dff_pos1',     portName: 'D' } },
      { id: cid(), from: { nodeId: 'dff_pos0', portName: 'Q' }, to: { nodeId: 'not_p0', portName: 'in' } },
      { id: cid(), from: { nodeId: 'dff_pos1', portName: 'Q' }, to: { nodeId: 'not_p1', portName: 'in' } },
      { id: cid(), from: { nodeId: 'not_p0', portName: 'out' }, to: { nodeId: 'and_at_p0', portName: 'a' } },
      { id: cid(), from: { nodeId: 'not_p1', portName: 'out' }, to: { nodeId: 'and_at_p0', portName: 'b' } },
      { id: cid(), from: { nodeId: 'dff_pos0', portName: 'Q' },   to: { nodeId: 'and_at_p1', portName: 'a' } },
      { id: cid(), from: { nodeId: 'not_p1',   portName: 'out' }, to: { nodeId: 'and_at_p1', portName: 'b' } },
      { id: cid(), from: { nodeId: 'not_p0',   portName: 'out' }, to: { nodeId: 'and_at_p2', portName: 'a' } },
      { id: cid(), from: { nodeId: 'dff_pos1', portName: 'Q' },   to: { nodeId: 'and_at_p2', portName: 'b' } },
      { id: cid(), from: { nodeId: 'and_at_p0', portName: 'out' }, to: { nodeId: 'dff_b_at_p0', portName: 'EN' } },
      { id: cid(), from: { nodeId: 'and_at_p1', portName: 'out' }, to: { nodeId: 'dff_b_at_p1', portName: 'EN' } },
      { id: cid(), from: { nodeId: 'dff_b_at_p0', portName: 'Q' }, to: { nodeId: 'xor_bits', portName: 'a' } },
      { id: cid(), from: { nodeId: 'dff_b_at_p1', portName: 'Q' }, to: { nodeId: 'xor_bits', portName: 'b' } },
      { id: cid(), from: { nodeId: 'and_at_p2', portName: 'out' }, to: { nodeId: 'and_gv1',      portName: 'a' } },
      { id: cid(), from: { nodeId: 'not_in0',   portName: 'out' }, to: { nodeId: 'and_gv1',      portName: 'b' } },
      { id: cid(), from: { nodeId: 'and_gv1',   portName: 'out' }, to: { nodeId: 'and_gv_final', portName: 'a' } },
      { id: cid(), from: { nodeId: 'xor_bits',  portName: 'out' }, to: { nodeId: 'and_gv_final', portName: 'b' } },
      { id: cid(), from: { nodeId: 'dff_m1',       portName: 'Q' },   to: { nodeId: 'and_m2d', portName: 'a' } },
      { id: cid(), from: { nodeId: 'and_gv_final', portName: 'out' }, to: { nodeId: 'and_m2d', portName: 'b' } },
      { id: cid(), from: { nodeId: 'dff_m2',       portName: 'Q' },   to: { nodeId: 'and_m3d', portName: 'a' } },
      { id: cid(), from: { nodeId: 'and_gv_final', portName: 'out' }, to: { nodeId: 'and_m3d', portName: 'b' } },
      { id: cid(), from: { nodeId: 'dff_m3',       portName: 'Q' },   to: { nodeId: 'and_m4d', portName: 'a' } },
      { id: cid(), from: { nodeId: 'and_gv_final', portName: 'out' }, to: { nodeId: 'and_m4d', portName: 'b' } },
      { id: cid(), from: { nodeId: 'and_gv_final', portName: 'out' }, to: { nodeId: 'dff_m1', portName: 'D' } },
      { id: cid(), from: { nodeId: 'and_m2d',      portName: 'out' }, to: { nodeId: 'dff_m2', portName: 'D' } },
      { id: cid(), from: { nodeId: 'and_m3d',      portName: 'out' }, to: { nodeId: 'dff_m3', portName: 'D' } },
      { id: cid(), from: { nodeId: 'and_m4d',      portName: 'out' }, to: { nodeId: 'dff_m4', portName: 'D' } },
      { id: cid(), from: { nodeId: 'and_at_p2', portName: 'out' }, to: { nodeId: 'dff_m1', portName: 'EN' } },
      { id: cid(), from: { nodeId: 'and_at_p2', portName: 'out' }, to: { nodeId: 'dff_m2', portName: 'EN' } },
      { id: cid(), from: { nodeId: 'and_at_p2', portName: 'out' }, to: { nodeId: 'dff_m3', portName: 'EN' } },
      { id: cid(), from: { nodeId: 'and_at_p2', portName: 'out' }, to: { nodeId: 'dff_m4', portName: 'EN' } },
      { id: cid(), from: { nodeId: 'dff_m4', portName: 'Q' }, to: { nodeId: 'led_lock', portName: 'in' } },
    ],
  } as unknown as Circuit;
}

function buildLab8IoMapping(): IoMapping {
  const e = (id: string, nodeId: string, port: string, label: string, pin: string): IoMappingEntry =>
    ({ id, nodeId, port, label, pin });
  return {
    inputs: [
      e('entry-in0',   'sw_in0',  'out', 'IN0 (SW6)',   'SW6'),
      e('entry-in1',   'sw_in1',  'out', 'IN1 (SW7)',   'SW7'),
      e('entry-in2',   'sw_in2',  'out', 'IN2 (SW8)',   'SW8'),
      e('entry-enter', 'sw_enter','out', 'ENTER (SW5)', 'SW5'),
      e('entry-reset', 'sw_reset','out', 'RESET (SW4)', 'SW4'),
    ],
    outputs: [
      e('entry-lock',  'led_lock','in',  'LOCK (LED1)', 'LED1'),
    ],
  };
}

// ---------------------------------------------------------------------------
// Test vectors — two 12-bit sequences for the testbench
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Inline testbench generator
// Avoids importing generateTestbenchVhdl (which chains through verifySchedule.ts
// → @redbyte/rb-utils re-export → import.meta.env crash under Node/tsx).
//
// Port names are determined by the ioMapping labels via sanitizeIdentifier:
//   SW4..SW8 aliases → packed as SW vector in VHDL entity (xdcRef = SW[N])
//   LED1 alias       → packed as LD vector (xdcRef = LD[N])
// ---------------------------------------------------------------------------
function buildTestbench(entityVhd: string): string {
  // Extract port block from entity so we use the exact port names/types
  const portMatch = entityVhd.match(/\bPort\s*\(([\s\S]*?)\n\s*\);/i);
  const portLines = portMatch
    ? portMatch[1]
        .split(';')
        .map((l) => l.trim())
        .filter(Boolean)
    : [];

  // Build component port declarations and signal declarations from entity
  const componentPorts: string[] = [];
  const signals: string[] = [];
  const inputSignals: string[] = [];
  const outputSignals: string[] = [];

  for (const portLine of portLines) {
    const colonIdx = portLine.indexOf(':');
    if (colonIdx < 0) continue;
    const name = portLine.slice(0, colonIdx).trim();
    const rest = portLine.slice(colonIdx + 1).trim();
    const isIn  = /\bin\b/i.test(rest);
    const isOut = /\bout\b/i.test(rest);
    const typeDecl = rest.replace(/\b(in|out)\b\s*/i, '').trim();
    componentPorts.push(`    ${name} : ${isIn ? 'in' : 'out'} ${typeDecl}`);
    signals.push(`  signal ${name} : ${typeDecl} := (others => '0');`);
    if (isIn)  inputSignals.push(name);
    if (isOut) outputSignals.push(name);
  }

  // Determine actual port names from entity for our sequences
  // SW vector: find which index corresponds to each input
  const swPort    = inputSignals.find((s) => /^SW/i.test(s)) ?? inputSignals[0] ?? 'SW';
  const ldPort    = outputSignals.find((s) => /^L[DE]/i.test(s)) ?? outputSignals[0] ?? 'LED';
  // CLK = SW[5] (ENTER), RST = SW[4] (RESET), DATA = SW[6] (IN0)
  const CLK = `${swPort}(5)`;
  const RST = `${swPort}(4)`;
  const DATA = `${swPort}(6)`;
  const LOCK = `${ldPort}(1)`;

  // Port map: connect signals to UUT
  const portMapEntries = [...inputSignals, ...outputSignals]
    .map((s) => `      ${s} => ${s}`)
    .join(',\n');

  // Procedure to pulse ENTER once (1→0 edge in positive-logic switch: SW5 high=pressed)
  // For this design, clock edge = rising edge of SW[5].
  // We pulse SW[5] high for 100 ns then low — one manual clock cycle.
  function applyBit(bit: '0' | '1', expectLock: '0' | '1'): string {
    return [
      `    ${DATA} <= '${bit}';`,
      `    wait for 50 ns;`,
      `    ${CLK} <= '1'; wait for 100 ns;`,
      `    ${CLK} <= '0'; wait for 50 ns;`,
      `    assert ${LOCK} = '${expectLock}'`,
      `      report "LOCK mismatch: expected ${expectLock}, got " & std_logic'image(${LOCK}) severity error;`,
    ].join('\n');
  }

  // Invalid stream: 110010010100 (lock must stay 0 throughout)
  const invalidSeq: ['0'|'1', '0'|'1'][] = [
    ['1','0'],['1','0'],['0','0'],['0','0'],['1','0'],['0','0'],
    ['0','0'],['1','0'],['0','0'],['1','0'],['0','0'],['0','0'],
  ];
  // Valid stream 1: 010100010100 (lock opens at bit 12)
  const valid1Seq: ['0'|'1', '0'|'1'][] = [
    ['0','0'],['1','0'],['0','0'],['1','0'],['0','0'],['0','0'],
    ['0','0'],['1','0'],['0','0'],['1','0'],['0','0'],['0','1'],
  ];
  // Valid stream 2: 100010100010 (lock opens at bit 12)
  const valid2Seq: ['0'|'1', '0'|'1'][] = [
    ['1','0'],['0','0'],['0','0'],['0','0'],['1','0'],['0','0'],
    ['1','0'],['0','0'],['0','0'],['0','0'],['1','0'],['0','1'],
  ];

  const invalidStim  = invalidSeq.map(([b,l]) => applyBit(b, l)).join('\n');
  const valid1Stim   = valid1Seq.map(([b,l]) => applyBit(b, l)).join('\n');
  const valid2Stim   = valid2Seq.map(([b,l]) => applyBit(b, l)).join('\n');

  return `-- Lab 8 Security Lock — VHDL Testbench
-- Generated by RedByte lab8-vivado-export.ts (inline generator)
-- Tests three 12-bit sequences as specified in ECE141 Lab 8.
--
-- Test 1 (INVALID): 110010010100 — 3 valid groups → LOCK must stay 0
-- Test 2 (VALID-1): 010100010100 — 4 valid groups → LOCK=1 at bit 12
-- Test 3 (VALID-2): 100010100010 — 4 valid groups → LOCK=1 at bit 12

library IEEE;
use IEEE.STD_LOGIC_1164.ALL;

entity tb_lab8 is
end entity tb_lab8;

architecture Behavioral of tb_lab8 is

  component top is
    Port (
${componentPorts.join(';\n')}
    );
  end component;

  -- DUT signals
${signals.join('\n')}

begin

  uut : top
    port map (
${portMapEntries}
    );

  stimulus : process
  begin
    -- ---------------------------------------------------------------
    -- Global reset
    -- ---------------------------------------------------------------
    ${RST} <= '1'; wait for 200 ns;
    ${RST} <= '0'; wait for 50 ns;

    -- ---------------------------------------------------------------
    -- Test 1: INVALID stream 110010010100
    -- Expected: LOCK = 0 after all 12 bits
    -- ---------------------------------------------------------------
    report "Test 1: INVALID stream 110010010100" severity note;
${invalidStim}
    report "Test 1 DONE: LOCK should be 0" severity note;
    wait for 200 ns;

    -- Reset between tests
    ${RST} <= '1'; wait for 200 ns; ${RST} <= '0'; wait for 50 ns;

    -- ---------------------------------------------------------------
    -- Test 2: VALID stream 1 = 010100010100
    -- Expected: LOCK = 1 after bit 12
    -- ---------------------------------------------------------------
    report "Test 2: VALID stream 010100010100" severity note;
${valid1Stim}
    assert ${LOCK} = '1' report "FAIL: LOCK should be 1 after valid stream 1" severity error;
    report "Test 2 DONE: LOCK=" & std_logic'image(${LOCK}) severity note;
    wait for 200 ns;

    -- Reset between tests
    ${RST} <= '1'; wait for 200 ns; ${RST} <= '0'; wait for 50 ns;

    -- ---------------------------------------------------------------
    -- Test 3: VALID stream 2 = 100010100010
    -- Expected: LOCK = 1 after bit 12
    -- ---------------------------------------------------------------
    report "Test 3: VALID stream 100010100010" severity note;
${valid2Stim}
    assert ${LOCK} = '1' report "FAIL: LOCK should be 1 after valid stream 2" severity error;
    report "Test 3 DONE: LOCK=" & std_logic'image(${LOCK}) severity note;

    report "All testbench checks complete." severity note;
    wait;
  end process stimulus;

end architecture Behavioral;
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function fail(msg: string): never {
  console.error(`[lab8-export] FAIL: ${msg}`);
  process.exit(1);
}

async function main() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot  = resolve(scriptDir, '..');
  const outDir    = join(repoRoot, 'out', 'lab8');
  mkdirSync(outDir, { recursive: true });

  const log: string[] = [
    `lab8-vivado-export run`,
    `date: ${new Date().toISOString()}`,
    '',
  ];
  const w = (s: string) => { log.push(s); console.log(s); };

  // Step 1: Build circuit + ioMapping
  w('=== Step 1: Building Lab 8 circuit ===');
  const circuit   = buildLab8Circuit();
  const ioMapping = buildLab8IoMapping();
  w(`nodes: ${circuit.nodes.length}, connections: ${circuit.connections.length}`);

  // Step 2: Run export pipeline
  w('\n=== Step 2: Running exportBasys3Bundle ===');
  const bundle = exportBasys3Bundle(circuit, ioMapping, { entityName: 'top' });
  if (bundle.warnings.length > 0) {
    w(`warnings (${bundle.warnings.length}):`);
    for (const wn of bundle.warnings) w(`  - ${wn}`);
  }
  if (!bundle.valid) {
    fail(`Bundle invalid after export. Warnings above.`);
  }
  w(`bundle.valid = ${bundle.valid}`);
  w(`top.vhd length: ${bundle.topVhd.length} chars`);
  w(`top.xdc length: ${bundle.topXdc.length} chars`);

  // Step 3: Generate Vivado import TCL
  w('\n=== Step 3: Generating vivado_import.tcl ===');
  const tclSrc = generateVivadoImportTcl({
    projectName:    'lab8_security_lock',
    topEntity:      'top',
    sourcePaths:    ['top.vhd'],
    constraintsPath: 'top.xdc',
    simulationPath: 'testbench.vhd',
    part:           'xc7a35tcpg236-1',
  });
  w(`vivado_import.tcl length: ${tclSrc.length} chars`);

  // Step 4: Generate testbench from entity VHDL (inline generator, no rb-utils chain)
  w('\n=== Step 4: Generating testbench.vhd ===');
  const testbenchVhd = buildTestbench(bundle.topVhd);
  w(`testbench.vhd length: ${testbenchVhd.length} chars`);

  // Step 5: Write individual files
  w('\n=== Step 5: Writing individual files ===');
  const files: { name: string; text: string }[] = [
    { name: 'top.vhd',           text: bundle.topVhd },
    { name: 'top.xdc',           text: bundle.topXdc },
    { name: 'vivado_import.tcl', text: tclSrc },
    { name: 'testbench.vhd',     text: testbenchVhd },
    { name: 'README.md',         text: bundle.readme },
  ];
  for (const f of files) {
    const outPath = join(outDir, f.name);
    writeFileSync(outPath, f.text, 'utf8');
    w(`  wrote: ${outPath}`);
  }

  // Step 6: Build deterministic zip
  w('\n=== Step 6: Building deterministic zip ===');
  const zipBytes = await buildDeterministicZip(files);
  const sha      = await sha256Hex(zipBytes);
  const zipPath  = join(outDir, 'lab8_security_lock.rb-lab.zip');
  writeFileSync(zipPath, Buffer.from(zipBytes));
  w(`  zip:    ${zipPath}`);
  w(`  sha256: ${sha}`);

  // Step 7: Verify zip determinism
  w('\n=== Step 7: Determinism check ===');
  const zipBytes2 = await buildDeterministicZip(files);
  const sha2      = await sha256Hex(zipBytes2);
  if (sha !== sha2) {
    fail(`ZIP is not deterministic: ${sha} vs ${sha2}`);
  }
  w(`determinism: PASS (sha256 stable across two builds)`);

  // Step 8: Print VHDL entity snippet for confirmation
  w('\n=== Step 8: VHDL entity head ===');
  const vhdlLines = bundle.topVhd.split('\n');
  const entityStart = vhdlLines.findIndex((l) => /\bentity\b/i.test(l));
  const entityEnd   = vhdlLines.findIndex((l, i) => i > entityStart && /\bend\s+entity\b/i.test(l));
  const entitySnippet = vhdlLines.slice(entityStart, Math.min(entityEnd + 1, entityStart + 40)).join('\n');
  w(entitySnippet);

  // Step 9: Print XDC snippet
  w('\n=== Step 9: XDC pin assignment summary ===');
  const xdcLines = bundle.topXdc.split('\n').filter((l) => l.includes('PACKAGE_PIN'));
  for (const l of xdcLines) w(`  ${l.trim()}`);

  // Step 10: Print Vivado usage instructions
  w('\n=== Step 10: Vivado usage ===');
  w('To create the Vivado project:');
  w(`  cd ${outDir}`);
  w(`  vivado -mode batch -source vivado_import.tcl -notrace -nojournal -log vivado_import.log`);
  w('');
  w('This creates: lab8_security_lock_vivado/lab8_security_lock.xpr');
  w('');
  w('Then open Vivado GUI → Open Project → lab8_security_lock.xpr');
  w('  1. Flow Navigator → Run Synthesis');
  w('  2. Flow Navigator → Run Implementation');
  w('  3. Flow Navigator → Generate Bitstream');
  w('  4. Open Hardware Manager → Program Device');

  // Write run log
  const logPath = join(outDir, 'run-log.txt');
  writeFileSync(logPath, log.join('\n') + '\n', 'utf8');
  console.log(`\n[lab8-export] run log: ${logPath}`);
  console.log('[lab8-export] DONE — all artifacts written to out/lab8/');

  // Summary table
  console.log('\n--- ARTIFACT SUMMARY ---');
  console.log(`  top.vhd            ${bundle.topVhd.length} chars`);
  console.log(`  top.xdc            ${bundle.topXdc.length} chars`);
  console.log(`  vivado_import.tcl  ${tclSrc.length} chars`);
  console.log(`  testbench.vhd      ${testbenchVhd.length} chars`);
  console.log(`  README.md          ${bundle.readme.length} chars`);
  console.log(`  zip sha256         ${sha}`);
  console.log(`  bundle.valid       ${bundle.valid}`);
  console.log('------------------------');
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
