import { analyzeSequentialLogic, type Circuit, type Node, type PortRef } from '@redbyte/rb-logic-core';
import { useMemo } from 'react';
import { getBasys3BoardResource, type Basys3BoardResource } from '../../fpga/boards/basys3/basys3Pins';
import type { ConstraintSetsDocument } from './constraintSets';
import { xdcLinesForAssignment, xdcPortToken } from './hardwareXdcPreview';
import type { ProjectHierarchyDocument } from './projectHierarchy';
import { useProjectRuntime, type ProjectIoRow, type RuntimeVerifyRun } from './projectRuntime';
import { buildFieldSignalResolver, normalizeSignalId, type ResolvedFieldSignal } from './signalIdentity';
import type { VerifyScenario } from './verifyScenario';
import type { WorkbenchDocument } from './workbenchDocuments';

// Engineering Relationship Index — the one derived, read-only index that relates
// a boundary signal (field) across every representation RedByte owns:
//
//   field id ⇄ circuit node/port ⇄ driver (module instance / port) ⇄ run signal
//   ⇄ scenario cases and checks ⇄ waveform lane ⇄ board resource ⇄ package pin
//   ⇄ I/O standard ⇄ XDC lines ⇄ generated artifacts.
//
// Rules (shared with signalIdentity): exact identity wins, aliases are explicit,
// ambiguity is surfaced rather than resolved by first match, and no relation is
// ever established by string containment. Nothing here is writable; consumers
// read the referenced objects live from their canonical owners.

export interface RelationEndpoint {
  readonly nodeId: string;
  readonly portName: string;
  /** Node label when the circuit names it; falls back to the node id. */
  readonly nodeLabel: string;
  /** Node type — a primitive gate type or a native module name. */
  readonly nodeType: string;
  /** Module id when the node is an instance of a native module. */
  readonly moduleId: string | null;
  /** `u_fa2/SUM` for module instances, `XOR1/out` for primitives. */
  readonly path: string;
}

export interface RelationBus {
  readonly name: string;
  readonly bit: number;
}

export interface RelationScenarioLink {
  readonly scenarioId: string;
  readonly scenarioName: string;
  readonly document: 'cases' | 'timing';
  /** Ticks (case indices) where the scenario authors an expected value for this field. */
  readonly checkTicks: readonly number[];
  readonly vectorCount: number;
}

export interface RelationRunLink {
  readonly runId: string;
  readonly scenarioId: string;
  readonly status: 'pass' | 'fail';
  readonly resolution: ResolvedFieldSignal;
  /** Ticks where the run reported a mismatch on this field's run signal. */
  readonly failingTicks: readonly number[];
}

export interface RelationBoardLink {
  readonly pin: string;
  readonly resource: Basys3BoardResource | null;
  readonly ioStandard: 'LVCMOS33';
  readonly artifactPort: string;
  readonly xdcLines: readonly string[];
  /** 1-based line numbers of those lines inside the active constraint set, when present. */
  readonly constraintSetId: string | null;
  readonly constraintLines: readonly number[];
}

export interface EngineeringSignalRelation {
  readonly fieldId: string;
  readonly label: string;
  readonly direction: 'in' | 'out';
  readonly required: boolean;
  readonly bus: RelationBus | null;
  readonly nodeId: string;
  readonly port: string;
  readonly moduleId: string;
  /** For an output pin: what drives it. For an input pin: null (it is the driver). */
  readonly driver: RelationEndpoint | null;
  /** For an input pin: what it feeds. For an output pin: empty. */
  readonly loads: readonly RelationEndpoint[];
  readonly scenarios: readonly RelationScenarioLink[];
  readonly run: RelationRunLink | null;
  readonly board: RelationBoardLink | null;
  /** Canonical generated artifacts this signal appears in. */
  readonly artifacts: readonly string[];
  /** Reasons this relation cannot be trusted blindly; empty when exact. */
  readonly ambiguity: readonly string[];
}

export interface EngineeringRelationshipIndex {
  readonly signals: readonly EngineeringSignalRelation[];
  readonly resolveField: (fieldId: string) => EngineeringSignalRelation | null;
  readonly resolveNode: (nodeId: string) => EngineeringSignalRelation | null;
  readonly resolveRunSignal: (signal: string) => EngineeringSignalRelation | null;
  readonly resolvePin: (pin: string) => readonly EngineeringSignalRelation[];
  readonly ambiguities: readonly { readonly fieldId: string; readonly reason: string }[];
}

