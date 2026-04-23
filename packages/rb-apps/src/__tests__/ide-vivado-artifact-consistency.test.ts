import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import type { RBProject } from '../export/projectFormat';
import { buildExportViewModel } from '../apps/ide/viewmodels/buildExportViewModel';
import {
  buildVivadoProjectFolderEntries,
  buildVivadoProjectFolderZip,
  deriveVivadoProjectSlug,
  resolveVivadoPart,
  type BuildVivadoProjectFolderInput,
  validateVivadoArtifactConsistency,
} from '../fpga/vivado/vivadoProjectFolder';

function buildPassThroughProject(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-11T00:00:00.000Z',
    updatedAt: '2026-03-11T00:00:00.000Z',
    name: 'Pass-through Vivado Consistency Fixture',
    description: 'Switch-to-lamp pass-through consistency fixture.',
    circuit: {
      nodes: [
        { id: 'sw0', type: 'Switch', x: 80, y: 80, label: 'SW0', config: {}, state: {} },
        { id: 'sw1', type: 'Switch', x: 80, y: 180, label: 'SW1', config: {}, state: {} },
        { id: 'ld0', type: 'Lamp', x: 420, y: 80, label: 'LD0', config: {}, state: {} },
        { id: 'ld1', type: 'Lamp', x: 420, y: 180, label: 'LD1', config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'ld0', portName: 'in' } },
        { from: { nodeId: 'sw1', portName: 'out' }, to: { nodeId: 'ld1', portName: 'in' } },
      ],
    },
    ioMapping: {
      inputs: [
        { id: 'in_sw0', nodeId: 'sw0', port: 'out', label: 'SW0', pin: 'SW0' },
        { id: 'in_sw1', nodeId: 'sw1', port: 'out', label: 'SW1', pin: 'SW1' },
      ],
      outputs: [
        { id: 'out_ld0', nodeId: 'ld0', port: 'in', label: 'LD0', pin: 'LD0' },
        { id: 'out_ld1', nodeId: 'ld1', port: 'in', label: 'LD1', pin: 'LD1' },
      ],
    },
    vectors: [
      { tick: 0, inputs: { SW0: 0, SW1: 0 }, expected: { LD0: 0, LD1: 0 } },
      { tick: 1, inputs: { SW0: 1, SW1: 0 }, expected: { LD0: 1, LD1: 0 } },
      { tick: 2, inputs: { SW0: 0, SW1: 1 }, expected: { LD0: 0, LD1: 1 } },
      { tick: 3, inputs: { SW0: 1, SW1: 1 }, expected: { LD0: 1, LD1: 1 } },
    ],
    meta: {
      projectId: 'vivado-consistency-pass-through',
      tags: ['contract', 'vivado', 'consistency'],
    },
  };
}

function buildRicherLogicProject(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-11T00:00:00.000Z',
    updatedAt: '2026-03-11T00:00:00.000Z',
    name: 'Richer Logic Vivado Consistency Fixture',
    description: 'Two-level logic consistency fixture.',
    circuit: {
      nodes: [
        { id: 'sw0', type: 'Switch', x: 40, y: 40, label: 'SW0', config: {}, state: {} },
        { id: 'sw1', type: 'Switch', x: 40, y: 140, label: 'SW1', config: {}, state: {} },
        { id: 'sw2', type: 'Switch', x: 40, y: 240, label: 'SW2', config: {}, state: {} },
        { id: 'and1', type: 'AND', x: 220, y: 100, label: 'AND1', config: {}, state: {} },
        { id: 'or1', type: 'OR', x: 380, y: 170, label: 'OR1', config: {}, state: {} },
        { id: 'ld0', type: 'Lamp', x: 560, y: 100, label: 'LD0', config: {}, state: {} },
        { id: 'ld1', type: 'Lamp', x: 560, y: 220, label: 'LD1', config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'and1', portName: 'in1' } },
        { from: { nodeId: 'sw1', portName: 'out' }, to: { nodeId: 'and1', portName: 'in2' } },
        { from: { nodeId: 'and1', portName: 'out' }, to: { nodeId: 'ld0', portName: 'in' } },
        { from: { nodeId: 'and1', portName: 'out' }, to: { nodeId: 'or1', portName: 'in1' } },
        { from: { nodeId: 'sw2', portName: 'out' }, to: { nodeId: 'or1', portName: 'in2' } },
        { from: { nodeId: 'or1', portName: 'out' }, to: { nodeId: 'ld1', portName: 'in' } },
      ],
    },
    ioMapping: {
      inputs: [
        { id: 'in_sw0', nodeId: 'sw0', port: 'out', label: 'SW0', pin: 'SW0' },
        { id: 'in_sw1', nodeId: 'sw1', port: 'out', label: 'SW1', pin: 'SW1' },
        { id: 'in_sw2', nodeId: 'sw2', port: 'out', label: 'SW2', pin: 'SW2' },
      ],
      outputs: [
        { id: 'out_ld0', nodeId: 'ld0', port: 'in', label: 'LD0', pin: 'LD0' },
        { id: 'out_ld1', nodeId: 'ld1', port: 'in', label: 'LD1', pin: 'LD1' },
      ],
    },
    vectors: [
      { tick: 0, inputs: { SW0: 0, SW1: 0, SW2: 0 }, expected: { LD0: 0, LD1: 0 } },
      { tick: 1, inputs: { SW0: 1, SW1: 1, SW2: 0 }, expected: { LD0: 1, LD1: 1 } },
      { tick: 2, inputs: { SW0: 1, SW1: 0, SW2: 1 }, expected: { LD0: 0, LD1: 1 } },
      { tick: 3, inputs: { SW0: 1, SW1: 1, SW2: 1 }, expected: { LD0: 1, LD1: 1 } },
    ],
    meta: {
      projectId: 'vivado-consistency-richer-logic',
      tags: ['contract', 'vivado', 'consistency'],
    },
  };
}

