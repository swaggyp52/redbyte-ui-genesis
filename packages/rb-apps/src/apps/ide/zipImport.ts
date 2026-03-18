import JSZip from 'jszip';
import type { RBProject } from '../../export/projectFormat';
import { decodeRBProject } from '../../export/projectFormat';
import { compareCodepoint } from '../../export/codepointSort';
import {
  type ParsedHDL,
  type ParsedPort,
  type ReconstructionLevel,
} from '../../import/hdlToCircuit';
import {
  buildImportedProjectCompilerResult,
  deriveProjectCompilerResult,
  type ImportDiagnostic,
  type ImportedProjectCompilerResult,
} from '../../import/importCompiler';
import { parseVerilog } from '../../import/verilogImport';
import { parseVhdl } from '../../import/vhdlImport';
import { parseXdcPins, type XdcParseResult } from '../../import/xdcImport';

const CLASSROOM_BOARD = 'basys3';
const CLASSROOM_PART = 'xc7a35tcpg236-1';

interface ZipTextEntry {
  path: string;
  text: string;
}

export interface ZipImportInspection {
  sourceName: string;
  importMode: 'manifest' | 'reconstructed';
  manifestPath?: string;
  detectedTopPath: string;
  detectedTopLanguage: 'vhdl' | 'verilog';
  detectedXdcPath?: string;
  detectedFiles: string[];
  ignoredFiles: string[];
  hdlCandidates: string[];
  xdcCandidates: string[];
  parsedHdl: ParsedHDL;
  xdcResult?: XdcParseResult;
  weakPinPorts: string[];
  warnings: string[];
  parserDiagnostics: ImportedProjectCompilerResult['parserDiagnostics'];
  compilerDiagnostics: ImportedProjectCompilerResult['compilerDiagnostics'];
  status: ImportedProjectCompilerResult['status'];
  isImportRunnable: boolean;
  reconstructionLevel: ReconstructionLevel;
  project: RBProject;
}

export async function importVivadoZipFile(file: File): Promise<ZipImportInspection> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return importVivadoZipBytes(bytes, { sourceName: file.name });
}

export async function reimportZipWithCandidates(
  file: File,
  hdlPath: string,
  xdcPath: string | null
): Promise<ZipImportInspection> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return importVivadoZipBytes(bytes, {
    sourceName: file.name,
    overrideTopPath: hdlPath,
    overrideXdcPath: xdcPath,
  });
}

