import { create } from 'zustand';
import type { IdeDiagnostic } from './diagnostics';
import type { DesignIssue } from './designIssues';
import type { EngineeringObjectRef } from './engineeringSelection';
import type { EngineeringRelationshipIndex } from './engineeringRelationships';
import type { RuntimeVerifyRun } from './projectRuntime';
import type { WorkbenchDocument } from './workbenchDocuments';
import type { IdeMode } from './workflowStages';
import type { ExportDiagnosticView } from './viewmodels/buildExportViewModel';
import type { Basys3SemanticMappingProjection } from '../../fpga/boards/basys3/basys3ExportContract';

/**
 * The unified Problems ledger — one derived, read-only projection over every
 * existing authority that can report an issue: design compiler diagnostics,
 * project health, signal identity, the simulation run, board mapping, export
 * validation and import fidelity.
 *
 * It owns nothing. Each problem carries the object it belongs to, the document
 * that shows it, and the authority that reported it, so a workspace can render
 * a compact local projection while the identity of the issue stays shared —
 * the status bar count, the Problems tool window, the navigator and the
 * Project explorer all read this same list.
 *
 * Shape is a strict superset of the older `ProjectProblem` (id, severity,
 * code, message, fixMode) so existing Project consumers keep working.
 */

export type ProblemSeverity = 'error' | 'warning' | 'info';
export type ProblemCategory =
  | 'design'
  | 'source'
  | 'identity'
  | 'simulation'
  | 'board'
  | 'constraint'
  | 'package'
  | 'import';

export interface EngineeringProblem {
  readonly id: string;
  readonly severity: ProblemSeverity;
  readonly category: ProblemCategory;
  readonly code: string;
  /** One concise line. */
  readonly message: string;
  /** Optional second line (hint, expected/observed, conflict partner). */
  readonly detail?: string;
  /** The engineering object the problem belongs to, when it has one. */
  readonly object?: EngineeringObjectRef;
  /** Human label for the object (`SUM[2]`, `u_fa2`, `top.xdc:27`). */
  readonly objectLabel?: string;
  readonly location?: { readonly file?: string; readonly line?: number };
  /** The document that shows the problem in context. */
  readonly document?: WorkbenchDocument;
  readonly freshness: 'current' | 'stale';
  /** Suggested next action, in the imperative. */
  readonly action?: string;
  /** The authority that reported it. */
  readonly authority: string;
  /** Workspace that owns the repair (legacy ProjectProblem field). */
  readonly fixMode?: IdeMode;
}

export interface EngineeringProblemsInput {
  readonly blockingIssues: readonly {
    readonly code: string;
    readonly message: string;
    readonly fixPath?: { readonly mode?: string } | null;
  }[];
  readonly designDiagnostics: readonly IdeDiagnostic[];
  /** Structural authoring issues (floating output, multiple drivers, unconnected input). */
  readonly designIssues: readonly DesignIssue[];
  readonly relationships: EngineeringRelationshipIndex;
  readonly exportErrors: readonly ExportDiagnosticView[];
  readonly exportWarnings: readonly ExportDiagnosticView[];
  readonly mappingProjection: readonly Basys3SemanticMappingProjection[];
  readonly lastRun: RuntimeVerifyRun | null;
  readonly runIsStale: boolean;
  /** Why the run is stale (from the run scope read-model); null when unknown. */
  readonly runStaleDetail?: string | null;
  readonly activeConstraintSetId: string | null;
  readonly importFidelity: 'full' | 'reconstructed' | 'partial' | null;
  readonly isSequential: boolean;
  readonly hasCircuit: boolean;
}

const SEVERITY_RANK: Record<ProblemSeverity, number> = { error: 0, warning: 1, info: 2 };
const CATEGORY_RANK: Record<ProblemCategory, number> = {
  design: 0,
  source: 1,
  identity: 2,
  simulation: 3,
  board: 4,
  constraint: 5,
  package: 6,
  import: 7,
};