export interface EngineeringRelationshipInput {
  readonly ioRows: readonly ProjectIoRow[];
  readonly circuit: Circuit | null;
  readonly hierarchy: ProjectHierarchyDocument | null;
  readonly scenarios: readonly VerifyScenario[];
  readonly lastRun: RuntimeVerifyRun | null | undefined;
  readonly constraintSets: ConstraintSetsDocument | null;
  /** Sequential projects author Timing documents; combinational ones author Cases. */
  readonly isSequential: boolean;
  readonly artifactPaths?: readonly string[];
}

const DEFAULT_ARTIFACTS = ['top.vhd', 'top.xdc', 'testbench.vhd'] as const;

/** `A[2] (SW4)` → { name: 'A', bit: 2 }; scalar labels → null. */
export function parseBusLabel(label: string): RelationBus | null {
  const match = /^([A-Za-z_][A-Za-z0-9_]*)\[(\d+)\]/.exec(label.trim());
  if (!match) return null;
  return { name: match[1], bit: Number.parseInt(match[2], 10) };
}

function portRefOf(ref: PortRef | string): PortRef {
  if (typeof ref !== 'string') return ref;
  const at = Math.max(ref.lastIndexOf('.'), ref.lastIndexOf(':'));
  return at === -1 ? { nodeId: ref, portName: '' } : { nodeId: ref.slice(0, at), portName: ref.slice(at + 1) };
}

function nodeLabelOf(node: Node | undefined, nodeId: string): string {
  const label = (node as { label?: string } | undefined)?.label?.trim();
  return label && label.length > 0 ? label : nodeId;
}

function endpointOf(
  circuit: Circuit,
  hierarchy: ProjectHierarchyDocument | null,
  nodeId: string,
  portName: string
): RelationEndpoint {
  const node = circuit.nodes.find((entry) => entry.id === nodeId);
  const nodeType = node?.type ?? 'unknown';
  const nodeLabel = nodeLabelOf(node, nodeId);
  const module = hierarchy?.modules.find((entry) => entry.name === nodeType) ?? null;
  return {
    nodeId,
    portName,
    nodeLabel,
    nodeType,
    moduleId: module?.id ?? null,
    path: `${nodeLabel}/${portName}`,
  };
}

function scenarioDocument(scenario: VerifyScenario, lastRun: RuntimeVerifyRun | null | undefined, isSequential: boolean): 'cases' | 'timing' {
  if (isSequential) return 'timing';
  if (lastRun?.scenarioId === scenario.id && lastRun.schedule === 'clocked_macro') return 'timing';
  return 'cases';
}

function constraintLineNumbers(xdcText: string, lines: readonly string[]): number[] {
  if (!xdcText || lines.length === 0) return [];
  const wanted = new Set(lines.map((line) => line.trim()));
  const found: number[] = [];
  xdcText.split(/\r?\n/).forEach((line, index) => {
    if (wanted.has(line.trim())) found.push(index + 1);
  });
  return found;
}

/**
 * Build the index from canonical inputs. Pure and deterministic: the same inputs
 * always yield the same relations, so callers may memoize on reference identity.
 */
