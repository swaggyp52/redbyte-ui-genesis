import {
  buildSimulationModel,
  elaborateCircuit,
  type Circuit,
  type CircuitIR,
  type IRDiagnostic,
  type SimulationModel,
} from '@redbyte/rb-logic-core';
import type { IoMapping, IoMappingEntry } from '@redbyte/rb-utils';
import { compareCodepoint } from '../../../export/codepointSort';
import { canonicalizeSemanticCircuit } from '../../../circuit/semanticCircuit';
import { netlistFromIr, type Netlist } from '../../../export/netlistExport';
import type {
  VhdlTopInputBinding,
  VhdlTopOutputBinding,
  VhdlTopPort,
} from '../../../export/vhdlExport';

export interface Basys3ExportBindingRef {
  entryId: string;
  direction: 'in' | 'out';
  nodeId: string;
  port: string;
  label?: string;
  pin?: string;
  portName: string;
  bitIndex?: number;
  signalRef: string;
  xdcRef: string;
}

export interface Basys3ExportModel {
  ir: CircuitIR;
  simModel: SimulationModel;
  netlist: Netlist;
  topPorts: VhdlTopPort[];
  topInputBindings: VhdlTopInputBinding[];
  topOutputBindings: VhdlTopOutputBinding[];
  inputRefs: Basys3ExportBindingRef[];
  outputRefs: Basys3ExportBindingRef[];
  blockingDiagnostics: IRDiagnostic[];
  isRunnable: boolean;
}

interface VhdlTopLevelBindings {
  topPorts: VhdlTopPort[];
  topInputBindings: VhdlTopInputBinding[];
  topOutputBindings: VhdlTopOutputBinding[];
}

interface TopLevelBindingRefs extends VhdlTopLevelBindings {
  inputRefs: Basys3ExportBindingRef[];
  outputRefs: Basys3ExportBindingRef[];
}

export function buildBasys3ExportModel(
  circuit: Circuit,
  ioMapping: IoMapping,
): Basys3ExportModel {
  const semanticCircuit = canonicalizeSemanticCircuit(circuit);
  const { ir } = elaborateCircuit(semanticCircuit, {
    pins: Object.fromEntries(
      [...ioMapping.inputs, ...ioMapping.outputs]
        .filter((entry) => typeof entry.pin === 'string' && entry.pin.trim().length > 0)
        .map((entry) => [entry.nodeId, entry.pin?.trim() ?? ''])
    ),
  });
  const simModel = buildSimulationModel(ir);
  const bindingRefs = buildTopLevelBindingRefs(ioMapping, ir);

  return {
    ir,
    simModel,
    netlist: netlistFromIr(ir),
    topPorts: bindingRefs.topPorts,
    topInputBindings: bindingRefs.topInputBindings,
    topOutputBindings: bindingRefs.topOutputBindings,
    inputRefs: bindingRefs.inputRefs,
    outputRefs: bindingRefs.outputRefs,
    blockingDiagnostics: simModel.blockingDiagnostics.map((diagnostic) => ({ ...diagnostic })),
    isRunnable: simModel.isRunnable,
  };
}

export function buildVhdlTopLevelBindings(
  ioMapping: IoMapping,
  ir?: CircuitIR,
): VhdlTopLevelBindings {
  const bindings = buildTopLevelBindingRefs(ioMapping, ir);
  return {
    topPorts: bindings.topPorts,
    topInputBindings: bindings.topInputBindings,
    topOutputBindings: bindings.topOutputBindings,
  };
}

export function buildTopLevelBindingRefs(
  ioMapping: IoMapping,
  ir?: CircuitIR,
): TopLevelBindingRefs {
  const boundaryKindsByNodeId = new Map(
    (ir?.ports ?? []).map((port) => [port.sourceNodeId, port.kind] as const),
  );
  // Declared buses from the IR are the vector authority; the label heuristic
  // below remains only as the fallback for undeclared scalars.
  const declaredByNodeId = new Map<string, DeclaredBusBit>();
  for (const bus of ir?.buses ?? []) {
    for (const bit of bus.bits) {
      declaredByNodeId.set(bit.portId, {
        busId: bus.id,
        baseName: bus.name,
        bitIndex: bit.index,
        left: bus.left,
        right: bus.right,
        width: bus.signalType.width,
      });
    }
  }
  const inputRefs = buildDirectionRefs(ioMapping.inputs, 'in', boundaryKindsByNodeId, declaredByNodeId);
  const outputRefs = buildDirectionRefs(ioMapping.outputs, 'out', boundaryKindsByNodeId, declaredByNodeId);

  return {
    topPorts: [
      ...inputRefs.topPorts,
      ...outputRefs.topPorts,
    ],
    topInputBindings: inputRefs.refs.map((ref) => ({
      portName: ref.portName,
      bitIndex: ref.bitIndex,
      toNodeId: ref.nodeId,
      toPort: ref.port,
    })),
    topOutputBindings: outputRefs.refs.map((ref) => ({
      portName: ref.portName,
      bitIndex: ref.bitIndex,
      fromNodeId: ref.nodeId,
      fromPort: ref.port,
    })),
    inputRefs: inputRefs.refs,
    outputRefs: outputRefs.refs,
  };
}