function buildClockedRegisterProject(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-04-23T00:00:00.000Z',
    updatedAt: '2026-04-23T00:00:00.000Z',
    name: 'Clocked Register Vivado Consistency Fixture',
    description: 'Sequential board-clock fixture for artifact consistency.',
    circuit: {
      nodes: [
        { id: 'clk', type: 'Clock', x: 40, y: 60, label: 'clk', config: { period: 10 }, state: {} },
        { id: 'sw0', type: 'Switch', x: 40, y: 160, label: 'D', config: {}, state: {} },
        { id: 'rst', type: 'Switch', x: 40, y: 260, label: 'RST', config: {}, state: {} },
        { id: 'ff0', type: 'DFlipFlop', x: 240, y: 140, label: 'FF0', config: {}, state: {} },
        { id: 'ld0', type: 'Lamp', x: 440, y: 140, label: 'Q', config: {}, state: {} },
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
        { id: 'sw0', nodeId: 'sw0', port: 'out', label: 'D', pin: 'SW0' },
        { id: 'rst', nodeId: 'rst', port: 'out', label: 'RST', pin: 'BTNC' },
      ],
      outputs: [
        { id: 'out_ld0', nodeId: 'ld0', port: 'in', label: 'Q', pin: 'LD0' },
      ],
    },
    vectors: [
      { tick: 0, inputs: { clk: 0, D: 0, RST: 1 }, expected: { Q: 0 } },
      { tick: 1, inputs: { clk: 1, D: 1, RST: 0 }, expected: { Q: 1 } },
    ],
    meta: {
      projectId: 'vivado-consistency-clocked-register',
      tags: ['contract', 'vivado', 'consistency', 'clocked'],
    },
  };
}

function buildProjectFolderInput(project: RBProject): BuildVivadoProjectFolderInput {
  const viewModel = buildExportViewModel(project);
  expect(viewModel.status).toBe('ok');
  expect(viewModel.errors).toEqual([]);

  return {
    artifacts: viewModel.artifacts
      .filter((artifact) => artifact.content.trim().length > 0)
      .map((artifact) => ({
        path: artifact.path,
        content: artifact.content,
      })),
    projectName: project.name,
    projectSlug: deriveVivadoProjectSlug(project.meta?.projectId ?? project.name),
    topModule: project.hdl?.top ?? project.fpga?.top ?? 'top',
    part: resolveVivadoPart(project.fpga?.part),
  };
}

type VivadoArtifacts = BuildVivadoProjectFolderInput['artifacts'];

function getRequiredArtifactContent(artifacts: VivadoArtifacts, path: string): string {
  const artifact = artifacts.find((candidate) => candidate.path === path);
  expect(artifact).toBeDefined();
  return artifact?.content ?? '';
}