export const PROBLEM_CATEGORY_LABELS: Readonly<Record<ProblemCategory, string>> = {
  design: 'Design',
  source: 'Sources',
  identity: 'Signal identity',
  simulation: 'Simulation',
  board: 'Board mapping',
  constraint: 'Constraints',
  package: 'Package',
  import: 'Import',
};

function mapDiagnosticSeverity(severity: IdeDiagnostic['severity']): ProblemSeverity {
  if (severity === 'error') return 'error';
  if (severity === 'warn' || (severity as string) === 'warning') return 'warning';
  return 'info';
}

function legacyFixMode(mode: string | undefined): IdeMode | undefined {
  if (!mode) return undefined;
  // The health authority names 'project' for mapping repairs; the workbench
  // owner for that repair is Board & Constraints.
  if (mode === 'project') return 'hardware';
  return mode as IdeMode;
}

function describeConflict(state: Basys3SemanticMappingProjection['conflictState']): string {
  switch (state) {
    case 'duplicate-package-pin':
      return 'shares its package pin with another signal';
    case 'artifact-port-collision':
      return 'collides with another artifact port name';
    case 'missing-pin':
      return 'has no package pin';
    case 'invalid-resource':
      return 'names a board resource Basys3 does not have';
    case 'direction-mismatch':
      return 'is mapped to a resource of the wrong direction';
    default:
      return `has a mapping conflict (${state})`;
  }
}

