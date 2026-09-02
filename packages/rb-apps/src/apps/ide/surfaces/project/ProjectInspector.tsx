import React from 'react';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { ConstraintSetsDocument } from '../../constraintSets';
import type { EngineeringObjectRef } from '../../engineeringSelection';
import { modulePortWidth, TOP_MODULE_ID, type ProjectHierarchyDocument } from '../../projectHierarchy';
import type { ProjectOutlineSummary } from '../../projectOutline';
import type { VerifyRunLedgerEntry } from '../../projectRuntime';
import type { ProjectSourceModel } from '../../projectSourceModel';
import { capabilityFor } from '../../languageCapability';
import { linksForModule, crossProbeQualityLabel, type CrossProbeIndex } from '../../sourceCrossProbe';
import type { WorkbenchDocument } from '../../workbenchDocuments';
import type { IdeMode } from '../../workflowStages';
import {
  artifactKind,
  formatRelative,
  modulePortSignature,
  type ProjectArtifactSummary,
  type ProjectMappingRowLike,
  type ProjectProblem,
  type ProjectScenarioSummary,
} from './projectWorkbenchModel';

export interface ProjectInspectorProps {
  readonly selected: EngineeringObjectRef | null;
  readonly projectName: string;
  readonly topModuleName: string;
  readonly boardLabel: string;
  readonly fpgaPart: string;
  readonly circuit: Circuit | undefined;
  readonly hierarchy: ProjectHierarchyDocument | undefined;
  readonly outline: ProjectOutlineSummary | null;
  readonly sourceModel: ProjectSourceModel | undefined;
  readonly crossProbe: CrossProbeIndex | null;
  readonly sourceLabels: Record<string, string>;
  readonly scenarios: readonly ProjectScenarioSummary[];
  readonly constraintSets: ConstraintSetsDocument | undefined;
  readonly mappingRows: readonly ProjectMappingRowLike[];
  readonly artifacts: readonly ProjectArtifactSummary[];
  readonly runs: readonly VerifyRunLedgerEntry[];
  readonly problems: readonly ProjectProblem[];
  readonly onOpenDocument: (doc: WorkbenchDocument) => void;
  readonly onNavigateMode: (mode: IdeMode) => void;
  readonly onClose: () => void;
}

type Row = { label: string; value: React.ReactNode; mono?: boolean; tone?: 'ok' | 'warn' | 'error' };
type Section = { title: string; rows: Row[] };

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Project inspector — a property grid for the selected engineering object,
 * read live from its authority. Renders nothing when nothing is selected, so
 * the right dock collapses to zero width.
 */
