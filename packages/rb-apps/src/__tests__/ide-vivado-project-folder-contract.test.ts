import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { RBProject } from '../export/projectFormat';
import { decodeRBProject, encodeRBProject } from '../export/projectFormat';
import { sha256Hex } from '../export/deterministicZip';
import {
  buildVivadoProjectFolderZip,
  deriveVivadoProjectSlug,
  resolveVivadoPart,
} from '../fpga/vivado/vivadoProjectFolder';
import { buildExportViewModel } from '../apps/ide/viewmodels/buildExportViewModel';
import { importVivadoZipBytes } from '../apps/ide/zipImport';
import { createEmptyProjectHierarchy, createModuleFromSelection, rederiveModulePortRefs } from '../apps/ide/projectHierarchy';

function buildNativeHierarchyProject(nested = false, registers = false): RBProject {
  const circuit: Circuit = {
    nodes: [
      { id: 'a', type: 'INPUT', label: 'A', position: { x: 0, y: 0 } },
      { id: 'b', type: 'INPUT', label: 'B', position: { x: 0, y: 120 } },
      { id: 'sum', type: 'XOR', position: { x: 200, y: 0 } },
      { id: 'sumNot1', type: 'NOT', position: { x: 240, y: 0 } },
      { id: 'sumNot2', type: 'NOT', position: { x: 280, y: 0 } },
      { id: 'carry', type: 'AND', position: { x: 200, y: 120 } },
      { id: 'y', type: 'OUTPUT', label: 'SUM', position: { x: 400, y: 0 } },
      { id: 'c', type: 'OUTPUT', label: 'CARRY', position: { x: 400, y: 120 } },
    ],
    connections: [
      { id: 'a-sum', from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'sum', portName: 'a' } },
      { id: 'b-sum', from: { nodeId: 'b', portName: 'out' }, to: { nodeId: 'sum', portName: 'b' } },
      { id: 'a-carry', from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'carry', portName: 'a' } },
      { id: 'b-carry', from: { nodeId: 'b', portName: 'out' }, to: { nodeId: 'carry', portName: 'b' } },
      { id: 'sum-not1', from: { nodeId: 'sum', portName: 'out' }, to: { nodeId: 'sumNot1', portName: 'in' } },
      { id: 'not1-not2', from: { nodeId: 'sumNot1', portName: 'out' }, to: { nodeId: 'sumNot2', portName: 'in' } },
      { id: 'sum-y', from: { nodeId: 'sumNot2', portName: 'out' }, to: { nodeId: 'y', portName: 'in' } },
      { id: 'carry-c', from: { nodeId: 'carry', portName: 'out' }, to: { nodeId: 'c', portName: 'in' } },
    ],
  };
  if (registers) {
    circuit.nodes.push(
      { id: 'clk', type: 'Clock', label: 'CLK', position: { x: 0, y: 240 } },
      { id: 'rst', type: 'INPUT', label: 'RST', position: { x: 0, y: 300 } },
      { id: 'en', type: 'INPUT', label: 'EN', position: { x: 0, y: 360 } },
      ...['inside', 'outside'].flatMap((location) => [
        { id: `reg_${location}`, type: 'Register1', config: { resetKind: 'async_clear', hasEnable: true }, position: { x: 200, y: 300 } },
        { id: `count_${location}`, type: 'OUTPUT', label: `COUNT_${location}`, position: { x: 400, y: 300 } },
      ]),
    );
    for (const location of ['inside', 'outside']) {
      for (const [nodeId, portName] of [['a', 'D'], ['clk', 'CLK'], ['rst', 'CLR'], ['en', 'EN']]) {
        circuit.connections.push({ id: `${location}-${portName}`, from: { nodeId, portName: 'out' }, to: { nodeId: `reg_${location}`, portName } });
      }
      circuit.connections.push({ id: `${location}-q`, from: { nodeId: `reg_${location}`, portName: 'Q' }, to: { nodeId: `count_${location}`, portName: 'in' } });
    }
  }
  const created = createModuleFromSelection(circuit, createEmptyProjectHierarchy(), {
    moduleName: 'IncrementSlice', instanceName: 'u_increment',
    selectedNodeIds: ['sum', 'sumNot1', 'sumNot2', 'carry', ...(registers ? ['reg_inside'] : [])],
    nowIso: '2026-10-01T00:00:00.000Z',
  });
  let hierarchy = created.hierarchy;
  if (nested) {
    const inner = createModuleFromSelection(created.definition.circuit, hierarchy, {
      moduleName: 'XorLeaf', instanceName: 'u_xor', selectedNodeIds: ['sum', 'sumNot1', 'sumNot2'],
      nowIso: '2026-10-01T00:00:00.000Z',
    });
    hierarchy = {
      ...inner.hierarchy,
      modules: inner.hierarchy.modules.map((module) => module.id === created.definition.id
        ? rederiveModulePortRefs({ ...module, circuit: inner.circuit }) : module),
    };
  }
  return {
    kind: 'rb-project', version: 1, name: 'Native Increment Slice',
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
    circuit: created.circuit, hierarchy,
    ioMapping: {
      inputs: [
        { id: 'a', nodeId: 'a', port: 'out', label: 'A', pin: 'V17' },
        { id: 'b', nodeId: 'b', port: 'out', label: 'B', pin: 'V16' },
        ...(registers ? [
          { id: 'clk', nodeId: 'clk', port: 'out', label: 'CLK', pin: 'W5' },
          { id: 'rst', nodeId: 'rst', port: 'out', label: 'RST', pin: 'U18' },
          { id: 'en', nodeId: 'en', port: 'out', label: 'EN', pin: 'W16' },
        ] : []),
      ],
      outputs: [
        { id: 'y', nodeId: 'y', port: 'in', label: 'SUM', pin: 'U16' },
        { id: 'c', nodeId: 'c', port: 'in', label: 'CARRY', pin: 'E19' },
        ...(registers ? [
          { id: 'count_inside', nodeId: 'count_inside', port: 'in', label: 'COUNT_inside', pin: 'U19' },
          { id: 'count_outside', nodeId: 'count_outside', port: 'in', label: 'COUNT_outside', pin: 'V19' },
        ] : []),
      ],
    },
    hdl: { top: 'top', sources: [] }, fpga: { board: 'basys3', top: 'top' },
    meta: { projectId: 'native-increment-slice' },
  };
}

