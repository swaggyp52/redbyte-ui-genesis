import {
  buildSimulationModel,
  elaborateCircuit,
  type Circuit,
  type CircuitIR,
  type IRDiagnostic,
  type SimulationModel,
} from '@redbyte/rb-logic-core';
import type { IoMapping } from '@redbyte/rb-utils';
import type { RBProject } from '../export/projectFormat';
import { compareCodepoint } from '../export/codepointSort';
import {
  parsedHdlToCircuit,
  type ParsedHDL,
  type ParsedPort,
  type ReconstructionLevel,
} from './hdlToCircuit';
import type { XdcParseResult } from './xdcImport';

const IMPORT_TIMESTAMP = '2026-02-20T00:00:00.000Z';
const CLASSROOM_BOARD = 'basys3';
const CLASSROOM_PART = 'xc7a35tcpg236-1';

export type ImportParseStatus = 'success' | 'failure';
export type ImportReconstructionStatus = 'success' | 'partial' | 'failure';
export type ImportCompilerStatus = 'runnable' | 'blocked';

export interface ImportDiagnostic {
  source: 'parser' | 'reconstruction' | 'constraints' | 'manifest' | 'archive';
  severity: 'warning' | 'error';
  code?: string;
  message: string;
  filePath?: string;
  line?: number;
  column?: number;
  blocking?: boolean;
}

export interface ImportedProjectCompilerStatus {
  parse: ImportParseStatus;
  reconstruction: ImportReconstructionStatus;
  compiler: ImportCompilerStatus;
}

export interface ImportedProjectCompilerResult {
  project: RBProject;
  parsedHdl: ParsedHDL;
  circuit: Circuit;
  ir: CircuitIR;
  simModel: SimulationModel;
  parserDiagnostics: ImportDiagnostic[];
  compilerDiagnostics: IRDiagnostic[];
  reconstructionLevel: ReconstructionLevel;
  status: ImportedProjectCompilerStatus;
  isImportRunnable: boolean;
}

export interface BuildImportedProjectCompilerInput {
  sourceName: string;
  topPath: string;
  topText: string;
  parsedHdl: ParsedHDL;
  xdcPath?: string;
  xdcText?: string;
  xdcResult?: XdcParseResult;
  existingPositions?: Map<string, { x: number; y: number }>;
  parseStatus?: ImportParseStatus;
  parserDiagnostics?: ImportDiagnostic[];
}

export function buildImportedProjectCompilerResult(
  input: BuildImportedProjectCompilerInput
): ImportedProjectCompilerResult {
  const converted = parsedHdlToCircuit(input.parsedHdl);

  if (input.existingPositions && input.existingPositions.size > 0) {
    for (const node of converted.circuit.nodes) {
      const saved = input.existingPositions.get(node.id);
      if (saved) {
        node.x = saved.x;
        node.y = saved.y;
      }
    }
  }

  const ioMapping = buildIoMapping(input.parsedHdl.ports, converted.circuit, input.xdcResult);
  const project = buildImportedProjectRecord(input, converted.circuit, ioMapping);
  const { ir } = elaborateCircuit(converted.circuit, {
    pins: buildPinMapping(ioMapping),
  });
  const simModel = buildSimulationModel(ir);

  const parserDiagnostics = normalizeParserDiagnostics([
    ...(input.parserDiagnostics ?? []),
    ...(input.parsedHdl.warnings ?? []).map((warning) => ({
      source: 'parser' as const,
      severity: 'warning' as const,
      filePath: normalizePath(input.topPath),
      line: warning.line,
      column: warning.col,
      message: warning.message,
    })),
    ...converted.warnings.map((warning) => ({
      source: 'reconstruction' as const,
      severity: 'warning' as const,
      message: warning,
    })),
    ...(input.xdcResult?.warnings ?? []).map((warning) => ({
      source: 'constraints' as const,
      severity: 'warning' as const,
      filePath: input.xdcPath ? normalizePath(input.xdcPath) : undefined,
      message: warning,
    })),
  ]);
  const compilerDiagnostics = ir.diagnostics
    .map((diagnostic) => ({ ...diagnostic }))
    .sort(compareCompilerDiagnostic);
  const reconstructionLevel = converted.reconstructionLevel;

  return {
    project,
    parsedHdl: input.parsedHdl,
    circuit: converted.circuit,
    ir,
    simModel,
    parserDiagnostics,
    compilerDiagnostics,
    reconstructionLevel,
    status: {
      parse: input.parseStatus ?? 'success',
      reconstruction: toReconstructionStatus(reconstructionLevel),
      compiler: simModel.isRunnable ? 'runnable' : 'blocked',
    },
    isImportRunnable: simModel.isRunnable,
  };
}