/** Build the ledger. Pure; deterministic order; ids stable across rebuilds. */
export function buildEngineeringProblems(input: EngineeringProblemsInput): EngineeringProblem[] {
  // No circuit, no problems: the Start Center is not a place to repair anything.
  if (!input.hasCircuit) return [];
  const problems: EngineeringProblem[] = [];
  const seen = new Set<string>();
  const push = (problem: EngineeringProblem) => {
    if (seen.has(problem.id)) return;
    seen.add(problem.id);
    problems.push(problem);
  };
  const boardDocument: WorkbenchDocument = {
    kind: 'board-io',
    constraintSetId: input.activeConstraintSetId ?? 'default',
  };

  // ── Project health (blocking) ────────────────────────────────────────
  for (const issue of input.blockingIssues) {
    const fixMode = legacyFixMode(issue.fixPath?.mode);
    push({
      id: `issue:${issue.code}`,
      severity: 'error',
      category: fixMode === 'hardware' ? 'board' : fixMode === 'verify' ? 'simulation' : 'design',
      code: issue.code,
      message: issue.message,
      document:
        fixMode === 'hardware'
          ? boardDocument
          : fixMode === 'verify' && input.lastRun
            ? { kind: 'cases', scenarioId: input.lastRun.scenarioId }
            : { kind: 'schematic', moduleId: 'top' },
      freshness: 'current',
      authority: 'project health',
      fixMode,
    });
  }

  // ── Design authoring (structural) ────────────────────────────────────
  const authoredPorts = new Set<string>();
  const seenDesignMessages = new Set<string>();
  for (const issue of input.designIssues) {
    authoredPorts.add(issue.portKey);
    const relation = input.relationships.resolveNode(issue.nodeId);
    push({
      id: `design:${issue.kind}:${issue.portKey}`,
      severity: issue.severity === 'error' ? 'error' : 'warning',
      category: 'design',
      code: issue.kind,
      message: issue.title,
      detail: issue.message,
      object: relation
        ? { kind: 'signal', fieldId: relation.fieldId, runSignal: relation.run?.resolution.runSignal ?? null, nodeId: issue.nodeId }
        : { kind: 'node', moduleId: 'top', nodeId: issue.nodeId },
      objectLabel: relation?.label ?? issue.portKey,
      document: { kind: 'schematic', moduleId: 'top' },
      freshness: 'current',
      action: issue.hint,
      authority: 'design authoring',
      fixMode: 'design',
    });
  }

  // ── Design compiler diagnostics ──────────────────────────────────────
  for (const diagnostic of input.designDiagnostics) {
    const nodeId = diagnostic.location?.nodeId;
    const port = diagnostic.location?.port;
    if (nodeId && port && authoredPorts.has(`${nodeId}.${port}`)) continue;
    const messageKey = diagnostic.message.trim().toLowerCase();
    if (seenDesignMessages.has(messageKey)) continue;
    seenDesignMessages.add(messageKey);
    const relation = nodeId ? input.relationships.resolveNode(nodeId) : null;
    const genericTitle = /^compiler (error|warning|note)$/i.test(diagnostic.title.trim());
    const headline = !genericTitle && diagnostic.title ? diagnostic.title : diagnostic.message;
    push({
      id: `diag:${diagnostic.id}`,
      severity: mapDiagnosticSeverity(diagnostic.severity),
      category: 'design',
      code: diagnostic.code,
      message: headline,
      detail: headline === diagnostic.message ? diagnostic.hint[0] : diagnostic.message,
      object: nodeId
        ? relation
          ? { kind: 'signal', fieldId: relation.fieldId, runSignal: relation.run?.resolution.runSignal ?? null, nodeId }
          : { kind: 'node', moduleId: 'top', nodeId }
        : undefined,
      objectLabel: relation?.label ?? diagnostic.location?.signal ?? nodeId ?? diagnostic.location?.netName,
      location: diagnostic.location?.filePath
        ? { file: diagnostic.location.filePath, line: diagnostic.location.line }
        : undefined,
      document: { kind: 'schematic', moduleId: 'top' },
      freshness: 'current',
      action: diagnostic.hint[0],
      authority: 'design compiler',
      fixMode: 'design',
    });
  }

  // ── Signal identity ──────────────────────────────────────────────────
  for (const ambiguity of input.relationships.ambiguities) {
    const relation = input.relationships.resolveField(ambiguity.fieldId);
    push({
      id: `identity:${ambiguity.fieldId}`,
      severity: 'warning',
      category: 'identity',
      code: 'signal-identity-ambiguous',
      message: `${relation?.label ?? ambiguity.fieldId} cannot be followed unambiguously`,
      detail: ambiguity.reason,
      object: relation
        ? { kind: 'signal', fieldId: relation.fieldId, runSignal: null, nodeId: relation.nodeId ?? undefined }
        : undefined,
      objectLabel: relation?.label ?? ambiguity.fieldId,
      document: { kind: 'schematic', moduleId: 'top' },
      freshness: 'current',
      action: 'Rename the signal so its identity is unique',
      authority: 'relationship index',
      fixMode: 'design',
    });
  }

  // ── Board mapping ────────────────────────────────────────────────────
  const boardProblemPorts = new Set<string>();
  for (const projection of input.mappingProjection) {
    const relation = input.relationships.resolveField(projection.logicalSignalId);
    const object: EngineeringObjectRef = {
      kind: 'signal',
      fieldId: projection.logicalSignalId,
      runSignal: relation?.run?.resolution.runSignal ?? null,
      nodeId: relation?.nodeId ?? undefined,
    };
    if (projection.required && !projection.packagePin) {
      boardProblemPorts.add(projection.artifactPortName);
      push({
        id: `board:unmapped:${projection.logicalSignalId}`,
        severity: 'error',
        category: 'board',
        code: 'board-unmapped',
        message: `${projection.logicalLabel} has no board resource`,
        detail: `${projection.direction === 'in' ? 'Input' : 'Output'} port ${projection.artifactPortName} needs a Basys3 resource before the package can carry it`,
        object,
        objectLabel: projection.logicalLabel,
        document: boardDocument,
        freshness: 'current',
        action: 'Assign a board resource',
        authority: 'board mapping',
        fixMode: 'hardware',
      });
      continue;
    }
    if (projection.conflictState !== 'none' && projection.conflictState !== 'missing-pin') {
      boardProblemPorts.add(projection.artifactPortName);
      push({
        id: `board:conflict:${projection.logicalSignalId}`,
        severity: 'error',
        category: 'board',
        code: `board-${projection.conflictState}`,
        message: `${projection.logicalLabel} ${describeConflict(projection.conflictState)}`,
        detail: projection.packagePin
          ? `${projection.boardResourceLabel ?? projection.boardResourceId ?? 'resource'} · ${projection.packagePin}`
          : undefined,
        object,
        objectLabel: projection.logicalLabel,
        document: boardDocument,
        freshness: 'current',
        action: 'Choose a different board resource',
        authority: 'board mapping',
        fixMode: 'hardware',
      });
    }
  }

  // ── Export validation (skip what the board rows already report) ──────
  const exportEntries: readonly { view: ExportDiagnosticView; severity: ProblemSeverity }[] = [
    ...input.exportErrors.map((view) => ({ view, severity: 'error' as const })),
    ...input.exportWarnings.map((view) => ({ view, severity: 'warning' as const })),
  ];
  const exportByCode = new Map<string, { view: ExportDiagnosticView; severity: ProblemSeverity }[]>();
  for (const entry of exportEntries) {
    if (entry.view.port && boardProblemPorts.has(entry.view.port)) continue;
    const list = exportByCode.get(entry.view.code) ?? [];
    list.push(entry);
    exportByCode.set(entry.view.code, list);
  }
  for (const [code, group] of exportByCode) {
    if (group.length > 3) {
      const { view, severity } = group[0];
      const ports = group.map((entry) => entry.view.port).filter((port): port is string => Boolean(port));
      push({
        id: `export:${code}`,
        severity,
        category: view.owner.kind === 'mapping' ? 'constraint' : 'package',
        code,
        message: `${group.length} × ${view.title || view.message}`,
        detail: ports.length
          ? `${ports.slice(0, 6).join(', ')}${ports.length > 6 ? ` +${ports.length - 6} more` : ''}`
          : view.message,
        document: view.owner.kind === 'mapping' ? boardDocument : { kind: 'package-artifact' },
        freshness: 'current',
        action: view.fix ?? view.hint[0],
        authority: 'export validation',
        fixMode: view.owner.kind === 'mapping' ? 'hardware' : 'export',
      });
      continue;
    }
    for (const { view, severity } of group) {
    const relation = view.port ? input.relationships.resolveField(view.port) : null;
    push({
      id: `export:${view.id}`,
      severity,
      category: view.owner.kind === 'mapping' ? 'constraint' : 'package',
      code: view.code,
      message: view.title || view.message,
      detail: view.title ? view.message : view.hint[0],
      object: relation
        ? { kind: 'signal', fieldId: relation.fieldId, runSignal: relation.run?.resolution.runSignal ?? null, nodeId: relation.nodeId ?? undefined }
        : undefined,
      objectLabel: relation?.label ?? view.port,
      document: view.owner.kind === 'mapping' ? boardDocument : { kind: 'package-artifact' },
      freshness: 'current',
      action: view.fix ?? view.hint[0],
      authority: 'export validation',
      fixMode: view.owner.kind === 'mapping' ? 'hardware' : 'export',
    });
    }
  }

  // ── Simulation evidence ──────────────────────────────────────────────
  const run = input.lastRun;
  if (run) {
    const evidenceDocument: WorkbenchDocument = input.isSequential
      ? { kind: 'timing', scenarioId: run.scenarioId }
      : { kind: 'cases', scenarioId: run.scenarioId };
    const freshness = input.runIsStale ? 'stale' : 'current';
    if (run.simulationStatus === 'blocked') {
      push({
        id: `sim:blocked:${run.scenarioId}`,
        severity: 'error',
        category: 'simulation',
        code: 'simulation-blocked',
        message: `${run.scenarioName} could not run`,
        detail: 'The circuit has a structural problem the simulator refuses to evaluate',
        document: evidenceDocument,
        freshness,
        action: 'Fix the blocking design problems, then run again',
        authority: 'simulation run',
        fixMode: 'design',
      });
    } else if (run.status === 'fail') {
      const failingBySignal = new Map<string, { count: number; firstTick: number; expected: string; actual: string; caseIndex?: number }>();
      for (const row of run.report.rows) {
        if (row.status !== 'fail') continue;
        const entry = failingBySignal.get(row.signal);
        if (entry) {
          entry.count += 1;
          if (row.tick < entry.firstTick) {
            entry.firstTick = row.tick;
            entry.expected = row.expected;
            entry.actual = row.actual;
            entry.caseIndex = row.caseIndex;
          }
        } else {
          failingBySignal.set(row.signal, {
            count: 1,
            firstTick: row.tick,
            expected: row.expected,
            actual: row.actual,
            caseIndex: row.caseIndex,
          });
        }
      }
      for (const [signal, entry] of failingBySignal) {
        const relation = input.relationships.resolveRunSignal(signal);
        const where = input.isSequential
          ? `t${entry.firstTick}`
          : `case ${entry.caseIndex ?? entry.firstTick}`;
        push({
          id: `sim:fail:${run.scenarioId}:${signal}`,
          severity: 'error',
          category: 'simulation',
          code: 'check-failed',
          message: `${relation?.label ?? signal}: ${entry.count} check${entry.count === 1 ? '' : 's'} fail in ${run.scenarioName}`,
          detail: `First at ${where} · expected ${entry.expected}, observed ${entry.actual}`,
          object: { kind: 'case-tick', scenarioId: run.scenarioId, tick: entry.firstTick },
          objectLabel: relation?.label ?? signal,
          document: evidenceDocument,
          freshness,
          action: 'Trace the signal in Design',
          authority: 'simulation run',
          fixMode: 'verify',
        });
      }
    }
    if (input.runIsStale) {
      push({
        id: `sim:stale:${run.scenarioId}`,
        severity: 'info',
        category: 'simulation',
        code: 'evidence-stale',
        message: `${run.scenarioName} evidence is stale`,
        detail: input.runStaleDetail ?? 'The design, stimulus or mapping changed after this run',
        object: { kind: 'scenario', scenarioId: run.scenarioId },
        document: evidenceDocument,
        freshness: 'stale',
        action: 'Run again to refresh the evidence',
        authority: 'simulation run',
        fixMode: 'verify',
      });
    }
  }

  // ── Import fidelity ──────────────────────────────────────────────────
  if (input.importFidelity && input.importFidelity !== 'full') {
    push({
      id: `import:${input.importFidelity}`,
      severity: 'info',
      category: 'import',
      code: `import-${input.importFidelity}`,
      message:
        input.importFidelity === 'partial'
          ? 'Imported project is partially reconstructed'
          : 'Imported project was reconstructed from its sources',
      detail: 'Unsupported constructs are preserved byte-for-byte and shown read-only',
      document: { kind: 'sources' },
      freshness: 'current',
      authority: 'import review',
      fixMode: 'project',
    });
  }

  return problems.sort(
    (left, right) =>
      SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity] ||
      CATEGORY_RANK[left.category] - CATEGORY_RANK[right.category] ||
      left.message.localeCompare(right.message)
  );
}

