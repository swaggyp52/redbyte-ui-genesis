import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import type { RBProject } from '../../../../export/projectFormat';
import { buildExportViewModel } from '../../../../apps/ide/viewmodels/buildExportViewModel';
import {
  buildVivadoProjectFolderZip,
  deriveVivadoProjectSlug,
} from '../../../vivado/vivadoProjectFolder';
import { exportProjectAsBasys3 } from '../basys3ExportService';
import { tryBuildPreservedImportHandoff } from '../preservedImportHandoff';

function buildVectorTopImportProject(): RBProject {
  const pkg = `library ieee;
use ieee.std_logic_1164.all;
package demo_pkg is constant K : natural := 1; end package;`;

  const helper = `library ieee;
use ieee.std_logic_1164.all;
entity helper_mod is port (x: in std_logic); end helper_mod;
architecture a of helper_mod is begin end a;`;

  const top = `library ieee;
use ieee.std_logic_1164.all;
use work.demo_pkg.all;

entity security_demo_top is
  port (
    clk : in std_logic;
    sw : in std_logic_vector(1 downto 0);
    led : out std_logic_vector(1 downto 0)
  );
end security_demo_top;

architecture rtl of security_demo_top is
begin
  led <= sw;
end rtl;`;

  const xdc = [
    'set_property PACKAGE_PIN W5 [get_ports {clk}]',
    'set_property IOSTANDARD LVCMOS33 [get_ports {clk}]',
    'set_property PACKAGE_PIN V17 [get_ports {sw[0]}]',
    'set_property IOSTANDARD LVCMOS33 [get_ports {sw[0]}]',
    'set_property PACKAGE_PIN V16 [get_ports {sw[1]}]',
    'set_property IOSTANDARD LVCMOS33 [get_ports {sw[1]}]',
    'set_property PACKAGE_PIN U16 [get_ports {led[0]}]',
    'set_property IOSTANDARD LVCMOS33 [get_ports {led[0]}]',
    'set_property PACKAGE_PIN E19 [get_ports {led[1]}]',
    'set_property IOSTANDARD LVCMOS33 [get_ports {led[1]}]',
  ].join('\n');

  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-04-24T00:00:00.000Z',
    updatedAt: '2026-04-24T00:00:00.000Z',
    name: 'preserved-handoff-demo',
    description: 'Fixture: multi-file import with vector top',
    circuit: {
      nodes: [
        { id: 'i0', type: 'INPUT', x: 0, y: 0, label: 'clk', config: {}, state: {} },
        { id: 'i1', type: 'INPUT', x: 0, y: 40, label: 'sw[0]', config: {}, state: {} },
        { id: 'i2', type: 'INPUT', x: 0, y: 80, label: 'sw[1]', config: {}, state: {} },
        { id: 'o0', type: 'OUTPUT', x: 200, y: 0, label: 'led[0]', config: {}, state: {} },
        { id: 'o1', type: 'OUTPUT', x: 200, y: 40, label: 'led[1]', config: {}, state: {} },
      ],
      connections: [],
    },
    ioMapping: {
      inputs: [
        { id: 'c1', nodeId: 'i0', port: 'out', label: 'clk', pin: 'CLK100MHZ' },
        { id: 'c2', nodeId: 'i1', port: 'out', label: 'sw[0]', pin: 'SW0' },
        { id: 'c3', nodeId: 'i2', port: 'out', label: 'sw[1]', pin: 'SW1' },
      ],
      outputs: [
        { id: 'c4', nodeId: 'o0', port: 'in', label: 'led[0]', pin: 'LD0' },
        { id: 'c5', nodeId: 'o1', port: 'in', label: 'led[1]', pin: 'LD1' },
      ],
    },
    vectors: [],
    hdl: {
      top: 'security_demo_top',
      sources: [
        { path: 'vhdl/demo_pkg.vhd', language: 'vhdl', text: pkg },
        { path: 'vhdl/helper_mod.vhd', language: 'vhdl', text: helper },
        { path: 'vhdl/security_demo_top.vhd', language: 'vhdl', text: top },
      ],
    },
    fpga: {
      board: 'basys3',
      top: 'security_demo_top',
      constraints: { type: 'xdc', text: xdc },
    },
    meta: {
      projectKind: 'import',
      tags: ['import', 'vivado', 'basys3', 'multi-file-hdl'],
    },
  };
}