export async function importVivadoZipBytes(
  bytes: Uint8Array,
  options?: {
    sourceName?: string;
    overrideTopPath?: string;
    overrideXdcPath?: string | null;
  }
): Promise<ZipImportInspection> {
  const sourceName = (options?.sourceName ?? 'vivado-import.zip').trim() || 'vivado-import.zip';
  const zip = await JSZip.loadAsync(bytes);
  const { entries, allPaths } = await collectReadableZipEntries(zip);
  if (allPaths.length === 0) {
    throw new Error('ZIP is empty.');
  }

  const manifestEntry = chooseManifestEntry(entries);
  if (manifestEntry) {
    return buildManifestInspection({
      sourceName,
      manifestEntry,
      entries,
      allPaths,
    });
  }

  const files = entries.filter((entry) => isImportSourcePath(entry.path));
  if (files.length === 0) {
    throw new Error(
      'ZIP contains no readable project files. Expected project.rbproj.json or HDL/XDC sources.'
    );
  }

  const autoTopEntry = chooseTopHdlEntry(files);
  if (!autoTopEntry) {
    throw new Error('No HDL source found in ZIP (expected .vhd, .vhdl, .v, or .sv).');
  }

  const topEntry = options?.overrideTopPath
    ? files.find((file) => file.path === options.overrideTopPath) ?? autoTopEntry
    : autoTopEntry;

  const detectedTopLanguage = detectHdlLanguage(topEntry.path, topEntry.text);
  const parsedHdl =
    detectedTopLanguage === 'vhdl' ? parseVhdl(topEntry.text) : parseVerilog(topEntry.text);

  const autoXdcEntry = chooseXdcEntry(files);
  const xdcEntry =
    options?.overrideXdcPath !== undefined
      ? options.overrideXdcPath !== null
        ? files.find((file) => file.path === options.overrideXdcPath) ?? undefined
        : undefined
      : autoXdcEntry;
  const xdcResult = xdcEntry ? parseXdcPins(xdcEntry.text) : undefined;

  const mappedPortNames = new Set(parsedHdl.ports.map((port) => normalizeToken(port.name)));
  const xdcPortWarnings =
    xdcResult?.pinMap
      ? Object.keys(xdcResult.pinMap)
          .filter((port) => !mappedPortNames.has(normalizeToken(port)))
          .sort(compareCodepoint)
          .map((port) => ({
            source: 'constraints' as const,
            severity: 'warning' as const,
            message: `Ignored XDC port "${port}" (no matching HDL port in detected top).`,
          }))
      : [];

  const compilerResult = buildImportedProjectCompilerResult({
    sourceName,
    topPath: topEntry.path,
    topText: topEntry.text,
    parsedHdl,
    xdcPath: xdcEntry?.path,
    xdcText: xdcEntry?.text,
    xdcResult,
    parserDiagnostics: [...xdcPortWarnings, ...collectXprDiagnostics(entries)],
  });

  const selectedPaths = new Set<string>([topEntry.path, ...(xdcEntry ? [xdcEntry.path] : [])]);
  const ignoredFiles = allPaths
    .filter((path) => !selectedPaths.has(path))
    .sort(compareCodepoint);

  const hdlEntries = files.filter((entry) => isHdlPath(entry.path));
  const hdlCandidates = [...hdlEntries].sort(compareHdlEntry).map((entry) => entry.path);
  const xdcEntries = files.filter((entry) => entry.path.toLowerCase().endsWith('.xdc'));
  const xdcCandidates = [...xdcEntries].sort(compareXdcEntry).map((entry) => entry.path);
  const weakPinPorts = collectWeakPinPorts(xdcResult);

  return {
    sourceName,
    importMode: 'reconstructed',
    detectedTopPath: autoTopEntry.path,
    detectedTopLanguage,
    detectedXdcPath: autoXdcEntry?.path,
    detectedFiles: [topEntry.path, ...(xdcEntry ? [xdcEntry.path] : [])],
    ignoredFiles,
    hdlCandidates,
    xdcCandidates,
    parsedHdl,
    xdcResult,
    weakPinPorts,
    warnings: compilerResult.parserDiagnostics.map((diagnostic) => diagnostic.message),
    parserDiagnostics: compilerResult.parserDiagnostics,
    compilerDiagnostics: compilerResult.compilerDiagnostics,
    status: compilerResult.status,
    isImportRunnable: compilerResult.isImportRunnable,
    reconstructionLevel: compilerResult.reconstructionLevel,
    project: compilerResult.project,
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
  /** Optional: preserve node positions from an existing canvas when re-importing */
  existingPositions?: Map<string, { x: number; y: number }>;
}): RBProject {
  return buildImportedProjectCompilerResult(input).project;
}

