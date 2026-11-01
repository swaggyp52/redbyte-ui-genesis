import type { CircuitScene, SceneSymbol } from '@redbyte/rb-logic-view/scene';
import {
  createRecordedPortResolver,
  journeySourceSpans,
  type Basys3BoardResource,
  type ProjectIoRow,
  type RuntimeVerifyRun,
} from '@redbyte/rb-apps/domain';
import type { ObjectRef } from './objectRef';

/**
 * One resolver maps an ObjectRef into every perspective's terms: the net it belongs to, the
 * waveform lane that recorded it, the generated statement that drives it and the board
 * resource it is bound to. Ambiguity resolves to nothing; nothing is matched by label.
 */
export interface SourceSpan {
  readonly path: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly kind: string;
  readonly nodeId: string;
}

export interface BoardBinding {
  /** XDC / board alias, e.g. SW0, LD1, BTNC, CLK100MHZ. */
  readonly name: string;
  readonly packagePin: string | null;
  readonly direction: 'in' | 'out';
  readonly ioRowId: string;
  readonly label: string;
}

export interface Resolution {
  readonly nodeId: string | null;
  readonly port: string | null;
  readonly netId: string | null;
  /** Sample key of the retained waveform lane, or null when this object was not recorded. */
  readonly lane: string | null;
  /** Statements that drive this object in the recording's generated source. */
  readonly spans: readonly SourceSpan[];
  readonly board: BoardBinding | null;
}

export interface ResolverContext {
  readonly scene: CircuitScene;
  readonly run?: RuntimeVerifyRun | null;
  readonly ioRows: readonly ProjectIoRow[];
  readonly boardResources: readonly Basys3BoardResource[];
}

export interface Resolver {
  resolve(ref: ObjectRef | null): Resolution;
  nodeForSourceLine(path: string, line: number): string | null;
  nodeForBoardName(name: string): string | null;
  boardBindings(): readonly BoardBinding[];
}

const EMPTY: Resolution = { nodeId: null, port: null, netId: null, lane: null, spans: [], board: null };

/**
 * Declared input pins that nothing drives. The engine reads such a pin at its unconnected level
 * (describeInputPin: 0 for a gate input, 1 for a DFlipFlop EN) without recording a read, so this
 * is a fact of topology, drawn as "unconnected · read as <level>", never as an observed value.
 */
export function unconnectedInputPins(scene: CircuitScene): Set<string> {
  const keys = new Set<string>();
  for (const symbol of scene.symbols) {
    if (symbol.geometry.kind === 'io-in' || symbol.geometry.kind === 'clock') continue;
    for (const pin of symbol.geometry.pins) {
      if (pin.direction !== 'in') continue;
      if (!scene.netByEndpoint.has(`${symbol.nodeId}.${pin.id}`)) keys.add(`${symbol.nodeId}.${pin.id}`);
    }
  }
  return keys;
}

/** The pin that names a symbol's own value: its single output, or an output sink's input. */
export function primaryPin(symbol: SceneSymbol): string | null {
  const outputs = symbol.geometry.pins.filter((pin) => pin.direction === 'out');
  if (symbol.geometry.kind === 'io-out') return symbol.geometry.pins.find((pin) => pin.direction === 'in')?.id ?? null;
  if (outputs.length === 0) return null;
  return (outputs.find((pin) => pin.id === 'Q' || pin.id === 'out') ?? outputs[0]).id;
}

