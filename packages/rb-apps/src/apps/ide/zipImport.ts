import JSZip from 'jszip';
import type { IoMapping } from '@redbyte/rb-utils';
import type { RBProject } from '../../export/projectFormat';
import { compareCodepoint } from '../../export/codepointSort';
import { parsedHdlToCircuit, type ParsedHDL, type ParsedPort } from '../../import/hdlToCircuit';
import { parseVerilog } from '../../import/verilogImport';
import { parseVhdl } from '../../import/vhdlImport';
import { parseXdcPins, type XdcParseResult } from '../../import/xdcImport';

const IMPORT_TIMESTAMP = '2026-02-20T00:00:00.000Z';

interface ZipTextEntry {
  path: string;
  text: string;
}

export interface ZipImportInspection {
  sourceName: string;
  detectedTopPath: string;
  detectedTopLanguage: 'vhdl' | 'verilog';
  detectedXdcPath?: string;
  detectedFiles: string[];
  ignoredFiles: string[];
  hdlCandidates: string[];      // all HDL files found, sorted by score (best first)
  xdcCandidates: string[];      // all XDC files found, in preference order
  parsedHdl: ParsedHDL;
  xdcResult?: XdcParseResult;
  warnings: string[];
  project: RBProject;
}

export async function importVivadoZipFile(file: File): Promise<ZipImportInspection> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return importVivadoZipBytes(bytes, { sourceName: file.name });
}

export async function importVivadoZipBytes(
  bytes: Uint8Array,
  options?: { sourceName?: string }
): Promise<ZipImportInspection> {
  const sourceName = (options?.sourceName ?? 'vivado-import.zip').trim() || 'vivado-import.zip';
  const zip = await JSZip.loadAsync(bytes);
  const files = await collectTextEntries(zip);
  if (files.length === 0) {
    throw new Error('ZIP contains no readable source files.');
  }

  const topEntry = chooseTopHdlEntry(files);
  if (!topEntry) {
    throw new Error('No HDL source found in ZIP (expected .vhd, .vhdl, .v, or .sv).');
  }
  const detectedTopLanguage = detectHdlLanguage(topEntry.path, topEntry.text);
  const parsedHdl =
    detectedTopLanguage === 'vhdl' ? parseVhdl(topEntry.text) : parseVerilog(topEntry.text);

  const xdcEntry = chooseXdcEntry(files);
  const xdcResult = xdcEntry ? parseXdcPins(xdcEntry.text) : undefined;

  const mappedPortNames = new Set(
    parsedHdl.ports.map((port) => normalizeToken(port.name))
  );
  const xdcPortWarnings =
    xdcResult?.pinMap
      ? Object.keys(xdcResult.pinMap)
          .filter((port) => !mappedPortNames.has(normalizeToken(port)))
          .sort(compareCodepoint)
          .map((port) => `Ignored XDC port "${port}" (no matching HDL port in detected top).`)
      : [];

  const project = buildImportedProject({
    sourceName,
    topPath: topEntry.path,
    topText: topEntry.text,
    parsedHdl,
    xdcPath: xdcEntry?.path,
    xdcText: xdcEntry?.text,
    xdcResult,
  });

  const selectedPaths = new Set<string>([topEntry.path, ...(xdcEntry ? [xdcEntry.path] : [])]);
  const ignoredFiles = files
    .map((entry) => entry.path)
    .filter((path) => !selectedPaths.has(path))
    .sort(compareCodepoint);

  const warnings = uniqueWarnings([
    ...(parsedHdl.warnings ?? []),
    ...parsedHdlToCircuit(parsedHdl).warnings,
    ...(xdcResult?.warnings ?? []),
    ...xdcPortWarnings,
  ]);

  const hdlEntries = files.filter((entry) => isHdlPath(entry.path));
  const hdlCandidates = [...hdlEntries]
    .sort(compareHdlEntry)
    .map((entry) => entry.path);

  const xdcEntries = files.filter((entry) => entry.path.toLowerCase().endsWith('.xdc'));
  const xdcCandidates = [...xdcEntries]
    .sort(compareXdcEntry)
    .map((entry) => entry.path);

  return {
    sourceName,
    detectedTopPath: topEntry.path,
    detectedTopLanguage,
    detectedXdcPath: xdcEntry?.path,
    detectedFiles: [topEntry.path, ...(xdcEntry ? [xdcEntry.path] : [])],
    ignoredFiles,
    hdlCandidates,
    xdcCandidates,
    parsedHdl,
    xdcResult,
    warnings,
    project,
  };
}

export function buildImportedProject(input: {
  sourceName: string;
  topPath: string;
  topText: string;
  parsedHdl: ParsedHDL;
  xdcPath?: string;
  xdcText?: string;
  xdcResult?: XdcParseResult;
}): RBProject {
  const converted = parsedHdlToCircuit(input.parsedHdl);
  const ioMapping = buildIoMapping(input.parsedHdl.ports, converted.circuit, input.xdcResult);
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
    circuit: converted.circuit,
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
      board: 'basys3',
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
      tags: ['import', 'vivado', 'basys3'],
    },
  };
}