interface DeclaredBusBit {
  busId: string;
  baseName: string;
  bitIndex: number;
  left: number;
  right: number;
  width: number;
}

function buildDirectionRefs(
  entries: IoMappingEntry[],
  direction: 'in' | 'out',
  boundaryKindsByNodeId: Map<string, CircuitIR['ports'][number]['kind']>,
  declaredByNodeId?: Map<string, DeclaredBusBit>,
): { topPorts: VhdlTopPort[]; refs: Basys3ExportBindingRef[] } {
  const scalarRefs: Basys3ExportBindingRef[] = [];
  const vectorGroups = new Map<string, Basys3ExportBindingRef[]>();
  const vectorOrder: string[] = [];
  const declaredGroups = new Map<string, DeclaredBusBit>();

  for (const entry of stableSortMapping(entries)) {
    const boundaryKind = boundaryKindsByNodeId.get(entry.nodeId);
    const declared = declaredByNodeId?.get(entry.nodeId);
    const vectorRef = declared
      ? { baseName: declared.baseName, bitIndex: declared.bitIndex }
      : parseExplicitVectorLabel(entry.label) ??
        parseBasys3BoundaryAliasVector(entry.pin, direction, boundaryKind);
    if (declared) {
      declaredGroups.set(declared.baseName, declared);
    }
    if (!vectorRef) {
      const portName = toSignalName(entry);
      scalarRefs.push({
        entryId: entry.id,
        direction,
        nodeId: entry.nodeId,
        port: entry.port,
        label: entry.label,
        pin: entry.pin,
        portName,
        signalRef: portName,
        xdcRef: portName,
      });
      continue;
    }

    const groupKey = vectorRef.baseName;
    if (!vectorGroups.has(groupKey)) {
      vectorGroups.set(groupKey, []);
      vectorOrder.push(groupKey);
    }
    vectorGroups.get(groupKey)?.push({
      entryId: entry.id,
      direction,
      nodeId: entry.nodeId,
      port: entry.port,
      label: entry.label,
      pin: entry.pin,
      portName: vectorRef.baseName,
      bitIndex: vectorRef.bitIndex,
      signalRef: `${vectorRef.baseName}(${vectorRef.bitIndex})`,
      xdcRef: `${vectorRef.baseName}[${vectorRef.bitIndex}]`,
    });
  }

  const topPorts: VhdlTopPort[] = [];
  const refs: Basys3ExportBindingRef[] = [];


  for (const groupKey of vectorOrder) {
    const groupEntries = (vectorGroups.get(groupKey) ?? [])
      .slice()
      .sort(compareBindingRef);
    // Only consider mapped bits
    const mappedBits = groupEntries.map((entry) => entry.bitIndex ?? 0);

    // Declared bus: when every declared bit is present, the declaration owns
    // the port — full declared range, honoring ascending declarations, even
    // when the mapped range happens to start above zero.
    const declared = declaredGroups.get(groupKey);
    if (declared && groupEntries.length === declared.width) {
      const descending = declared.left >= declared.right;
      topPorts.push({
        name: groupKey,
        dir: direction,
        vhdlType: `STD_LOGIC_VECTOR(${declared.left} ${descending ? 'downto' : 'to'} ${declared.right})`,
      });
      refs.push(
        ...groupEntries.map((entry) => ({
          ...entry,
          signalRef: `${groupKey}(${entry.bitIndex})`,
          xdcRef: `${groupKey}[${entry.bitIndex}]`,
        }))
      );
      continue;
    }

    if (mappedBits.length === 1) {
      // Only one bit mapped: emit scalar port
      topPorts.push({
        name: mappedBits[0] === 0 ? groupKey : `${groupKey}${mappedBits[0]}`,
        dir: direction,
        vhdlType: 'STD_LOGIC',
      });
      refs.push({
        ...groupEntries[0],
        portName: mappedBits[0] === 0 ? groupKey : `${groupKey}${mappedBits[0]}`,
        bitIndex: undefined,
        signalRef: mappedBits[0] === 0 ? groupKey : `${groupKey}${mappedBits[0]}`,
        xdcRef: mappedBits[0] === 0 ? groupKey : `${groupKey}${mappedBits[0]}`,
      });
    } else if (
      mappedBits.length > 1 &&
      mappedBits.every((v, i, arr) => i === 0 || v === arr[i - 1] + 1)
    ) {
      // Contiguous mapped bits: emit vector port for the range
      const minBit = Math.min(...mappedBits);
      const maxBit = Math.max(...mappedBits);
      topPorts.push({
        name: groupKey,
        dir: direction,
        vhdlType: `STD_LOGIC_VECTOR(${maxBit} downto ${minBit})`,
      });
      refs.push(
        ...groupEntries.map((entry) => ({
          ...entry,
          signalRef: `${groupKey}(${entry.bitIndex})`,
          xdcRef: `${groupKey}[${entry.bitIndex}]`,
        }))
      );
    } else {
      // Non-contiguous mapped bits: emit individual scalar ports
      for (const entry of groupEntries) {
        topPorts.push({
          name: `${groupKey}${entry.bitIndex}`,
          dir: direction,
          vhdlType: 'STD_LOGIC',
        });
        refs.push({
          ...entry,
          portName: `${groupKey}${entry.bitIndex}`,
          bitIndex: undefined,
          signalRef: `${groupKey}${entry.bitIndex}`,
          xdcRef: `${groupKey}${entry.bitIndex}`,
        });
      }
    }
  }

  const sortedScalarRefs = scalarRefs.slice().sort(compareBindingRef);
  for (const ref of sortedScalarRefs) {
    topPorts.push({
      name: ref.portName,
      dir: direction,
      vhdlType: 'STD_LOGIC',
    });
    refs.push(ref);
  }

  return { topPorts, refs };
}