describe('preserved import handoff export', () => {
  it('detects handoff for multi-file import with aligned XDC', () => {
    const project = buildVectorTopImportProject();
    const handoff = tryBuildPreservedImportHandoff(project);
    expect(handoff).not.toBeNull();
    expect(handoff!.companions.length).toBe(2);
    expect(handoff!.topVhd).toContain('security_demo_top');
  });

  it('exports preserved top, companions, and Open Project zip entries', async () => {
    const project = buildVectorTopImportProject();
    const exportResult = exportProjectAsBasys3(project);
    expect(exportResult.success).toBe(true);
    expect(exportResult.errors.filter((e) => e.severity === 'error')).toEqual([]);
    expect(exportResult.bundle?.exportMode).toBe('preserved-import-rtl');
    expect(exportResult.bundle?.importedCompanionSources?.length).toBe(2);
    expect(exportResult.projectProjection?.hdl?.sources.map((source) => source.path)).toEqual([
      'imported/vhdl/demo_pkg.vhd',
      'imported/vhdl/helper_mod.vhd',
      'top.vhd',
    ]);
    expect(exportResult.bundle?.topVhd).toContain('std_logic_vector');

    const viewModel = buildExportViewModel(project);
    expect(viewModel.status).toBe('ok');
    const importedArtifacts = viewModel.artifacts.filter((a) => a.path.startsWith('imported/'));
    expect(importedArtifacts.length).toBe(2);

    const slug = deriveVivadoProjectSlug(project.name);
    const zip = await buildVivadoProjectFolderZip({
      artifacts: viewModel.artifacts.map((a) => ({ path: a.path, content: a.content })),
      projectName: project.name,
      projectSlug: slug,
      topModule: project.hdl?.top ?? 'top',
    });
    const loaded = await JSZip.loadAsync(zip);
    const names = Object.keys(loaded.files)
      .filter((n) => !loaded.files[n]?.dir)
      .sort();
    expect(names.some((n) => n.includes('sources_1/imported/'))).toBe(true);
    const tcl = await loaded.file(`${slug}/vivado_import.tcl`)!.async('string');
    expect(tcl).toContain('sources_1/imported/');
    expect(tcl).toContain('sources_1/new/top.vhd');
  });

  it('regenerates preserved-import XDC from current mapping and keeps companion paths idempotent', () => {
    const project = buildVectorTopImportProject();
    project.ioMapping!.inputs[1] = {
      ...project.ioMapping!.inputs[1]!,
      pin: 'SW2',
    };

    const firstExport = exportProjectAsBasys3(project);
    expect(firstExport.success).toBe(true);
    expect(firstExport.bundle?.topVhd).toContain('security_demo_top');
    expect(firstExport.bundle?.topXdc).toContain(
      'set_property PACKAGE_PIN W16 [get_ports {sw[0]}]'
    );
    expect(firstExport.bundle?.topXdc).not.toContain(
      'set_property PACKAGE_PIN V17 [get_ports {sw[0]}]'
    );
    expect(firstExport.projectProjection?.fpga?.constraints?.text).toBe(firstExport.bundle?.topXdc);

    const secondExport = exportProjectAsBasys3(firstExport.projectProjection!);
    expect(secondExport.success).toBe(true);
    expect(secondExport.bundle?.topXdc).toBe(firstExport.bundle?.topXdc);
    expect(secondExport.bundle?.importedCompanionSources?.map((source) => source.exportPath)).toEqual(
      firstExport.bundle?.importedCompanionSources?.map((source) => source.exportPath)
    );
    expect(secondExport.projectProjection?.hdl?.sources).toEqual(
      firstExport.projectProjection?.hdl?.sources
    );
  });
});