async function buildManifestInspection(input: {
  sourceName: string;
  manifestEntry: ZipTextEntry;
  entries: ZipTextEntry[];
  allPaths: string[];
}): Promise<ZipImportInspection> {
  let project: RBProject;
  try {
    project = decodeRBProject(input.manifestEntry.text);
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim().length > 0
        ? error.message.trim()
        : 'invalid manifest';
    throw new Error(
      `RedByte project manifest "${input.manifestEntry.path}" is corrupted or unsupported (${detail}). No files were changed.`
    );
  }

  const manifestTopSource = selectManifestTopSource(project);
  const manifestPreview = parseManifestHdl(project, manifestTopSource);
  const parsedHdl = manifestPreview.parsedHdl;
  const xdcText = project.fpga?.constraints?.text?.trim() ?? '';
  const xdcResult = xdcText.length > 0 ? parseXdcPins(xdcText) : undefined;
  const zipTopEntry = chooseTopHdlEntry(input.entries.filter((entry) => isHdlPath(entry.path)));
  const zipXdcEntry = chooseXdcEntry(input.entries);
  const detectedFiles = [input.manifestEntry.path];
  const parserDiagnostics: ImportDiagnostic[] = [
    {
      source: 'manifest',
      severity: 'warning',
      message: `Imported from RedByte project manifest "${input.manifestEntry.path}".`,
    },
    ...(project.fpga?.board && project.fpga.board !== CLASSROOM_BOARD
      ? [
          {
            source: 'manifest' as const,
            severity: 'warning' as const,
            message: `Manifest targets board "${project.fpga.board}". Classroom target is "${CLASSROOM_BOARD}".`,
          },
        ]
      : []),
    ...(zipTopEntry &&
    manifestTopSource &&
    normalizeNewlines(zipTopEntry.text) !== normalizeNewlines(manifestTopSource.text)
      ? [
          {
            source: 'manifest' as const,
            severity: 'warning' as const,
            message: `ZIP HDL "${zipTopEntry.path}" differs from the embedded RedByte manifest. RedByte restored the manifest version.`,
          },
        ]
      : []),
    ...(zipXdcEntry && xdcText.length > 0 && normalizeNewlines(zipXdcEntry.text) !== normalizeNewlines(xdcText)
      ? [
          {
            source: 'manifest' as const,
            severity: 'warning' as const,
            message: `ZIP constraints "${zipXdcEntry.path}" differ from the embedded RedByte manifest. RedByte restored the manifest version.`,
          },
        ]
      : []),
    ...(manifestPreview.previewDiagnostics.length > 0
      ? manifestPreview.previewDiagnostics
      : manifestTopSource
      ? [
          {
            source: 'manifest' as const,
            severity: 'warning' as const,
            message: `Restored HDL source "${manifestTopSource.path}" from the manifest.`,
          },
        ]
      : []),
    ...(xdcText.length > 0
      ? [
          {
            source: 'manifest' as const,
            severity: 'warning' as const,
            message: 'Restored XDC constraints from the manifest.',
          },
        ]
      : []),
    ...(parsedHdl.warnings ?? []).map((warning) => ({
      source: 'parser' as const,
      severity: 'warning' as const,
      message: warning.message,
    })),
    ...(xdcResult?.warnings ?? []).map((warning) => ({
      source: 'constraints' as const,
      severity: 'warning' as const,
      message: warning,
    })),
    ...collectXprDiagnostics(input.entries),
  ];
  const compilerResult = deriveProjectCompilerResult(project, {
    parsedHdl,
    parseStatus: manifestPreview.parseStatus,
    parserDiagnostics,
  });

  return {
    sourceName: input.sourceName,
    importMode: 'manifest',
    manifestPath: input.manifestEntry.path,
    detectedTopPath: manifestTopSource?.path ?? input.manifestEntry.path,
    detectedTopLanguage: parsedHdl.lang,
    detectedXdcPath: xdcText.length > 0 ? zipXdcEntry?.path ?? 'embedded constraints' : undefined,
    detectedFiles,
    ignoredFiles: input.allPaths
      .filter((path) => !detectedFiles.includes(path))
      .sort(compareCodepoint),
    hdlCandidates: manifestTopSource ? [manifestTopSource.path] : [],
    xdcCandidates: zipXdcEntry ? [zipXdcEntry.path] : [],
    parsedHdl,
    xdcResult,
    weakPinPorts: collectWeakPinPorts(xdcResult),
    warnings: compilerResult.parserDiagnostics.map((diagnostic) => diagnostic.message),
    parserDiagnostics: compilerResult.parserDiagnostics,
    compilerDiagnostics: compilerResult.compilerDiagnostics,
    status: compilerResult.status,
    isImportRunnable: compilerResult.isImportRunnable,
    reconstructionLevel: compilerResult.reconstructionLevel,
    project,
  };
}

async function collectReadableZipEntries(zip: JSZip): Promise<{
  entries: ZipTextEntry[];
  allPaths: string[];
}> {
  const entries: ZipTextEntry[] = [];
  const allPaths = Object.keys(zip.files)
    .filter((path) => !zip.files[path]?.dir)
    .map(normalizePath)
    .sort(compareCodepoint);

  for (const path of allPaths) {
    if (!shouldReadZipText(path)) {
      continue;
    }
    const file = zip.file(path);
    if (!file) continue;
    const text = await file.async('string');
    entries.push({ path, text });
  }

  return { entries, allPaths };
}