function getOptionalArtifactContent(artifacts: VivadoArtifacts, path: string): string {
  return artifacts.find((candidate) => candidate.path === path)?.content ?? '';
}

function mutateTopXdcArtifacts(
  artifacts: VivadoArtifacts,
  mutate: (topXdc: string) => string
): { artifacts: VivadoArtifacts; mutatedTopXdc: string } {
  const originalTopXdc = getRequiredArtifactContent(artifacts, 'top.xdc');
  const mutatedTopXdc = mutate(originalTopXdc);
  const mutatedArtifacts = artifacts.map((artifact) =>
    artifact.path === 'top.xdc' ? { ...artifact, content: mutatedTopXdc } : artifact
  );
  return { artifacts: mutatedArtifacts, mutatedTopXdc };
}

function validateConsistencyForArtifacts(artifacts: VivadoArtifacts): string[] {
  return validateVivadoArtifactConsistency({
    topVhd: getRequiredArtifactContent(artifacts, 'top.vhd'),
    topXdc: getRequiredArtifactContent(artifacts, 'top.xdc'),
    testbenchVhd: getOptionalArtifactContent(artifacts, 'testbench.vhd'),
    xprText: '',
    vivadoImportTcl: '',
  });
}

function toEntryTextMap(
  entries: Array<{ name: string; text: string; dir?: boolean }>
): Map<string, string> {
  const result = new Map<string, string>();
  for (const entry of entries) {
    if (entry.dir) continue;
    result.set(entry.name, entry.text);
  }
  return result;
}

function extractEntityPorts(topVhd: string): string[] {
  const block = topVhd.match(/\bentity\s+[A-Za-z_][A-Za-z0-9_]*\s+is[\s\S]*?\bport\s*\(([^]*?)\)\s*;/i);
  if (!block) return [];
  return Array.from(
    new Set(
      block[1]
        .split(';')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .flatMap((entry) => {
          const left = entry.split(':')[0]?.trim() ?? '';
          if (left.length === 0) return [];
          return left
            .split(',')
            .map((name) => name.trim())
            .filter((name) => name.length > 0);
        })
    )
  );
}

function findUndeclaredAssignmentIdentifiers(topVhd: string): string[] {
  const declared = new Set<string>();
  for (const port of extractEntityPorts(topVhd)) {
    declared.add(port.toLowerCase());
  }
  for (const match of topVhd.matchAll(/\bsignal\s+([A-Za-z_][A-Za-z0-9_]*)\s*:/gi)) {
    declared.add(match[1].toLowerCase());
  }

  const keywords = new Set([
    'and',
    'or',
    'not',
    'xor',
    'nand',
    'nor',
    'xnor',
    'when',
    'else',
    'others',
  ]);

  const unresolved = new Set<string>();
  for (const match of topVhd.matchAll(/<=\s*([^;]+);/g)) {
    const rhs = match[1];
    for (const token of rhs.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []) {
      const normalized = token.toLowerCase();
      if (keywords.has(normalized)) continue;
      if (!declared.has(normalized)) unresolved.add(token);
    }
  }

  return Array.from(unresolved).sort((left, right) => left.localeCompare(right));
}

function assertFullConsistency(
  slug: string,
  topVhd: string,
  topXdc: string,
  testbenchVhd: string,
  xprText: string,
  importTclText: string
): void {
  const issues = validateVivadoArtifactConsistency({
    topVhd,
    topXdc,
    testbenchVhd,
    xprText,
    vivadoImportTcl: importTclText,
    expectedTopModule: 'top',
    expectedXprSourceRef: 'sources_1/new/top.vhd',
    expectedXprConstraintsRef: 'constrs_1/new/top.xdc',
    expectedTclSourcePath: `${slug}.srcs/sources_1/new/top.vhd`,
    expectedTclConstraintsPath: `${slug}.srcs/constrs_1/new/top.xdc`,
    expectedTclSimulationPath: `${slug}.srcs/sim_1/new/testbench.vhd`,
  });

  expect(issues).toEqual([]);
  expect(findUndeclaredAssignmentIdentifiers(topVhd)).toEqual([]);
}