function buildFixtureProject(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-09T00:00:00.000Z',
    updatedAt: '2026-03-09T00:00:00.000Z',
    name: 'Vivado Project Folder Fixture',
    description: 'Deterministic Open Project export contract fixture.',
    circuit: {
      nodes: [
        { id: 'g1', type: 'AND', x: 240, y: 160, label: 'and0', config: {}, state: {} },
      ],
      connections: [],
    },
    ioMapping: {
      inputs: [
        { id: 'sw0', nodeId: 'g1', port: 'in1', label: 'sw0', pin: 'V17' },
        { id: 'sw1', nodeId: 'g1', port: 'in2', label: 'sw1', pin: 'V16' },
      ],
      outputs: [
        { id: 'ld0', nodeId: 'g1', port: 'out', label: 'ld0', pin: 'U16' },
      ],
    },
    vectors: [],
    hdl: {
      top: 'student_top',
      sources: [
        {
          path: 'top.vhd',
          language: 'vhdl',
          text: [
            'library IEEE;',
            'use IEEE.STD_LOGIC_1164.ALL;',
            '',
            'entity student_top is',
            '  port (',
            '    sw0 : in std_logic;',
            '    sw1 : in std_logic;',
            '    ld0 : out std_logic',
            '  );',
            'end student_top;',
            '',
            'architecture rtl of student_top is',
            'begin',
            '  ld0 <= sw0 and sw1;',
            'end rtl;',
          ].join('\n'),
        },
      ],
    },
    fpga: { board: 'basys3', part: 'xc7a100tcsg324-1', top: 'student_top' },
    meta: {
      projectId: 'rb-project-folder-fixture',
      tags: ['contract', 'vivado-project-folder'],
    },
  };
}