export function buildEngineeringRelationshipIndex(input: EngineeringRelationshipInput): EngineeringRelationshipIndex {
  const { ioRows, circuit, hierarchy, scenarios, lastRun, constraintSets, isSequential } = input;
  const artifacts = input.artifactPaths ?? DEFAULT_ARTIFACTS;
  const topModuleId = hierarchy?.topModuleId ?? 'top';

  // Duplicate identities are surfaced, never silently merged.
  const fieldCounts = new Map<string, number>();
  const pinOwners = new Map<string, string[]>();
  for (const row of ioRows) {
    const key = normalizeSignalId(row.id);
    fieldCounts.set(key, (fieldCounts.get(key) ?? 0) + 1);
    const pin = row.pin?.trim();
    if (pin) pinOwners.set(pin, [...(pinOwners.get(pin) ?? []), row.id]);
  }

  const resolver =
    lastRun && lastRun.report
      ? buildFieldSignalResolver({
          fieldIds: ioRows.map((row) => row.id),
          evidence: lastRun.evidence,
          reportSignals: Array.from(new Set(lastRun.report.rows.map((row) => row.signal))),
        })
      : null;

  const activeSet = constraintSets?.sets.find((set) => set.id === constraintSets.activeId) ?? null;

  const signals: EngineeringSignalRelation[] = ioRows.map((row) => {
    const ambiguity: string[] = [];
    const key = normalizeSignalId(row.id);
    if ((fieldCounts.get(key) ?? 0) > 1) ambiguity.push(`field id "${row.id}" is declared more than once`);

    // Circuit relations: an output pin is driven through its `in` port; an input
    // pin drives through its `out` port.
    let driver: RelationEndpoint | null = null;
    let loads: RelationEndpoint[] = [];
    if (circuit) {
      if (row.direction === 'out') {
        const feeds = circuit.connections
          .map((c) => ({ from: portRefOf(c.from), to: portRefOf(c.to) }))
          .filter((c) => c.to.nodeId === row.nodeId && c.to.portName === 'in');
        if (feeds.length === 1) driver = endpointOf(circuit, hierarchy, feeds[0].from.nodeId, feeds[0].from.portName);
        else if (feeds.length > 1) ambiguity.push(`output "${row.label}" has ${feeds.length} drivers`);
      } else {
        loads = circuit.connections
          .map((c) => ({ from: portRefOf(c.from), to: portRefOf(c.to) }))
          .filter((c) => c.from.nodeId === row.nodeId)
          .map((c) => endpointOf(circuit, hierarchy, c.to.nodeId, c.to.portName));
      }
    }

    const scenarioLinks: RelationScenarioLink[] = scenarios.map((scenario) => ({
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      document: scenarioDocument(scenario, lastRun, isSequential),
      checkTicks: scenario.vectors
        .map((vector, index) => {
          const expected = (vector as { expected?: Record<string, unknown> }).expected ?? {};
          return Object.keys(expected).some((id) => normalizeSignalId(id) === key) ? index : -1;
        })
        .filter((tick) => tick >= 0),
      vectorCount: scenario.vectors.length,
    }));

    let run: RelationRunLink | null = null;
    if (resolver && lastRun) {
      const resolution = resolver.resolve(row.id);
      if (resolution.kind === 'ambiguous') {
        ambiguity.push(`run signal is ambiguous: ${resolution.candidates.join(', ')}`);
      }
      const failingTicks = resolution.runSignal
        ? lastRun.report.rows
            .filter((r) => r.status === 'fail' && normalizeSignalId(r.signal) === normalizeSignalId(resolution.runSignal ?? ''))
            .map((r) => r.tick)
        : [];
      run = {
        runId: lastRun.deterministicHash,
        scenarioId: lastRun.scenarioId,
        status: lastRun.status,
        resolution,
        failingTicks,
      };
    }

    let board: RelationBoardLink | null = null;
    const pin = row.pin?.trim() ?? '';
    if (pin) {
      const owners = pinOwners.get(pin) ?? [];
      if (owners.length > 1) ambiguity.push(`pin ${pin} is also assigned to ${owners.filter((id) => id !== row.id).join(', ')}`);
      // A row may carry the board alias (LD0) or the package pin (U16); constraints name the package pin.
      const resource = getBasys3BoardResource(pin);
      const packagePin = resource?.packagePin ?? pin;
      const xdcLines = xdcLinesForAssignment(row.label, packagePin, 'LVCMOS33');
      board = {
        pin: packagePin,
        resource,
        ioStandard: 'LVCMOS33',
        artifactPort: xdcPortToken(row.label),
        xdcLines,
        constraintSetId: activeSet?.id ?? null,
        constraintLines: activeSet ? constraintLineNumbers(activeSet.xdcText, xdcLines) : [],
      };
    }

    return {
      fieldId: row.id,
      label: row.label,
      direction: row.direction,
      required: row.required,
      bus: parseBusLabel(row.label),
      nodeId: row.nodeId,
      port: row.port,
      moduleId: topModuleId,
      driver,
      loads,
      scenarios: scenarioLinks,
      run,
      board,
      artifacts,
      ambiguity,
    };
  });

  const byField = new Map<string, EngineeringSignalRelation>();
  const byNode = new Map<string, EngineeringSignalRelation>();
  const byRunSignal = new Map<string, EngineeringSignalRelation>();
  const byPin = new Map<string, EngineeringSignalRelation[]>();
  for (const relation of signals) {
    const key = normalizeSignalId(relation.fieldId);
    // A duplicated field id owns nothing — lookups report null rather than a guess.
    if ((fieldCounts.get(key) ?? 0) === 1) byField.set(key, relation);
    if (!byNode.has(relation.nodeId)) byNode.set(relation.nodeId, relation);
    else byNode.delete(relation.nodeId);
    const runSignal = relation.run?.resolution.runSignal;
    if (runSignal) byRunSignal.set(normalizeSignalId(runSignal), relation);
    if (relation.board) byPin.set(relation.board.pin, [...(byPin.get(relation.board.pin) ?? []), relation]);
  }

  return {
    signals,
    resolveField: (fieldId) => byField.get(normalizeSignalId(fieldId)) ?? null,
    resolveNode: (nodeId) => byNode.get(nodeId) ?? null,
    resolveRunSignal: (signal) => byRunSignal.get(normalizeSignalId(signal)) ?? null,
    resolvePin: (pin) => byPin.get(pin.trim()) ?? [],
    ambiguities: signals.flatMap((relation) => relation.ambiguity.map((reason) => ({ fieldId: relation.fieldId, reason }))),
  };
}

