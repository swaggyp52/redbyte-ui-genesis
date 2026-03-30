/**
 * Vivado Clean Export CI Gate
 *
 * Asserts that the generated Vivado project artifacts are clean:
 * - No obsolete EnableVHDL2008 project-level option in XPR (would cause Vivado warning)
 * - VHDLVersion=vhdl_2k8 set on design source AND testbench in XPR
 * - TCL sets VHDL 2008 on both sources_1 and sim_1 filesets
 * - Combinational XDC has explicit timing policy comment (not silent omission)
 * - Sequential/clock XDC has create_clock for the W5 Basys3 clock pin
 * - README contains writable-directory guidance (prevents vivado.jou errors)
 * - README contains harmless-noise classification (prevents student panic)
 *
 * Run: pnpm vitest run src/__tests__/vivado-clean-export-gate.test.ts
 */
import { describe, it, expect } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { IoMapping } from '@redbyte/rb-utils';
import {
  buildVivadoXpr,
  buildVivadoProjectFolderEntries,
  deriveVivadoProjectSlug,
  resolveVivadoPart,
} from '../fpga/vivado/vivadoProjectFolder';
import { generateVivadoImportTcl } from '../fpga/boards/basys3/vivadoImportTcl';
import { exportBasys3Bundle } from '../fpga/boards/basys3/basys3Bundle';
import { buildExportViewModel } from '../apps/ide/viewmodels/buildExportViewModel';
import type { RBProject } from '../export/projectFormat';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function buildCombinationalCircuit(): Circuit {
  return {
    nodes: [
      { id: 'sw0', type: 'INPUT', label: 'SW0', position: { x: 0, y: 0 } },
      { id: 'sw1', type: 'INPUT', label: 'SW1', position: { x: 0, y: 80 } },
      { id: 'and0', type: 'AND', label: 'AND', position: { x: 160, y: 40 } },
      { id: 'ld0', type: 'OUTPUT', label: 'LED0', position: { x: 320, y: 40 } },
    ] as any[],
    connections: [
      { id: 'c1', from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'and0', portName: 'a' } },
      { id: 'c2', from: { nodeId: 'sw1', portName: 'out' }, to: { nodeId: 'and0', portName: 'b' } },
      { id: 'c3', from: { nodeId: 'and0', portName: 'out' }, to: { nodeId: 'ld0', portName: 'in' } },
    ],
  } as Circuit;
}

function buildCombinationalIoMapping(): IoMapping {
  return {
    inputs: [
      { id: 'sw0', nodeId: 'sw0', port: 'out', label: 'SW0', pin: 'SW0' },
      { id: 'sw1', nodeId: 'sw1', port: 'out', label: 'SW1', pin: 'SW1' },
    ],
    outputs: [
      { id: 'ld0', nodeId: 'ld0', port: 'in', label: 'LED0', pin: 'LD0' },
    ],
  };
}

function buildSequentialIoMapping(): IoMapping {
  return {
    inputs: [
      { id: 'clk', nodeId: 'clk', port: 'out', label: 'clk', pin: 'CLK100MHZ' },
      { id: 'sw0', nodeId: 'sw0', port: 'out', label: 'SW0', pin: 'SW0' },
    ],
    outputs: [
      { id: 'ld0', nodeId: 'ld0', port: 'in', label: 'LED0', pin: 'LD0' },
    ],
  };
}

// ─── XPR: no EnableVHDL2008 project-level option ─────────────────────────────

describe('Vivado clean export — XPR has no obsolete EnableVHDL2008', () => {
  it('XPR without simulation does not contain EnableVHDL2008', () => {
    const xpr = buildVivadoXpr({
      projectFileName: 'test.xpr',
      topModule: 'top',
      xprId: 'deadbeef00000000',
      includeSimulation: false,
    });
    expect(xpr).not.toContain('EnableVHDL2008');
  });

  it('XPR with simulation does not contain EnableVHDL2008', () => {
    const xpr = buildVivadoXpr({
      projectFileName: 'test.xpr',
      topModule: 'top',
      xprId: 'deadbeef00000000',
      includeSimulation: true,
    });
    expect(xpr).not.toContain('EnableVHDL2008');
  });
});

// ─── XPR: VHDLVersion=vhdl_2k8 on design source ──────────────────────────────

