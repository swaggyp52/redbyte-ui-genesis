/**
 * Artifact dependency graph — a derived read-model over the package's
 * artifact list. It says which workbench inputs each generated file depends
 * on, and which generated files feed others, using the same categories the
 * bundle uses to place files. It owns no export truth: the artifacts, their
 * contents and hashes come from the export view model and the export ledger.
 */
export type ArtifactInputId = 'design' | 'board' | 'simulate' | 'project';

export interface ArtifactGraphInput {
  readonly id: ArtifactInputId;
  readonly label: string;
  readonly detail: string;
}

export interface ArtifactGraphArtifact {
  readonly path: string;
  readonly kind: string;
  readonly category: string;
  readonly status: 'ready' | 'blocked' | 'pending';
  /** Workbench inputs this file is generated from. */
  readonly inputs: readonly ArtifactInputId[];
  /** Other generated files this file references. */
  readonly dependsOn: readonly string[];
}

export interface ArtifactGraphEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: 'input' | 'artifact';
}

export interface ArtifactDependencyGraph {
  readonly inputs: readonly ArtifactGraphInput[];
  readonly artifacts: readonly ArtifactGraphArtifact[];
  readonly edges: readonly ArtifactGraphEdge[];
}

export const ARTIFACT_GRAPH_INPUTS: readonly ArtifactGraphInput[] = Object.freeze([
  { id: 'design', label: 'Design', detail: 'Circuit, hierarchy and the top entity' },
  { id: 'board', label: 'Board & Constraints', detail: 'Pin assignments and the active constraint set' },
  { id: 'simulate', label: 'Simulate', detail: 'The active scenario and its recorded run' },
  { id: 'project', label: 'Project', detail: 'Project identity, sources and package settings' },
]);

export interface ArtifactGraphSource {
  readonly path: string;
  readonly kind: string;
  readonly category: string;
  readonly status: 'ready' | 'blocked' | 'pending';
}

function lower(value: string): string {
  return value.trim().toLowerCase();
}

function inputsFor(artifact: ArtifactGraphSource): ArtifactInputId[] {
  const kind = lower(artifact.kind);
  const category = lower(artifact.category);
  const path = lower(artifact.path);
  if (category === 'design-source' || kind === 'vhd' && !/tb|test/.test(path)) return ['design'];
  if (category === 'constraints' || kind === 'xdc') return ['board', 'design'];
  if (category === 'simulation-source' || kind === 'tb' || /testbench|_tb\b/.test(path)) return ['simulate', 'design'];
  if (kind === 'tcl') return ['project', 'design', 'board'];
  // README, manifest and other metadata describe the whole package.
  return ['project', 'design', 'board', 'simulate'];
}

function artifactDependencies(artifact: ArtifactGraphSource, all: readonly ArtifactGraphSource[]): string[] {
  const kind = lower(artifact.kind);
  const category = lower(artifact.category);
  const path = lower(artifact.path);
  const designSources = all.filter((entry) => lower(entry.category) === 'design-source' || (lower(entry.kind) === 'vhd' && !/tb|test/.test(lower(entry.path))));
  const constraints = all.filter((entry) => lower(entry.category) === 'constraints' || lower(entry.kind) === 'xdc');
  const simulation = all.filter((entry) => lower(entry.category) === 'simulation-source' || lower(entry.kind) === 'tb');
  const others = (entries: readonly ArtifactGraphSource[]) => entries.map((entry) => entry.path).filter((entryPath) => entryPath !== artifact.path);
  if (category === 'simulation-source' || kind === 'tb' || /testbench|_tb\b/.test(path)) return others(designSources);
  if (kind === 'tcl') return others([...designSources, ...constraints, ...simulation]);
  // README, manifests and metadata describe the package; they are drawn from the inputs, not from every file.
  return [];
}

/** Build the graph for the current artifact list. Deterministic: order follows the artifact list. */
export function buildArtifactDependencyGraph(sources: readonly ArtifactGraphSource[]): ArtifactDependencyGraph {
  const artifacts: ArtifactGraphArtifact[] = sources.map((artifact) => ({
    path: artifact.path,
    kind: artifact.kind,
    category: artifact.category,
    status: artifact.status,
    inputs: inputsFor(artifact),
    dependsOn: artifactDependencies(artifact, sources),
  }));
  const edges: ArtifactGraphEdge[] = [];
  for (const artifact of artifacts) {
    for (const input of artifact.inputs) edges.push({ from: input, to: artifact.path, kind: 'input' });
    for (const dependency of artifact.dependsOn) edges.push({ from: dependency, to: artifact.path, kind: 'artifact' });
  }
  const usedInputs = new Set(artifacts.flatMap((artifact) => artifact.inputs));
  return {
    inputs: ARTIFACT_GRAPH_INPUTS.filter((input) => usedInputs.has(input.id)),
    artifacts,
    edges,
  };
}

/** Artifacts that would be affected if the given input changed. */
export function artifactsDependingOn(graph: ArtifactDependencyGraph, input: ArtifactInputId): string[] {
  return graph.artifacts.filter((artifact) => artifact.inputs.includes(input)).map((artifact) => artifact.path);
}
