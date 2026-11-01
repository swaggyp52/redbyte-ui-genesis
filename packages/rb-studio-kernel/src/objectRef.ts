import type { EngineeringObjectRef, JourneySelection } from '@redbyte/rb-apps/domain';

/**
 * One identity for "the thing the student is looking at", whichever representation they
 * found it in. A ref names an object; it never carries a value. Scope is the elaborated
 * instance path (empty = top), the only scope encoding the studio uses.
 *
 * The union is a superset of the workbench's EngineeringObjectRef and of the Signal
 * Journey selection, so existing surfaces can be adapted without losing a field.
 */
export type Scope = readonly string[];

export type ObjectRef =
  | { readonly kind: 'project' }
  | { readonly kind: 'node'; readonly scope: Scope; readonly nodeId: string; readonly moduleId?: string }
  | {
      readonly kind: 'port';
      readonly scope: Scope;
      readonly nodeId: string;
      readonly port: string;
      readonly bit?: number | null;
      readonly busId?: string;
    }
  | { readonly kind: 'net'; readonly scope: Scope; readonly netId: string; readonly bit?: number | null }
  | { readonly kind: 'wire'; readonly scope: Scope; readonly wireId: string }
  | { readonly kind: 'instance'; readonly path: Scope }
  | { readonly kind: 'module'; readonly definitionId: string }
  | { readonly kind: 'field'; readonly fieldId: string; readonly runSignal: string | null; readonly nodeId?: string }
  | { readonly kind: 'boardPort'; readonly name: string }
  | { readonly kind: 'boardResource'; readonly constraintSetId: string; readonly pin: string }
  | { readonly kind: 'span'; readonly fileId: string; readonly line: number; readonly range?: unknown }
  | { readonly kind: 'case'; readonly scenarioId: string; readonly tick: number }
  | { readonly kind: 'signalEdge'; readonly fieldId: string; readonly tick: number }
  | { readonly kind: 'scenario'; readonly scenarioId: string }
  | { readonly kind: 'run'; readonly runId: string }
  | { readonly kind: 'artifact'; readonly artifactId: string }
  | { readonly kind: 'constraintSet'; readonly constraintSetId: string }
  | { readonly kind: 'macro'; readonly macroId: string; readonly macroName: string }
  | { readonly kind: 'component'; readonly componentName: string }
  | { readonly kind: 'diagnostic'; readonly problemId: string };