/** Compact object path for the app bar: `LD2 (SUM[2]) ← u_fa2/SUM · U19`. */
export function describeSignalRelationPath(relation: EngineeringSignalRelation): string {
  const parts: string[] = [relation.label];
  if (relation.driver) parts.push(`← ${relation.driver.path}`);
  else if (relation.loads.length === 1) parts.push(`→ ${relation.loads[0].path}`);
  else if (relation.loads.length > 1) parts.push(`→ ${relation.loads.length} loads`);
  if (relation.board) parts.push(`· ${relation.board.pin}`);
  return parts.join(' ');
}

export interface RelatedDocumentLink {
  readonly label: string;
  readonly document: WorkbenchDocument;
  /** Why the link is offered — shown as a tooltip. */
  readonly detail: string;
}

/**
 * Documents a signal can be followed into. Only documents that exist for this
 * project are offered; nothing here opens a view that would be empty.
 */
export function relatedDocumentsForSignal(
  relation: EngineeringSignalRelation,
  options: { readonly activeScenarioId: string | null; readonly hasRun: boolean }
): RelatedDocumentLink[] {
  const links: RelatedDocumentLink[] = [];
  links.push({
    label: 'Open schematic',
    document: { kind: 'schematic', moduleId: relation.moduleId },
    detail: relation.driver ? `Driven by ${relation.driver.path}` : `${relation.loads.length} load(s)`,
  });
  if (relation.driver?.moduleId) {
    links.push({
      label: `Open ${relation.driver.nodeType}`,
      document: { kind: 'schematic', moduleId: relation.driver.moduleId },
      detail: `Inside ${relation.driver.nodeLabel}`,
    });
  }
  const scenario =
    relation.scenarios.find((entry) => entry.scenarioId === options.activeScenarioId) ?? relation.scenarios[0] ?? null;
  if (scenario) {
    links.push({
      label: scenario.document === 'timing' ? 'Open timing' : 'Open cases',
      document: { kind: scenario.document, scenarioId: scenario.scenarioId },
      detail:
        scenario.checkTicks.length > 0
          ? `${scenario.checkTicks.length} check(s) on ${relation.label} in ${scenario.scenarioName}`
          : `${scenario.vectorCount} case(s) in ${scenario.scenarioName}; no check on ${relation.label}`,
    });
    if (options.hasRun) {
      links.push({
        label: 'Open waveform',
        document: { kind: 'waveform', scenarioId: scenario.scenarioId },
        detail: relation.run?.resolution.runSignal
          ? `Lane ${relation.run.resolution.runSignal}${relation.run.failingTicks.length ? ` · fails at t${relation.run.failingTicks[0]}` : ''}`
          : 'No resolved lane for this signal',
      });
    }
  }
  links.push({
    label: 'Open board mapping',
    document: { kind: 'board-io', constraintSetId: relation.board?.constraintSetId ?? 'default' },
    detail: relation.board ? `${relation.board.resource?.label ?? relation.board.pin} · ${relation.board.pin}` : 'Unmapped',
  });
  links.push({
    label: 'Open package',
    document: { kind: 'package-artifact' },
    detail: relation.board ? `${relation.board.artifactPort} in ${relation.artifacts.join(', ')}` : relation.artifacts.join(', '),
  });
  return links;
}

/** Memoized index over the live runtime. Re-computes only when an input reference changes. */
export function useEngineeringRelationshipIndex(): EngineeringRelationshipIndex {
  const ioRows = useProjectRuntime((state) => state.projectIoRows);
  const circuit = useProjectRuntime((state) => state.circuit);
  const hierarchy = useProjectRuntime((state) => state.hierarchy);
  const scenarios = useProjectRuntime((state) => state.scenarios);
  const lastRun = useProjectRuntime((state) => state.verifyLastRun);
  const constraintSets = useProjectRuntime((state) => state.constraintSets);
  const isSequential = useMemo(
    () => analyzeSequentialLogic(circuit).hasClockedMacros || lastRun?.schedule === 'clocked_macro',
    [circuit, lastRun?.schedule]
  );
  return useMemo(
    () => buildEngineeringRelationshipIndex({ ioRows, circuit, hierarchy, scenarios, lastRun, constraintSets, isSequential }),
    [ioRows, circuit, hierarchy, scenarios, lastRun, constraintSets, isSequential]
  );
}