describe('Vivado clean export — XPR sets VHDLVersion=vhdl_2k8 on design source', () => {
  it('sources_1/top.vhd has VHDLVersion=vhdl_2k8 in XPR', () => {
    const xpr = buildVivadoXpr({
      projectFileName: 'test.xpr',
      topModule: 'top',
      xprId: 'deadbeef00000000',
      includeSimulation: false,
    });
    // The sources_1 file block must contain the VHDLVersion attribute
    expect(xpr).toContain('<Attr Name="VHDLVersion" Val="vhdl_2k8"/>');
    // Must be within the sources_1 fileset (before sim_1)
    const sources1End = xpr.indexOf('</FileSet>');
    const vhdlVersionPos = xpr.indexOf('<Attr Name="VHDLVersion" Val="vhdl_2k8"/>');
    expect(vhdlVersionPos).toBeGreaterThan(-1);
    expect(vhdlVersionPos).toBeLessThan(sources1End);
  });
});

// ─── XPR: VHDLVersion=vhdl_2k8 on testbench ──────────────────────────────────

describe('Vivado clean export — XPR sets VHDLVersion=vhdl_2k8 on testbench', () => {
  it('sim_1/testbench.vhd has VHDLVersion=vhdl_2k8 when simulation is included', () => {
    const xpr = buildVivadoXpr({
      projectFileName: 'test.xpr',
      topModule: 'top',
      xprId: 'deadbeef00000000',
      includeSimulation: true,
    });
    // Both sources_1 and sim_1 blocks should contain VHDLVersion
    const occurrences = [...xpr.matchAll(/<Attr Name="VHDLVersion" Val="vhdl_2k8"\/>/g)];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);

    // Confirm testbench.vhd block specifically contains VHDLVersion
    const tbFileStart = xpr.indexOf('$PSRCDIR/sim_1/new/testbench.vhd');
    expect(tbFileStart).toBeGreaterThan(-1);
    const tbFileEnd = xpr.indexOf('</File>', tbFileStart);
    const tbBlock = xpr.slice(tbFileStart, tbFileEnd);
    expect(tbBlock).toContain('<Attr Name="VHDLVersion" Val="vhdl_2k8"/>');
  });

  it('XPR without simulation has exactly one VHDLVersion attribute (only for top.vhd)', () => {
    const xpr = buildVivadoXpr({
      projectFileName: 'test.xpr',
      topModule: 'top',
      xprId: 'deadbeef00000000',
      includeSimulation: false,
    });
    const occurrences = [...xpr.matchAll(/<Attr Name="VHDLVersion" Val="vhdl_2k8"\/>/g)];
    expect(occurrences.length).toBe(1);
  });
});

// ─── TCL: VHDL 2008 for sim_1 ────────────────────────────────────────────────

describe('Vivado clean export — TCL sets VHDL 2008 for sim_1', () => {
  it('TCL with testbench sets VHDL 2008 on sim_1 files', () => {
    const tcl = generateVivadoImportTcl({
      projectName: 'test_project',
      topEntity: 'top',
      sourcePaths: ['test_project.srcs/sources_1/new/top.vhd'],
      constraintsPath: 'test_project.srcs/constrs_1/new/basys3.xdc',
      simulationPath: 'test_project.srcs/sim_1/new/testbench.vhd',
    });
    expect(tcl).toContain('get_filesets sim_1');
    expect(tcl).toContain('set_property FILE_TYPE {VHDL 2008}');
    // The sim_1 property must come after the add_files for sim_1
    const addSimPos = tcl.indexOf('add_files -fileset sim_1');
    const sim1PropPos = tcl.indexOf('get_filesets sim_1');
    expect(addSimPos).toBeGreaterThan(-1);
    expect(sim1PropPos).toBeGreaterThan(addSimPos);
  });

  it('TCL without testbench does not reference sim_1', () => {
    const tcl = generateVivadoImportTcl({
      projectName: 'test_project',
      topEntity: 'top',
      sourcePaths: ['test_project.srcs/sources_1/new/top.vhd'],
      constraintsPath: 'test_project.srcs/constrs_1/new/basys3.xdc',
    });
    expect(tcl).not.toContain('add_files -fileset sim_1');
    expect(tcl).not.toContain('get_filesets sim_1');
  });

  it('TCL sets VHDL 2008 on sources_1 regardless of testbench', () => {
    const tcl = generateVivadoImportTcl({
      projectName: 'test_project',
      topEntity: 'top',
      sourcePaths: ['test_project.srcs/sources_1/new/top.vhd'],
      constraintsPath: 'test_project.srcs/constrs_1/new/basys3.xdc',
    });
    expect(tcl).toContain('get_filesets sources_1');
    expect(tcl).toContain('set_property FILE_TYPE {VHDL 2008}');
  });
});