export interface ProblemCounts {
  readonly error: number;
  readonly warning: number;
  readonly info: number;
  readonly total: number;
}

export function countProblems(problems: readonly EngineeringProblem[]): ProblemCounts {
  let error = 0;
  let warning = 0;
  let info = 0;
  for (const problem of problems) {
    if (problem.severity === 'error') error += 1;
    else if (problem.severity === 'warning') warning += 1;
    else info += 1;
  }
  return { error, warning, info, total: problems.length };
}

// ── Read-model store ─────────────────────────────────────────────────────
// The shell publishes the ledger once; every consumer subscribes. Never an
// authority: nothing here can be edited, only re-derived.

interface EngineeringProblemsState {
  problems: readonly EngineeringProblem[];
  publish: (problems: readonly EngineeringProblem[]) => void;
}

export const useEngineeringProblems = create<EngineeringProblemsState>((set) => ({
  problems: [],
  publish: (problems) => set({ problems }),
}));

export const EMPTY_PROBLEMS: readonly EngineeringProblem[] = [];

/** Errors + warnings — what the status bar and tool-window tabs count. Notes are not problems. */
export function selectProblemCount(state: { problems: readonly EngineeringProblem[] }): number {
  let count = 0;
  for (const problem of state.problems) if (problem.severity !== 'info') count += 1;
  return count;
}