function parseExplicitVectorLabel(
  label: string | undefined,
): { baseName: string; bitIndex: number } | null {
  const trimmed = label?.trim() ?? '';
  if (trimmed.length === 0) return null;
  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\[(\d+)\]/);
  if (!match) return null;
  return {
    baseName: sanitizeIdentifier(match[1]),
    bitIndex: Number.parseInt(match[2], 10),
  };
}

function parseBasys3BoundaryAliasVector(
  alias: string | undefined,
  direction: 'in' | 'out',
  boundaryKind: CircuitIR['ports'][number]['kind'] | undefined,
): { baseName: string; bitIndex: number } | null {
  const normalizedAlias = alias?.trim().toUpperCase() ?? '';
  if (!isBoundaryDirectionMatch(direction, boundaryKind)) return null;

  const switchMatch = normalizedAlias.match(/^SW(\d+)$/);
  if (switchMatch) {
    return {
      baseName: 'SW',
      bitIndex: Number.parseInt(switchMatch[1] ?? '0', 10),
    };
  }

  const ledMatch = normalizedAlias.match(/^(?:LD|LED)(\d+)$/);
  if (ledMatch) {
    return {
      baseName: 'LED',
      bitIndex: Number.parseInt(ledMatch[1] ?? '0', 10),
    };
  }

  const anodeMatch = normalizedAlias.match(/^AN(\d+)$/);
  if (anodeMatch) {
    return {
      baseName: 'AN',
      bitIndex: Number.parseInt(anodeMatch[1] ?? '0', 10),
    };
  }

  const segmentMatch = normalizedAlias.match(/^SEG(\d+)$/);
  if (segmentMatch) {
    return {
      baseName: 'SEG',
      bitIndex: Number.parseInt(segmentMatch[1] ?? '0', 10),
    };
  }

  return null;
}

function isBoundaryDirectionMatch(
  direction: 'in' | 'out',
  boundaryKind: CircuitIR['ports'][number]['kind'] | undefined,
): boolean {
  if (direction === 'out') {
    return boundaryKind === 'output';
  }
  return boundaryKind === 'input' || boundaryKind === 'clock' || boundaryKind === 'reset';
}

function mappingKey(entry: IoMappingEntry): string {
  return `${entry.nodeId}.${entry.port}.${entry.id}`;
}

function stableSortMapping(entries: IoMappingEntry[]): IoMappingEntry[] {
  return [...entries].sort((left, right) => compareCodepoint(mappingKey(left), mappingKey(right)));
}

export function toSignalName(entry: IoMappingEntry): string {
  const trimmedLabel = entry.label?.trim() ?? '';
  if (trimmedLabel.length > 0) {
    const sanitizedLabel = sanitizeIdentifier(trimmedLabel);
    if (sanitizedLabel.length > 0) return sanitizedLabel;
  }
  return sanitizeIdentifier(`${entry.nodeId}_${entry.port}`);
}

function sanitizeIdentifier(name: string): string {
  const normalized = name
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (normalized.length === 0) return '';
  if (/^[A-Za-z]/.test(normalized)) return normalized;
  return `sig_${normalized}`;
}

function compareBindingRef(left: Basys3ExportBindingRef, right: Basys3ExportBindingRef): number {
  const byPortName = compareCodepoint(left.portName, right.portName);
  if (byPortName !== 0) return byPortName;
  const byBitIndex = (left.bitIndex ?? -1) - (right.bitIndex ?? -1);
  if (byBitIndex !== 0) return byBitIndex;
  return compareCodepoint(left.entryId, right.entryId);
}
