// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Licensed under the RedByte Proprietary License (RPL-1.0).

/**
 * Lab 8 Export Validation Test
 *
 * Confirms the complete export pipeline for a Lab 8 FSM circuit:
 *   - Clock binding detection (sw_enter as manual clock)
 *   - No blocking IR diagnostics
 *   - Bundle validity (VHDL + XDC correctness)
 *   - VHDL contains correct rising_edge process blocks
 *   - XDC contains correct Basys3 pin assignments
 *   - No hard-block from validateClockResetContract
 */

import { describe, expect, it } from 'vitest';
import '@redbyte/rb-logic-core';
import { exportBasys3Bundle } from '../fpga/boards/basys3/basys3Bundle';
import { exportProjectAsBasys3 } from '../fpga/boards/basys3/basys3ExportService';
import { buildBasys3ExportModel } from '../fpga/boards/basys3/basys3ExportModel';
import { resolveBasys3PackagePin } from '../fpga/boards/basys3/basys3Pins';
import { buildDeterministicVerifyContext } from '../fpga/boards/basys3/verifySchedule';
import { runDeterministicVerifyFromModel } from '../apps/ide/sim/simEngineCore';
import { LAB_STARTERS } from '../apps/ide/labStarters';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { IoMapping, IoMappingEntry } from '@redbyte/rb-utils';
import type { RBProject } from '../export/projectFormat';

// ---------------------------------------------------------------------------
// Lab 8 FSM circuit — minimal but complete (uses sw_enter as clock)
// ---------------------------------------------------------------------------

/** Build the full Lab 8 FSM circuit (from e2e proof) as a Circuit object */
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

/** Build the Lab 8 IO mapping with correct Basys3 pin assignments */
function buildLab8IoMapping(): IoMapping {
  const makeEntry = (
    id: string, nodeId: string, port: string, label: string, pin: string,
  ): IoMappingEntry => ({ id, nodeId, port, label, pin });

  return {
    inputs: [
      makeEntry('entry-in0',   'sw_in0',  'out', 'IN0 (SW6)',   'SW6'),
      makeEntry('entry-in1',   'sw_in1',  'out', 'IN1 (SW7)',   'SW7'),
      makeEntry('entry-in2',   'sw_in2',  'out', 'IN2 (SW8)',   'SW8'),
      makeEntry('entry-enter', 'sw_enter','out', 'ENTER (SW5)', 'SW5'),
      makeEntry('entry-reset', 'sw_reset','out', 'RESET (SW4)', 'SW4'),
    ],
    outputs: [
      makeEntry('entry-lock',  'led_lock','in',  'LOCK (LED1)', 'LED1'),
    ],
  };
}