function buildClockedFixtureProject(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-04-23T00:00:00.000Z',
    updatedAt: '2026-04-23T00:00:00.000Z',
    name: 'Vivado Project Folder Clock Fixture',
    description: 'Sequential fixture with real Basys3 board clock export.',
    circuit: {
      nodes: [
        { id: 'clk', type: 'Clock', x: 40, y: 60, label: 'clk', config: { period: 10 }, state: {} },
        { id: 'sw0', type: 'Switch', x: 40, y: 160, label: 'd', config: {}, state: {} },
        { id: 'rst', type: 'Switch', x: 40, y: 260, label: 'rst', config: {}, state: {} },
        { id: 'ff0', type: 'DFlipFlop', x: 240, y: 140, label: 'ff0', config: {}, state: {} },
        { id: 'ld0', type: 'Lamp', x: 440, y: 140, label: 'q', config: {}, state: {} },
      ],
      connections: [
        { id: 'c1', from: { nodeId: 'clk', portName: 'out' }, to: { nodeId: 'ff0', portName: 'CLK' } },
        { id: 'c2', from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'ff0', portName: 'D' } },
        { id: 'c3', from: { nodeId: 'rst', portName: 'out' }, to: { nodeId: 'ff0', portName: 'RST' } },
        { id: 'c4', from: { nodeId: 'ff0', portName: 'Q' }, to: { nodeId: 'ld0', portName: 'in' } },
      ],
    },
    ioMapping: {
      inputs: [
        { id: 'clk', nodeId: 'clk', port: 'out', label: 'clk', pin: 'CLK100MHZ' },
        { id: 'sw0', nodeId: 'sw0', port: 'out', label: 'd', pin: 'SW0' },
        { id: 'rst', nodeId: 'rst', port: 'out', label: 'rst', pin: 'BTNC' },
      ],
      outputs: [
        { id: 'ld0', nodeId: 'ld0', port: 'in', label: 'q', pin: 'LD0' },
      ],
    },
    vectors: [
      { tick: 0, inputs: { clk: 0, d: 0, rst: 1 }, expected: { q: 0 } },
      { tick: 1, inputs: { clk: 1, d: 1, rst: 0 }, expected: { q: 1 } },
    ],
    fpga: { board: 'basys3', top: 'top' },
    meta: {
      projectId: 'rb-project-folder-clock-fixture',
      tags: ['contract', 'vivado-project-folder', 'clocked'],
    },
  };
}

async function buildProjectFolderZip(project: RBProject): Promise<Uint8Array> {
  const viewModel = buildExportViewModel(project);
  expect(viewModel.errors).toEqual([]);
  expect(viewModel.status).toBe('ok');
    return buildVivadoProjectFolderZip({
    artifacts: viewModel.artifacts.map((artifact) => ({
      path: artifact.path,
      content: artifact.content,
    })),
    projectName: project.name,
    projectSlug: deriveVivadoProjectSlug(project.meta?.projectId ?? project.name),
    topModule: project.hdl?.top ?? project.fpga?.top ?? 'top',
    part: resolveVivadoPart(project.fpga?.part),
  });
}

