import type { EngineeringObjectRef } from './engineeringSelection';
import type { EngineeringProblem } from './engineeringProblems';
import type { EngineeringRelationshipIndex, EngineeringSignalRelation } from './engineeringRelationships';
import type { ProjectHierarchyDocument } from './projectHierarchy';
import type { ProjectSourceModel } from './projectSourceModel';
import type { ConstraintSetsDocument } from './constraintSets';
import type { RuntimeVerifyRun, VerifyRunLedgerEntry } from './projectRuntime';
import { documentKey, fallbackDocumentLabel, type WorkbenchDocument } from './workbenchDocuments';

/**
 * The Universal Navigator index — a derived, read-only search model over the
 * engineering objects the project actually has: signals and buses, modules
 * and instances, source files, cases and failures, board resources and
 * package pins, constraint lines, generated artifacts, problems, runs and
 * open documents.
 *
 * Every entry names the real document that shows the object and the exact
 * selection to publish there. Identity is exact: an entry is emitted per
 * canonical object, never invented from a name match, and an ambiguous
 * signal carries its ambiguity so the navigator can show it instead of
 * guessing.
 */

export type NavigatorKind =
  | 'document'
  | 'signal'
  | 'bus'
  | 'module'
  | 'instance'
  | 'source'
  | 'case'
  | 'failure'
  | 'board'
  | 'constraint'
  | 'artifact'
  | 'problem'
  | 'run';

export interface NavigatorEntry {
  readonly id: string;
  readonly kind: NavigatorKind;
  /** The identifier itself (`SUM[2]`, `u_fa2`, `top.xdc:27`, `Case 11`). */
  readonly title: string;
  /** Type and place, e.g. `Signal · top`, `Constraint · SUM[2] → U19`. */
  readonly subtitle: string;
  /** Short mono facts: `Driver u_fa2/SUM`, `Board LD2 · U19`. */
  readonly facts: readonly string[];
  readonly keywords: readonly string[];
  readonly document: WorkbenchDocument | null;
  readonly selection: EngineeringObjectRef | null;
  /** Present when the object's identity cannot be followed exactly. */
  readonly ambiguity?: string;
  /** Monospace title (identifiers) vs. proportional (documents, prose). */
  readonly mono: boolean;
}

export const NAVIGATOR_KIND_LABELS: Readonly<Record<NavigatorKind, string>> = {
  document: 'Open documents',
  signal: 'Signals',
  bus: 'Buses',
  module: 'Modules',
  instance: 'Instances',
  source: 'Source files',
  case: 'Cases & timing',
  failure: 'Failures',
  board: 'Board resources',
  constraint: 'Constraints',
  artifact: 'Generated artifacts',
  problem: 'Problems',
  run: 'Runs',
};

/** Fixed presentation order of groups. */
export const NAVIGATOR_KIND_ORDER: readonly NavigatorKind[] = [
  'failure',
  'problem',
  'signal',
  'bus',
  'module',
  'instance',
  'case',
  'board',
  'constraint',
  'source',
  'artifact',
  'run',
  'document',
];

interface MinimalNode {
  readonly id: string;
  readonly label?: string;
  readonly type?: string;
  readonly config?: Record<string, unknown> | null;
}