async function collectTextEntries(zip: JSZip): Promise<ZipTextEntry[]> {
  const entries: ZipTextEntry[] = [];
  const paths = Object.keys(zip.files)
    .filter((path) => !zip.files[path]?.dir)
    .map(normalizePath)
    .sort(compareCodepoint);

  for (const path of paths) {
    const file = zip.file(path);
    if (!file) continue;
    const text = await file.async('string');
    entries.push({ path, text });
  }
  return entries;
}

function chooseTopHdlEntry(files: ZipTextEntry[]): ZipTextEntry | null {
  const hdlEntries = files.filter((entry) => isHdlPath(entry.path));
  if (hdlEntries.length === 0) return null;
  return [...hdlEntries].sort(compareHdlEntry)[0] ?? null;
}

function chooseXdcEntry(files: ZipTextEntry[]): ZipTextEntry | undefined {
  const xdcEntries = files.filter((entry) => entry.path.toLowerCase().endsWith('.xdc'));
  if (xdcEntries.length === 0) return undefined;
  return [...xdcEntries].sort(compareXdcEntry)[0];
}

function buildIoMapping(
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

function compareHdlEntry(left: ZipTextEntry, right: ZipTextEntry): number {
  const leftScore = topHdlScore(left.path);
  const rightScore = topHdlScore(right.path);
  if (leftScore !== rightScore) return leftScore - rightScore;

  const leftExt = extensionRank(left.path);
  const rightExt = extensionRank(right.path);
  if (leftExt !== rightExt) return leftExt - rightExt;

  const lengthDelta = left.path.length - right.path.length;
  if (lengthDelta !== 0) return lengthDelta;
  return compareCodepoint(left.path, right.path);
}

function compareXdcEntry(left: ZipTextEntry, right: ZipTextEntry): number {
  const leftPath = left.path.toLowerCase();
  const rightPath = right.path.toLowerCase();
  // Prefer files in Vivado constrs_* directories
  const leftConstrs = /(^|\/)constrs_\d+\//.test(leftPath);
  const rightConstrs = /(^|\/)constrs_\d+\//.test(rightPath);
  if (leftConstrs !== rightConstrs) return leftConstrs ? -1 : 1;
  // Then prefer top.xdc by name
  const leftTop = leftPath.endsWith('/top.xdc') || leftPath === 'top.xdc';
  const rightTop = rightPath.endsWith('/top.xdc') || rightPath === 'top.xdc';
  if (leftTop !== rightTop) return leftTop ? -1 : 1;
  // Then prefer basys3.xdc by name
  const leftBasys = leftPath.endsWith('/basys3.xdc') || leftPath === 'basys3.xdc';
  const rightBasys = rightPath.endsWith('/basys3.xdc') || rightPath === 'basys3.xdc';
  if (leftBasys !== rightBasys) return leftBasys ? -1 : 1;
  const lengthDelta = left.path.length - right.path.length;
  if (lengthDelta !== 0) return lengthDelta;
  return compareCodepoint(left.path, right.path);
}

function topHdlScore(path: string): number {
  const lower = path.toLowerCase();
  const file = lower.split('/').pop() ?? lower;
  const fileScore =
    file === 'top.vhd' || file === 'top.vhdl' || file === 'top.v' || file === 'top.sv'
      ? 0
      : file.startsWith('top.')
        ? 1
        : file.includes('top')
          ? 2
          : 3;
  // Files in sources_* dirs (Vivado project structure) sort before non-sources files at same level
  const inSourcesDir = /(^|\/)sources?_\d+\//.test(lower);
  return inSourcesDir ? fileScore : fileScore + 4;
}

function extensionRank(path: string): number {
  const lower = path.toLowerCase();
  if (lower.endsWith('.vhd')) return 0;
  if (lower.endsWith('.vhdl')) return 1;
  if (lower.endsWith('.v')) return 2;
  if (lower.endsWith('.sv')) return 3;
  return 9;
}

function isHdlPath(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    lower.endsWith('.vhd') ||
    lower.endsWith('.vhdl') ||
    lower.endsWith('.v') ||
    lower.endsWith('.sv')
  );
}

function detectHdlLanguage(path: string, text: string): 'vhdl' | 'verilog' {
  const lower = path.toLowerCase();
  if (lower.endsWith('.vhd') || lower.endsWith('.vhdl')) return 'vhdl';
  if (lower.endsWith('.v') || lower.endsWith('.sv')) return 'verilog';
  const normalized = text.toLowerCase();
  if (normalized.includes('entity') && normalized.includes('architecture')) return 'vhdl';
  return 'verilog';
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

function uniqueWarnings(rows: string[]): string[] {
  const deduped = new Set<string>();
  for (const row of rows) {
    const message = row.trim();
    if (!message) continue;
    deduped.add(message);
  }
  return Array.from(deduped).sort(compareCodepoint);
}