describe('IDE Vivado project folder contract', () => {
  it('retains clocked, enabled, async-clear Register1 behavior in structural top and nested definition bytes', async () => {
    const project = buildNativeHierarchyProject(true, true);
    const slug = deriveVivadoProjectSlug(project.meta!.projectId!);
    const loaded = await JSZip.loadAsync(await buildProjectFolderZip(project));
    const root = `${slug}/${slug}.srcs/sources_1/new/`;
    const top = await loaded.file(`${root}top.vhd`)!.async('string');
    const module = await loaded.file(`${root}increment_slice.vhd`)!.async('string');
    for (const [source, location] of [[top, 'outside'], [module, 'inside']]) {
      expect(source).toMatch(/process\s*\(CLK,\s*RST\)/i);
      expect(source).toMatch(/if\s+RST\s*=\s*'1'\s+then[\s\S]*elsif\s+rising_edge\(CLK\)/i);
      expect(source).toMatch(/rising_edge\(CLK\)\s+then\s+if\s+EN\s*=\s*'1'\s+then/i);
      expect(source).toMatch(new RegExp(`n_reg_${location}_Q\\s*<=\\s*'0'`, 'i'));
      expect(source).toMatch(new RegExp(`n_reg_${location}_Q\\s*<=\\s*A`, 'i'));
      expect(source).not.toMatch(/unsupported Register1|missing Register1 clock|register with no EN/i);
      expect(source).not.toMatch(new RegExp(`n_reg_${location}_out\\s*<=\\s*'0'`, 'i'));
      expect(source).toMatch(new RegExp(`COUNT_${location}\\s*<=\\s*n_reg_${location}_Q`, 'i'));
    }
    expect(top).toContain('entity work.IncrementSlice');
    expect(module).toContain('entity work.XorLeaf');
    expect(top).toMatch(/COUNT_inside\s*<=\s*n_u_increment_COUNT_inside/i);
    expect(top).toMatch(/CLK\s*=>\s*CLK/i);
    expect(top).toMatch(/RST\s*=>\s*RST/i);
    expect(top).toMatch(/EN\s*=>\s*EN/i);
    expect(await loaded.file(`${slug}/${slug}.srcs/constrs_1/new/top.xdc`)!.async('string'))
      .toContain('create_clock -period 10.000');
  });

  it.each([false, true])('packages native module definitions and references with nested=%s', async (nested) => {
    const project = buildNativeHierarchyProject(nested);
    const slug = deriveVivadoProjectSlug(project.meta!.projectId!);
    const viewModel = buildExportViewModel(project);
    expect(viewModel.status).toBe('ok');
    expect(viewModel.errors).toEqual([]);
    const companions = viewModel.artifacts.filter((artifact) =>
      artifact.path.endsWith('.vhd') && artifact.path !== 'top.vhd' && artifact.path !== 'testbench.vhd');
    expect(companions.map((artifact) => artifact.path)).toEqual(nested
      ? ['xor_leaf.vhd', 'increment_slice.vhd'] : ['increment_slice.vhd']);

    const zipBytes = await buildProjectFolderZip(project);
    expect(await sha256Hex(zipBytes)).toBe(await sha256Hex(await buildProjectFolderZip(project)));
    const loaded = await JSZip.loadAsync(zipBytes);
    const sourceRoot = `${slug}/${slug}.srcs/sources_1/new/`;
    const top = await loaded.file(`${sourceRoot}top.vhd`)!.async('string');
    expect(top).toContain('u_increment : entity work.IncrementSlice');
    expect(top).toBe(viewModel.artifacts.find((artifact) => artifact.path === 'top.vhd')!.content);
    const xpr = await loaded.file(`${slug}/${slug}.xpr`)!.async('string');
    const tcl = await loaded.file(`${slug}/vivado_import.tcl`)!.async('string');
    for (const companion of companions) {
      expect(loaded.file(`${sourceRoot}${companion.path}`)).not.toBeNull();
      expect(await loaded.file(`${sourceRoot}${companion.path}`)!.async('string')).toBe(companion.content);
      expect(xpr).toContain(`$PSRCDIR/sources_1/new/${companion.path}`);
      expect(tcl).toContain(`[file join $script_dir "${slug}.srcs/sources_1/new/${companion.path}"]`);
    }
    expect(companions.find((artifact) => artifact.path === 'increment_slice.vhd')!.content)
      .toContain('entity IncrementSlice is');
    expect(xpr.indexOf('$PSRCDIR/sources_1/new/increment_slice.vhd'))
      .toBeLessThan(xpr.indexOf('$PSRCDIR/sources_1/new/top.vhd'));
    expect(tcl).toContain('update_compile_order -fileset sources_1');
    if (nested) {
      expect(companions[0].content).toContain('entity XorLeaf is');
      expect(companions[1].content).toContain('u_xor : entity work.XorLeaf');
      expect(xpr.indexOf('$PSRCDIR/sources_1/new/xor_leaf.vhd'))
        .toBeLessThan(xpr.indexOf('$PSRCDIR/sources_1/new/increment_slice.vhd'));
    }
    const canonical = decodeRBProject(await loaded.file(`${slug}/project.rbproj.json`)!.async('string'));
    expect(canonical.hierarchy).toEqual(decodeRBProject(encodeRBProject(project)).hierarchy);
    expect(canonical.circuit).toEqual(decodeRBProject(encodeRBProject(project)).circuit);
    const reopened = await importVivadoZipBytes(zipBytes, { sourceName: 'native-increment.zip' });
    expect(reopened.importMode).toBe('manifest');
    expect(reopened.project.hierarchy).toEqual(canonical.hierarchy);
  });

  it('preserves imported source layout alongside native companions', async () => {
    const project = buildNativeHierarchyProject();
    const slug = deriveVivadoProjectSlug(project.meta!.projectId!);
    const viewModel = buildExportViewModel(project);
    const imported = { path: 'imported/support/pkg.vhd', content: 'package support_pkg is\nend package support_pkg;\n' };
    const bytes = await buildVivadoProjectFolderZip({
      artifacts: [...viewModel.artifacts, imported], projectName: project.name, projectSlug: slug,
      topModule: 'top', part: resolveVivadoPart(project.fpga?.part),
    });
    const loaded = await JSZip.loadAsync(bytes);
    expect(await loaded.file(`${slug}/${slug}.srcs/sources_1/imported/support/pkg.vhd`)!.async('string'))
      .toBe(imported.content);
    expect(loaded.file(`${slug}/${slug}.srcs/sources_1/new/imported/support/pkg.vhd`)).toBeNull();
    expect(loaded.file(`${slug}/${slug}.srcs/sources_1/new/increment_slice.vhd`)).not.toBeNull();
    expect(await loaded.file(`${slug}/${slug}.xpr`)!.async('string'))
      .toContain('$PSRCDIR/sources_1/imported/support/pkg.vhd');
    expect(await loaded.file(`${slug}/vivado_import.tcl`)!.async('string'))
      .toContain(`${slug}.srcs/sources_1/imported/support/pkg.vhd`);
  });

  it.each(['../escape.vhd', '/absolute.vhd', 'C:\\escape.vhd', 'native/../escape.vhd', 'imported/../escape.vhd'])
    ('refuses unsafe design companion path %s', async (path) => {
      const project = buildFixtureProject();
      const viewModel = buildExportViewModel(project);
      await expect(buildVivadoProjectFolderZip({
        artifacts: [...viewModel.artifacts, { path, content: 'entity escaped is end entity escaped;' }],
        projectName: project.name, topModule: 'student_top',
      })).rejects.toThrow('invalid design-source path');
    });

  it('builds a deterministic Open Project ZIP with the expected Vivado folder layout', async () => {
    const project = buildFixtureProject();
    const slug = deriveVivadoProjectSlug(project.meta?.projectId ?? project.name);

    const zipA = await buildProjectFolderZip(project);
    const zipB = await buildProjectFolderZip(project);

    expect(await sha256Hex(zipA)).toBe(await sha256Hex(zipB));

    const loaded = await JSZip.loadAsync(zipA);
    const fileNames = Object.keys(loaded.files)
      .filter((name) => !loaded.files[name]?.dir)
      .sort();

    expect(fileNames).toEqual(
      [
        `${slug}/${slug}.srcs/constrs_1/new/top.xdc`,
        `${slug}/${slug}.srcs/sources_1/new/top.vhd`,
        `${slug}/${slug}.xpr`,
        `${slug}/BRINGUP.md`,
        `${slug}/EXPECTED_IO.json`,
        `${slug}/README.txt`,
        `${slug}/program_and_test.tcl`,
        `${slug}/project.rbproj.json`,
        `${slug}/vivado_import.tcl`,
      ].sort()
    );

    const xprText = await loaded.file(`${slug}/${slug}.xpr`)!.async('string');
    expect(xprText).toContain('<Project Product="Vivado" Version="7" Minor="68"');
    expect(xprText).toContain('<DefaultLaunch Dir="$PRUNDIR"/>');
    expect(xprText).toContain('Option Name="Part" Val="xc7a100tcsg324-1"');
    expect(xprText).toContain('Option Name="SimulatorVersionXsim" Val="2024.2"');
    expect(xprText).toContain('Option Name="TopModule" Val="student_top"');
    expect(xprText).toContain('$PSRCDIR/sources_1/new/top.vhd');
    expect(xprText).toContain('$PSRCDIR/constrs_1/new/top.xdc');
    expect(xprText).toContain('<Option Name="ConstrsType" Val="XDC"/>');
    expect(xprText).toContain('<Option Name="TopAutoSet" Val="TRUE"/>');
    expect(xprText).toContain('<Simulator Name="ModelSim">');
    expect(xprText).toContain('<FileSet Name="utils_1" Type="Utils"');
    expect(xprText).toContain('<StratHandle Name="Vivado Synthesis Defaults" Flow="Vivado Synthesis 2024">');
    expect(xprText).toContain('<Step Id="synth_design"/>');
    expect(xprText).toContain('<GeneratedRun Dir="$PRUNDIR" File="gen_run.xml"/>');
    expect(xprText).toContain('<StratHandle Name="Vivado Implementation Defaults" Flow="Vivado Implementation 2024">');
    expect(xprText).toContain('<Step Id="write_bitstream"/>');
    expect(xprText).not.toContain('<Strategy Version="1" Minor="1">Vivado Synthesis Defaults</Strategy>');
    expect(xprText).toContain('<Board/>');

    const importTclText = await loaded.file(`${slug}/vivado_import.tcl`)!.async('string');
    expect(importTclText).toContain('set part "xc7a100tcsg324-1"');
    expect(importTclText).toContain('set top_module "student_top"');
    expect(importTclText).toContain(`${slug}.srcs/constrs_1/new/top.xdc`);

    const manifestText = await loaded.file(`${slug}/project.rbproj.json`)!.async('string');
    const manifestProject = JSON.parse(manifestText) as RBProject;
    expect(manifestProject.fpga?.part).toBe('xc7a100tcsg324-1');
    expect(manifestProject.fpga?.top).toBe('student_top');

    const readmeText = await loaded.file(`${slug}/README.txt`)!.async('string');
    expect(readmeText).toContain('Open Project');
    expect(readmeText).toContain(`${slug}.xpr`);
    expect(readmeText).toContain('top.xdc');

    expect(loaded.files[`${slug}/${slug}.srcs/utils_1/`]?.dir).toBe(true);
    expect(loaded.files[`${slug}/${slug}.runs/`]?.dir).toBe(true);
    expect(loaded.files[`${slug}/${slug}.runs/synth_1/`]?.dir).toBe(true);
    expect(loaded.files[`${slug}/${slug}.runs/impl_1/`]?.dir).toBe(true);
    expect(loaded.files[`${slug}/${slug}.cache/`]?.dir).toBe(true);
    expect(loaded.files[`${slug}/${slug}.hw/`]?.dir).toBe(true);
    expect(loaded.files[`${slug}/${slug}.sim/`]?.dir).toBe(true);
    expect(loaded.files[`${slug}/${slug}.ip_user_files/`]?.dir).toBe(true);
  });

  it('round-trips editable project data and original sources while generated HDL/XDC match delivered bytes', async () => {
    const project = buildFixtureProject();
    const normalizedProject = decodeRBProject(encodeRBProject(project));
    const zipBytes = await buildProjectFolderZip(project);

    const imported = await importVivadoZipBytes(zipBytes, {
      sourceName: 'rb-project-folder-fixture-vivado-project.zip',
    });

    expect(imported.importMode).toBe('manifest');
    const { hdl: originalHdl, fpga: originalFpga, sourceModel: originalSourceModel, ...originalEditable } = normalizedProject;
    const { hdl: emittedHdl, fpga: emittedFpga, sourceModel: reopenedSources, ...reopenedEditable } = imported.project;
    expect(reopenedEditable).toEqual(originalEditable);
    expect(emittedFpga?.board).toBe(originalFpga?.board);
    expect(emittedFpga?.part).toBe(originalFpga?.part);
    expect(emittedFpga?.top).toBe(originalFpga?.top);
    expect(emittedHdl?.top).toBe(originalHdl?.top);
    expect(reopenedSources?.files.map((source) => ({ path: source.path, language: source.language, text: source.text })))
      .toEqual(originalHdl?.sources);
    expect(reopenedSources?.topEntity).toBe(originalHdl?.top);
    if (originalSourceModel) expect(reopenedSources).toEqual(originalSourceModel);
    const slug = deriveVivadoProjectSlug(project.meta?.projectId ?? project.name);
    const loaded = await JSZip.loadAsync(zipBytes);
    expect(emittedHdl?.sources.find((source) => source.path === 'top.vhd')?.text)
      .toBe(await loaded.file(`${slug}/${slug}.srcs/sources_1/new/top.vhd`)!.async('string'));
    expect(emittedFpga?.constraints?.text)
      .toBe(await loaded.file(`${slug}/${slug}.srcs/constrs_1/new/top.xdc`)!.async('string'));
  });

  it('keeps top.xdc canonical and preserves the real W5 board clock in sequential project folders', async () => {
    const project = buildClockedFixtureProject();
    const slug = deriveVivadoProjectSlug(project.meta?.projectId ?? project.name);
    const zipBytes = await buildProjectFolderZip(project);
    const loaded = await JSZip.loadAsync(zipBytes);

    const topXdcPath = `${slug}/${slug}.srcs/constrs_1/new/top.xdc`;
    const xprPath = `${slug}/${slug}.xpr`;
    const tclPath = `${slug}/vivado_import.tcl`;

    expect(loaded.file(topXdcPath)).toBeDefined();
    expect(loaded.file(`${slug}/${slug}.srcs/constrs_1/new/basys3.xdc`)).toBeNull();

    const topXdcText = await loaded.file(topXdcPath)!.async('string');
    const xprText = await loaded.file(xprPath)!.async('string');
    const importTclText = await loaded.file(tclPath)!.async('string');

    expect(topXdcText).toContain('PACKAGE_PIN W5');
    expect(topXdcText).toContain('create_clock -period 10.000');
    expect(xprText).toContain('$PSRCDIR/constrs_1/new/top.xdc');
    expect(importTclText).toContain(`${slug}.srcs/constrs_1/new/top.xdc`);
  });

  it.each(['top', 'counter2'])(
    'sets the sim_1 top to the entity testbench.vhd declares (design top %s)',
    async (designTop) => {
      const base = buildClockedFixtureProject();
      const project: RBProject = { ...base, fpga: { ...base.fpga!, top: designTop } };
      const slug = deriveVivadoProjectSlug(project.meta?.projectId ?? project.name);
      const loaded = await JSZip.loadAsync(await buildProjectFolderZip(project));
      const testbench = await loaded.file(`${slug}/${slug}.srcs/sim_1/new/testbench.vhd`)!.async('string');
      const xprText = await loaded.file(`${slug}/${slug}.xpr`)!.async('string');
      const importTclText = await loaded.file(`${slug}/vivado_import.tcl`)!.async('string');
      const tbEntity = `tb_${designTop}`;

      expect(testbench).toMatch(new RegExp(`^entity ${tbEntity} is$`, 'm'));
      expect(xprText).toMatch(
        new RegExp(`<FileSet Name="sim_1"[\\s\\S]*?<Option Name="TopModule" Val="${tbEntity}"/>`),
      );
      expect(importTclText).toContain(`set_property top "${tbEntity}" [get_filesets sim_1]`);
    },
  );
});