function chooseManifestEntry(entries: ZipTextEntry[]): ZipTextEntry | undefined {
  return [...entries]
    .filter((entry) => baseName(entry.path) === 'project.rbproj.json')
    .sort((left, right) => {
      const lengthDelta = left.path.length - right.path.length;
      if (lengthDelta !== 0) return lengthDelta;
      return compareCodepoint(left.path, right.path);
    })[0];
}

function shouldReadZipText(path: string): boolean {
  const lower = path.toLowerCase();
  if (
    lower.endsWith('.vhd') ||
    lower.endsWith('.vhdl') ||
    lower.endsWith('.v') ||
    lower.endsWith('.sv') ||
    lower.endsWith('.xdc') ||
    lower.endsWith('.tcl') ||
    lower.endsWith('.xpr')
  ) {
    return true;
  }
  const fileName = baseName(lower);
  return (
    fileName === 'project.rbproj.json' ||
    fileName === 'expected_io.json' ||
    fileName === 'readme.txt'
  );
}

function isImportSourcePath(path: string): boolean {
  const lower = path.toLowerCase();
  return isHdlPath(lower) || lower.endsWith('.xdc') || lower.endsWith('.xpr');
}

function parseManifestHdl(
  project: RBProject,
  source:
    | {
        path: string;
        text: string;
        language: 'vhdl' | 'verilog';
      }
    | undefined
): {
  parsedHdl: ParsedHDL;
  previewDiagnostics: ImportDiagnostic[];
  parseStatus: 'success' | 'failure';
} {
  if (source && source.text.trim().length > 0) {
    try {
      return {
        parsedHdl: source.language === 'vhdl' ? parseVhdl(source.text) : parseVerilog(source.text),
        previewDiagnostics: [],
        parseStatus: 'success',
      };
    } catch (error) {
      const detail =
        error instanceof Error && error.message.trim().length > 0
          ? error.message.trim()
          : 'parse failed';
      return {
        parsedHdl: buildManifestFallbackParsedHdl(project, source.language),
        previewDiagnostics: [
          {
            source: 'manifest',
            severity: 'warning',
            message: `Manifest HDL source "${source.path}" could not be parsed for preview (${detail}). RedByte restored the manifest project and derived ports from project IO metadata.`,
          },
        ],
        parseStatus: 'failure',
      };
    }
  }

  return {
    parsedHdl: buildManifestFallbackParsedHdl(project, 'vhdl'),
    previewDiagnostics: [
      {
        source: 'manifest',
        severity: 'warning',
        message: 'Manifest does not include a top HDL source; the preview is using project IO metadata only.',
      },
    ],
    parseStatus: 'failure',
  };
}

function buildManifestFallbackParsedHdl(
  project: RBProject,
  language: 'vhdl' | 'verilog'
): ParsedHDL {
  const topEntity = sanitizeIdentifier(project.hdl?.top ?? project.fpga?.top ?? 'top');
  const ports = collectManifestPreviewPorts(project);
  return {
    entityName: topEntity,
    ports,
    instances: [],
    signals: [],
    warnings:
      ports.length === 0
        ? [{ message: 'Manifest preview could not derive top-level ports.' }]
        : [],
    lang: language,
  };
}

function collectManifestPreviewPorts(project: RBProject): ParsedPort[] {
  const ports: ParsedPort[] = [
    ...(project.ioMapping?.inputs ?? []).map((entry) => ({
      name: (entry.label ?? entry.id).trim() || entry.id,
      direction: 'in' as const,
      typeName: 'STD_LOGIC',
    })),
    ...(project.ioMapping?.outputs ?? []).map((entry) => ({
      name: (entry.label ?? entry.id).trim() || entry.id,
      direction: 'out' as const,
      typeName: 'STD_LOGIC',
    })),
  ];

  if (ports.length > 0) {
    return dedupePreviewPorts(ports);
  }

  const circuitPorts: ParsedPort[] = (project.circuit?.nodes ?? [])
    .filter((node) => node.type === 'INPUT' || node.type === 'OUTPUT')
    .map((node) => ({
      name: String(node.label ?? node.id).trim() || node.id,
      direction: node.type === 'INPUT' ? ('in' as const) : ('out' as const),
      typeName: 'STD_LOGIC',
    }));

  return dedupePreviewPorts(circuitPorts);
}