describe('IDE Vivado full artifact consistency contract', () => {
  it('pass-through project ZIP is structurally consistent across VHDL/XDC/testbench/XPR/TCL', async () => {
    const project = buildPassThroughProject();
    const input = buildProjectFolderInput(project);
    const slug = deriveVivadoProjectSlug(project.meta?.projectId ?? project.name);

    const zipBytes = await buildVivadoProjectFolderZip(input);
    const loaded = await JSZip.loadAsync(zipBytes);

    const topVhd = await loaded.file(`${slug}/${slug}.srcs/sources_1/new/top.vhd`)!.async('string');
    const topXdc = await loaded.file(`${slug}/${slug}.srcs/constrs_1/new/top.xdc`)!.async('string');
    const testbenchVhd = await loaded.file(`${slug}/${slug}.srcs/sim_1/new/testbench.vhd`)!.async('string');
    const xprText = await loaded.file(`${slug}/${slug}.xpr`)!.async('string');
    const importTclText = await loaded.file(`${slug}/vivado_import.tcl`)!.async('string');

    assertFullConsistency(slug, topVhd, topXdc, testbenchVhd, xprText, importTclText);
  });

  it('richer logic project remains consistent across the full export artifact set', async () => {
    const project = buildRicherLogicProject();
    const input = buildProjectFolderInput(project);
    const slug = deriveVivadoProjectSlug(project.meta?.projectId ?? project.name);

    const entries = await buildVivadoProjectFolderEntries(input);
    const byPath = toEntryTextMap(entries);

    const topVhd = byPath.get(`${slug}/${slug}.srcs/sources_1/new/top.vhd`) ?? '';
    const topXdc = byPath.get(`${slug}/${slug}.srcs/constrs_1/new/top.xdc`) ?? '';
    const testbenchVhd = byPath.get(`${slug}/${slug}.srcs/sim_1/new/testbench.vhd`) ?? '';
    const xprText = byPath.get(`${slug}/${slug}.xpr`) ?? '';
    const importTclText = byPath.get(`${slug}/vivado_import.tcl`) ?? '';

    expect(topVhd.length).toBeGreaterThan(0);
    expect(topXdc.length).toBeGreaterThan(0);
    expect(testbenchVhd.length).toBeGreaterThan(0);
    expect(xprText.length).toBeGreaterThan(0);
    expect(importTclText.length).toBeGreaterThan(0);

    assertFullConsistency(slug, topVhd, topXdc, testbenchVhd, xprText, importTclText);
  });

  it('clocked project stays consistent and preserves a real W5 board clock constraint', async () => {
    const project = buildClockedRegisterProject();
    const input = buildProjectFolderInput(project);
    const slug = deriveVivadoProjectSlug(project.meta?.projectId ?? project.name);

    const entries = await buildVivadoProjectFolderEntries(input);
    const byPath = toEntryTextMap(entries);

    const topVhd = byPath.get(`${slug}/${slug}.srcs/sources_1/new/top.vhd`) ?? '';
    const topXdc = byPath.get(`${slug}/${slug}.srcs/constrs_1/new/top.xdc`) ?? '';
    const testbenchVhd = byPath.get(`${slug}/${slug}.srcs/sim_1/new/testbench.vhd`) ?? '';
    const xprText = byPath.get(`${slug}/${slug}.xpr`) ?? '';
    const importTclText = byPath.get(`${slug}/vivado_import.tcl`) ?? '';

    expect(topXdc).toContain('PACKAGE_PIN W5');
    expect(topXdc).toContain('create_clock -period 10.000');
    assertFullConsistency(slug, topVhd, topXdc, testbenchVhd, xprText, importTclText);
  });

  it('aborts export when top-level naming drifts across generated artifacts', async () => {
    const project = buildPassThroughProject();
    const input = buildProjectFolderInput(project);

    const driftedArtifacts = input.artifacts.map((artifact) => {
      if (artifact.path !== 'top.xdc') return artifact;
      return {
        ...artifact,
        content: artifact.content.replace(
          /\[get_ports\s*\{([^}]+)\}\]/,
          '[get_ports {$1_drift}]'
        ),
      };
    });

    await expect(
      buildVivadoProjectFolderEntries({
        ...input,
        artifacts: driftedArtifacts,
      })
    ).rejects.toThrow('Vivado export aborted: artifact naming/top-module consistency check failed.');
  });

  it('rejects XDC with malformed syntax (unmatched brackets)', async () => {
    const project = buildPassThroughProject();
    const input = buildProjectFolderInput(project);

    const malformedArtifacts = input.artifacts.map((artifact) => {
      if (artifact.path !== 'top.xdc') return artifact;
      // Introduce unmatched bracket in [get_ports
      return {
        ...artifact,
        content: artifact.content.replace(
          '[get_ports {',
          '[get_ports {'
        ),
      };
    });

    // Remove closing bracket to create malformed syntax
    const brokenXdc = malformedArtifacts.find((a) => a.path === 'top.xdc');
    if (brokenXdc) {
      // Remove a closing bracket to break syntax
      brokenXdc.content = brokenXdc.content.replace(
        /(\[get_ports\s*\{[^}]*)\}/,
        '$1'
      );
    }

    await expect(
      buildVivadoProjectFolderEntries({
        ...input,
        artifacts: malformedArtifacts,
      })
    ).rejects.toThrow(/XDC.*unmatched.*bracket|XDC.*syntax/i);
  });

  it('rejects XDC when pin does not exist on Basys3', async () => {
    const project = buildPassThroughProject();
    const input = buildProjectFolderInput(project);
    const originalTopXdc = getRequiredArtifactContent(input.artifacts, 'top.xdc');

    const { artifacts: invalidPinArtifacts, mutatedTopXdc } = mutateTopXdcArtifacts(
      input.artifacts,
      (topXdc) => topXdc.replace(/PACKAGE_PIN\s+[A-Z0-9]+/, 'PACKAGE_PIN AA1')
    );

    expect(mutatedTopXdc).toContain('PACKAGE_PIN AA1');
    expect(mutatedTopXdc).not.toEqual(originalTopXdc);
    expect(getRequiredArtifactContent(invalidPinArtifacts, 'top.xdc')).toEqual(mutatedTopXdc);

    const validatorIssues = validateConsistencyForArtifacts(invalidPinArtifacts);
    expect(validatorIssues.some((issue) => /AA1.*does not exist on Basys3/i.test(issue))).toBe(true);

    await expect(
      buildVivadoProjectFolderEntries({
        ...input,
        artifacts: invalidPinArtifacts,
      })
    ).rejects.toThrow(/AA1.*does not exist on Basys3/i);
  });

  it('rejects XDC with duplicate PACKAGE_PIN assignments', async () => {
    const project = buildPassThroughProject();
    const input = buildProjectFolderInput(project);
    const originalTopXdc = getRequiredArtifactContent(input.artifacts, 'top.xdc');

    const { artifacts: duplicatePinArtifacts, mutatedTopXdc } = mutateTopXdcArtifacts(
      input.artifacts,
      (topXdc) => {
        const lines = topXdc.split('\n');
        const firstAssignmentIndex = lines.findIndex((line) => /PACKAGE_PIN\s+[A-Z0-9]+/.test(line));
        if (firstAssignmentIndex < 0) {
          throw new Error('Expected at least one PACKAGE_PIN assignment in top.xdc fixture.');
        }
        lines.splice(firstAssignmentIndex + 1, 0, lines[firstAssignmentIndex]);
        return lines.join('\n');
      }
    );

    expect(mutatedTopXdc).not.toEqual(originalTopXdc);
    expect(getRequiredArtifactContent(duplicatePinArtifacts, 'top.xdc')).toEqual(mutatedTopXdc);

    const pinAssignmentLines = mutatedTopXdc
      .split('\n')
      .filter((line) => /PACKAGE_PIN\s+[A-Z0-9]+/.test(line));
    const pinValues = pinAssignmentLines
      .map((line) => line.match(/PACKAGE_PIN\s+([A-Z0-9]+)/)?.[1] ?? '')
      .filter((pin) => pin.length > 0);
    const duplicatePin = pinValues.find((pin, index) => pinValues.indexOf(pin) !== index);

    expect(duplicatePin).toBeDefined();
    if (!duplicatePin) {
      throw new Error('Expected duplicated PACKAGE_PIN value in mutated top.xdc.');
    }
    expect(pinAssignmentLines.filter((line) => line.includes(`PACKAGE_PIN ${duplicatePin}`)).length).toBeGreaterThanOrEqual(2);

    const validatorIssues = validateConsistencyForArtifacts(duplicatePinArtifacts);
    expect(validatorIssues.some((issue) => /assigns pin.*multiple ports|duplicate/i.test(issue))).toBe(true);

    await expect(
      buildVivadoProjectFolderEntries({
        ...input,
        artifacts: duplicatePinArtifacts,
      })
    ).rejects.toThrow(/assigns pin.*multiple ports|duplicate/i);
  });
});

