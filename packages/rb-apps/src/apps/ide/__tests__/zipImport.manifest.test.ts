import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import type { RBProject } from '../../../export/projectFormat';
import { encodeRBProject } from '../../../export/projectFormat';
import { importVivadoZipBytes } from '../zipImport';
import { buildExportViewModel } from '../viewmodels/buildExportViewModel';

function buildManifestProject(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-09T00:00:00.000Z',
    updatedAt: '2026-03-09T00:00:00.000Z',
    name: 'manifest-roundtrip',
    description: 'Regression fixture for manifest-first ZIP import.',
    circuit: {
      nodes: [
        { id: 'in_a', type: 'INPUT', x: 0, y: 0, config: {}, state: {}, label: 'in_a' },
        { id: 'out_y', type: 'OUTPUT', x: 160, y: 0, config: {}, state: {}, label: 'out_y' },
      ],
      connections: [
        {
          from: { nodeId: 'in_a', portName: 'out' },
          to: { nodeId: 'out_y', portName: 'in' },
        },
      ],
    },
    hdl: {
      top: 'top',
      sources: [
        {
          path: 'top.vhd',
          language: 'vhdl',
          text: [
            'library IEEE;',
            'use IEEE.STD_LOGIC_1164.ALL;',
            'entity top is',
            '  port ( in_a : in STD_LOGIC; out_y : out STD_LOGIC );',
            'end top;',
            'architecture broken of top is',
            'begin',
            '  out_y <= ;',
            'end broken;',
          ].join('\n'),
        },
      ],
    },
    fpga: {
      board: 'basys3',
      part: 'xc7a35tcpg236-1',
      top: 'top',
      constraints: {
        type: 'xdc',
        text: [
          'set_property PACKAGE_PIN V17 [get_ports {in_a}]',
          'set_property PACKAGE_PIN U16 [get_ports {out_y}]',
        ].join('\n'),
      },
    },
    ioMapping: {
      inputs: [{ id: 'in_a', nodeId: 'in_a', port: 'out', label: 'in_a', pin: 'V17' }],
      outputs: [{ id: 'out_y', nodeId: 'out_y', port: 'in', label: 'out_y', pin: 'U16' }],
    },
    vectors: [],
    meta: {
      projectId: 'rb-manifest-roundtrip',
      tags: ['classroom', 'manifest'],
    },
  };
}

async function buildManifestZip(project: RBProject, manifestText = encodeRBProject(project)): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('demo/project.rbproj.json', manifestText);
  zip.file(
    'demo/demo.srcs/sources_1/new/top.vhd',
    [
      'library IEEE;',
      'use IEEE.STD_LOGIC_1164.ALL;',
      'entity top is',
      '  port ( sw0 : in STD_LOGIC; ld0 : out STD_LOGIC );',
      'end top;',
      'architecture rtl of top is',
      'begin',
      '  ld0 <= sw0;',
      'end rtl;',
    ].join('\n')
  );
  zip.file(
    'demo/demo.srcs/constrs_1/new/top.xdc',
    [
      'set_property PACKAGE_PIN V17 [get_ports {sw0}]',
      'set_property PACKAGE_PIN U16 [get_ports {ld0}]',
    ].join('\n')
  );
  zip.file('demo/demo.runs/impl_1/top.bit', new Uint8Array([0, 1, 2, 3, 4]));
  return new Uint8Array(await zip.generateAsync({ type: 'arraybuffer' }));
}

describe('zipImport manifest-first flow', () => {
  it('restores a valid manifest even when Vivado HDL and XDC files disagree with it', async () => {
    const project = buildManifestProject();
    const bytes = await buildManifestZip(project);

    const result = await importVivadoZipBytes(bytes, { sourceName: 'demo.zip' });

    expect(result.importMode).toBe('manifest');
    expect(result.manifestPath).toBe('demo/project.rbproj.json');
    expect(result.project.name).toBe(project.name);
    expect(result.project.circuit.connections).toHaveLength(1);
    expect(result.status.parse).toBe('success');
    expect(result.status.compiler).toBe('runnable');
    expect(result.isImportRunnable).toBe(true);
    expect(result.compilerDiagnostics).toEqual([]);
    expect(result.parsedHdl.ports).toEqual([
      { name: 'in_a', direction: 'in', typeName: 'STD_LOGIC' },
      { name: 'out_y', direction: 'out', typeName: 'STD_LOGIC' },
    ]);
    expect(
      result.warnings.some((warning) =>
        warning.includes('ZIP HDL "demo/demo.srcs/sources_1/new/top.vhd" differs from the embedded RedByte manifest.')
      )
    ).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes('ZIP constraints "demo/demo.srcs/constrs_1/new/top.xdc" differ from the embedded RedByte manifest.')
      )
    ).toBe(true);
    expect(result.ignoredFiles).toContain('demo/demo.runs/impl_1/top.bit');
  });

  it('hard-stops when project.rbproj.json is malformed even if HDL and XDC are present', async () => {
    const project = buildManifestProject();
    const bytes = await buildManifestZip(project, '{"kind":"rb-project","version":1,"name":"broken"}');

    await expect(importVivadoZipBytes(bytes, { sourceName: 'demo.zip' })).rejects.toThrow(
      'No files were changed.'
    );
  });

  it('re-exports the manifest projection byte-for-byte while conflicting siblings remain non-authoritative', async () => {
    const project = buildManifestProject();
    const firstExport = buildExportViewModel(project);
    const firstManifestText = requireArtifact(firstExport, 'project.rbproj.json');
    const firstTopText = requireArtifact(firstExport, 'top.vhd');
    const firstXdcText = requireArtifact(firstExport, 'top.xdc');
    const projectedManifest = JSON.parse(firstManifestText) as RBProject;

    expect(firstExport.status).toBe('ok');
    expect(projectedManifest.hdl?.sources.find((source) => source.path === 'top.vhd')?.text)
      .not.toContain('out_y <= ;');
    expect(projectedManifest.fpga?.constraints?.text).toContain(
      'set_property PACKAGE_PIN V17 [get_ports {in_a}]'
    );
    expect(projectedManifest.fpga?.part).toBe('xc7a35tcpg236-1');

    const bytes = await buildManifestZip(project, firstManifestText);
    const imported = await importVivadoZipBytes(bytes, { sourceName: 'demo.zip' });
    const secondExport = buildExportViewModel(imported.project);

    expect(imported.importMode).toBe('manifest');
    expect(imported.project).toEqual(projectedManifest);
    expect(secondExport.mappingProjection).toEqual(firstExport.mappingProjection);
    expect(secondExport.exportHash).toBe(firstExport.exportHash);
    expect(requireArtifact(secondExport, 'top.vhd')).toBe(firstTopText);
    expect(requireArtifact(secondExport, 'top.xdc')).toBe(firstXdcText);
    expect(requireArtifact(secondExport, 'project.rbproj.json')).toBe(firstManifestText);
  });
});

function requireArtifact(
  viewModel: ReturnType<typeof buildExportViewModel>,
  path: string,
): string {
  const artifact = viewModel.artifacts.find((entry) => entry.path === path);
  expect(artifact?.content).toBeTruthy();
  return artifact?.content ?? '';
}