function dedupePreviewPorts(ports: ParsedPort[]): ParsedPort[] {
  const seen = new Set<string>();
  const deduped: ParsedPort[] = [];
  for (const port of [...ports].sort((left, right) => compareCodepoint(left.name, right.name))) {
    const key = `${port.direction}:${normalizeToken(port.name)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(port);
  }
  return deduped;
}

function selectManifestTopSource(project: RBProject):
  | { path: string; text: string; language: 'vhdl' | 'verilog' }
  | undefined {
  const sources = project.hdl?.sources ?? [];
  if (sources.length === 0) return undefined;

  const targetTop = normalizeToken(project.hdl?.top ?? project.fpga?.top ?? '');
  const ranked = [...sources]
    .filter((source) => typeof source.text === 'string' && source.text.trim().length > 0)
    .sort((left, right) => {
      const leftScore = manifestTopSourceScore(left.path, targetTop);
      const rightScore = manifestTopSourceScore(right.path, targetTop);
      if (leftScore !== rightScore) return leftScore - rightScore;
      return compareCodepoint(left.path, right.path);
    });

  const selected = ranked[0];
  if (!selected) return undefined;

  return {
    path: normalizePath(selected.path),
    text: selected.text,
    language: selected.language === 'verilog' ? 'verilog' : 'vhdl',
  };
}

function manifestTopSourceScore(path: string, targetTop: string): number {
  const normalizedPath = normalizePath(path);
  const file = baseName(normalizedPath);
  const stem = file.replace(/\.[^.]+$/, '');
  if (targetTop.length > 0 && stem.toLowerCase() === targetTop) return 0;
  if (file === 'top.vhd' || file === 'top.vhdl' || file === 'top.v' || file === 'top.sv') return 1;
  if (stem.toLowerCase().includes(targetTop) && targetTop.length > 0) return 2;
  return 3;
}

function collectWeakPinPorts(xdcResult: XdcParseResult | undefined): string[] {
  return xdcResult?.pinEntries
    ? Object.entries(xdcResult.pinEntries)
        .filter(([, entry]) => entry.confidence === 'weak')
        .map(([portName]) => portName)
        .sort(compareCodepoint)
    : [];
}

function collectXprDiagnostics(entries: ZipTextEntry[]): ImportDiagnostic[] {
  const xprParts = entries
    .filter((entry) => entry.path.toLowerCase().endsWith('.xpr'))
    .map((entry) => ({
      path: entry.path,
      part: extractVivadoPart(entry.text),
    }))
    .filter((entry): entry is { path: string; part: string } => typeof entry.part === 'string');

  return xprParts
    .filter((entry) => normalizeToken(entry.part) !== CLASSROOM_PART)
    .map((entry) => ({
      source: 'archive' as const,
      severity: 'warning' as const,
      message: `Vivado project "${entry.path}" targets part "${entry.part}". RedByte import assumes ${CLASSROOM_PART}.`,
    }))
    .sort((left, right) => compareCodepoint(left.message, right.message));
}

function extractVivadoPart(text: string): string | undefined {
  const match = text.match(/<Option\s+Name="Part"\s+Val="([^"]+)"/i);
  const part = match?.[1]?.trim();
  return part && part.length > 0 ? part : undefined;
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
  const leftConstrs = /(^|\/)constrs_\d+\//.test(leftPath);
  const rightConstrs = /(^|\/)constrs_\d+\//.test(rightPath);
  if (leftConstrs !== rightConstrs) return leftConstrs ? -1 : 1;
  const leftTop = leftPath.endsWith('/top.xdc') || leftPath === 'top.xdc';
  const rightTop = rightPath.endsWith('/top.xdc') || rightPath === 'top.xdc';
  if (leftTop !== rightTop) return leftTop ? -1 : 1;
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

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function baseName(path: string): string {
  return normalizePath(path).split('/').pop()?.toLowerCase() ?? '';
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
