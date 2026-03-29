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
  const inputRefs = buildDirectionRefs(ioMapping.inputs, 'in', boundaryKindsByNodeId);
  const outputRefs = buildDirectionRefs(ioMapping.outputs, 'out', boundaryKindsByNodeId);

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

function buildDirectionRefs(
  entries: IoMappingEntry[],
  direction: 'in' | 'out',
  boundaryKindsByNodeId: Map<string, CircuitIR['ports'][number]['kind']>,
): { topPorts: VhdlTopPort[]; refs: Basys3ExportBindingRef[] } {
  const scalarRefs: Basys3ExportBindingRef[] = [];
  const vectorGroups = new Map<string, Basys3ExportBindingRef[]>();
  const vectorOrder: string[] = [];

  for (const entry of stableSortMapping(entries)) {
    const boundaryKind = boundaryKindsByNodeId.get(entry.nodeId);
    const vectorRef =
      parseExplicitVectorLabel(entry.label) ??
      parseBasys3BoundaryAliasVector(entry.pin, direction, boundaryKind);
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
    const maxBitIndex = Math.max(...groupEntries.map((entry) => entry.bitIndex ?? 0), 0);
    const useVectorPort = maxBitIndex > 0 || groupEntries.length > 1;
    topPorts.push({
      name: groupKey,
      dir: direction,
      vhdlType: useVectorPort ? `STD_LOGIC_VECTOR(${maxBitIndex} downto 0)` : 'STD_LOGIC',
    });
    refs.push(
      ...groupEntries.map((entry) =>
        useVectorPort
          ? entry
          : {
              ...entry,
              bitIndex: undefined,
              signalRef: entry.portName,
              xdcRef: entry.portName,
            }
      )
    );
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

function toSignalName(entry: IoMappingEntry): string {
  const trimmedLabel = entry.label?.trim() ?? '';
  if (trimmedLabel.length > 0) return sanitizeIdentifier(trimmedLabel);
  return sanitizeIdentifier(`${entry.nodeId}_${entry.port}`);
}

function sanitizeIdentifier(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
}

function compareBindingRef(left: Basys3ExportBindingRef, right: Basys3ExportBindingRef): number {
  const byPortName = compareCodepoint(left.portName, right.portName);
  if (byPortName !== 0) return byPortName;
  const byBitIndex = (left.bitIndex ?? -1) - (right.bitIndex ?? -1);
  if (byBitIndex !== 0) return byBitIndex;
  return compareCodepoint(left.entryId, right.entryId);
}