// ─── XDC: clock policy (combinational vs sequential) ─────────────────────────

describe('Vivado clean export — XDC clock constraint policy', () => {
  it('combinational design XDC has no create_clock command (comment mentions it but no TCL command)', () => {
    const circuit = buildCombinationalCircuit();
    const ioMapping = buildCombinationalIoMapping();
    const bundle = exportBasys3Bundle(circuit, ioMapping);
    // Comments mention create_clock by design, but no actual TCL command should be emitted
    const commandLines = bundle.topXdc
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .filter((line) => line.includes('create_clock'));
    expect(commandLines).toHaveLength(0);
  });

  it('sequential/clock design XDC has create_clock for W5 (CLK100MHZ)', () => {
    const circuit = buildCombinationalCircuit();
    const ioMapping = buildSequentialIoMapping();
    const bundle = exportBasys3Bundle(circuit, ioMapping);
    expect(bundle.topXdc).toContain('-period 10.000');
    expect(bundle.topXdc).toContain('sys_clk');
    // Exactly one non-comment create_clock command
    const clockCommandLines = bundle.topXdc
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .filter((line) => line.includes('create_clock'));
    expect(clockCommandLines).toHaveLength(1);
  });

  it('clock constraint uses 100 MHz period (10.000 ns) for Basys3 W5 oscillator', () => {
    const circuit = buildCombinationalCircuit();
    const ioMapping = buildSequentialIoMapping();
    const bundle = exportBasys3Bundle(circuit, ioMapping);
    // Verify waveform is correct for 50% duty cycle at 100 MHz
    expect(bundle.topXdc).toContain('-waveform {0.000 5.000}');
  });

  it('combinational design XDC assigns LVCMOS33 IO standard to all mapped ports', () => {
    const circuit = buildCombinationalCircuit();
    const ioMapping = buildCombinationalIoMapping();
    const bundle = exportBasys3Bundle(circuit, ioMapping);
    const ioStdLines = bundle.topXdc
      .split('\n')
      .filter((line) => line.includes('IOSTANDARD'));
    expect(ioStdLines.length).toBeGreaterThanOrEqual(3); // sw0 + sw1 + led0
    for (const line of ioStdLines) {
      expect(line).toContain('LVCMOS33');
    }
  });

  it('combinational design XDC has explicit timing policy comment', () => {
    const circuit = buildCombinationalCircuit();
    const ioMapping = buildCombinationalIoMapping();
    const bundle = exportBasys3Bundle(circuit, ioMapping);
    // Must say "Combinational design" to be explicit, not silently absent
    expect(bundle.topXdc).toContain('Combinational design');
    expect(bundle.topXdc).toContain('create_clock intentionally omitted');
  });

  it('sequential design XDC has timing policy comment indicating sequential', () => {
    const circuit = buildCombinationalCircuit();
    const ioMapping = buildSequentialIoMapping();
    const bundle = exportBasys3Bundle(circuit, ioMapping);
    expect(bundle.topXdc).toContain('Sequential design');
    // Must NOT say combinational
    expect(bundle.topXdc).not.toContain('Combinational design');
  });

  it('combinational design XDC emits CLOCK_BUFFER_TYPE NONE for switch input ports', () => {
    const circuit = buildCombinationalCircuit();
    const ioMapping = buildCombinationalIoMapping();
    const bundle = exportBasys3Bundle(circuit, ioMapping);
    // SW/BTN ports must always get CLOCK_BUFFER_TYPE NONE to prevent Vivado
    // from inserting BUFG on non-clock paths (even in combinational designs).
    const bufNoneLines = bundle.topXdc
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .filter((line) => line.includes('CLOCK_BUFFER_TYPE NONE'));
    // SW0 + SW1 = 2 switch input ports
    expect(bufNoneLines).toHaveLength(2);
  });

  it('sequential-clocked design XDC emits CLOCK_BUFFER_TYPE NONE for switch ports (not for CLK)', () => {
    const circuit = buildCombinationalCircuit();
    const ioMapping = buildSequentialIoMapping();
    const bundle = exportBasys3Bundle(circuit, ioMapping);
    const bufNoneLines = bundle.topXdc
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .filter((line) => line.includes('CLOCK_BUFFER_TYPE NONE'));
    // sw0 = 1 switch input port; CLK100MHZ must NOT get CLOCK_BUFFER_TYPE NONE
    expect(bufNoneLines).toHaveLength(1);
    // CLK port must not have CLOCK_BUFFER_TYPE NONE (it needs the BUFG)
    expect(bufNoneLines.join('\n')).not.toContain('clk');
  });

  it('all design classifications include CLOCK_BUFFER_TYPE policy comment in XDC', () => {
    const circuit = buildCombinationalCircuit();
    // Combinational
    const combBundle = exportBasys3Bundle(circuit, buildCombinationalIoMapping());
    expect(combBundle.topXdc).toContain('CLOCK_BUFFER_TYPE NONE applied to all switch/button ports');
    // Sequential-clocked
    const seqBundle = exportBasys3Bundle(circuit, buildSequentialIoMapping());
    expect(seqBundle.topXdc).toContain('CLOCK_BUFFER_TYPE NONE applied to all switch/button ports');
  });
});