export const ProjectInspector: React.FC<ProjectInspectorProps> = (props) => {
  const { selected, onOpenDocument, onNavigateMode, onClose } = props;
  if (!selected) return null;
  const resolved = resolveSections(selected, props);
  if (!resolved) return null;

  return (
    <section className="wb-toolwindow rb-inspector" data-testid="ide-project-inspector" aria-label="Inspector">
      <header className="wb-toolwindow-header">
        <span className="rb-inspector-kind">{resolved.kind}</span>
        <code className="rb-inspector-name">{resolved.name}</code>
        <span className="wb-toolbar-spacer" />
        <button type="button" className="wb-btn wb-btn--ghost wb-btn--icon" aria-label="Clear selection" title="Clear selection" onClick={onClose}>×</button>
      </header>
      <div className="wb-toolwindow-body">
        <div className="wb-propgrid" data-testid="ide-project-inspector-grid">
          {resolved.sections.map((section) => (
            <React.Fragment key={section.title}>
              <div className="wb-propgrid-group">{section.title}</div>
              {section.rows.map((row, index) => (
                <React.Fragment key={`${section.title}-${index}`}>
                  <div className="wb-propgrid-label">{row.label}</div>
                  <div className={`wb-propgrid-value${row.mono ? ' is-mono' : ''}`} data-tone={row.tone}>{row.value}</div>
                </React.Fragment>
              ))}
            </React.Fragment>
          ))}
          {resolved.commands.length > 0 ? (
            <div className="wb-propgrid-actions">
              {resolved.commands.map((command) => (
                <button
                  key={command.label}
                  type="button"
                  className="wb-btn"
                  data-testid={`ide-project-inspector-cmd-${command.id}`}
                  onClick={() => (command.open ? onOpenDocument(command.open) : command.mode ? onNavigateMode(command.mode) : undefined)}
                >
                  {command.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};

interface Resolved {
  kind: string;
  name: string;
  sections: Section[];
  commands: { id: string; label: string; open?: WorkbenchDocument; mode?: IdeMode }[];
}

function resolveSections(selected: EngineeringObjectRef, props: ProjectInspectorProps): Resolved | null {
  const { circuit, hierarchy, outline, sourceModel, crossProbe, sourceLabels } = props;
  const modules = hierarchy?.modules ?? [];
  switch (selected.kind) {
    case 'project':
      return {
        kind: 'project',
        name: props.projectName,
        sections: [
          {
            title: 'Identity',
            rows: [
              { label: 'Top', value: props.topModuleName, mono: true },
              { label: 'Board', value: props.boardLabel, mono: true },
              { label: 'Part', value: props.fpgaPart, mono: true },
            ],
          },
        ],
        commands: [{ id: 'open-schematic', label: 'Open schematic', open: { kind: 'schematic', moduleId: TOP_MODULE_ID } }],
      };
    case 'module': {
      const isTop = selected.moduleId === TOP_MODULE_ID;
      const module = modules.find((entry) => entry.id === selected.moduleId);
      const name = isTop ? props.topModuleName : module?.displayName || module?.name || selected.moduleId;
      const moduleCircuit = isTop ? circuit : module?.circuit;
      const instances = isTop ? 0 : circuit ? circuit.nodes.filter((node) => readString(node.config?.moduleDefinitionId) === selected.moduleId).length : 0;
      const links = crossProbe ? linksForModule(crossProbe, selected.moduleId) : [];
      const portRows: Row[] = (module?.ports ?? []).map((port) => ({
        label: port.name,
        value: `${port.direction} · ${modulePortWidth(port) > 1 ? `[${port.range?.left ?? modulePortWidth(port) - 1}:${port.range?.right ?? 0}]` : '1 bit'}`,
        mono: true,
      }));
      return {
        kind: isTop ? 'top module' : 'module',
        name,
        sections: [
          {
            title: 'Definition',
            rows: [
              { label: 'Kind', value: isTop ? 'top (native visual)' : 'native visual module' },
              { label: 'Nodes', value: String(moduleCircuit?.nodes.length ?? 0), mono: true },
              { label: 'Nets', value: String(moduleCircuit?.connections.length ?? 0), mono: true },
              ...(isTop ? [] : [{ label: 'Instances', value: String(instances), mono: true }]),
              ...(module ? [{ label: 'Signature', value: modulePortSignature(module.ports), mono: true }] : []),
            ],
          },
          ...(portRows.length ? [{ title: 'Ports', rows: portRows }] : []),
          {
            title: 'Source',
            rows: links.length
              ? links.map((link) => ({
                  label: crossProbeQualityLabel(link.quality ?? 'partial'),
                  value: `${sourceLabels[link.sourceId] ?? link.sourceId}${link.range ? `:${link.range.start.line}` : ''}`,
                  mono: true,
                  tone: (link.quality === 'exact' ? 'ok' : link.quality === 'ambiguous' ? 'error' : 'warn') as Row['tone'],
                }))
              : [{ label: 'HDL', value: 'generated from the visual definition' }],
          },
        ],
        commands: [
          { id: 'open-schematic', label: 'Open schematic', open: { kind: 'schematic', moduleId: selected.moduleId } },
          { id: 'open-package', label: 'Generated HDL', open: { kind: 'package-artifact' } },
        ],
      };
    }
    case 'node': {
      const node = circuit?.nodes.find((entry) => entry.id === selected.nodeId);
      if (!node) return null;
      const definitionId = readString(node.config?.moduleDefinitionId);
      const definition = modules.find((entry) => entry.id === definitionId);
      const io = props.mappingRows.find((row) => row.nodeId === node.id);
      const drivers = circuit ? circuit.connections.filter((c) => endpointNode(c.to) === node.id).map((c) => endpointNode(c.from)) : [];
      const loads = circuit ? circuit.connections.filter((c) => endpointNode(c.from) === node.id).map((c) => endpointNode(c.to)) : [];
      return {
        kind: definition ? 'instance' : 'node',
        name: readString(node.config?.instanceName) || String(node.label ?? node.id),
        sections: [
          {
            title: 'Identity',
            rows: [
              { label: 'Id', value: node.id, mono: true },
              { label: 'Type', value: definition ? definition.displayName || definition.name : String(node.type), mono: true },
              { label: 'Module', value: selected.moduleId === TOP_MODULE_ID ? props.topModuleName : selected.moduleId, mono: true },
              ...(io ? [{ label: 'Boundary', value: `${io.label} · ${io.direction} · ${io.pin.trim() || 'unmapped'}`, mono: true, tone: (io.required && !io.pin.trim() ? 'warn' : undefined) as Row['tone'] }] : []),
            ],
          },
          {
            title: 'Connectivity',
            rows: [
              { label: 'Driven by', value: drivers.length ? [...new Set(drivers)].join(', ') : '—', mono: true },
              { label: 'Drives', value: loads.length ? [...new Set(loads)].join(', ') : '—', mono: true },
            ],
          },
        ],
        commands: [
          { id: 'open-schematic', label: 'Show in schematic', open: { kind: 'schematic', moduleId: selected.moduleId } },
          ...(definition ? [{ id: 'open-definition', label: 'Open definition', open: { kind: 'schematic', moduleId: definition.id } as WorkbenchDocument }] : []),
          ...(io ? [{ id: 'open-board', label: 'Board mapping', open: { kind: 'board-io', constraintSetId: 'default' } as WorkbenchDocument }] : []),
        ],
      };
    }
    case 'signal': {
      const io = props.mappingRows.find((row) => row.id === selected.fieldId || row.nodeId === selected.nodeId);
      if (!io) return null;
      return {
        kind: 'signal',
        name: io.label,
        sections: [
          {
            title: 'Boundary',
            rows: [
              { label: 'Field', value: io.id, mono: true },
              { label: 'Direction', value: io.direction, mono: true },
              { label: 'Port', value: io.port, mono: true },
              { label: 'Node', value: io.nodeId ?? '—', mono: true },
              { label: 'Required', value: io.required ? 'yes' : 'no' },
            ],
          },
          {
            title: 'Physical',
            rows: [{ label: 'Pin', value: io.pin.trim() || 'unmapped', mono: true, tone: io.required && !io.pin.trim() ? 'warn' : 'ok' }],
          },
        ],
        commands: [
          { id: 'open-board', label: 'Board mapping', open: { kind: 'board-io', constraintSetId: 'default' } },
          ...(io.nodeId ? [{ id: 'open-schematic', label: 'Show in schematic', open: { kind: 'schematic', moduleId: TOP_MODULE_ID } as WorkbenchDocument }] : []),
        ],
      };
    }
    case 'component': {
      const component = outline?.customComponents.find((entry) => entry.name === selected.componentName);
      return {
        kind: 'component',
        name: selected.componentName,
        sections: [{ title: 'Definition', rows: [{ label: 'I/O', value: component?.ioSummary ?? '—', mono: true }, { label: 'Description', value: component?.description || '—' }] }],
        commands: [{ id: 'open-design', label: 'Open in Design', mode: 'design' }],
      };
    }
    case 'macro': {
      const macro = outline?.macros.find((entry) => entry.id === selected.macroId);
      return {
        kind: 'macro',
        name: selected.macroName,
        sections: [{ title: 'Definition', rows: [{ label: 'I/O', value: macro?.ioSummary ?? '—', mono: true }, { label: 'Description', value: macro?.description || '—' }] }],
        commands: [{ id: 'open-design', label: 'Open in Design', mode: 'design' }],
      };
    }
    case 'scenario': {
      const scenario = props.scenarios.find((entry) => entry.id === selected.scenarioId);
      if (!scenario) return null;
      return {
        kind: 'scenario',
        name: scenario.name,
        sections: [
          {
            title: 'Stimulus',
            rows: [
              { label: 'Kind', value: scenario.sequential ? 'sequential (Timing)' : 'combinational (Cases)' },
              { label: scenario.sequential ? 'Events' : 'Cases', value: String(scenario.vectorCount), mono: true },
              { label: 'Checks', value: String(scenario.checkCount), mono: true },
            ],
          },
        ],
        commands: [
          { id: 'open-cases', label: scenario.sequential ? 'Open Timing' : 'Open Cases', open: { kind: scenario.sequential ? 'timing' : 'cases', scenarioId: scenario.id } },
          { id: 'open-wave', label: 'Open Waveform', open: { kind: 'waveform', scenarioId: scenario.id } },
        ],
      };
    }
    case 'constraint-set': {
      const set = props.constraintSets?.sets.find((entry) => entry.id === selected.constraintSetId);
      const required = props.mappingRows.filter((row) => row.required);
      const mapped = required.filter((row) => row.pin.trim().length > 0);
      return {
        kind: 'constraints',
        name: set?.name ?? `${props.boardLabel} I/O`,
        sections: [
          {
            title: 'Mapping',
            rows: [
              { label: 'Board', value: props.boardLabel, mono: true },
              { label: 'Part', value: props.fpgaPart, mono: true },
              { label: 'Required', value: `${mapped.length}/${required.length} mapped`, mono: true, tone: required.length && mapped.length < required.length ? 'warn' : 'ok' },
              ...(set ? [{ label: 'XDC lines', value: String(set.xdcText.split('\n').filter((l) => l.trim()).length), mono: true }, { label: 'Active', value: props.constraintSets?.activeId === set.id ? 'yes' : 'no' }] : []),
            ],
          },
        ],
        commands: [{ id: 'open-board', label: 'Open I/O planning', open: { kind: 'board-io', constraintSetId: selected.constraintSetId } }],
      };
    }
    case 'source-range': {
      const file = sourceModel?.files.find((entry) => entry.id === selected.fileId);
      if (!file) return null;
      const capability = capabilityFor(file.language);
      return {
        kind: 'source',
        name: file.path,
        sections: [
          {
            title: 'File',
            rows: [
              { label: 'Fileset', value: file.fileset },
              { label: 'Language', value: capability.displayName },
              { label: 'Library', value: file.library, mono: true },
              { label: 'Bytes', value: String(new TextEncoder().encode(file.text).length), mono: true },
              { label: 'Capability', value: `${capability.tier} (${capability.status})`, tone: capability.tier === 'structural-subset' ? 'ok' : 'warn' },
              { label: 'Line', value: String(selected.range.start.line), mono: true },
            ],
          },
        ],
        commands: [{ id: 'open-source', label: 'Open source', open: { kind: 'source-file', fileId: file.id } }],
      };
    }
    case 'artifact': {
      const artifact = props.artifacts.find((entry) => entry.path === selected.artifactId);
      return {
        kind: 'artifact',
        name: selected.artifactId,
        sections: [
          {
            title: 'Generated',
            rows: [
              { label: 'Kind', value: artifactKind(selected.artifactId) },
              { label: 'Bytes', value: artifact ? String(artifact.bytes) : '—', mono: true },
              { label: 'Owner', value: 'Package (deterministic generator)' },
            ],
          },
        ],
        commands: [{ id: 'open-package', label: 'Open in Package', open: { kind: 'package-artifact' } }],
      };
    }
    case 'run': {
      const run = props.runs.find((entry) => entry.runId === selected.runId);
      if (!run) return null;
      return {
        kind: 'run',
        name: run.runId.slice(0, 12),
        sections: [
          {
            title: 'Result',
            rows: [
              { label: 'Status', value: run.status.toUpperCase(), tone: run.status === 'pass' ? 'ok' : 'error' },
              { label: 'Rows', value: `${run.passedRows} pass · ${run.failedRows} fail`, mono: true },
              { label: 'When', value: formatRelative(run.ranAtIso) },
              ...(run.firstFailure ? [{ label: 'First mismatch', value: `${run.firstFailure.signal} @ ${run.firstFailure.tick}: expected ${run.firstFailure.expected}, got ${run.firstFailure.actual}`, mono: true, tone: 'error' as const }] : []),
            ],
          },
          {
            title: 'Identity',
            rows: [
              { label: 'Circuit', value: run.circuitHash.slice(0, 12), mono: true },
              { label: 'Vectors', value: run.vectorsHash.slice(0, 12), mono: true },
              { label: 'Mapping', value: run.mappingHash.slice(0, 12), mono: true },
            ],
          },
        ],
        commands: [{ id: 'open-simulate', label: 'Open Simulate', mode: 'verify' }],
      };
    }
    case 'problem': {
      const problem = props.problems.find((entry) => entry.id === selected.problemId);
      if (!problem) return null;
      return {
        kind: 'problem',
        name: problem.code,
        sections: [{ title: 'Diagnostic', rows: [{ label: 'Severity', value: problem.severity, tone: problem.severity === 'error' ? 'error' : 'warn' }, { label: 'Message', value: problem.message }] }],
        commands: problem.fixMode ? [{ id: 'fix', label: 'Open owner workspace', mode: problem.fixMode }] : [],
      };
    }
    default:
      return null;
  }
}

function endpointNode(endpoint: unknown): string {
  if (typeof endpoint === 'string') return endpoint.split(/[.:/]/)[0];
  if (endpoint && typeof endpoint === 'object' && 'nodeId' in endpoint) return String((endpoint as { nodeId: string }).nodeId);
  return '';
}