export function createResolver(context: ResolverContext): Resolver {
  const { scene, run, ioRows, boardResources } = context;
  const recordedPort = run?.circuitSnapshot ? createRecordedPortResolver(run.circuitSnapshot, run.waveform) : null;
  const resourceByAlias = new Map(boardResources.map((resource) => [resource.alias.toUpperCase(), resource] as const));
  // A project row names its board resource by alias (SW0, BTNC) or by package pin (V17); the
  // catalog resolves both to one resource (the first resource that owns a pin).
  const resourceByPin = new Map<string, (typeof boardResources)[number]>();
  for (const resource of boardResources) {
    const pin = resource.packagePin.toUpperCase();
    if (!resourceByPin.has(pin)) resourceByPin.set(pin, resource);
  }
  const resourceFor = (pin: string) => resourceByAlias.get(pin.trim().toUpperCase()) ?? resourceByPin.get(pin.trim().toUpperCase());

  const bindings: BoardBinding[] = ioRows
    .filter((row) => row.nodeId && row.pin?.trim())
    .map((row) => {
      const resource = resourceFor(row.pin);
      return {
        name: resource?.alias ?? row.pin.trim(),
        packagePin: resource?.packagePin ?? null,
        direction: row.direction,
        ioRowId: row.id,
        label: row.label,
      };
    });
  const bindingByNode = new Map<string, BoardBinding>();
  for (const row of ioRows) {
    const binding = bindings.find((entry) => entry.ioRowId === row.id);
    if (row.nodeId && binding) bindingByNode.set(row.nodeId, binding);
  }

  const spansFor = (nodeId: string): SourceSpan[] =>
    run?.generatedSource
      ? journeySourceSpans(run, nodeId).map((span) => ({
          path: span.path,
          startLine: span.startLine,
          endLine: span.endLine,
          kind: span.kind,
          nodeId: span.nodeId,
        }))
      : [];

  const resolveEndpoint = (nodeId: string, port: string | null): Resolution => {
    const symbol = scene.symbolById.get(nodeId);
    if (!symbol) return EMPTY;
    const pin = port ?? primaryPin(symbol);
    const netId = pin ? scene.netByEndpoint.get(`${nodeId}.${pin}`) ?? null : null;
    const lane = pin && recordedPort ? recordedPort(nodeId, pin) : null;
    return { nodeId, port: pin, netId, lane, spans: spansFor(nodeId), board: bindingByNode.get(nodeId) ?? null };
  };

  const nodeForSourceLine = (path: string, line: number): string | null => {
    const spans = (run?.generatedSource?.spans ?? []).filter(
      (span) => span.path === path && span.definitionId === 'top' && span.startLine <= line && line <= span.endLine,
    );
    if (spans.length === 0) return null;
    const narrowest = Math.min(...spans.map((span) => span.endLine - span.startLine));
    const owners = new Set(spans.filter((span) => span.endLine - span.startLine === narrowest).map((span) => span.nodeId));
    return owners.size === 1 ? [...owners][0] : null;
  };

  const nodeForBoardName = (name: string): string | null => {
    const wanted = name.trim().toUpperCase();
    const rows = ioRows.filter((row) => row.nodeId && row.pin?.trim() && (resourceFor(row.pin)?.alias.toUpperCase() ?? row.pin.trim().toUpperCase()) === wanted);
    return rows.length === 1 ? rows[0].nodeId ?? null : null;
  };

  return {
    resolve(ref) {
      if (!ref) return EMPTY;
      switch (ref.kind) {
        case 'node':
          return resolveEndpoint(ref.nodeId, null);
        case 'port':
          return resolveEndpoint(ref.nodeId, ref.port);
        case 'net': {
          const net = scene.netById.get(ref.netId);
          return net ? { ...resolveEndpoint(net.driver.nodeId, net.driver.pin), netId: net.netId } : EMPTY;
        }
        case 'wire': {
          const net = scene.nets.find((entry) => entry.wires.some((wire) => wire.wireId === ref.wireId));
          return net ? { ...resolveEndpoint(net.driver.nodeId, net.driver.pin), netId: net.netId } : EMPTY;
        }
        case 'boardPort': {
          const nodeId = nodeForBoardName(ref.name);
          return nodeId ? resolveEndpoint(nodeId, null) : EMPTY;
        }
        case 'span': {
          const nodeId = nodeForSourceLine(ref.fileId, ref.line);
          return nodeId ? resolveEndpoint(nodeId, null) : EMPTY;
        }
        case 'field': {
          const nodeId = ref.nodeId ?? ioRows.find((row) => row.id === ref.fieldId)?.nodeId ?? null;
          return nodeId ? resolveEndpoint(nodeId, null) : EMPTY;
        }
        default:
          return EMPTY;
      }
    },
    nodeForSourceLine,
    nodeForBoardName,
    boardBindings: () => bindings,
  };
}
