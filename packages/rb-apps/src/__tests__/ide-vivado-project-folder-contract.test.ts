import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
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

async function buildProjectFolderZip(project: RBProject): Promise<Uint8Array> {
  const viewModel = buildExportViewModel(project);
  expect(viewModel.status).toBe('ok');
  expect(viewModel.errors).toEqual([]);
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
        `${slug}/${slug}.srcs/constrs_1/new/basys3.xdc`,
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
    expect(xprText).toContain('$PSRCDIR/constrs_1/new/basys3.xdc');
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
    expect(importTclText).toContain(`${slug}.srcs/constrs_1/new/basys3.xdc`);

    const manifestText = await loaded.file(`${slug}/project.rbproj.json`)!.async('string');
    const manifestProject = JSON.parse(manifestText) as RBProject;
    expect(manifestProject.fpga?.part).toBe('xc7a100tcsg324-1');
    expect(manifestProject.fpga?.top).toBe('student_top');

    const readmeText = await loaded.file(`${slug}/README.txt`)!.async('string');
    expect(readmeText).toContain('Open Project');
    expect(readmeText).toContain(`${slug}.xpr`);
    expect(readmeText).toContain('basys3.xdc');

    expect(loaded.files[`${slug}/${slug}.srcs/utils_1/`]?.dir).toBe(true);
    expect(loaded.files[`${slug}/${slug}.runs/`]?.dir).toBe(true);
    expect(loaded.files[`${slug}/${slug}.runs/synth_1/`]?.dir).toBe(true);
    expect(loaded.files[`${slug}/${slug}.runs/impl_1/`]?.dir).toBe(true);
    expect(loaded.files[`${slug}/${slug}.cache/`]?.dir).toBe(true);
    expect(loaded.files[`${slug}/${slug}.hw/`]?.dir).toBe(true);
    expect(loaded.files[`${slug}/${slug}.sim/`]?.dir).toBe(true);
    expect(loaded.files[`${slug}/${slug}.ip_user_files/`]?.dir).toBe(true);
  });

  it('round-trips the exported project folder back into the same normalized RBProject', async () => {
    const project = buildFixtureProject();
    const normalizedProject = decodeRBProject(encodeRBProject(project));
    const zipBytes = await buildProjectFolderZip(project);

    const imported = await importVivadoZipBytes(zipBytes, {
      sourceName: 'rb-project-folder-fixture-vivado-project.zip',
    });

    expect(imported.importMode).toBe('manifest');
    expect(encodeRBProject(imported.project)).toBe(encodeRBProject(normalizedProject));
  });
});