export interface NavigatorIndexInput {
  readonly relationships: EngineeringRelationshipIndex;
  readonly hierarchy: ProjectHierarchyDocument | null;
  readonly topNodes: readonly MinimalNode[];
  readonly topModuleName: string;
  readonly scenarios: readonly { readonly id: string; readonly name: string; readonly checkCount: number; readonly sequential: boolean }[];
  readonly lastRun: RuntimeVerifyRun | null;
  readonly runIsStale: boolean;
  readonly runHistory: readonly VerifyRunLedgerEntry[];
  readonly constraintSets: ConstraintSetsDocument | null;
  readonly sourceModel: ProjectSourceModel | null;
  readonly artifacts: readonly { readonly path: string; readonly bytes: number }[];
  readonly problems: readonly EngineeringProblem[];
  readonly openDocuments: readonly WorkbenchDocument[];
  readonly documentLabels: Readonly<Record<string, string>>;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function signalSelection(relation: EngineeringSignalRelation): EngineeringObjectRef {
  return {
    kind: 'signal',
    fieldId: relation.fieldId,
    runSignal: relation.ambiguity.length === 0 ? (relation.run?.resolution.runSignal ?? null) : null,
    nodeId: relation.nodeId,
  };
}

function signalFacts(relation: EngineeringSignalRelation): string[] {
  const facts: string[] = [];
  if (relation.driver) facts.push(`Driver ${relation.driver.path}`);
  else if (relation.direction === 'in' && relation.loads.length > 0) {
    facts.push(`Loads ${relation.loads.slice(0, 2).map((load) => load.path).join(', ')}${relation.loads.length > 2 ? ` +${relation.loads.length - 2}` : ''}`);
  }
  if (relation.board) {
    facts.push(`Board ${relation.board.resource?.label ?? relation.board.artifactPort} · ${relation.board.pin}`);
  }
  const checks = relation.scenarios.reduce((count, link) => count + link.checkTicks.length, 0);
  if (checks > 0) facts.push(`${checks} check${checks === 1 ? '' : 's'}`);
  if (relation.run?.failingTicks.length) facts.push(`${relation.run.failingTicks.length} failing`);
  return facts;
}

/** Build every navigable entry the project currently has. Pure. */
export function buildNavigatorIndex(input: NavigatorIndexInput): NavigatorEntry[] {
  const entries: NavigatorEntry[] = [];
  const topScenario = input.scenarios[0] ?? null;
  const evidenceKind = (sequential: boolean): 'cases' | 'timing' => (sequential ? 'timing' : 'cases');

  // ── Signals and buses ────────────────────────────────────────────────
  const buses = new Map<string, EngineeringSignalRelation[]>();
  for (const relation of input.relationships.signals) {
    entries.push({
      id: `signal:${relation.fieldId}`,
      kind: 'signal',
      title: relation.label,
      subtitle: `${relation.direction === 'in' ? 'Input' : 'Output'} signal · ${relation.moduleId === 'top' ? input.topModuleName : relation.moduleId}`,
      facts: signalFacts(relation),
      keywords: [relation.fieldId, relation.label, relation.board?.pin ?? '', relation.board?.resource?.label ?? '', relation.driver?.path ?? ''].filter(Boolean),
      document: { kind: 'schematic', moduleId: 'top' },
      selection: signalSelection(relation),
      ambiguity: relation.ambiguity[0],
      mono: true,
    });
    if (relation.bus) {
      const list = buses.get(relation.bus.name) ?? [];
      list.push(relation);
      buses.set(relation.bus.name, list);
    }
  }
  for (const [name, bits] of buses) {
    const sorted = [...bits].sort((left, right) => (left.bus?.bit ?? 0) - (right.bus?.bit ?? 0));
    const high = sorted[sorted.length - 1]?.bus?.bit ?? 0;
    const low = sorted[0]?.bus?.bit ?? 0;
    const first = sorted[0];
    entries.push({
      id: `bus:${name}`,
      kind: 'bus',
      title: `${name}[${high}:${low}]`,
      subtitle: `${first.direction === 'in' ? 'Input' : 'Output'} bus · ${sorted.length} bits`,
      facts: sorted.every((bit) => bit.board) ? [`Board ${sorted.map((bit) => bit.board?.pin).join(' ')}`] : ['Partially mapped'],
      keywords: [name, `${name}[${high}:${low}]`],
      document: { kind: 'schematic', moduleId: 'top' },
      selection: signalSelection(first),
      mono: true,
    });
  }

  // ── Modules and instances ────────────────────────────────────────────
  const definitions = new Map((input.hierarchy?.modules ?? []).map((def) => [def.id, def]));
  const instanceCounts = new Map<string, number>();
  for (const node of input.topNodes) {
    const definitionId = readString(node.config?.moduleDefinitionId);
    if (!definitionId) continue;
    instanceCounts.set(definitionId, (instanceCounts.get(definitionId) ?? 0) + 1);
  }
  if (input.topNodes.length > 0) {
    entries.push({
      id: 'module:top',
      kind: 'module',
      title: input.topModuleName,
      subtitle: 'Top module',
      facts: [`${input.topNodes.length} components`, `${definitions.size} child module${definitions.size === 1 ? '' : 's'}`],
      keywords: ['top', input.topModuleName],
      document: { kind: 'schematic', moduleId: 'top' },
      selection: { kind: 'module', moduleId: 'top' },
      mono: true,
    });
  }
  for (const def of definitions.values()) {
    const count = instanceCounts.get(def.id) ?? 0;
    entries.push({
      id: `module:${def.id}`,
      kind: 'module',
      title: def.displayName || def.name,
      subtitle: `Module · ${def.ports.length} ports`,
      facts: [count === 0 ? 'Not instantiated' : `${count} instance${count === 1 ? '' : 's'} in ${input.topModuleName}`],
      keywords: [def.id, def.name, def.displayName],
      document: { kind: 'schematic', moduleId: def.id },
      selection: { kind: 'module', moduleId: def.id },
      mono: true,
    });
  }
  for (const node of input.topNodes) {
    const definitionId = readString(node.config?.moduleDefinitionId);
    const def = definitionId ? definitions.get(definitionId) : undefined;
    if (!def) continue;
    const instanceName = readString(node.config?.instanceName) || node.label || node.id;
    entries.push({
      id: `instance:${node.id}`,
      kind: 'instance',
      title: instanceName,
      subtitle: `Instance of ${def.displayName || def.name} · in ${input.topModuleName}`,
      facts: [],
      keywords: [instanceName, node.id, def.name],
      document: { kind: 'schematic', moduleId: 'top' },
      selection: { kind: 'node', moduleId: 'top', nodeId: node.id },
      mono: true,
    });
  }

  // ── Cases / timing documents and failures ────────────────────────────
  for (const scenario of input.scenarios) {
    const kind = evidenceKind(scenario.sequential);
    entries.push({
      id: `scenario:${scenario.id}`,
      kind: 'case',
      title: `${scenario.name} — ${scenario.sequential ? 'Timing' : 'Cases'}`,
      subtitle: `${scenario.sequential ? 'Timing document' : 'Case document'} · ${scenario.checkCount} check${scenario.checkCount === 1 ? '' : 's'}`,
      facts: input.lastRun?.scenarioId === scenario.id ? [input.runIsStale ? 'Last run stale' : `Last run ${input.lastRun.status.toUpperCase()}`] : [],
      keywords: [scenario.name, scenario.sequential ? 'timing' : 'cases', 'scenario'],
      document: { kind, scenarioId: scenario.id },
      selection: { kind: 'scenario', scenarioId: scenario.id },
      mono: false,
    });
    if (input.lastRun && input.lastRun.status === 'pass' && input.lastRun.scenarioId === scenario.id) {
      entries.push({
        id: `waveform:${scenario.id}`,
        kind: 'case',
        title: `${scenario.name} — Waveform`,
        subtitle: `Waveform document · ${input.runIsStale ? 'stale' : 'current'} run`,
        facts: [],
        keywords: [scenario.name, 'waveform', 'wave'],
        document: { kind: 'waveform', scenarioId: scenario.id },
        selection: null,
        mono: false,
      });
    }
  }
  const run = input.lastRun;
  if (run && run.status === 'fail') {
    const scenario = input.scenarios.find((entry) => entry.id === run.scenarioId);
    const sequential = scenario?.sequential ?? run.schedule === 'clocked_macro';
    const seen = new Set<string>();
    for (const row of run.report.rows) {
      if (row.status !== 'fail') continue;
      const key = `${row.signal}@${row.tick}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const relation = input.relationships.resolveRunSignal(row.signal);
      const where = sequential ? `t${row.tick}` : `Case ${row.caseIndex ?? row.tick}`;
      entries.push({
        id: `failure:${run.scenarioId}:${key}`,
        kind: 'failure',
        title: `${where} · ${relation?.label ?? row.signal}`,
        subtitle: `${run.scenarioName} · expected ${row.expected} · observed ${row.actual}${input.runIsStale ? ' · stale' : ''}`,
        facts: relation?.board ? [`Board ${relation.board.resource?.label ?? relation.board.artifactPort} · ${relation.board.pin}`] : [],
        keywords: [row.signal, relation?.label ?? '', 'fail', 'failure', where],
        document: { kind: evidenceKind(sequential), scenarioId: run.scenarioId },
        selection: { kind: 'case-tick', scenarioId: run.scenarioId, tick: row.tick },
        mono: true,
      });
    }
    if (run.status === 'fail') {
      entries.push({
        id: `waveform:${run.scenarioId}`,
        kind: 'case',
        title: `${run.scenarioName} — Waveform`,
        subtitle: `Waveform document · failing run${input.runIsStale ? ' · stale' : ''}`,
        facts: [],
        keywords: [run.scenarioName, 'waveform', 'wave'],
        document: { kind: 'waveform', scenarioId: run.scenarioId },
        selection: run.firstFailingTick !== undefined ? { kind: 'case-tick', scenarioId: run.scenarioId, tick: run.firstFailingTick } : null,
        mono: false,
      });
    }
  }

  // ── Board resources, package pins and constraint lines ───────────────
  const activeSetId = input.constraintSets?.activeId ?? null;
  const boardDocument: WorkbenchDocument = { kind: 'board-io', constraintSetId: activeSetId ?? 'default' };
  for (const relation of input.relationships.signals) {
    const board = relation.board;
    if (!board) continue;
    const resourceLabel = board.resource?.label ?? board.artifactPort;
    entries.push({
      id: `board:${relation.fieldId}`,
      kind: 'board',
      title: `${resourceLabel} · ${board.pin}`,
      subtitle: `Board resource · ${relation.label} (${board.artifactPort})`,
      facts: [`${board.ioStandard}`, ...(board.constraintLines.length ? [`${board.constraintSetId ?? 'top'}.xdc:${board.constraintLines.join(',')}`] : [])],
      keywords: [board.pin, resourceLabel, relation.label, board.artifactPort, 'pin', 'led', 'switch', 'button'],
      document: boardDocument,
      selection: signalSelection(relation),
      mono: true,
    });
    board.xdcLines.forEach((line, index) => {
      const lineNumber = board.constraintLines[index];
      const setName = input.constraintSets?.sets.find((set) => set.id === board.constraintSetId)?.name;
      entries.push({
        id: `constraint:${relation.fieldId}:${index}`,
        kind: 'constraint',
        title: lineNumber !== undefined ? `${setName ?? 'top'}.xdc:${lineNumber}` : describeXdcLine(line, relation.label),
        subtitle: `Constraint · ${relation.label} → ${board.pin}`,
        facts: [line.trim()],
        keywords: [line, relation.label, board.pin, 'xdc', 'constraint', 'set_property'],
        document: boardDocument,
        selection: signalSelection(relation),
        mono: true,
      });
    });
  }

  // ── Source files ─────────────────────────────────────────────────────
  for (const file of input.sourceModel?.files ?? []) {
    entries.push({
      id: `source:${file.id}`,
      kind: 'source',
      title: file.path,
      subtitle: `${file.language.toUpperCase()} · ${file.fileset} · library ${file.library}`,
      facts: [`${file.text.split('\n').length} lines`],
      keywords: [file.path, file.id, file.language, file.fileset, file.library],
      document: { kind: 'source-file', fileId: file.id },
      selection: null,
      mono: true,
    });
  }

  // ── Generated artifacts ──────────────────────────────────────────────
  for (const artifact of input.artifacts) {
    entries.push({
      id: `artifact:${artifact.path}`,
      kind: 'artifact',
      title: artifact.path,
      subtitle: `Generated artifact · ${artifact.bytes.toLocaleString()} bytes`,
      facts: [],
      keywords: [artifact.path, 'artifact', 'package', artifact.path.split('.').pop() ?? ''],
      document: { kind: 'package-artifact' },
      selection: { kind: 'artifact', artifactId: artifact.path },
      mono: true,
    });
  }

  // ── Problems ─────────────────────────────────────────────────────────
  for (const problem of input.problems) {
    entries.push({
      id: `problem:${problem.id}`,
      kind: 'problem',
      title: problem.message,
      subtitle: `${problem.severity === 'error' ? 'Error' : problem.severity === 'warning' ? 'Warning' : 'Note'} · ${problem.authority}${problem.freshness === 'stale' ? ' · stale' : ''}`,
      facts: [problem.objectLabel ?? '', problem.detail ?? ''].filter(Boolean),
      keywords: [problem.code, problem.message, problem.objectLabel ?? '', problem.category],
      document: problem.document ?? null,
      selection: { kind: 'problem', problemId: problem.id },
      mono: false,
    });
  }

  // ── Runs ─────────────────────────────────────────────────────────────
  input.runHistory.slice(0, 12).forEach((entry, index) => {
    const label = index === 0 ? 'Latest run' : `Run ${input.runHistory.length - index}`;
    entries.push({
      id: `run:${entry.runId}`,
      kind: 'run',
      title: `${label} · ${entry.status.toUpperCase()}`,
      subtitle: `${entry.passedRows} passed · ${entry.failedRows} failed · ${entry.ranAtIso.slice(0, 16).replace('T', ' ')}`,
      facts: entry.firstFailure ? [`First failure ${entry.firstFailure.signal} @ t${entry.firstFailure.tick}`] : [],
      keywords: ['run', entry.status, entry.runId, entry.projectHash.slice(0, 8)],
      document: { kind: 'runs' },
      selection: { kind: 'run', runId: entry.runId },
      mono: false,
    });
  });

  // ── Open documents ───────────────────────────────────────────────────
  for (const doc of input.openDocuments) {
    const key = documentKey(doc);
    entries.push({
      id: `document:${key}`,
      kind: 'document',
      title: input.documentLabels[key] ?? fallbackDocumentLabel(doc),
      subtitle: `Open document · ${doc.kind.replace(/-/g, ' ')}`,
      facts: [],
      keywords: [key, doc.kind, input.documentLabels[key] ?? ''],
      document: doc,
      selection: null,
      mono: false,
    });
  }

  void topScenario;
  return entries;
}

export interface NavigatorMatch {
  readonly entry: NavigatorEntry;
  readonly score: number;
}

export interface NavigatorGroup {
  readonly kind: NavigatorKind;
  readonly label: string;
  readonly matches: readonly NavigatorMatch[];
}

/**  /  from a set_property line; the label otherwise. */
function describeXdcLine(line: string, fallback: string): string {
  const match = /set_property\s+(\S+)\s+(\S+)/.exec(line.trim());
  return match ? `${match[1]} ${match[2]}` : fallback;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function scoreEntry(entry: NavigatorEntry, tokens: readonly string[], raw: string): number {
  const title = normalize(entry.title);
  const haystack = [title, normalize(entry.subtitle), ...entry.keywords.map(normalize), ...entry.facts.map(normalize)];
  let score = 0;
  if (title === raw) score += 100;
  else if (title.startsWith(raw)) score += 60;
  else if (title.includes(raw)) score += 40;
  for (const token of tokens) {
    if (title === token) score += 30;
    else if (title.startsWith(token)) score += 20;
    else if (title.includes(token)) score += 12;
    else if (haystack.some((field) => field.includes(token))) score += 6;
    else return 0; // every token must match somewhere
  }
  return score;
}

/**
 * Search the index. Every whitespace token must match; groups come back in
 * `NAVIGATOR_KIND_ORDER`, each capped so one kind cannot flood the list.
 */
export function searchNavigator(
  entries: readonly NavigatorEntry[],
  query: string,
  limitPerKind = 6
): NavigatorGroup[] {
  const raw = normalize(query);
  if (!raw) return [];
  const tokens = raw.split(' ').filter(Boolean);
  const byKind = new Map<NavigatorKind, NavigatorMatch[]>();
  for (const entry of entries) {
    const score = scoreEntry(entry, tokens, raw);
    if (score <= 0) continue;
    const list = byKind.get(entry.kind) ?? [];
    list.push({ entry, score });
    byKind.set(entry.kind, list);
  }
  const groups: NavigatorGroup[] = [];
  for (const kind of NAVIGATOR_KIND_ORDER) {
    const matches = byKind.get(kind);
    if (!matches?.length) continue;
    matches.sort((left, right) => right.score - left.score || left.entry.title.localeCompare(right.entry.title));
    groups.push({ kind, label: NAVIGATOR_KIND_LABELS[kind], matches: matches.slice(0, limitPerKind) });
  }
  return groups;
}