export function deriveProjectCompilerResult(
  project: RBProject,
  options: {
    parsedHdl: ParsedHDL;
    parseStatus?: ImportParseStatus;
    parserDiagnostics?: ImportDiagnostic[];
    reconstructionLevel?: ReconstructionLevel;
  }
): ImportedProjectCompilerResult {
  const { ir } = elaborateCircuit(project.circuit, {
    pins: buildPinMapping(project.ioMapping),
  });
  const simModel = buildSimulationModel(ir);
  const reconstructionLevel =
    options.reconstructionLevel ?? inferReconstructionLevelFromCircuit(project.circuit);

  return {
    project,
    parsedHdl: options.parsedHdl,
    circuit: project.circuit,
    ir,
    simModel,
    parserDiagnostics: normalizeParserDiagnostics(options.parserDiagnostics ?? []),
    compilerDiagnostics: ir.diagnostics.map((diagnostic) => ({ ...diagnostic })).sort(compareCompilerDiagnostic),
    reconstructionLevel,
    status: {
      parse: options.parseStatus ?? 'success',
      reconstruction: toReconstructionStatus(reconstructionLevel),
      compiler: simModel.isRunnable ? 'runnable' : 'blocked',
    },
    isImportRunnable: simModel.isRunnable,
  };
}

export function inferReconstructionLevelFromCircuit(circuit: Circuit): ReconstructionLevel {
  const nodes = Array.isArray(circuit?.nodes) ? circuit.nodes : [];
  if (nodes.length === 0) return 'empty';
  const hasGates = nodes.some((node) => node.type !== 'INPUT' && node.type !== 'OUTPUT');
  return hasGates ? 'full' : 'ports-only';
}

export function buildIoMapping(
  ports: ParsedPort[],
  circuit: RBProject['circuit'],
  xdcResult: XdcParseResult | undefined
): IoMapping {
  const pinMap = new Map<string, string>();
  for (const [port, pin] of Object.entries(xdcResult?.pinMap ?? {})) {
    pinMap.set(normalizeToken(port), pin.trim().toUpperCase());
  }

  const mapping: IoMapping = {
    inputs: [],
    outputs: [],
  };

  for (const port of ports) {
    const portName = port.name.trim();
    if (!portName) continue;
    const nodeId =
      findPortNodeId(circuit, port) ??
      (port.direction === 'in' ? `port_${portName}` : `port_out_${portName}`);
    const mappedPin = pinMap.get(normalizeToken(portName)) ?? '';
    if (port.direction === 'in') {
      mapping.inputs.push({
        id: toMappingId(portName),
        nodeId,
        port: 'out',
        label: portName,
        pin: mappedPin,
      });
      continue;
    }
    mapping.outputs.push({
      id: toMappingId(portName),
      nodeId,
      port: 'in',
      label: portName,
      pin: mappedPin,
    });
  }

  mapping.inputs.sort((left, right) => compareCodepoint(left.id, right.id));
  mapping.outputs.sort((left, right) => compareCodepoint(left.id, right.id));
  return mapping;
}

function buildImportedProjectRecord(
  input: BuildImportedProjectCompilerInput,
  circuit: Circuit,
  ioMapping: IoMapping
): RBProject {
  const topEntity = sanitizeIdentifier(
    input.parsedHdl.entityName.trim() || stemFromPath(input.topPath) || 'top'
  );
  const projectName = deriveProjectName(input.sourceName, topEntity);
  const projectId = deriveProjectId(input.sourceName, topEntity);

  return {
    kind: 'rb-project',
    version: 1,
    createdAt: IMPORT_TIMESTAMP,
    updatedAt: IMPORT_TIMESTAMP,
    name: projectName,
    description: `Imported from ${input.sourceName}`,
    circuit,
    hdl: {
      top: topEntity,
      sources: [
        {
          path: normalizePath(input.topPath),
          language: input.parsedHdl.lang,
          text: input.topText,
        },
      ],
    },
    fpga: {
      board: CLASSROOM_BOARD,
      part: CLASSROOM_PART,
      top: topEntity,
      constraints:
        input.xdcText && input.xdcText.trim().length > 0
          ? {
              type: 'xdc',
              text: input.xdcText,
            }
          : undefined,
    },
    ioMapping,
    vectors: [],
    meta: {
      appSurface: 'ide-import',
      projectId,
      tags: ['import', 'vivado', CLASSROOM_BOARD],
    },
  };
}