/** Structural equality; key order independent. */
export function sameRef(a: ObjectRef | null | undefined, b: ObjectRef | null | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return canonicalJson(a) === canonicalJson(b);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Node or port refs name a node; other kinds may name one through their payload. */
export function refNodeId(ref: ObjectRef | null | undefined): string | null {
  if (!ref) return null;
  if (ref.kind === 'node' || ref.kind === 'port') return ref.nodeId;
  if (ref.kind === 'field') return ref.nodeId ?? null;
  return null;
}

// ── Adapters to the existing workbench selection ─────────────────────────────

export function fromEngineeringRef(ref: EngineeringObjectRef): ObjectRef {
  switch (ref.kind) {
    case 'project':
      return { kind: 'project' };
    case 'signal':
      return ref.nodeId === undefined
        ? { kind: 'field', fieldId: ref.fieldId, runSignal: ref.runSignal }
        : { kind: 'field', fieldId: ref.fieldId, runSignal: ref.runSignal, nodeId: ref.nodeId };
    case 'node':
      return { kind: 'node', scope: [], nodeId: ref.nodeId, moduleId: ref.moduleId };
    case 'module':
      return { kind: 'module', definitionId: ref.moduleId };
    case 'component':
      return { kind: 'component', componentName: ref.componentName };
    case 'macro':
      return { kind: 'macro', macroId: ref.macroId, macroName: ref.macroName };
    case 'scenario':
      return { kind: 'scenario', scenarioId: ref.scenarioId };
    case 'case-tick':
      return { kind: 'case', scenarioId: ref.scenarioId, tick: ref.tick };
    case 'signal-edge':
      return { kind: 'signalEdge', fieldId: ref.fieldId, tick: ref.tick };
    case 'board-resource':
      return { kind: 'boardResource', constraintSetId: ref.constraintSetId, pin: ref.pin };
    case 'constraint-set':
      return { kind: 'constraintSet', constraintSetId: ref.constraintSetId };
    case 'source-range':
      return { kind: 'span', fileId: ref.fileId, line: ref.range.start.line, range: ref.range };
    case 'artifact':
      return { kind: 'artifact', artifactId: ref.artifactId };
    case 'run':
      return { kind: 'run', runId: ref.runId };
    case 'problem':
      return { kind: 'diagnostic', problemId: ref.problemId };
  }
}

/** Back to the workbench vocabulary. Kinds the workbench cannot name return null. */
export function toEngineeringRef(ref: ObjectRef): EngineeringObjectRef | null {
  switch (ref.kind) {
    case 'project':
      return { kind: 'project' };
    case 'field':
      return ref.nodeId === undefined
        ? { kind: 'signal', fieldId: ref.fieldId, runSignal: ref.runSignal }
        : { kind: 'signal', fieldId: ref.fieldId, runSignal: ref.runSignal, nodeId: ref.nodeId };
    case 'node':
      return { kind: 'node', moduleId: ref.moduleId ?? 'top', nodeId: ref.nodeId };
    case 'module':
      return { kind: 'module', moduleId: ref.definitionId };
    case 'component':
      return { kind: 'component', componentName: ref.componentName };
    case 'macro':
      return { kind: 'macro', macroId: ref.macroId, macroName: ref.macroName };
    case 'scenario':
      return { kind: 'scenario', scenarioId: ref.scenarioId };
    case 'case':
      return { kind: 'case-tick', scenarioId: ref.scenarioId, tick: ref.tick };
    case 'signalEdge':
      return { kind: 'signal-edge', fieldId: ref.fieldId, tick: ref.tick };
    case 'boardResource':
      return { kind: 'board-resource', constraintSetId: ref.constraintSetId, pin: ref.pin };
    case 'constraintSet':
      return { kind: 'constraint-set', constraintSetId: ref.constraintSetId };
    case 'span':
      return ref.range
        ? { kind: 'source-range', fileId: ref.fileId, range: ref.range as Extract<EngineeringObjectRef, { kind: 'source-range' }>['range'] }
        : null;
    case 'artifact':
      return { kind: 'artifact', artifactId: ref.artifactId };
    case 'run':
      return { kind: 'run', runId: ref.runId };
    case 'diagnostic':
      return { kind: 'problem', problemId: ref.problemId };
    default:
      return null;
  }
}

// ── Adapter to the Signal Journey selection ──────────────────────────────────

export interface JourneyCoordinates {
  readonly projectId: string;
  readonly revision: string;
  readonly object: Extract<ObjectRef, { kind: 'port' }>;
  readonly runId: string;
  readonly tick: number;
  readonly eventOrder: number | null;
  readonly anchor: { readonly nodeId: string; readonly port: string } | null;
}

export function fromJourneySelection(selection: JourneySelection): JourneyCoordinates {
  const object: Extract<ObjectRef, { kind: 'port' }> = {
    kind: 'port',
    scope: [...selection.instancePath],
    nodeId: selection.nodeId,
    port: selection.port,
    bit: selection.bit,
    ...(selection.busId !== undefined ? { busId: selection.busId } : {}),
  };
  return {
    projectId: selection.projectId,
    revision: selection.revision,
    object,
    runId: selection.runId,
    tick: selection.tick,
    eventOrder: selection.eventOrder,
    anchor:
      selection.anchorNodeId !== undefined && selection.anchorPort !== undefined
        ? { nodeId: selection.anchorNodeId, port: selection.anchorPort }
        : null,
  };
}

export function toJourneySelection(coordinates: JourneyCoordinates): JourneySelection {
  const { object } = coordinates;
  return {
    projectId: coordinates.projectId,
    revision: coordinates.revision,
    runId: coordinates.runId,
    tick: coordinates.tick,
    nodeId: object.nodeId,
    port: object.port,
    instancePath: [...object.scope],
    bit: object.bit ?? null,
    ...(object.busId !== undefined ? { busId: object.busId } : {}),
    eventOrder: coordinates.eventOrder,
    ...(coordinates.anchor ? { anchorNodeId: coordinates.anchor.nodeId, anchorPort: coordinates.anchor.port } : {}),
  };
}