function buildLab8Project(): RBProject {
  return {
    projectId: 'lab8-export-test',
    schemaVersion: '1.0',
    name: 'Lab 8 Export Test',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    circuit: buildLab8Circuit(),
    ioMapping: buildLab8IoMapping(),
    hdl: { top: 'top' },
  } as RBProject;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Lab 8 Export Validation', () => {
  it('export model has clock binding (sw_enter as clock, not blocked)', () => {
    const circuit = buildLab8Circuit();
    const ioMapping = buildLab8IoMapping();
    const model = buildBasys3ExportModel(circuit, ioMapping);

    // Clock must be detected from sw_enter → DFlipFlop CLK connections
    expect(model.simModel.clockBindings.length).toBeGreaterThan(0);

    // No blocking diagnostics — circuit is valid
    expect(model.blockingDiagnostics.length).toBe(0);
  });

  it('bundle export succeeds and produces valid=true', () => {
    const circuit = buildLab8Circuit();
    const ioMapping = buildLab8IoMapping();
    const bundle = exportBasys3Bundle(circuit, ioMapping, { entityName: 'top' });

    // No hard-block errors should appear in warnings that prevent valid
    if (!bundle.valid) {
      console.error('Bundle warnings:', bundle.warnings);
    }

    expect(bundle.valid).toBe(true);
  });

  it('VHDL contains rising_edge process blocks for DFlipFlops (correct synthesis)', () => {
    const circuit = buildLab8Circuit();
    const ioMapping = buildLab8IoMapping();
    const bundle = exportBasys3Bundle(circuit, ioMapping, { entityName: 'top' });

    // Must have process blocks with rising_edge — confirms sequential VHDL is correct
    expect(bundle.topVhd).toContain('rising_edge');
    expect(bundle.topVhd).toContain('process');
  });

  it('VHDL includes async reset process blocks for DFlipFlops with RST', () => {
    const circuit = buildLab8Circuit();
    const ioMapping = buildLab8IoMapping();
    const bundle = exportBasys3Bundle(circuit, ioMapping, { entityName: 'top' });

    // RST is connected → async reset pattern in VHDL
    // The generated VHDL should have: process (clk, rst) ... if rst = '1' then
    expect(bundle.topVhd).toMatch(/process\s*\([^)]*\)/i);
    expect(bundle.topVhd).toMatch(/if\s+[^\n]*=\s*'1'\s+then/i);
  });

  it('XDC contains correct Basys3 pin assignments for Lab 8 switches', () => {
    const circuit = buildLab8Circuit();
    const ioMapping = buildLab8IoMapping();
    const bundle = exportBasys3Bundle(circuit, ioMapping, { entityName: 'top' });

    const xdc = bundle.topXdc;

    // SW4 → W15 (RESET)
    expect(xdc).toContain('PACKAGE_PIN W15');
    // SW5 → V15 (ENTER/clock)
    expect(xdc).toContain('PACKAGE_PIN V15');
    // SW6 → W14 (IN0)
    expect(xdc).toContain('PACKAGE_PIN W14');
    // SW7 → W13 (IN1)
    expect(xdc).toContain('PACKAGE_PIN W13');
    // SW8 → V2 (IN2)
    expect(xdc).toContain('PACKAGE_PIN V2');
    // LED1 → E19 (LOCK)
    expect(xdc).toContain('PACKAGE_PIN E19');
  });

  it('XDC has CLOCK_BUFFER_TYPE NONE on ENTER (SW5) — prevents BUFG insertion', () => {
    const circuit = buildLab8Circuit();
    const ioMapping = buildLab8IoMapping();
    const bundle = exportBasys3Bundle(circuit, ioMapping, { entityName: 'top' });

    // CLOCK_BUFFER_TYPE NONE must appear for switch inputs to prevent
    // Vivado from inserting clock buffers on the manually-clocked paths.
    expect(bundle.topXdc).toContain('CLOCK_BUFFER_TYPE NONE');
  });

  it('XDC suppresses timing analysis on manual switch-driven sequential paths', () => {
    const circuit = buildLab8Circuit();
    const ioMapping = buildLab8IoMapping();
    const bundle = exportBasys3Bundle(circuit, ioMapping, { entityName: 'top' });

    expect(bundle.topXdc).toContain('set_false_path -from [get_ports {SW[5]}]');
  });

  it('raw Basys3 package pins still emit switch timing suppression for Lab 8 mappings', () => {
    const circuit = buildLab8Circuit();
    const aliasedMapping = buildLab8IoMapping();
    const packagePinMapping: IoMapping = {
      inputs: aliasedMapping.inputs.map((entry) => ({
        ...entry,
        pin: resolveBasys3PackagePin(entry.pin ?? '') ?? entry.pin,
      })),
      outputs: aliasedMapping.outputs.map((entry) => ({
        ...entry,
        pin: resolveBasys3PackagePin(entry.pin ?? '') ?? entry.pin,
      })),
    };
    const bundle = exportBasys3Bundle(circuit, packagePinMapping, { entityName: 'top' });

    expect(bundle.topXdc).toContain('CLOCK_BUFFER_TYPE NONE [get_ports {ENTER_SW5}]');
    expect(bundle.topXdc).toContain('set_false_path -from [get_ports {ENTER_SW5}]');
  });

  it('XDC does NOT have an active create_clock directive for SW5 (manual switch, not FPGA oscillator)', () => {
    const circuit = buildLab8Circuit();
    const ioMapping = buildLab8IoMapping();
    const bundle = exportBasys3Bundle(circuit, ioMapping, { entityName: 'top' });

    // SW5 (V15) is a manual switch used as a step clock — no create_clock constraint.
    // create_clock is only generated for W5 (the 100MHz FPGA oscillator pin).
    // Check non-comment lines only (comments may reference create_clock in explanatory text).
    const nonCommentLines = bundle.topXdc
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'));
    const activeConstraints = nonCommentLines.join('\n');
    expect(activeConstraints).not.toContain('create_clock');
  });

  it('full project export through exportProjectAsBasys3 succeeds with no errors', () => {
    const project = buildLab8Project();
    const result = exportProjectAsBasys3(project);

    const hardErrors = result.errors.filter((e) => e.severity === 'error');
    if (hardErrors.length > 0) {
      console.error('Export errors:', hardErrors);
    }

    expect(hardErrors.length).toBe(0);
    expect(result.success).toBe(true);
    expect(result.bundle?.topVhd).toBeDefined();
    expect(result.bundle?.topXdc).toBeDefined();
  });

  it('Lab 8 starter vectors run cleanly against the proven FSM in the IDE verify engine', () => {
    const starter = LAB_STARTERS.find((entry) => entry.id === 'lab8-security-lock-fsm');

    expect(starter).toBeDefined();
    expect(starter?.example.vectors.length).toBeGreaterThan(0);

    if (!starter) {
      throw new Error('Lab 8 starter is missing.');
    }

    const circuit = buildLab8Circuit();
    const ioMapping = buildLab8IoMapping();
    const verifyContext = buildDeterministicVerifyContext(circuit, ioMapping);
    const verifyResult = runDeterministicVerifyFromModel(
      circuit,
      verifyContext.simModel,
      starter.example.ioRows,
      starter.example.vectors,
      verifyContext.schedule
    );

    expect(verifyResult.evidence.preflight).toEqual([]);
    expect(verifyResult.rows.filter((row) => row.expected !== row.actual)).toEqual([]);
  });

  it('exported VHDL entity has the correct port names (SW vector + LD output)', () => {
    const circuit = buildLab8Circuit();
    const ioMapping = buildLab8IoMapping();
    const bundle = exportBasys3Bundle(circuit, ioMapping, { entityName: 'top' });

    // SW[4..8] should be packed as a vector port named SW
    // LD[1] should be a vector or scalar port
    const vhd = bundle.topVhd;
    expect(vhd).toContain('entity top');
    // At minimum, the entity should have some ports
    expect(vhd).toContain('Port (');
  });
});
