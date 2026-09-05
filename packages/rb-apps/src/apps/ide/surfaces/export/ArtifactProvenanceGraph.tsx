import React, { useMemo } from 'react';
import {
  buildArtifactDependencyGraph,
  type ArtifactGraphSource,
  type ArtifactInputId,
} from '../../artifactDependencyGraph';

/**
 * Package provenance figure — inputs on the left (Design, Board & Constraints,
 * Simulate, Project), generated files on the right, one curve per dependency.
 * Every node is operable: inputs open their workspace document, files select
 * the artifact. Files that changed against the previous recorded package are
 * marked; inputs that changed since the last package are marked too. It is a
 * read-only projection of the export view model and the export ledger.
 */
export interface ArtifactProvenanceGraphProps {
  readonly artifacts: readonly ArtifactGraphSource[];
  readonly selectedPath?: string | null;
  /** Artifact paths whose content differs from the previous recorded package. */
  readonly changedPaths?: ReadonlySet<string>;
  /** Inputs that changed since the last recorded package. */
  readonly changedInputs?: ReadonlySet<ArtifactInputId>;
  readonly onSelectArtifact?: (path: string) => void;
  readonly onOpenInput?: (input: ArtifactInputId) => void;
}

const INPUT_W = 168;
const FILE_W = 220;
const ROW_H = 26;
const GAP_X = 96;
const PAD = 8;
const NODE_H = 20;

export const ArtifactProvenanceGraph: React.FC<ArtifactProvenanceGraphProps> = ({
  artifacts,
  selectedPath = null,
  changedPaths,
  changedInputs,
  onSelectArtifact,
  onOpenInput,
}) => {
  const graph = useMemo(() => buildArtifactDependencyGraph(artifacts), [artifacts]);
  const rows = Math.max(graph.inputs.length, graph.artifacts.length, 1);
  const height = rows * ROW_H + PAD * 2;
  const width = INPUT_W + GAP_X + FILE_W + PAD * 2;
  const inputY = new Map<string, number>();
  graph.inputs.forEach((input, index) => inputY.set(input.id, PAD + index * ROW_H + ROW_H / 2));
  const fileY = new Map<string, number>();
  graph.artifacts.forEach((artifact, index) => fileY.set(artifact.path, PAD + index * ROW_H + ROW_H / 2));
  const fileX = PAD + INPUT_W + GAP_X;
  const selectedArtifact = selectedPath ? graph.artifacts.find((artifact) => artifact.path === selectedPath) ?? null : null;
  const emphasised = new Set<string>();
  if (selectedArtifact) {
    for (const input of selectedArtifact.inputs) emphasised.add(input);
    for (const dependency of selectedArtifact.dependsOn) emphasised.add(dependency);
    emphasised.add(selectedArtifact.path);
  }

  if (graph.artifacts.length === 0) {
    return (
      <p className="rb-pkg-provenance-empty" data-testid="ide-export-provenance-graph-empty">
        Generate a package to see how each file depends on the design, the board mapping and the recorded run.
      </p>
    );
  }

  return (
    <svg
      className="rb-pkg-provenance-graph"
      data-testid="ide-export-provenance-graph"
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      role="img"
      aria-label={`Package provenance: ${graph.artifacts.length} files generated from ${graph.inputs.map((input) => input.label).join(', ')}`}
      style={{ maxWidth: width, height: 'auto' }}
    >
      {graph.edges.map((edge) => {
        const fromInput = inputY.has(edge.from);
        const y1 = fromInput ? inputY.get(edge.from)! : fileY.get(edge.from)!;
        const y2 = fileY.get(edge.to)!;
        const x1 = fromInput ? PAD + INPUT_W : fileX + FILE_W;
        const x2 = fromInput ? fileX : fileX + FILE_W + 12;
        const isEmphasised =
          selectedArtifact !== null && (edge.to === selectedArtifact.path && (emphasised.has(edge.from)));
        const dim = selectedArtifact !== null && !isEmphasised;
        const d = fromInput
          ? `M ${x1} ${y1} C ${x1 + GAP_X / 2} ${y1}, ${x2 - GAP_X / 2} ${y2}, ${x2} ${y2}`
          : `M ${x1} ${y1} C ${x2 + 12} ${y1}, ${x2 + 12} ${y2}, ${x1} ${y2}`;
        return (
          <path
            key={`${edge.from}->${edge.to}`}
            d={d}
            className={`rb-pkg-provenance-edge is-${edge.kind}${isEmphasised ? ' is-emphasised' : ''}${dim ? ' is-dim' : ''}`}
            data-testid={`ide-export-provenance-edge-${edge.kind}`}
            fill="none"
          />
        );
      })}
      {graph.inputs.map((input) => {
        const y = inputY.get(input.id)!;
        const changed = changedInputs?.has(input.id) ?? false;
        return (
          <g
            key={input.id}
            className={`rb-pkg-provenance-node is-input${changed ? ' is-changed' : ''}${emphasised.has(input.id) ? ' is-emphasised' : ''}`}
            data-testid={`ide-export-provenance-input-${input.id}`}
            data-changed={changed ? 'true' : undefined}
            role={onOpenInput ? 'button' : undefined}
            tabIndex={onOpenInput ? 0 : undefined}
            onClick={onOpenInput ? () => onOpenInput(input.id) : undefined}
            onKeyDown={onOpenInput ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenInput(input.id); } } : undefined}
            style={{ cursor: onOpenInput ? 'pointer' : 'default' }}
          >
            <title>{`${input.label} — ${input.detail}${changed ? ' · changed since the last package' : ''}`}</title>
            <rect x={PAD} y={y - NODE_H / 2} width={INPUT_W} height={NODE_H} rx={3} />
            <text x={PAD + 8} y={y + 4}>{input.label}</text>
            {changed ? <circle cx={PAD + INPUT_W - 8} cy={y} r={3} className="rb-pkg-provenance-dot" /> : null}
          </g>
        );
      })}
      {graph.artifacts.map((artifact) => {
        const y = fileY.get(artifact.path)!;
        const changed = changedPaths?.has(artifact.path) ?? false;
        const isSelected = artifact.path === selectedPath;
        return (
          <g
            key={artifact.path}
            className={`rb-pkg-provenance-node is-file is-${artifact.status}${changed ? ' is-changed' : ''}${isSelected ? ' is-selected' : ''}`}
            data-testid={`ide-export-provenance-file-${artifact.path.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
            data-changed={changed ? 'true' : undefined}
            aria-current={isSelected ? 'true' : undefined}
            role={onSelectArtifact ? 'button' : undefined}
            tabIndex={onSelectArtifact ? 0 : undefined}
            onClick={onSelectArtifact ? () => onSelectArtifact(artifact.path) : undefined}
            onKeyDown={onSelectArtifact ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectArtifact(artifact.path); } } : undefined}
            style={{ cursor: onSelectArtifact ? 'pointer' : 'default' }}
          >
            <title>{`${artifact.path} — from ${artifact.inputs.join(', ')}${artifact.dependsOn.length > 0 ? `; references ${artifact.dependsOn.join(', ')}` : ''}${changed ? ' · changed against the previous package' : ''}`}</title>
            <rect x={fileX} y={y - NODE_H / 2} width={FILE_W} height={NODE_H} rx={3} />
            <text x={fileX + 8} y={y + 4}>{artifact.path}</text>
            <text x={fileX + FILE_W - 8} y={y + 4} textAnchor="end" className="rb-pkg-provenance-status">
              {artifact.status === 'ready' ? (changed ? 'changed' : 'ready') : artifact.status}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