// ─── README: student-safe guidance ───────────────────────────────────────────

function buildMinimalProject(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-18T00:00:00.000Z',
    name: 'Clean Export Gate Fixture',
    description: 'Minimal fixture for README contract checks.',
    circuit: {
      nodes: [
        { id: 'sw0', type: 'Switch', x: 80, y: 80, label: 'SW0', config: {}, state: {} },
        { id: 'ld0', type: 'Lamp', x: 320, y: 80, label: 'LD0', config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'ld0', portName: 'in' } },
      ],
    },
    ioMapping: {
      inputs: [{ id: 'in_sw0', nodeId: 'sw0', port: 'out', label: 'SW0', pin: 'SW0' }],
      outputs: [{ id: 'out_ld0', nodeId: 'ld0', port: 'in', label: 'LD0', pin: 'LD0' }],
    },
    vectors: [],
    meta: { projectId: 'clean-export-gate-fixture' },
  };
}

async function buildReadmeForProject(project: RBProject): Promise<string> {
  const viewModel = buildExportViewModel(project);
  expect(viewModel.status).toBe('ok');
  const slug = deriveVivadoProjectSlug(project.meta?.projectId ?? project.name);
  const entries = await buildVivadoProjectFolderEntries({
    artifacts: viewModel.artifacts
      .filter((a) => a.content.trim().length > 0)
      .map((a) => ({ path: a.path, content: a.content })),
    projectName: project.name,
    projectSlug: slug,
    topModule: 'top',
    part: resolveVivadoPart(project.fpga?.part),
  });
  const readmeEntry = entries.find((e) => e.name.endsWith('README.txt'));
  expect(readmeEntry).toBeDefined();
  return readmeEntry?.text ?? '';
}

describe('Vivado clean export — README student-safe guidance contract', () => {
  it('README contains short-path extraction guidance', async () => {
    const readme = await buildReadmeForProject(buildMinimalProject());
    expect(readme).toContain('short path');
    expect(readme).toContain('C:\\rb\\');
  });

  it('README contains writable working directory guidance', async () => {
    const readme = await buildReadmeForProject(buildMinimalProject());
    // Must address the vivado.jou / System32 launch issue
    expect(readme).toContain('writable');
    expect(readme).toContain('vivado.jou');
  });

  it('README documents harmless Vivado noise that students should ignore', async () => {
    const readme = await buildReadmeForProject(buildMinimalProject());
    // Must enumerate the real noise from the confirmed hardware run
    expect(readme).toContain('Harmless Vivado messages');
    expect(readme).toContain('project file moved');
    expect(readme).toContain('GeneratedRun file not found');
    expect(readme).toContain('No supported debug core');
  });

  it('README step 2 says to open Vivado from Start menu (not by double-clicking exe)', async () => {
    const readme = await buildReadmeForProject(buildMinimalProject());
    expect(readme).toContain('Start menu');
  });

  it('README includes fallback batch-mode Tcl command', async () => {
    const readme = await buildReadmeForProject(buildMinimalProject());
    expect(readme).toContain('vivado -mode batch');
    expect(readme).toContain('vivado_import.tcl');
  });
});