function buildPinMapping(ioMapping: IoMapping | undefined): Record<string, string> {
  const pins: Record<string, string> = {};
  for (const entry of [...(ioMapping?.inputs ?? []), ...(ioMapping?.outputs ?? [])]) {
    const pin = entry.pin?.trim().toUpperCase();
    const nodeId = entry.nodeId?.trim();
    if (!pin || !nodeId) continue;
    pins[nodeId] = pin;
  }
  return pins;
}

function findPortNodeId(
  circuit: RBProject['circuit'],
  port: ParsedPort
): string | undefined {
  const targetLabel = normalizeToken(port.name);
  const preferredType = port.direction === 'in' ? 'INPUT' : 'OUTPUT';
  const match = circuit.nodes.find((node) => {
    const nodeLabel = normalizeToken(String(node.label ?? ''));
    if (nodeLabel !== targetLabel) return false;
    return normalizeToken(String(node.type)) === normalizeToken(preferredType);
  });
  return match?.id;
}

function normalizeParserDiagnostics(rows: ImportDiagnostic[]): ImportDiagnostic[] {
  const seen = new Set<string>();
  const normalized: ImportDiagnostic[] = [];
  for (const row of rows) {
    const message = row.message.trim();
    if (!message) continue;
    const key = [
      row.source,
      row.severity,
      row.code ?? '',
      row.filePath ?? '',
      Number.isFinite(row.line) ? row.line : '',
      Number.isFinite(row.column) ? row.column : '',
      message,
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      source: row.source,
      severity: row.severity,
      code: row.code?.trim() || undefined,
      message,
      filePath: row.filePath ? normalizePath(row.filePath) : undefined,
      line: Number.isFinite(row.line) ? Math.max(1, Math.floor(Number(row.line))) : undefined,
      column: Number.isFinite(row.column) ? Math.max(1, Math.floor(Number(row.column))) : undefined,
      blocking: row.blocking === true ? true : undefined,
    });
  }
  return normalized.sort(compareImportDiagnostic);
}

function compareImportDiagnostic(left: ImportDiagnostic, right: ImportDiagnostic): number {
  const bySeverity = compareCodepoint(left.severity, right.severity);
  if (bySeverity !== 0) return bySeverity;
  const byCode = compareCodepoint(left.code ?? '', right.code ?? '');
  if (byCode !== 0) return byCode;
  const bySource = compareCodepoint(left.source, right.source);
  if (bySource !== 0) return bySource;
  const byFilePath = compareCodepoint(left.filePath ?? '', right.filePath ?? '');
  if (byFilePath !== 0) return byFilePath;
  const byLine = (left.line ?? Number.MAX_SAFE_INTEGER) - (right.line ?? Number.MAX_SAFE_INTEGER);
  if (byLine !== 0) return byLine;
  const byColumn = (left.column ?? Number.MAX_SAFE_INTEGER) - (right.column ?? Number.MAX_SAFE_INTEGER);
  if (byColumn !== 0) return byColumn;
  return compareCodepoint(left.message, right.message);
}

function compareCompilerDiagnostic(left: IRDiagnostic, right: IRDiagnostic): number {
  const byCode = compareCodepoint(left.code, right.code);
  if (byCode !== 0) return byCode;
  const byNodeId = compareCodepoint(left.nodeId ?? '', right.nodeId ?? '');
  if (byNodeId !== 0) return byNodeId;
  const byPort = compareCodepoint(left.port ?? '', right.port ?? '');
  if (byPort !== 0) return byPort;
  return compareCodepoint(left.message, right.message);
}

function toReconstructionStatus(level: ReconstructionLevel): ImportReconstructionStatus {
  if (level === 'full') return 'success';
  if (level === 'ports-only') return 'partial';
  return 'failure';
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').trim();
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function toMappingId(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized.length > 0 ? normalized : 'io';
}

function sanitizeIdentifier(value: string): string {
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (normalized.length === 0) return 'top';
  if (!/^[A-Za-z_]/.test(normalized)) return `top_${normalized}`;
  return normalized;
}

function stemFromPath(path: string): string {
  const file = normalizePath(path).split('/').pop() ?? '';
  return file.replace(/\.[^.]+$/, '');
}

function deriveProjectName(sourceName: string, topEntity: string): string {
  const stem = sourceName.trim().replace(/\.[^.]+$/, '');
  if (stem.length > 0) return stem;
  return topEntity;
}

function deriveProjectId(sourceName: string, topEntity: string): string {
  const raw = sourceName.trim().replace(/\.[^.]+$/, '') || topEntity;
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized.length > 0 ? `rb-${normalized}` : 'rb-imported-project';
}
