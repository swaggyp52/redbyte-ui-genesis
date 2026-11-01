import { describe, expect, it } from 'vitest';
import { artifactsDependingOn, buildArtifactDependencyGraph } from '../artifactDependencyGraph';

/** P2.5H Wave Three — the provenance graph is derived from the bundle's own categories. */
const ARTIFACTS = [
  { path: 'top.vhd', kind: 'vhd', category: 'design-source', status: 'ready' as const },
  { path: 'top.xdc', kind: 'xdc', category: 'constraints', status: 'ready' as const },
  { path: 'testbench.vhd', kind: 'tb', category: 'simulation-source', status: 'ready' as const },
  { path: 'vivado_import.tcl', kind: 'tcl', category: 'project-meta', status: 'ready' as const },
  { path: 'README.md', kind: 'md', category: 'project-meta', status: 'pending' as const },
];

describe('artifactDependencyGraph', () => {
  it('assigns inputs by category: design sources from Design, constraints from Board, testbench from Simulate', () => {
    const graph = buildArtifactDependencyGraph(ARTIFACTS);
    const byPath = new Map(graph.artifacts.map((artifact) => [artifact.path, artifact]));
    expect(byPath.get('top.vhd')?.inputs).toEqual(['design']);
    expect(byPath.get('top.xdc')?.inputs).toEqual(['board', 'design']);
    expect(byPath.get('testbench.vhd')?.inputs).toEqual(['simulate', 'design']);
    expect(byPath.get('vivado_import.tcl')?.inputs).toEqual(['project', 'design', 'board']);
    expect(graph.inputs.map((input) => input.id)).toEqual(['design', 'board', 'simulate', 'project']);
  });

  it('links generated files that reference other generated files', () => {
    const graph = buildArtifactDependencyGraph(ARTIFACTS);
    const byPath = new Map(graph.artifacts.map((artifact) => [artifact.path, artifact]));
    expect(byPath.get('testbench.vhd')?.dependsOn).toEqual(['top.vhd']);
    expect(byPath.get('vivado_import.tcl')?.dependsOn).toEqual(['top.vhd', 'top.xdc', 'testbench.vhd']);
    // Metadata describes the package; it is drawn from the inputs, not from every other file.
    expect(byPath.get('README.md')?.dependsOn).toEqual([]);
    expect(byPath.get('top.vhd')?.dependsOn).toEqual([]);
    expect(graph.edges.filter((edge) => edge.kind === 'artifact').length).toBe(1 + 3);
  });

  it('answers which files a changed input would affect', () => {
    const graph = buildArtifactDependencyGraph(ARTIFACTS);
    expect(artifactsDependingOn(graph, 'board')).toEqual(['top.xdc', 'vivado_import.tcl', 'README.md']);
    expect(artifactsDependingOn(graph, 'simulate')).toEqual(['testbench.vhd', 'README.md']);
  });

  it('is empty for an empty package', () => {
    const graph = buildArtifactDependencyGraph([]);
    expect(graph.artifacts).toEqual([]);
    expect(graph.inputs).toEqual([]);
  });
});
