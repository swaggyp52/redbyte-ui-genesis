import type { Circuit } from '@redbyte/rb-logic-core';
import type { ConstraintSetsDocument } from '../../constraintSets';
import type { EngineeringObjectRef } from '../../engineeringSelection';
import type { ProjectHealth } from '../../projectHealth';
import { modulePortWidth, TOP_MODULE_ID, type ProjectHierarchyDocument } from '../../projectHierarchy';
import type { ProjectOutlineSummary } from '../../projectOutline';
import type { VerifyRunLedgerEntry } from '../../projectRuntime';
import {
  deriveCompileOrder,
  filesByFileset,
  isEmptyProjectSourceModel,
  type ProjectSourceModel,
  type SourceFile,
} from '../../projectSourceModel';
import type { WorkbenchDocument } from '../../workbenchDocuments';
import type { IdeMode } from '../../workflowStages';

/**
 * Project workbench read-models. Pure derivations over the canonical
 * authorities (project runtime, source model, hierarchy, scenarios, constraint
 * sets, run ledger, health) that the Project explorer, documents, and inspector
 * render. Nothing here is a store; every row is a typed reference back into
 * the authority that owns it.
 */

export interface ProjectMappingRowLike {
  readonly id: string;
  readonly nodeId?: string;
  readonly label: string;
  readonly direction: 'in' | 'out';
  readonly pin: string;
  readonly required: boolean;
  readonly port: string;
}

export interface ProjectScenarioSummary {
  readonly id: string;
  readonly name: string;
  readonly vectorCount: number;
  readonly checkCount: number;
  readonly sequential: boolean;
}

export interface ProjectArtifactSummary {
  readonly path: string;
  readonly bytes: number;
}

export interface ProjectProblem {
  readonly id: string;
  readonly severity: 'error' | 'warning' | 'info';
  readonly code: string;
  readonly message: string;
  /** Workspace that owns the repair, when the problem carries a fix path. */
  readonly fixMode?: IdeMode;
}

export type ExplorerRowKind =
  | 'module'
  | 'instance'
  | 'component'
  | 'macro'
  | 'source-file'
  | 'scenario'
  | 'constraint-set'
  | 'artifact'
  | 'run'
  | 'problem'
  | 'io'
  | 'document';

export interface ProjectExplorerRow {
  readonly key: string;
  readonly kind: ExplorerRowKind;
  readonly label: string;
  /** Secondary mono text (port signature, language, pin, …). */
  readonly meta?: string;
  readonly depth: number;
  readonly tone?: 'ok' | 'warn' | 'error' | 'ext' | 'muted';
  /** Selecting the row publishes this engineering object. */
  readonly select: EngineeringObjectRef;
  /** Activating the row (double-click / Enter) opens this document. */
  readonly open?: WorkbenchDocument;
  /** Activating navigates to a workspace when there is no document to open. */
  readonly navigateMode?: IdeMode;
  readonly current?: boolean;
}

export interface ProjectExplorerGroup {
  readonly id: 'project' | 'design' | 'hierarchy' | 'simulation' | 'constraints' | 'generated' | 'runs' | 'problems';
  readonly label: string;
  readonly count: number;
  readonly rows: readonly ProjectExplorerRow[];
}

export interface ProjectExplorerInput {
  readonly topModuleName: string;
  readonly circuit: Circuit | undefined;
  readonly hierarchy: ProjectHierarchyDocument | undefined;
  readonly outline: ProjectOutlineSummary | null;
  readonly sourceModel: ProjectSourceModel | undefined;
  readonly scenarios: readonly ProjectScenarioSummary[];
  readonly activeScenarioId: string | null;
  readonly constraintSets: ConstraintSetsDocument | undefined;
  readonly boardLabel: string;
  readonly mappingRows: readonly ProjectMappingRowLike[];
  readonly artifacts: readonly ProjectArtifactSummary[];
  readonly runs: readonly VerifyRunLedgerEntry[];
  readonly problems: readonly ProjectProblem[];
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** `A[3:0], B[3:0] → SUM[3:0], COUT` style port signature for a module. */
export function modulePortSignature(
  ports: readonly { name: string; direction: 'input' | 'output'; width: number; range?: { left: number; right: number } }[]
): string {
  const fmt = (port: (typeof ports)[number]) => {
    const width = modulePortWidth(port);
    if (width <= 1) return port.name;
    const range = port.range ?? { left: width - 1, right: 0 };
    return `${port.name}[${range.left}:${range.right}]`;
  };
  const inputs = ports.filter((p) => p.direction === 'input').map(fmt);
  const outputs = ports.filter((p) => p.direction === 'output').map(fmt);
  return `${inputs.join(', ') || '—'} → ${outputs.join(', ') || '—'}`;
}

export function artifactKind(path: string): 'hdl' | 'constraint' | 'testbench' | 'script' | 'manifest' | 'readme' | 'other' {
  const lower = path.toLowerCase();
  if (/testbench|_tb\.|tb_/.test(lower)) return 'testbench';
  if (/\.(vhd|vhdl|v|sv)$/.test(lower)) return 'hdl';
  if (/\.xdc$/.test(lower)) return 'constraint';
  if (/\.tcl$/.test(lower)) return 'script';
  if (/readme/.test(lower)) return 'readme';
  if (/\.json$/.test(lower)) return 'manifest';
  return 'other';
}

export function deriveProjectExplorer(input: ProjectExplorerInput): readonly ProjectExplorerGroup[] {
  const groups: ProjectExplorerGroup[] = [];
  const circuit = input.circuit;
  const modules = input.hierarchy?.modules ?? [];

  // ── Project documents ─────────────────────────────────────────────────────
  groups.push({
    id: 'project',
    label: 'Project',
    count: 3,
    rows: [
      { key: 'doc:overview', kind: 'document', label: 'Overview', depth: 0, select: { kind: 'project' }, open: { kind: 'project-overview' } },
      { key: 'doc:sources', kind: 'document', label: 'Sources', meta: `${(input.sourceModel?.files.length ?? 0) + modules.length + 1} units`, depth: 0, select: { kind: 'project' }, open: { kind: 'sources' } },
      { key: 'doc:architecture', kind: 'document', label: 'Architecture', meta: input.hierarchy ? `${input.hierarchy.modules.length + 1} modules` : undefined, depth: 0, select: { kind: 'project' }, open: { kind: 'architecture' } },
      { key: 'doc:runs', kind: 'document', label: 'Runs', meta: input.runs.length ? `${input.runs.length}` : undefined, depth: 0, select: { kind: 'project' }, open: { kind: 'runs' } },
      { key: 'doc:compile-order', kind: 'document', label: 'Compile Order', depth: 0, select: { kind: 'project' }, open: { kind: 'compile-order' } },
    ],
  });

  // ── Design Sources ────────────────────────────────────────────────────────
  const design: ProjectExplorerRow[] = [];
  design.push({
    key: `module:${TOP_MODULE_ID}`,
    kind: 'module',
    label: input.topModuleName,
    meta: circuit ? `${circuit.nodes.length} nodes · top` : 'top',
    depth: 0,
    select: { kind: 'module', moduleId: TOP_MODULE_ID },
    open: { kind: 'schematic', moduleId: TOP_MODULE_ID },
    current: true,
  });
  for (const module of modules) {
    const instances = circuit ? circuit.nodes.filter((node) => readString(node.config?.moduleDefinitionId) === module.id).length : 0;
    design.push({
      key: `module:${module.id}`,
      kind: 'module',
      label: module.displayName || module.name,
      meta: `${modulePortSignature(module.ports)} · ${instances}×`,
      depth: 0,
      select: { kind: 'module', moduleId: module.id },
      open: { kind: 'schematic', moduleId: module.id },
    });
  }
  for (const component of input.outline?.customComponents ?? []) {
    design.push({
      key: `component:${component.name}`,
      kind: 'component',
      label: component.name,
      meta: component.ioSummary,
      depth: 0,
      select: { kind: 'component', componentName: component.name },
      navigateMode: 'design',
    });
  }
  for (const macro of input.outline?.macros ?? []) {
    design.push({
      key: `macro:${macro.id}`,
      kind: 'macro',
      label: macro.name,
      meta: macro.ioSummary,
      depth: 0,
      select: { kind: 'macro', macroId: macro.id, macroName: macro.name },
      navigateMode: 'design',
    });
  }
  if (input.sourceModel && !isEmptyProjectSourceModel(input.sourceModel)) {
    const grouped = filesByFileset(input.sourceModel);
    for (const file of grouped.design) {
      design.push(sourceFileRow(file, 0));
    }
  }
  groups.push({ id: 'design', label: 'Design Sources', count: design.length, rows: design });

  // ── Hierarchy ─────────────────────────────────────────────────────────────
  if (circuit && modules.length > 0) {
    const rows: ProjectExplorerRow[] = [
      {
        key: `hier:${TOP_MODULE_ID}`,
        kind: 'module',
        label: input.topModuleName,
        depth: 0,
        select: { kind: 'module', moduleId: TOP_MODULE_ID },
        open: { kind: 'schematic', moduleId: TOP_MODULE_ID },
      },
    ];
    const byId = new Map(modules.map((module) => [module.id, module]));
    for (const node of circuit.nodes) {
      const definitionId = readString(node.config?.moduleDefinitionId);
      if (!definitionId) continue;
      const definition = byId.get(definitionId);
      const instanceName = readString(node.config?.instanceName) || node.label || node.id;
      rows.push({
        key: `hier:${TOP_MODULE_ID}/${node.id}`,
        kind: 'instance',
        label: instanceName,
        meta: definition ? definition.displayName || definition.name : node.type,
        depth: 1,
        select: { kind: 'node', moduleId: TOP_MODULE_ID, nodeId: node.id },
        open: definition ? { kind: 'schematic', moduleId: definition.id } : undefined,
      });
    }
    groups.push({ id: 'hierarchy', label: 'Hierarchy', count: rows.length - 1, rows });
  }

  // ── Simulation Sources ────────────────────────────────────────────────────
  const simulation: ProjectExplorerRow[] = input.scenarios.map((scenario) => ({
    key: `scenario:${scenario.id}`,
    kind: 'scenario',
    label: scenario.name,
    meta: `${scenario.vectorCount} ${scenario.sequential ? 'events' : 'cases'} · ${scenario.checkCount} checks`,
    depth: 0,
    select: { kind: 'scenario', scenarioId: scenario.id },
    open: { kind: scenario.sequential ? 'timing' : 'cases', scenarioId: scenario.id },
    current: scenario.id === input.activeScenarioId,
  }));
  if (input.sourceModel && !isEmptyProjectSourceModel(input.sourceModel)) {
    for (const file of filesByFileset(input.sourceModel).simulation) simulation.push(sourceFileRow(file, 0));
  }
  groups.push({ id: 'simulation', label: 'Simulation Sources', count: simulation.length, rows: simulation });

  // ── Constraints ───────────────────────────────────────────────────────────
  const constraints: ProjectExplorerRow[] = [];
  const sets = input.constraintSets?.sets ?? [];
  const requiredRows = input.mappingRows.filter((row) => row.required);
  const mappedRows = requiredRows.filter((row) => row.pin.trim().length > 0);
  if (sets.length === 0) {
    constraints.push({
      key: 'constraints:live',
      kind: 'constraint-set',
      label: `${input.boardLabel} I/O`,
      meta: `${mappedRows.length}/${requiredRows.length} mapped`,
      depth: 0,
      tone: requiredRows.length > 0 && mappedRows.length < requiredRows.length ? 'warn' : undefined,
      select: { kind: 'constraint-set', constraintSetId: 'default' },
      open: { kind: 'board-io', constraintSetId: 'default' },
      current: true,
    });
  } else {
    for (const set of sets) {
      constraints.push({
        key: `constraints:${set.id}`,
        kind: 'constraint-set',
        label: set.name,
        meta: `${set.xdcText.split('\n').filter((line) => line.trim().length > 0).length} lines`,
        depth: 0,
        select: { kind: 'constraint-set', constraintSetId: set.id },
        open: { kind: 'board-io', constraintSetId: set.id },
        current: set.id === input.constraintSets?.activeId,
      });
    }
  }
  if (input.sourceModel && !isEmptyProjectSourceModel(input.sourceModel)) {
    for (const file of filesByFileset(input.sourceModel).constraint) constraints.push(sourceFileRow(file, 0));
  }
  groups.push({ id: 'constraints', label: 'Constraints', count: constraints.length, rows: constraints });

  // ── Generated Files ───────────────────────────────────────────────────────
  const generated: ProjectExplorerRow[] = input.artifacts.map((artifact) => ({
    key: `artifact:${artifact.path}`,
    kind: 'artifact',
    label: artifact.path,
    meta: artifactKind(artifact.path),
    depth: 0,
    select: { kind: 'artifact', artifactId: artifact.path },
    open: { kind: 'package-artifact' },
  }));
  groups.push({ id: 'generated', label: 'Generated Files', count: generated.length, rows: generated });

  // ── Runs ──────────────────────────────────────────────────────────────────
  const runs: ProjectExplorerRow[] = [...input.runs]
    .reverse()
    .slice(0, 12)
    .map((run) => ({
      key: `run:${run.runId}`,
      kind: 'run',
      label: `${run.status === 'pass' ? 'PASS' : 'FAIL'} ${run.passedRows}/${run.passedRows + run.failedRows}`,
      meta: run.firstFailure ? `first mismatch ${run.firstFailure.signal} @ ${run.firstFailure.tick}` : formatRelative(run.ranAtIso),
      depth: 0,
      tone: run.status === 'pass' ? 'ok' : 'error',
      select: { kind: 'run', runId: run.runId },
      navigateMode: 'verify',
    }));
  groups.push({ id: 'runs', label: 'Runs', count: input.runs.length, rows: runs });

  // ── Problems ──────────────────────────────────────────────────────────────
  const problems: ProjectExplorerRow[] = input.problems.map((problem) => ({
    key: `problem:${problem.id}`,
    kind: 'problem',
    label: problem.message,
    meta: problem.code,
    depth: 0,
    tone: problem.severity === 'error' ? 'error' : problem.severity === 'warning' ? 'warn' : 'muted',
    select: { kind: 'problem', problemId: problem.id },
    navigateMode: problem.fixMode,
  }));
  groups.push({ id: 'problems', label: 'Problems', count: problems.length, rows: problems });

  return groups;
}

function sourceFileRow(file: SourceFile, depth: number): ProjectExplorerRow {
  return {
    key: `file:${file.id}`,
    kind: 'source-file',
    label: file.path.split('/').pop() ?? file.path,
    meta: `${file.language} · ${file.library}`,
    depth,
    tone: 'ext',
    select: { kind: 'source-range', fileId: file.id, range: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } } },
    open: { kind: 'source-file', fileId: file.id },
  };
}

export function formatRelative(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const deltaSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (deltaSec < 45) return 'just now';
  const min = Math.round(deltaSec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} h ago`;
  return `${Math.round(hr / 24)} d ago`;
}

/** Filter rows by a case-insensitive query; groups with no match collapse away. */
export function filterExplorer(
  groups: readonly ProjectExplorerGroup[],
  query: string
): readonly ProjectExplorerGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  return groups
    .map((group) => ({
      ...group,
      rows: group.rows.filter((row) => `${row.label} ${row.meta ?? ''} ${row.kind}`.toLowerCase().includes(q)),
    }))
    .filter((group) => group.rows.length > 0);
}

// ── Compile order ────────────────────────────────────────────────────────────

export interface CompileOrderRow {
  readonly order: number;
  readonly unit: string;
  readonly kind: 'native module' | 'top module' | 'source file';
  readonly library: string;
  readonly fileset: string;
  readonly dependsOn: readonly string[];
  readonly ref: EngineeringObjectRef;
  readonly open?: WorkbenchDocument;
}

/**
 * Compile order = source-model compile filesets (when the project carries
 * HDL) followed by the native hierarchy (leaf module definitions before the
 * top that instantiates them). Deterministic and authority-derived; never a
 * user-editable list of its own.
 */
export function deriveProjectCompileOrder(input: {
  readonly topModuleName: string;
  readonly hierarchy: ProjectHierarchyDocument | undefined;
  readonly sourceModel: ProjectSourceModel | undefined;
}): readonly CompileOrderRow[] {
  const rows: CompileOrderRow[] = [];
  if (input.sourceModel && !isEmptyProjectSourceModel(input.sourceModel)) {
    for (const file of deriveCompileOrder(input.sourceModel)) {
      rows.push({
        order: rows.length + 1,
        unit: file.path,
        kind: 'source file',
        library: file.library,
        fileset: file.fileset,
        dependsOn: [],
        ref: { kind: 'source-range', fileId: file.id, range: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } } },
        open: { kind: 'source-file', fileId: file.id },
      });
    }
  }
  const modules = input.hierarchy?.modules ?? [];
  for (const module of modules) {
    rows.push({
      order: rows.length + 1,
      unit: `${module.name}.vhd`,
      kind: 'native module',
      library: 'work',
      fileset: 'design',
      dependsOn: [],
      ref: { kind: 'module', moduleId: module.id },
      open: { kind: 'schematic', moduleId: module.id },
    });
  }
  rows.push({
    order: rows.length + 1,
    unit: `${input.topModuleName}.vhd`,
    kind: 'top module',
    library: 'work',
    fileset: 'design',
    dependsOn: modules.map((module) => module.name),
    ref: { kind: 'module', moduleId: TOP_MODULE_ID },
    open: { kind: 'schematic', moduleId: TOP_MODULE_ID },
  });
  return rows;
}

// ── Overview facts ───────────────────────────────────────────────────────────

export interface OverviewFact {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly tone?: 'ok' | 'warn' | 'error';
  readonly mono?: boolean;
  /** Where the fact's owner lives; the value is a link when set. */
  readonly open?: WorkbenchDocument;
  readonly navigateMode?: IdeMode;
}

export function deriveOverviewFacts(input: {
  readonly projectName: string;
  readonly projectKindLabel: string;
  readonly boardLabel: string;
  readonly fpgaPart: string;
  readonly sourceFileCount: number;
  readonly moduleCount: number;
  readonly nodeCount: number;
  readonly connectionCount: number;
  readonly inputCount: number;
  readonly outputCount: number;
  readonly scenarios: readonly ProjectScenarioSummary[];
  readonly activeScenarioId: string | null;
  readonly health: ProjectHealth;
  readonly simulationLabel: string;
  readonly simulationTone: 'ok' | 'warn' | 'error' | undefined;
  readonly mappedRequired: number;
  readonly requiredTotal: number;
  readonly packageLabel: string;
  readonly packageTone: 'ok' | 'warn' | 'error' | undefined;
  readonly problemCount: number;
  readonly savedLabel: string;
  readonly determinismHash: string;
}): readonly OverviewFact[] {
  const activeScenario = input.scenarios.find((scenario) => scenario.id === input.activeScenarioId) ?? input.scenarios[0];
  return [
    { id: 'kind', label: 'Kind', value: input.projectKindLabel },
    { id: 'board', label: 'Target board', value: input.boardLabel, mono: true, navigateMode: 'hardware' },
    { id: 'part', label: 'Part', value: input.fpgaPart, mono: true },
    {
      id: 'design',
      label: 'Design',
      value: `${input.nodeCount} components · ${input.connectionCount} nets · ${input.moduleCount} module${input.moduleCount === 1 ? '' : 's'}`,
      open: { kind: 'schematic', moduleId: TOP_MODULE_ID },
    },
    {
      id: 'boundary',
      label: 'Boundary',
      value: `${input.inputCount} inputs · ${input.outputCount} outputs`,
    },
    {
      id: 'sources',
      label: 'Sources',
      value: input.sourceFileCount > 0 ? `${input.sourceFileCount} file${input.sourceFileCount === 1 ? '' : 's'}` : 'native visual only',
      open: { kind: 'sources' },
    },
    {
      id: 'simulation',
      label: 'Simulation',
      value: activeScenario
        ? `${input.simulationLabel} · ${activeScenario.name} (${activeScenario.vectorCount} ${activeScenario.sequential ? 'events' : 'cases'})`
        : input.simulationLabel,
      tone: input.simulationTone,
      open: activeScenario ? { kind: activeScenario.sequential ? 'timing' : 'cases', scenarioId: activeScenario.id } : undefined,
    },
    {
      id: 'mapping',
      label: 'Mapping',
      value: input.requiredTotal > 0 ? `${input.mappedRequired}/${input.requiredTotal} required signals mapped` : 'no required signals',
      tone: input.requiredTotal > 0 ? (input.mappedRequired === input.requiredTotal ? 'ok' : 'warn') : undefined,
      open: { kind: 'board-io', constraintSetId: 'default' },
    },
    { id: 'package', label: 'Package', value: input.packageLabel, tone: input.packageTone, open: { kind: 'package-artifact' } },
    {
      id: 'problems',
      label: 'Problems',
      value: input.problemCount === 0 ? 'none' : `${input.problemCount}`,
      tone: input.problemCount === 0 ? 'ok' : 'error',
    },
    { id: 'saved', label: 'Saved', value: input.savedLabel },
    { id: 'hash', label: 'Determinism hash', value: input.determinismHash ? input.determinismHash.slice(0, 16) : '—', mono: true },
  ];
}
