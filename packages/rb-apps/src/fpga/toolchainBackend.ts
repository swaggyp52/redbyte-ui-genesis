import { stableStringify } from '../export/stableStringify';
import { buildDoctorReportV2, type DoctorReportV2 } from './doctorReportV2';
import { mapHardwareErrorCode } from './hardwareErrorTaxonomy';
import { lintBasys3ProjectPorts } from './boards/basys3/portLint';
import { basys3TopModuleContract } from './boards/basys3/basys3Contract';
import type {
  BuildLogEntry,
  TargetBoardId,
  ToolchainPreflightStatus,
  ToolProbeResult,
  ToolProbeTool,
  ToolchainBackendId,
  ToolchainPreflightProjectSummary,
  ToolchainPreflightLintSummary,
  ToolchainLogLevel,
  ToolchainStep,
  ToolchainDoctorReport,
  StudentReadinessGate,
  StudentReadinessSummary,
  ToolchainRunState,
  BoardDetectResult,
  BuildpackInstallRequest,
  BuildpackRemoveResult,
  BuildpackRunDoneSummary,
  BuildpackRunStatus,
  BuildpackStatusResult,
  BuildpackToolStatus,
  SynthRequest,
  SynthRunStatus,
  SynthRunDoneSummary,
  SynthArtifactRef,
  ImplementPlanResult,
  ImplementPlanRequest,
  ImplementPlanBackend,
  ImplementPlanBuildpackRef,
  ImplementPlanRequiredTool,
  ImplementPlanCommand,
  ImplementPlanOutput,
  ToolchainBuildPath,
  ImplementRunRequest,
  ImplementRunStatus,
  ImplementRunDoneSummary,
  ImplementArtifactRef,
} from './toolchainTypes';

export type {
  BuildLogEntry,
  TargetBoardId,
  ToolchainPreflightStatus,
  ToolProbeResult,
  ToolProbeTool,
  ToolchainBackendId,
  ToolchainPreflightProjectSummary,
  ToolchainPreflightLintSummary,
  ToolchainLogLevel,
  ToolchainStep,
  ToolchainDoctorReport,
  StudentReadinessGate,
  StudentReadinessSummary,
  ToolchainRunState,
  BoardDetectResult,
  BuildpackInstallRequest,
  BuildpackRemoveResult,
  BuildpackRunDoneSummary,
  BuildpackRunStatus,
  BuildpackStatusResult,
  BuildpackToolStatus,
  SynthRequest,
  SynthRunStatus,
  SynthRunDoneSummary,
  SynthArtifactRef,
  ImplementPlanResult,
  ImplementPlanRequest,
  ImplementPlanBackend,
  ImplementPlanBuildpackRef,
  ImplementPlanRequiredTool,
  ImplementPlanCommand,
  ImplementPlanOutput,
  ToolchainBuildPath,
  ImplementRunRequest,
  ImplementRunStatus,
  ImplementRunDoneSummary,
  ImplementArtifactRef,
} from './toolchainTypes';

export type HdlLanguage = 'verilog' | 'vhdl';

export interface HdlSource {
  path: string;
  language: HdlLanguage;
  text: string;
}

export interface ToolchainProjectInput {
  sources: HdlSource[];
  top?: string;
}

export interface ToolchainFpgaConstraintsInput {
  type: 'xdc';
  text: string;
}

export interface ToolchainFpgaInput {
  board: TargetBoardId;
  constraints?: ToolchainFpgaConstraintsInput;
  preset?: string;
  top?: string;
}

export interface ToolchainProjectSnapshotInput {
  hdl?: ToolchainProjectInput;
  fpga?: ToolchainFpgaInput;
}

export interface NetlistArtifact {
  kind: 'netlist';
  backend: ToolchainBackendId;
  format: 'stub';
}

export interface ImplementedArtifact {
  kind: 'implemented';
  backend: ToolchainBackendId;
  format: 'stub';
}

export interface BitstreamArtifact {
  kind: 'bitstream';
  backend: ToolchainBackendId;
  format: 'stub';
  bitstreamBase64?: string;
}

export interface ProgramResult {
  ok: boolean;
  backend: ToolchainBackendId;
}

export interface ProgramBitstreamInput {
  board: TargetBoardId;
  mode: 'sram';
  bitstream: {
    kind: 'base64';
    data: string;
  };
}

export interface ProgramBitstreamResult {
  ok: boolean;
  runId: string;
  artifactId: string;
  logs: BuildLogEntry[];
  state?: ToolchainRunState;
  nextOffset?: number;
  error?: string;
  activeRunId?: string;
}

export interface ProgramRunStatusResult {
  runId: string;
  artifactId: string;
  state: ToolchainRunState;
  ok: boolean | null;
  exitCode: number | null;
  logs: BuildLogEntry[];
  nextOffset: number;
  error?: string;
}

export interface ProgramRunDoneSummary {
  runId: string;
  artifactId: string;
  state: Exclude<ToolchainRunState, 'running'>;
  ok: boolean;
  exitCode: number | null;
  nextOffset: number;
  error?: string;
}

export interface ProgramRunStreamHandlers {
  onLog?: (entry: BuildLogEntry) => void;
  onDone?: (summary: ProgramRunDoneSummary) => void;
  onError?: (errorCode: string) => void;
}

export interface ProgramRunStreamSubscription {
  close: () => void;
}

export interface SynthRunStreamHandlers {
  onLog?: (entry: BuildLogEntry) => void;
  onDone?: (summary: SynthRunDoneSummary) => void;
  onError?: (errorCode: string) => void;
}

export interface SynthRunStreamSubscription {
  close: () => void;
}

export interface ImplementRunStreamHandlers {
  onLog?: (entry: BuildLogEntry) => void;
  onDone?: (summary: ImplementRunDoneSummary) => void;
  onError?: (errorCode: string) => void;
}

export interface ImplementRunStreamSubscription {
  close: () => void;
}

export interface BuildpackRunStreamHandlers {
  onLog?: (entry: BuildLogEntry) => void;
  onDone?: (summary: BuildpackRunDoneSummary) => void;
  onError?: (errorCode: string) => void;
}

export interface BuildpackRunStreamSubscription {
  close: () => void;
}

export interface SynthArtifactDownload {
  filename: string;
  bytes: Uint8Array;
}

export interface SynthArtifactDownloadOptions {
  includeSources?: boolean;
}

export interface ImplementArtifactDownload {
  filename: string;
  bytes: Uint8Array;
}

export interface ImplementArtifactDownloadOptions {
  includeSources?: boolean;
}

export interface ImplementBitstreamOutput {
  runId: string;
  artifactId: string;
  filename: string;
  bitstream: {
    kind: 'base64';
    data: string;
  };
  output?: {
    kind: 'bitstream' | 'report' | 'output';
    name?: string;
  };
}

export interface ToolchainLogSink {
  log: (entry: BuildLogEntry) => void;
}

export interface ToolchainDoctorReportOptions {
  refreshProbe?: boolean;
  logs?: BuildLogEntry[];
  probe?: ToolProbeResult | null;
  preflight?: ToolchainPreflightStatus | null;
  buildPath?: ToolchainBuildPath | null;
}

export interface ToolchainBackend {
  id: ToolchainBackendId;
  synthesize: (input: ToolchainProjectInput, sink?: ToolchainLogSink) => Promise<NetlistArtifact>;
  implement: (netlist: NetlistArtifact, sink?: ToolchainLogSink) => Promise<ImplementedArtifact>;
  bitgen: (implemented: ImplementedArtifact, sink?: ToolchainLogSink) => Promise<BitstreamArtifact>;
  program: (bitstream: BitstreamArtifact, board: TargetBoardId, sink?: ToolchainLogSink) => Promise<ProgramResult>;
  probeTools: () => Promise<ToolProbeResult>;
  preflight: (
    snapshot: ToolchainProjectSnapshotInput,
    options?: { refreshProbe?: boolean }
  ) => Promise<ToolchainPreflightStatus>;
  resolveBuildPath: (
    snapshot: ToolchainProjectSnapshotInput,
    options?: { refreshProbe?: boolean }
  ) => Promise<ToolchainBuildPath>;
  implementPlan: (
    snapshot: ToolchainProjectSnapshotInput,
    options?: { refreshProbe?: boolean }
  ) => Promise<ImplementPlanResult>;
  synth: (input: SynthRequest) => Promise<SynthRunStatus>;
  getSynthRunStatus: (runId: string, offset?: number) => Promise<SynthRunStatus>;
  openSynthRunStream: (
    runId: string,
    handlers: SynthRunStreamHandlers,
    options?: { offset?: number }
  ) => SynthRunStreamSubscription | null;
  downloadSynthArtifacts: (runId: string, options?: SynthArtifactDownloadOptions) => Promise<SynthArtifactDownload>;
  implementRun: (input: ImplementRunRequest) => Promise<ImplementRunStatus>;
  getImplementRunStatus: (runId: string, offset?: number) => Promise<ImplementRunStatus>;
  openImplementRunStream: (
    runId: string,
    handlers: ImplementRunStreamHandlers,
    options?: { offset?: number }
  ) => ImplementRunStreamSubscription | null;
  downloadImplementArtifacts: (
    runId: string,
    options?: ImplementArtifactDownloadOptions
  ) => Promise<ImplementArtifactDownload>;
  getImplementBitstream: (runId: string) => Promise<ImplementBitstreamOutput>;
  programImplementBitstream: (runId: string, options?: { board?: TargetBoardId; mode?: 'sram' }) => Promise<ProgramBitstreamResult>;
  programBitstream: (input: ProgramBitstreamInput) => Promise<ProgramBitstreamResult>;
  getRunStatus: (runId: string, offset?: number) => Promise<ProgramRunStatusResult>;
  cancelRun: (runId: string) => Promise<ProgramRunStatusResult>;
  detectBoards: () => Promise<BoardDetectResult>;
  getBuildpackStatus: () => Promise<BuildpackStatusResult>;
  installBuildpack: (input: BuildpackInstallRequest) => Promise<BuildpackRunStatus>;
  getBuildpackRunStatus: (runId: string, offset?: number) => Promise<BuildpackRunStatus>;
  openBuildpackRunStream: (
    runId: string,
    handlers: BuildpackRunStreamHandlers,
    options?: { offset?: number }
  ) => BuildpackRunStreamSubscription | null;
  removeBuildpack: (name: string, version: string) => Promise<BuildpackRemoveResult>;
  openRunStream: (
    runId: string,
    handlers: ProgramRunStreamHandlers,
    options?: { offset?: number }
  ) => ProgramRunStreamSubscription | null;
  doctorReport: (
    snapshot: ToolchainProjectSnapshotInput,
    options?: ToolchainDoctorReportOptions
  ) => Promise<ToolchainDoctorReport>;
  doctorReportV2: () => Promise<DoctorReportV2>;
}

export function isToolchainProjectInput(value: unknown): value is ToolchainProjectInput {
  if (!value || typeof value !== 'object') return false;
  const v = value as { sources?: unknown; top?: unknown };
  if (!Array.isArray(v.sources)) return false;
  for (const src of v.sources) {
    if (!src || typeof src !== 'object') return false;
    const s = src as { path?: unknown; language?: unknown; text?: unknown };
    if (typeof s.path !== 'string' || s.path.trim().length === 0) return false;
    if (s.language !== 'verilog' && s.language !== 'vhdl') return false;
    if (typeof s.text !== 'string') return false;
  }
  if (v.top !== undefined && typeof v.top !== 'string') return false;
  return true;
}

type LegacyToolchainProjectInput = {
  kind: 'hdl';
  language: HdlLanguage;
  files: Record<string, string>;
  topModule?: string;
};

function isLegacyToolchainProjectInput(value: unknown): value is LegacyToolchainProjectInput {
  if (!value || typeof value !== 'object') return false;
  const v = value as { kind?: unknown; language?: unknown; files?: unknown; topModule?: unknown };
  if (v.kind !== 'hdl') return false;
  if (v.language !== 'verilog' && v.language !== 'vhdl') return false;
  if (!v.files || typeof v.files !== 'object') return false;
  for (const entry of Object.entries(v.files as Record<string, unknown>)) {
    const [fileName, text] = entry;
    if (typeof fileName !== 'string' || fileName.trim().length === 0) return false;
    if (typeof text !== 'string') return false;
  }
  if (v.topModule !== undefined && typeof v.topModule !== 'string') return false;
  return true;
}

export function coerceToolchainProjectInput(value: unknown): ToolchainProjectInput | null {
  if (isToolchainProjectInput(value)) return value;
  if (isLegacyToolchainProjectInput(value)) {
    const fileNames = Object.keys(value.files ?? {}).filter(Boolean).sort();
    const sources = fileNames.map((path) => ({
      path,
      language: value.language,
      text: value.files[path] ?? '',
    }));
    return { sources, top: value.topModule };
  }
  return null;
}

function normalizeSources(input: ToolchainProjectInput | undefined): HdlSource[] {
  if (!input) return [];
  return [...(input.sources ?? [])]
    .filter((source) => typeof source.path === 'string' && source.path.trim().length > 0)
    .map((source) => ({
      path: source.path,
      language: source.language === 'vhdl' ? 'vhdl' : 'verilog',
      text: source.text ?? '',
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function normalizeTop(inputTop: string | undefined, fpgaTop: string | undefined): string | null {
  const top = (inputTop ?? fpgaTop ?? '').trim();
  return top.length > 0 ? top : null;
}

function normalizeFpgaInput(fpga: ToolchainFpgaInput | undefined): ToolchainFpgaInput {
  const board = fpga?.board === 'basys3' ? 'basys3' : 'basys3';
  const constraintsText = fpga?.constraints?.type === 'xdc' ? fpga.constraints.text ?? '' : '';
  const constraints = constraintsText.trim().length > 0 ? { type: 'xdc' as const, text: constraintsText } : undefined;
  const preset = typeof fpga?.preset === 'string' && fpga.preset.trim().length > 0 ? fpga.preset.trim() : undefined;
  const top = typeof fpga?.top === 'string' && fpga.top.trim().length > 0 ? fpga.top.trim() : undefined;
  return { board, constraints, preset, top };
}

function normalizeSnapshotInput(input: ToolchainProjectSnapshotInput): Required<ToolchainProjectSnapshotInput> {
  const normalizedHdl: ToolchainProjectInput = {
    sources: normalizeSources(input.hdl),
    top: normalizeTop(input.hdl?.top, input.fpga?.top) ?? undefined,
  };
  const normalizedFpga = normalizeFpgaInput(input.fpga);
  return {
    hdl: normalizedHdl,
    fpga: normalizedFpga,
  };
}

function normalizeBackendId(raw: unknown): ToolchainBackendId {
  return raw === 'open' ? 'open' : 'vivado';
}

export function getToolchainBackendId(): ToolchainBackendId {
  // Browser: Vite exposes only VITE_* env vars
  const vite = (import.meta as any)?.env?.VITE_RB_TOOLCHAIN_BACKEND;
  // Node (future): allow non-VITE env var name as requested by the spec prompt
  const proc = typeof process !== 'undefined' ? (process as any)?.env?.RB_TOOLCHAIN_BACKEND : undefined;
  return normalizeBackendId(typeof vite === 'string' ? vite : typeof proc === 'string' ? proc : 'vivado');
}

let toolchainRunSeq = 0;
const BRIDGE_URL = 'http://127.0.0.1:4242';
const lastProbeByBackend: Partial<Record<ToolchainBackendId, ToolProbeResult>> = {};
const TOOLCHAIN_PLANNER_VERSION = 'toolchain_planner_v1' as const;
const buildPathCacheByBackend: Partial<Record<ToolchainBackendId, Map<string, ToolchainBuildPath>>> = {};
const lastBuildPathByBackend: Partial<Record<ToolchainBackendId, ToolchainBuildPath>> = {};
const buildPathInputKeyByBackend: Partial<Record<ToolchainBackendId, Map<string, string>>> = {};

function createRunId(prefix: string): string {
  const next = toolchainRunSeq++;
  return `${prefix}-${next}`;
}

function deterministicId(prefix: string, payload: unknown): string {
  const text = stableStringify(payload);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function normalizeBitstreamBase64(raw: string): string {
  return raw.trim().replace(/^data:.*;base64,/, '');
}

function normalizeSynthTop(top: string): string | null {
  const value = typeof top === 'string' ? top.trim() : '';
  return /^[A-Za-z_][A-Za-z0-9_$]*$/.test(value) ? value : null;
}

function normalizeSynthSourcePath(pathValue: string): string | null {
  if (typeof pathValue !== 'string') return null;
  let value = pathValue.trim().replace(/\\/g, '/');
  if (!value) return null;
  if (value.startsWith('/') || /^[A-Za-z]:/.test(value)) return null;
  while (value.startsWith('./')) value = value.slice(2);
  const segments = value
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  if (segments.length === 0) return null;
  if (segments.some((segment) => segment === '.' || segment === '..')) return null;
  return segments
    .map((segment) => {
      const sanitized = segment.replace(/[^a-zA-Z0-9._-]/g, '_');
      return sanitized.length > 0 ? sanitized : '_';
    })
    .join('/');
}

function normalizeSynthRequest(input: SynthRequest): SynthRequest {
  const top = normalizeSynthTop(input.top) ?? 'top';
  const sources = Array.isArray(input.sources)
    ? input.sources
        .map((source) => ({
          path: normalizeSynthSourcePath(source?.path ?? '') ?? '',
          language: source?.language === 'verilog' ? 'verilog' : 'verilog',
          text: typeof source?.text === 'string' ? source.text : '',
        }))
        .filter((source) => source.path.length > 0)
    : [];
  sources.sort((left, right) => left.path.localeCompare(right.path));
  return {
    board: input.board === 'basys3' ? 'basys3' : 'basys3',
    top,
    sources,
  };
}

const SYNTH_SCRIPT_VERSION = 'rb_yosys_synth_v1';

export function deriveSynthArtifactId(input: SynthRequest, yosysVersion?: string | null): string {
  const normalized = normalizeSynthRequest(input);
  return deterministicId('toolchain-synth', {
    board: normalized.board,
    top: normalized.top,
    yosysVersion: typeof yosysVersion === 'string' ? yosysVersion : null,
    scriptVersion: SYNTH_SCRIPT_VERSION,
    sources: normalized.sources.map((source) => ({
      path: source.path,
      text: source.text,
    })),
  });
}

export function encodeSynthRequestPayload(input: SynthRequest) {
  const normalized = normalizeSynthRequest(input);
  const rawBuildPath = input.buildPath;
  const planId = typeof rawBuildPath?.planId === 'string' ? rawBuildPath.planId.trim() : '';
  const backend = normalizeImplementPlanBackend(rawBuildPath?.backend);
  const buildPath =
    planId.length > 0
      ? {
          planId,
          backend,
        }
      : undefined;
  return {
    board: normalized.board,
    top: normalized.top,
    sources: normalized.sources,
    ...(buildPath ? { buildPath } : {}),
  };
}

export function deriveProgramBitstreamRunId(input: ProgramBitstreamInput): string {
  const artifactId = deriveProgramBitstreamArtifactId(input);
  return createRunId(`${artifactId}-run`);
}

export function deriveProgramBitstreamArtifactId(input: ProgramBitstreamInput): string {
  const normalizedData = normalizeBitstreamBase64(input.bitstream.data);
  const bitstreamHash = deterministicId('bitstream', normalizedData);
  return deterministicId('program-bitstream', {
    board: input.board,
    mode: input.mode,
    bitstreamHash,
  });
}

export function encodeProgramBitstreamRequestPayload(input: ProgramBitstreamInput) {
  return {
    board: input.board,
    mode: input.mode,
    bitstream: {
      kind: 'base64' as const,
      data: normalizeBitstreamBase64(input.bitstream.data),
    },
  };
}

function makeEntrySink(run_id: string, sink?: ToolchainLogSink) {
  let ts = 0;
  const entries: BuildLogEntry[] = [];
  const emit = (event: { step: ToolchainStep; level: ToolchainLogLevel; msg: string; data?: Record<string, unknown> }) => {
    const entry: BuildLogEntry = { run_id, ts: ts++, ...event };
    entries.push(entry);
    sink?.log(entry);
  };
  return { entries, emit };
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number, init?: RequestInit) {
  const hasAbort = typeof AbortController !== 'undefined';
  const controller = hasAbort ? new AbortController() : null;
  const timeoutId =
    controller && timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const requestInit = controller ? { ...(init ?? {}), signal: controller.signal } : init;
    const res = await fetch(url, requestInit);
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function parseContentDispositionFilename(headerValue: string | null | undefined, fallback: string): string {
  if (!headerValue || typeof headerValue !== 'string') return fallback;
  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      // ignore decode failures
    }
  }
  const plainMatch = headerValue.match(/filename=\"?([^\";]+)\"?/i);
  if (plainMatch?.[1]) return plainMatch[1];
  return fallback;
}

function isToolProbeResult(value: unknown): value is ToolProbeResult {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<ToolProbeResult>;
  return (
    v.schema_version === 'toolchain_probe_v1' &&
    typeof v.run_id === 'string' &&
    Array.isArray(v.tools) &&
    Array.isArray(v.logs)
  );
}

function isToolchainPreflightStatus(value: unknown): value is ToolchainPreflightStatus {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<ToolchainPreflightStatus>;
  return (
    v.schema_version === 'toolchain_preflight_v1' &&
    typeof v.run_id === 'string' &&
    typeof v.ts === 'number' &&
    typeof v.overallOk === 'boolean' &&
    !!v.project &&
    !!v.lint &&
    Array.isArray(v.tools)
  );
}

function sortToolsByName(tools: ToolProbeTool[]): ToolProbeTool[] {
  return [...tools].sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeToolAlternate(
  alternate: NonNullable<ToolProbeTool['alternates']>[number]
): NonNullable<ToolProbeTool['alternates']>[number] {
  const source =
    alternate?.source === 'bundled' ||
    alternate?.source === 'buildpack' ||
    alternate?.source === 'system' ||
    alternate?.source === 'not_found' ||
    alternate?.source === 'found_not_in_path'
      ? alternate.source
      : 'not_found';
  const status =
    alternate?.status === 'ok' || alternate?.status === 'found_not_in_path' || alternate?.status === 'missing'
      ? alternate.status
      : source === 'found_not_in_path'
        ? 'found_not_in_path'
        : source === 'not_found'
          ? 'missing'
          : 'ok';
  const integrity =
    source === 'bundled' || source === 'buildpack'
      ? alternate?.integrity === 'verified' || alternate?.integrity === 'corrupt' || alternate?.integrity === 'unknown'
        ? alternate.integrity
        : 'unknown'
      : 'unknown';

  return {
    source,
    status,
    integrity,
    ...(typeof alternate?.version === 'string' ? { version: alternate.version } : {}),
    ...(typeof alternate?.path === 'string' ? { path: alternate.path } : {}),
    ...(typeof alternate?.error === 'string' ? { error: alternate.error } : {}),
    ...(typeof alternate?.buildpackName === 'string' ? { buildpackName: alternate.buildpackName } : {}),
    ...(typeof alternate?.buildpackVersion === 'string' ? { buildpackVersion: alternate.buildpackVersion } : {}),
  };
}

function normalizeProbeTool(tool: ToolProbeTool): ToolProbeTool {
  const status =
    tool.status === 'ok' || tool.status === 'found_not_in_path' || tool.status === 'missing'
      ? tool.status
      : tool.ok
        ? 'ok'
        : 'missing';
  const source =
    tool.source === 'bundled' ||
    tool.source === 'buildpack' ||
    tool.source === 'system' ||
    tool.source === 'not_found' ||
    tool.source === 'found_not_in_path'
      ? tool.source
      : status === 'found_not_in_path'
        ? 'found_not_in_path'
        : status === 'missing'
          ? 'not_found'
          : 'system';
  const integrity =
    source === 'bundled' || source === 'buildpack'
      ? tool.integrity === 'verified' || tool.integrity === 'corrupt' || tool.integrity === 'unknown'
        ? tool.integrity
        : 'unknown'
      : 'unknown';
  const alternates = Array.isArray(tool.alternates)
    ? tool.alternates
        .map((alternate) => normalizeToolAlternate(alternate))
        .sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)))
    : undefined;

  return {
    name: tool.name,
    ok: status !== 'missing' && tool.ok !== false,
    status,
    source,
    integrity,
    ...(typeof tool.version === 'string' ? { version: tool.version } : {}),
    ...(typeof tool.path === 'string' ? { path: tool.path } : {}),
    ...(typeof tool.error === 'string' ? { error: tool.error } : {}),
    ...(typeof tool.suggestedFix === 'string' ? { suggestedFix: tool.suggestedFix } : {}),
    ...(typeof tool.buildpackName === 'string' ? { buildpackName: tool.buildpackName } : {}),
    ...(typeof tool.buildpackVersion === 'string' ? { buildpackVersion: tool.buildpackVersion } : {}),
    ...(alternates && alternates.length > 0 ? { alternates } : {}),
  };
}

function normalizeProbeTools(tools: ToolProbeTool[]): ToolProbeTool[] {
  return sortToolsByName(tools).map((tool) => normalizeProbeTool(tool));
}

function sortLogsByRunTs(entries: BuildLogEntry[]): BuildLogEntry[] {
  return [...entries].sort((a, b) => {
    const runCmp = a.run_id.localeCompare(b.run_id);
    if (runCmp !== 0) return runCmp;
    if (a.ts !== b.ts) return a.ts - b.ts;
    return a.msg.localeCompare(b.msg);
  });
}

function sortPreflightLogs(entries: BuildLogEntry[]): BuildLogEntry[] {
  return [...entries].sort((a, b) => {
    const stepCmp = a.step.localeCompare(b.step);
    if (stepCmp !== 0) return stepCmp;
    const msgCmp = a.msg.localeCompare(b.msg);
    if (msgCmp !== 0) return msgCmp;
    if (a.level !== b.level) return a.level.localeCompare(b.level);
    if (a.run_id !== b.run_id) return a.run_id.localeCompare(b.run_id);
    return a.ts - b.ts;
  });
}

function sortPlanCommands(commands: ImplementPlanCommand[]): ImplementPlanCommand[] {
  return [...commands].sort((left, right) => {
    if (left.step !== right.step) return left.step.localeCompare(right.step);
    const leftCmd = left.argv.join('\u0000');
    const rightCmd = right.argv.join('\u0000');
    return leftCmd.localeCompare(rightCmd);
  });
}

function sortPlanOutputs(outputs: ImplementPlanOutput[]): ImplementPlanOutput[] {
  return [...outputs].sort((left, right) => {
    const nameCmp = left.name.localeCompare(right.name);
    if (nameCmp !== 0) return nameCmp;
    return left.pathHint.localeCompare(right.pathHint);
  });
}

function sortPlanRequiredTools(tools: ImplementPlanRequiredTool[]): ImplementPlanRequiredTool[] {
  return [...tools].sort((left, right) => left.name.localeCompare(right.name));
}

function normalizePlanLogs(entries: BuildLogEntry[], run_id: string, step: ToolchainStep): BuildLogEntry[] {
  return [...entries]
    .map((entry, index) => ({
      ...entry,
      run_id,
      ts: typeof entry.ts === 'number' ? entry.ts : index,
      step,
    }))
    .sort((left, right) => {
      if (left.ts !== right.ts) return left.ts - right.ts;
      const msgCmp = left.msg.localeCompare(right.msg);
      if (msgCmp !== 0) return msgCmp;
      return left.level.localeCompare(right.level);
    })
    .map((entry, index) => ({ ...entry, ts: index }));
}

function summarizePorts(portNames: string[]): string {
  const sorted = [...portNames].sort((a, b) => a.localeCompare(b));
  if (sorted.length <= 6) return sorted.join(', ');
  return `${sorted.slice(0, 6).join(', ')}, +${sorted.length - 6} more`;
}

function makePreflightEntries(
  run_id: string,
  messages: Array<{ level: ToolchainLogLevel; msg: string; data?: Record<string, unknown> }>
): BuildLogEntry[] {
  return messages.map((message, index) => ({
    run_id,
    ts: index,
    step: 'preflight',
    level: message.level,
    msg: message.msg,
    ...(message.data ? { data: message.data } : {}),
  }));
}

function buildPreflightProjectSummary(snapshot: Required<ToolchainProjectSnapshotInput>): ToolchainPreflightProjectSummary {
  const hasHdl = snapshot.hdl.sources.some((source) => source.text.trim().length > 0);
  const top = normalizeTop(snapshot.hdl.top, snapshot.fpga.top);
  const hasXdc = (snapshot.fpga.constraints?.text ?? '').trim().length > 0;
  return {
    board: snapshot.fpga.board,
    hasHdl,
    top,
    hasXdc,
    preset: snapshot.fpga.preset ?? null,
  };
}

function buildPreflightLintSummary(
  run_id: string,
  snapshot: Required<ToolchainProjectSnapshotInput>,
  projectSummary: ToolchainPreflightProjectSummary
): ToolchainPreflightLintSummary {
  const errors: Array<{ level: ToolchainLogLevel; msg: string; data?: Record<string, unknown> }> = [];
  const warnings: Array<{ level: ToolchainLogLevel; msg: string; data?: Record<string, unknown> }> = [];

  if (!projectSummary.hasHdl) {
    errors.push({ level: 'error', msg: '[preflight] project: missing_hdl_sources' });
  }

  if (!projectSummary.top) {
    errors.push({
      level: 'error',
      msg: `[preflight] project: missing_top_module (expected "${basys3TopModuleContract.topModule}")`,
    });
  }

  if (!projectSummary.hasXdc) {
    errors.push({ level: 'error', msg: '[preflight] project: missing_xdc_constraints' });
  }

  const xdcText = snapshot.fpga.constraints?.text ?? '';
  if (projectSummary.hasHdl && projectSummary.top && projectSummary.hasXdc) {
    const lint = lintBasys3ProjectPorts(
      {
        sources: snapshot.hdl.sources,
        top: projectSummary.top,
      },
      xdcText
    );

    if (!lint.verilogModuleFound) {
      errors.push({
        level: 'error',
        msg: `[preflight] lint: top module "${lint.topModule}" not found`,
      });
    }

    if (lint.missingInHdl.length > 0) {
      errors.push({
        level: 'error',
        msg: `[preflight] lint: xdc_missing_in_hdl (${lint.missingInHdl.length}): ${summarizePorts(lint.missingInHdl)}`,
      });
    }

    if (lint.missingInXdc.length > 0) {
      warnings.push({
        level: 'warn',
        msg: `[preflight] lint: hdl_unconstrained_in_xdc (${lint.missingInXdc.length}): ${summarizePorts(lint.missingInXdc)}`,
      });
    }

    if (lint.missingContractPorts.length > 0) {
      warnings.push({
        level: 'warn',
        msg: `[preflight] lint: missing_contract_ports (${lint.missingContractPorts.length}): ${summarizePorts(
          lint.missingContractPorts
        )}`,
      });
    }
  }

  return {
    ok: errors.length === 0,
    warnings: sortPreflightLogs(makePreflightEntries(run_id, warnings)),
    errors: sortPreflightLogs(makePreflightEntries(run_id, errors)),
  };
}

export function createToolchainPreflightStatus(input: {
  backend_id: ToolchainBackendId;
  snapshot: ToolchainProjectSnapshotInput;
  probe: ToolProbeResult | null;
}): ToolchainPreflightStatus {
  const normalizedSnapshot = normalizeSnapshotInput(input.snapshot);
  const projectSummary = buildPreflightProjectSummary(normalizedSnapshot);
  const run_id = deterministicId(`${input.backend_id}-preflight`, {
    backend_id: input.backend_id,
    snapshot: normalizedSnapshot,
    probe: input.probe
      ? {
          ok: input.probe.ok,
          tools: normalizeProbeTools(input.probe.tools ?? []).map((tool) => ({
            ...tool,
            version: tool.version ?? null,
            path: tool.path ?? null,
            error: tool.error ?? null,
            suggestedFix: tool.suggestedFix ?? null,
            buildpackName: tool.buildpackName ?? null,
            buildpackVersion: tool.buildpackVersion ?? null,
            alternates: Array.isArray(tool.alternates)
              ? tool.alternates.map((alternate) => ({
                  ...alternate,
                  version: alternate.version ?? null,
                  path: alternate.path ?? null,
                  error: alternate.error ?? null,
                  buildpackName: alternate.buildpackName ?? null,
                  buildpackVersion: alternate.buildpackVersion ?? null,
                }))
              : [],
          })),
        }
      : null,
  });
  const lintSummary = buildPreflightLintSummary(run_id, normalizedSnapshot, projectSummary);
  const tools = normalizeProbeTools(input.probe?.tools ?? []);
  return {
    schema_version: 'toolchain_preflight_v1',
    run_id,
    ts: 0,
    project: projectSummary,
    lint: lintSummary,
    tools,
    overallOk: lintSummary.ok,
  };
}

function buildDoctorProjectSummary(snapshot: Required<ToolchainProjectSnapshotInput>) {
  const top = normalizeTop(snapshot.hdl.top, snapshot.fpga.top);
  const hasXdc = (snapshot.fpga.constraints?.text ?? '').trim().length > 0;
  return {
    board: snapshot.fpga.board,
    preset: snapshot.fpga.preset ?? null,
    top,
    hdlFilesCount: snapshot.hdl.sources.length,
    hasXdc,
  } as const;
}

function normalizePreflightStatus(status: ToolchainPreflightStatus): ToolchainPreflightStatus {
  const warnings = sortPreflightLogs((status.lint?.warnings ?? []).map((entry) => ({ ...entry, step: 'preflight' as const })));
  const errors = sortPreflightLogs((status.lint?.errors ?? []).map((entry) => ({ ...entry, step: 'preflight' as const })));
  return {
    ...status,
    ts: 0,
    tools: sortToolsByName(status.tools ?? []),
    lint: {
      ...status.lint,
      warnings,
      errors,
      ok: errors.length === 0,
    },
    overallOk: errors.length === 0,
  };
}

function normalizeProbeForHash(probe: ToolProbeResult | null) {
  if (!probe) return null;
  return {
    ok: probe.ok,
    env: probe.env ?? null,
    tools: normalizeProbeTools(probe.tools ?? []).map((tool) => ({
      name: tool.name,
      ok: tool.ok,
      status: tool.status,
      source: tool.source,
      integrity: tool.integrity ?? null,
      version: tool.version ?? null,
      path: tool.path ?? null,
      error: tool.error ?? null,
      suggestedFix: tool.suggestedFix ?? null,
      buildpackName: tool.buildpackName ?? null,
      buildpackVersion: tool.buildpackVersion ?? null,
      alternates: Array.isArray(tool.alternates)
        ? tool.alternates.map((alternate) => ({
            source: alternate.source ?? null,
            status: alternate.status ?? null,
            integrity: alternate.integrity ?? null,
            version: alternate.version ?? null,
            path: alternate.path ?? null,
            error: alternate.error ?? null,
            buildpackName: alternate.buildpackName ?? null,
            buildpackVersion: alternate.buildpackVersion ?? null,
          }))
        : [],
    })),
  };
}

const IMPLEMENT_PLAN_TOOL_DEFS: Record<ImplementPlanBackend, Array<{ name: string; why: string }>> = {
  'buildpack-open': [
    { name: 'yosys', why: 'required for RTL synthesis frontend (bundled/buildpack verified)' },
    { name: 'f4pga', why: 'required buildpack-backed xc7 implementation flow' },
  ],
  'nextpnr-xilinx': [
    { name: 'yosys', why: 'required for RTL synthesis before open P&R' },
    { name: 'nextpnr-xilinx', why: 'required for open Xilinx 7-series placement/routing' },
  ],
  f4pga: [
    { name: 'yosys', why: 'required for RTL synthesis frontend' },
    { name: 'f4pga', why: 'required for the F4PGA xc7 implementation flow' },
  ],
  'vivado-fallback': [{ name: 'vivado', why: 'required fallback for implementation and bitstream generation' }],
  none: [
    { name: 'yosys', why: 'required for open-source synthesis' },
    { name: 'nextpnr-xilinx', why: 'preferred open-source Artix-7 place-and-route backend' },
    { name: 'f4pga', why: 'fallback open-source xc7 implementation flow' },
    { name: 'vivado', why: 'last-resort proprietary fallback implementation backend' },
  ],
};

const IMPLEMENT_PLAN_COMMANDS: Record<ImplementPlanBackend, ImplementPlanCommand[]> = {
  'buildpack-open': [
    {
      step: 'synth',
      argv: [
        'f4pga',
        'build',
        '--flow',
        'xc7',
        '--part',
        'xc7a35tcpg236-1',
        '--top',
        '<top>',
        '--sources',
        '<sources>',
        '--xdc',
        '<constraints>',
        '--out',
        'out',
      ],
      envKeysUsed: ['PATH', 'F4PGA_INSTALL_DIR', 'RB_FPGA_BUILDPACKS_DIR'],
    },
    {
      step: 'pnr',
      argv: ['f4pga', 'build', '--stage', 'place_route', '--out', 'out'],
      envKeysUsed: ['PATH', 'F4PGA_INSTALL_DIR', 'RB_FPGA_BUILDPACKS_DIR'],
    },
    {
      step: 'bitgen',
      argv: ['f4pga', 'build', '--stage', 'bitstream', '--out', 'out'],
      envKeysUsed: ['PATH', 'F4PGA_INSTALL_DIR', 'RB_FPGA_BUILDPACKS_DIR'],
    },
  ],
  'nextpnr-xilinx': [
    {
      step: 'synth',
      argv: ['yosys', '-p', 'read_verilog -sv <sources>; hierarchy -top <top>; synth_xilinx -top <top> -family xc7; write_json out/netlist.json'],
      envKeysUsed: ['PATH'],
    },
    {
      step: 'pnr',
      argv: ['nextpnr-xilinx', '--json', 'out/netlist.json', '--xdc', 'constraints.xdc', '--write', 'out/routed.json'],
      envKeysUsed: ['PATH'],
    },
    {
      step: 'bitgen',
      argv: ['python', '-m', 'f4pga.utils.xc7.bitgen', '--input', 'out/routed.json', '--output', 'out/design.bit'],
      envKeysUsed: ['PATH', 'F4PGA_INSTALL_DIR'],
    },
  ],
  f4pga: [
    {
      step: 'synth',
      argv: ['f4pga', 'build', '--flow', 'xc7', '--part', 'xc7a35tcpg236-1', '--top', '<top>'],
      envKeysUsed: ['PATH', 'F4PGA_INSTALL_DIR'],
    },
    {
      step: 'pnr',
      argv: ['f4pga', 'build', '--stage', 'place_route'],
      envKeysUsed: ['PATH', 'F4PGA_INSTALL_DIR'],
    },
    {
      step: 'bitgen',
      argv: ['f4pga', 'build', '--stage', 'bitstream'],
      envKeysUsed: ['PATH', 'F4PGA_INSTALL_DIR'],
    },
  ],
  'vivado-fallback': [
    {
      step: 'synth',
      argv: ['vivado', '-mode', 'batch', '-source', 'scripts/redbyte_synth.tcl'],
      envKeysUsed: ['PATH', 'XILINX_VIVADO'],
    },
    {
      step: 'pnr',
      argv: ['vivado', '-mode', 'batch', '-source', 'scripts/redbyte_impl.tcl'],
      envKeysUsed: ['PATH', 'XILINX_VIVADO'],
    },
    {
      step: 'bitgen',
      argv: ['vivado', '-mode', 'batch', '-source', 'scripts/redbyte_bitgen.tcl'],
      envKeysUsed: ['PATH', 'XILINX_VIVADO'],
    },
  ],
  none: [],
};

const IMPLEMENT_PLAN_OUTPUTS: Record<ImplementPlanBackend, ImplementPlanOutput[]> = {
  'buildpack-open': [
    { name: 'eblif', pathHint: 'out/top.eblif' },
    { name: 'fasm', pathHint: 'out/top.fasm' },
    { name: 'bitstream', pathHint: 'out/top.bit' },
  ],
  'nextpnr-xilinx': [
    { name: 'netlist-json', pathHint: 'out/netlist.json' },
    { name: 'routed-json', pathHint: 'out/routed.json' },
    { name: 'bitstream', pathHint: 'out/design.bit' },
  ],
  f4pga: [
    { name: 'eblif', pathHint: 'build/top.eblif' },
    { name: 'fasm', pathHint: 'build/top.fasm' },
    { name: 'bitstream', pathHint: 'build/top.bit' },
  ],
  'vivado-fallback': [
    { name: 'synth-checkpoint', pathHint: 'out/post_synth.dcp' },
    { name: 'impl-checkpoint', pathHint: 'out/post_route.dcp' },
    { name: 'bitstream', pathHint: 'out/design.bit' },
  ],
  none: [],
};

function normalizeImplementPlanBackend(value: unknown): ImplementPlanBackend {
  if (
    value === 'buildpack-open' ||
    value === 'nextpnr-xilinx' ||
    value === 'f4pga' ||
    value === 'vivado-fallback' ||
    value === 'none'
  ) {
    return value;
  }
  return 'none';
}

function resolveImplementPlanExecutableFromProbe(
  commandName: string,
  probe: ToolProbeResult | null
): string {
  const CAPABILITY_NAME_BY_COMMAND: Record<string, string> = {
    yosys: 'yosys',
    'nextpnr-xilinx': 'nextpnr-xilinx',
    f4pga: 'f4pga',
    vivado: 'vivado',
  };
  const toolName = CAPABILITY_NAME_BY_COMMAND[commandName];
  if (!toolName) return commandName;
  const tool = sortToolsByName(probe?.tools ?? []).find((entry) => entry.name === toolName);
  if (!tool) return commandName;
  const status =
    tool.status === 'ok' || tool.status === 'found_not_in_path' || tool.status === 'missing'
      ? tool.status
      : tool.ok
        ? 'ok'
        : 'missing';
  if (status !== 'ok') return commandName;
  if (typeof tool.path === 'string' && tool.path.trim().length > 0) return tool.path.trim();
  return commandName;
}

function pickToolVersion(tools: ToolProbeTool[], name: string): string | undefined {
  const match = tools.find((tool) => tool.name === name && tool.ok && typeof tool.version === 'string');
  return match?.version;
}

function chooseImplementPlanBackend(
  probe: ToolProbeResult | null,
  backend_id: ToolchainBackendId = 'open'
): ImplementPlanBackend {
  const tools = sortToolsByName(probe?.tools ?? []);
  const findTool = (name: string) => tools.find((tool) => tool.name === name);
  const sourceFor = (tool: ToolProbeTool | undefined) =>
    tool?.source === 'bundled' ||
    tool?.source === 'buildpack' ||
    tool?.source === 'system' ||
    tool?.source === 'found_not_in_path' ||
    tool?.source === 'not_found'
      ? tool.source
      : 'not_found';
  const statusFor = (tool: ToolProbeTool | undefined) =>
    tool?.status === 'ok' || tool?.status === 'found_not_in_path' || tool?.status === 'missing' ? tool.status : 'ok';
  const integrityFor = (tool: ToolProbeTool | undefined) => {
    if (tool?.integrity === 'verified' || tool?.integrity === 'corrupt' || tool?.integrity === 'unknown') {
      return tool.integrity;
    }
    const source = sourceFor(tool);
    return source === 'bundled' || source === 'buildpack' ? 'unknown' : 'unknown';
  };
  const isReady = (tool: ToolProbeTool | undefined) => Boolean(tool?.ok) && statusFor(tool) === 'ok';
  const isVerifiedManagedOpenTool = (tool: ToolProbeTool | undefined) => {
    const source = sourceFor(tool);
    return isReady(tool) && (source === 'bundled' || source === 'buildpack') && integrityFor(tool) === 'verified';
  };
  const isVerifiedBuildpackTool = (tool: ToolProbeTool | undefined) =>
    isReady(tool) && sourceFor(tool) === 'buildpack' && integrityFor(tool) === 'verified';
  const isVerifiedSystemTool = (tool: ToolProbeTool | undefined) => isReady(tool) && sourceFor(tool) === 'system';
  const isVerifiedVivadoFallback = (tool: ToolProbeTool | undefined) => {
    if (!isReady(tool)) return false;
    const source = sourceFor(tool);
    if (source === 'system') return true;
    return (source === 'bundled' || source === 'buildpack') && integrityFor(tool) === 'verified';
  };

  const yosys = findTool('yosys');
  const nextpnr = findTool('nextpnr-xilinx');
  const f4pga = findTool('f4pga');
  const vivado = findTool('vivado');

  const hasBuildpackYosys = isVerifiedManagedOpenTool(yosys);
  const hasBuildpackF4pga = isVerifiedBuildpackTool(f4pga);
  const hasVivado = isVerifiedVivadoFallback(vivado);
  const hasSystemYosys = isVerifiedSystemTool(yosys);
  const hasSystemNextpnr = isVerifiedSystemTool(nextpnr);
  const hasSystemF4pga = isVerifiedSystemTool(f4pga);
  const platform = probe?.env?.platform ?? '';
  const nextpnrKnownSupported = hasSystemYosys && hasSystemNextpnr && platform !== 'win32';
  const buildpackOpenReady = hasBuildpackYosys && hasBuildpackF4pga;

  if (buildpackOpenReady) return 'buildpack-open';
  if (backend_id === 'vivado' && hasVivado) return 'vivado-fallback';
  if (hasVivado) return 'vivado-fallback';
  if (nextpnrKnownSupported) return 'nextpnr-xilinx';
  if (hasSystemYosys && hasSystemF4pga) return 'f4pga';
  return 'none';
}

function buildImplementPlanRequiredTools(probe: ToolProbeResult | null, backend: ImplementPlanBackend): ImplementPlanRequiredTool[] {
  const tools = sortToolsByName(probe?.tools ?? []);
  const defs = IMPLEMENT_PLAN_TOOL_DEFS[backend];
  return sortPlanRequiredTools(
    defs.map((tool) => {
      const match = tools.find((entry) => entry.name === tool.name);
      const status =
        match?.status === 'ok' || match?.status === 'found_not_in_path' || match?.status === 'missing'
          ? match.status
          : match?.ok
            ? 'ok'
            : 'missing';
      return {
        name: tool.name,
        why: tool.why,
        ok: Boolean(match?.ok) && status === 'ok',
        ...(typeof match?.version === 'string' ? { version: match.version } : {}),
        ...(match?.source === 'bundled' ||
        match?.source === 'buildpack' ||
        match?.source === 'system' ||
        match?.source === 'found_not_in_path' ||
        match?.source === 'not_found'
          ? { source: match.source }
          : {}),
        ...(match?.integrity === 'verified' || match?.integrity === 'corrupt' || match?.integrity === 'unknown'
          ? { integrity: match.integrity }
          : {}),
      };
    })
  );
}

function resolveImplementPlanBuildpack(
  probe: ToolProbeResult | null,
  backend: ImplementPlanBackend
): ImplementPlanBuildpackRef | undefined {
  if (backend !== 'buildpack-open') return undefined;
  const tools = sortToolsByName(probe?.tools ?? []);
  const candidates = tools
    .filter((tool) => tool.source === 'buildpack' && tool.integrity === 'verified' && tool.ok)
    .map((tool) => {
      const name = typeof tool.buildpackName === 'string' ? tool.buildpackName.trim() : '';
      const version = typeof tool.buildpackVersion === 'string' ? tool.buildpackVersion.trim() : '';
      return { name, version };
    })
    .filter((candidate) => candidate.name.length > 0 && candidate.version.length > 0)
    .sort((left, right) => {
      if (left.name !== right.name) return left.name.localeCompare(right.name);
      return left.version.localeCompare(right.version);
    });
  if (candidates.length === 0) return undefined;
  return candidates[0];
}

function findUnsupportedImplementationMarkers(snapshot: Required<ToolchainProjectSnapshotInput>): string[] {
  const joined = snapshot.hdl.sources
    .filter((source) => source.language === 'verilog')
    .map((source) => source.text)
    .join('\n');
  const markers: Array<{ token: string; regex: RegExp }> = [
    { token: 'DSP48', regex: /\bDSP48E\d?\b/i },
    { token: 'MMCM/PLL', regex: /\b(MMCME2|PLLE2)\b/i },
    { token: 'SERDES', regex: /\b(I|O)SERDESE2\b/i },
    { token: 'ILA/VIO', regex: /\b(ILA|VIO)\b/i },
  ];
  return markers.filter((marker) => marker.regex.test(joined)).map((marker) => marker.token).sort((a, b) => a.localeCompare(b));
}

export function createToolchainImplementPlan(input: {
  backend_id: ToolchainBackendId;
  snapshot: ToolchainProjectSnapshotInput;
  probe: ToolProbeResult | null;
  bridgeError?: string;
}): ImplementPlanResult {
  const normalizedSnapshot = normalizeSnapshotInput(input.snapshot);
  const backend = chooseImplementPlanBackend(input.probe, input.backend_id);
  const requiredTools = buildImplementPlanRequiredTools(input.probe, backend);
  const buildpack = resolveImplementPlanBuildpack(input.probe, backend);
  const top = normalizeTop(normalizedSnapshot.hdl.top, normalizedSnapshot.fpga.top) ?? basys3TopModuleContract.topModule;
  const sourceArgs = normalizedSnapshot.hdl.sources
    .map((source) => source.path)
    .sort((left, right) => left.localeCompare(right))
    .map((entry) => (entry.includes(' ') ? `"${entry}"` : entry))
    .join(' ');
  const constraintsPath = normalizedSnapshot.fpga.constraints?.text?.trim() ? 'constraints.xdc' : 'constraints.xdc';
  const yosysVersion = pickToolVersion(input.probe?.tools ?? [], 'yosys') ?? null;
  const commands = sortPlanCommands(
    IMPLEMENT_PLAN_COMMANDS[backend].map((command) => ({
      ...command,
      argv: command.argv.map((arg, index) => {
        const resolvedArg = arg
          .replace(/<top>/g, top)
          .replace(/<sources>/g, sourceArgs)
          .replace(/<constraints>/g, constraintsPath);
        if (index !== 0) return resolvedArg;
        return resolveImplementPlanExecutableFromProbe(resolvedArg, input.probe);
      }),
      envKeysUsed: [...command.envKeysUsed].sort((a, b) => a.localeCompare(b)),
    }))
  );
  const outputs = sortPlanOutputs(IMPLEMENT_PLAN_OUTPUTS[backend]);

  const run_id = deterministicId(`${input.backend_id}-implement-plan-run`, {
    backend_id: input.backend_id,
    probe: normalizeProbeForHash(input.probe),
    project: {
      board: normalizedSnapshot.fpga.board,
      top,
      sourceCount: normalizedSnapshot.hdl.sources.length,
      hasXdc: Boolean(normalizedSnapshot.fpga.constraints?.text?.trim()),
      preset: normalizedSnapshot.fpga.preset ?? null,
    },
    backend,
  });

  const warningMessages: string[] = [];
  if (normalizedSnapshot.hdl.sources.some((source) => source.language === 'vhdl')) {
    warningMessages.push('[implement-plan] vhdl_sources_present: current open-flow plan models verilog-first execution.');
  }
  if (!normalizedSnapshot.fpga.constraints?.text?.trim()) {
    warningMessages.push('[implement-plan] missing_xdc_constraints: implementation will fail without constraints.');
  }
  const unsupportedMarkers = findUnsupportedImplementationMarkers(normalizedSnapshot);
  if (unsupportedMarkers.length > 0) {
    warningMessages.push(`[implement-plan] unsupported_constructs_hint: ${unsupportedMarkers.join(', ')}`);
  }
  if (backend === 'none') {
    warningMessages.push('[implement-plan] no_viable_backend: install nextpnr-xilinx/f4pga or Vivado fallback.');
  }
  if (backend === 'buildpack-open' && !buildpack) {
    warningMessages.push('[implement-plan] buildpack_metadata_missing: selected buildpack-open but no buildpack name/version was detected.');
  }
  if (input.bridgeError) {
    warningMessages.push(`[implement-plan] bridge_fallback: ${input.bridgeError}`);
  }

  const warnings = warningMessages
    .sort((a, b) => a.localeCompare(b))
    .map((msg, index) => ({
      run_id,
      ts: index,
      step: 'pnr' as const,
      level: 'warn' as const,
      msg,
    }));

  const logs: BuildLogEntry[] = [
    {
      run_id,
      ts: 0,
      step: 'pnr',
      level: 'info',
      msg: `[${input.backend_id}] implement-plan: selected backend ${backend}`,
      data: {
        board: normalizedSnapshot.fpga.board,
        top,
        sourceCount: normalizedSnapshot.hdl.sources.length,
        yosysVersion,
        ...(buildpack ? { buildpack } : {}),
      },
    },
    {
      run_id,
      ts: 1,
      step: 'pnr',
      level: 'info',
      msg: `[${input.backend_id}] implement-plan: required tools checked (${requiredTools.length})`,
    },
    {
      run_id,
      ts: 2,
      step: 'pnr',
      level: 'info',
      msg: `[${input.backend_id}] implement-plan: command steps prepared (${commands.length})`,
    },
  ];

  const planId = deterministicId(`${input.backend_id}-implement-plan`, {
    backend,
    top,
    requiredTools: requiredTools.map((tool) => ({
      name: tool.name,
      ok: tool.ok,
      version: tool.version ?? null,
      source: tool.source ?? null,
      integrity: tool.integrity ?? null,
      why: tool.why,
    })),
    commands: commands.map((command) => ({
      step: command.step,
      argv: command.argv,
      envKeysUsed: command.envKeysUsed,
    })),
    outputs,
    warnings: warnings.map((entry) => entry.msg),
    buildpack: buildpack ?? null,
  });

  return {
    schema_version: 'toolchain_implement_plan_v1',
    ok: backend !== 'none',
    run_id,
    planId,
    backend,
    ...(buildpack ? { buildpack } : {}),
    requiredTools,
    commands,
    outputs,
    warnings,
    logs,
  };
}

function isImplementPlanResult(value: unknown): value is ImplementPlanResult {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<ImplementPlanResult>;
  const hasValidBuildpack =
    v.buildpack === undefined ||
    (Boolean(v.buildpack) &&
      typeof v.buildpack === 'object' &&
      typeof (v.buildpack as { name?: unknown }).name === 'string' &&
      typeof (v.buildpack as { version?: unknown }).version === 'string');
  return (
    v.schema_version === 'toolchain_implement_plan_v1' &&
    typeof v.ok === 'boolean' &&
    typeof v.run_id === 'string' &&
    typeof v.planId === 'string' &&
    normalizeImplementPlanBackend(v.backend) === v.backend &&
    hasValidBuildpack &&
    Array.isArray(v.requiredTools) &&
    Array.isArray(v.commands) &&
    Array.isArray(v.outputs) &&
    Array.isArray(v.warnings) &&
    Array.isArray(v.logs)
  );
}

function normalizeImplementPlanResult(result: ImplementPlanResult): ImplementPlanResult {
  const run_id = result.run_id;
  const buildpack =
    result.buildpack &&
    typeof result.buildpack.name === 'string' &&
    result.buildpack.name.trim().length > 0 &&
    typeof result.buildpack.version === 'string' &&
    result.buildpack.version.trim().length > 0
      ? {
          name: result.buildpack.name.trim(),
          version: result.buildpack.version.trim(),
        }
      : undefined;
  return {
    schema_version: 'toolchain_implement_plan_v1',
    ok: result.ok,
    run_id,
    planId: result.planId,
    backend: normalizeImplementPlanBackend(result.backend),
    ...(buildpack ? { buildpack } : {}),
    requiredTools: sortPlanRequiredTools(
      (result.requiredTools ?? []).map((tool) => ({
        name: tool.name,
        ok: tool.ok === true,
        why: tool.why,
        ...(typeof tool.version === 'string' ? { version: tool.version } : {}),
        ...(tool.source === 'bundled' ||
        tool.source === 'buildpack' ||
        tool.source === 'system' ||
        tool.source === 'found_not_in_path' ||
        tool.source === 'not_found'
          ? { source: tool.source }
          : {}),
        ...(tool.integrity === 'verified' || tool.integrity === 'corrupt' || tool.integrity === 'unknown'
          ? { integrity: tool.integrity }
          : {}),
      }))
    ),
    commands: sortPlanCommands(
      (result.commands ?? []).map((command) => ({
        step: command.step,
        argv: [...(command.argv ?? [])].map((value) => String(value)),
        envKeysUsed: [...(command.envKeysUsed ?? [])].map((value) => String(value)).sort((a, b) => a.localeCompare(b)),
      }))
    ),
    outputs: sortPlanOutputs(
      (result.outputs ?? []).map((output) => ({
        name: String(output.name),
        pathHint: String(output.pathHint),
      }))
    ),
    warnings: normalizePlanLogs(result.warnings ?? [], run_id, 'pnr'),
    logs: normalizePlanLogs(result.logs ?? [], run_id, 'pnr'),
  };
}

function buildProjectSummaryForBuildPath(snapshot: Required<ToolchainProjectSnapshotInput>) {
  const top = normalizeTop(snapshot.hdl.top, snapshot.fpga.top) ?? basys3TopModuleContract.topModule;
  return {
    board: snapshot.fpga.board,
    top,
    preset: snapshot.fpga.preset ?? null,
    hasXdc: Boolean(snapshot.fpga.constraints?.text?.trim()),
    sourceCount: snapshot.hdl.sources.length,
  };
}

function deriveBuildPathPlanId(input: {
  backend_id: ToolchainBackendId;
  snapshot: Required<ToolchainProjectSnapshotInput>;
  backend: ImplementPlanBackend;
  requiredTools: ImplementPlanRequiredTool[];
  buildpack?: ImplementPlanBuildpackRef;
}): string {
  const projectSummary = buildProjectSummaryForBuildPath(input.snapshot);
  return deterministicId(`${input.backend_id}-build-path`, {
    plannerVersion: TOOLCHAIN_PLANNER_VERSION,
    backend: input.backend,
    buildpack:
      input.buildpack && input.buildpack.name.trim().length > 0 && input.buildpack.version.trim().length > 0
        ? {
            name: input.buildpack.name.trim(),
            version: input.buildpack.version.trim(),
          }
        : null,
    project: projectSummary,
    tools: sortPlanRequiredTools(input.requiredTools).map((tool) => ({
      name: tool.name,
      ok: tool.ok,
      version: tool.version ?? null,
      source: tool.source ?? null,
      integrity: tool.integrity ?? null,
    })),
  });
}

function buildPathFromImplementPlan(input: {
  backend_id: ToolchainBackendId;
  snapshot: Required<ToolchainProjectSnapshotInput>;
  plan: ImplementPlanResult;
}): ToolchainBuildPath {
  const normalizedPlan = normalizeImplementPlanResult(input.plan);
  const projectSummary = buildProjectSummaryForBuildPath(input.snapshot);
  const derivedPlanId = deriveBuildPathPlanId({
    backend_id: input.backend_id,
    snapshot: input.snapshot,
    backend: normalizedPlan.backend,
    requiredTools: normalizedPlan.requiredTools,
    buildpack: normalizedPlan.buildpack,
  });

  const path: ToolchainBuildPath = {
    schema_version: 'toolchain_build_path_v1',
    plannerVersion: TOOLCHAIN_PLANNER_VERSION,
    planId: normalizedPlan.planId || derivedPlanId,
    backend: normalizedPlan.backend,
    ...(normalizedPlan.buildpack ? { buildpack: normalizedPlan.buildpack } : {}),
    board: projectSummary.board,
    top: projectSummary.top,
    constraintsPreset: projectSummary.preset,
    requiredTools: sortPlanRequiredTools(normalizedPlan.requiredTools),
    commands: sortPlanCommands(normalizedPlan.commands),
    outputs: sortPlanOutputs(normalizedPlan.outputs),
    warnings: normalizePlanLogs(normalizedPlan.warnings, normalizedPlan.run_id, 'pnr'),
  };

  if (path.planId !== derivedPlanId) {
    return {
      ...path,
      planId: derivedPlanId,
    };
  }
  return path;
}

function isToolchainBuildPath(value: unknown): value is ToolchainBuildPath {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<ToolchainBuildPath>;
  const hasValidBuildpack =
    v.buildpack === undefined ||
    (Boolean(v.buildpack) &&
      typeof v.buildpack === 'object' &&
      typeof (v.buildpack as { name?: unknown }).name === 'string' &&
      typeof (v.buildpack as { version?: unknown }).version === 'string');
  return (
    v.schema_version === 'toolchain_build_path_v1' &&
    v.plannerVersion === 'toolchain_planner_v1' &&
    typeof v.planId === 'string' &&
    normalizeImplementPlanBackend(v.backend) === v.backend &&
    hasValidBuildpack &&
    v.board === 'basys3' &&
    typeof v.top === 'string' &&
    (v.constraintsPreset === null || typeof v.constraintsPreset === 'string') &&
    Array.isArray(v.requiredTools) &&
    Array.isArray(v.commands) &&
    Array.isArray(v.outputs) &&
    Array.isArray(v.warnings)
  );
}

function normalizeToolchainBuildPath(path: ToolchainBuildPath): ToolchainBuildPath {
  const buildpack =
    path.buildpack &&
    typeof path.buildpack.name === 'string' &&
    path.buildpack.name.trim().length > 0 &&
    typeof path.buildpack.version === 'string' &&
    path.buildpack.version.trim().length > 0
      ? {
          name: path.buildpack.name.trim(),
          version: path.buildpack.version.trim(),
        }
      : undefined;
  return {
    schema_version: 'toolchain_build_path_v1',
    plannerVersion: 'toolchain_planner_v1',
    planId: path.planId,
    backend: normalizeImplementPlanBackend(path.backend),
    ...(buildpack ? { buildpack } : {}),
    board: 'basys3',
    top: path.top.trim() || basys3TopModuleContract.topModule,
    constraintsPreset: typeof path.constraintsPreset === 'string' && path.constraintsPreset.trim().length > 0
      ? path.constraintsPreset.trim()
      : null,
    requiredTools: sortPlanRequiredTools(
      (path.requiredTools ?? []).map((tool) => ({
        name: String(tool.name),
        ok: tool.ok === true,
        why: String(tool.why),
        ...(typeof tool.version === 'string' ? { version: tool.version } : {}),
        ...(tool.source === 'bundled' ||
        tool.source === 'buildpack' ||
        tool.source === 'system' ||
        tool.source === 'found_not_in_path' ||
        tool.source === 'not_found'
          ? { source: tool.source }
          : {}),
        ...(tool.integrity === 'verified' || tool.integrity === 'corrupt' || tool.integrity === 'unknown'
          ? { integrity: tool.integrity }
          : {}),
      }))
    ),
    commands: sortPlanCommands(
      (path.commands ?? []).map((command) => ({
        step: command.step,
        argv: [...(command.argv ?? [])].map((value) => String(value)),
        envKeysUsed: [...(command.envKeysUsed ?? [])].map((value) => String(value)).sort((a, b) => a.localeCompare(b)),
      }))
    ),
    outputs: sortPlanOutputs(
      (path.outputs ?? []).map((output) => ({
        name: String(output.name),
        pathHint: String(output.pathHint),
      }))
    ),
    warnings: normalizePlanLogs(path.warnings ?? [], `build-path-${path.planId}`, 'pnr'),
  };
}

function isStudentReadinessGate(value: unknown): value is StudentReadinessGate {
  if (!value || typeof value !== 'object') return false;
  const gate = value as {
    id?: unknown;
    label?: unknown;
    state?: unknown;
    detail?: unknown;
    nextAction?: unknown;
  };
  return (
    (gate.id === 'toolchain_probe' ||
      gate.id === 'preflight' ||
      gate.id === 'implement_plan' ||
      gate.id === 'toolchain_ui' ||
      gate.id === 'doctor_export') &&
    typeof gate.label === 'string' &&
    (gate.state === 'pass' || gate.state === 'warn' || gate.state === 'fail') &&
    typeof gate.detail === 'string' &&
    (gate.nextAction === undefined || typeof gate.nextAction === 'string')
  );
}

function isStudentReadinessSummary(value: unknown): value is StudentReadinessSummary {
  if (!value || typeof value !== 'object') return false;
  const summary = value as { schema_version?: unknown; overall?: unknown; gates?: unknown };
  return (
    summary.schema_version === 'student_readiness_v1' &&
    (summary.overall === 'ready' || summary.overall === 'needs_action') &&
    Array.isArray(summary.gates) &&
    summary.gates.every(isStudentReadinessGate)
  );
}

function isToolchainDoctorReport(value: unknown): value is ToolchainDoctorReport {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<ToolchainDoctorReport>;
  if (
    v.schema_version === 'rb_toolchain_doctor_v1' &&
    typeof v.reportId === 'string' &&
    typeof v.backend_id === 'string' &&
    Array.isArray(v.logs)
  ) {
    if (v.buildPath !== undefined && !isToolchainBuildPath(v.buildPath)) return false;
    if (v.studentReadiness !== undefined && !isStudentReadinessSummary(v.studentReadiness)) return false;
    return true;
  }
  return false;
}

function isBoardDetectResult(value: unknown): value is BoardDetectResult {
  if (!value || typeof value !== 'object') return false;
  const v = value as {
    schema_version?: unknown;
    ok?: unknown;
    run_id?: unknown;
    boards?: unknown;
    tools?: unknown;
    logs?: unknown;
  };
  if (
    v.schema_version !== 'toolchain_board_detect_v1' ||
    typeof v.ok !== 'boolean' ||
    typeof v.run_id !== 'string' ||
    !Array.isArray(v.boards) ||
    !v.tools ||
    typeof v.tools !== 'object' ||
    !Array.isArray(v.logs)
  ) {
    return false;
  }

  const tools = v.tools as { openFPGALoader?: unknown };
  if (!tools.openFPGALoader || typeof tools.openFPGALoader !== 'object') {
    return false;
  }

  const openFpgaLoader = tools.openFPGALoader as {
    ok?: unknown;
    version?: unknown;
    path?: unknown;
    error?: unknown;
  };
  if (typeof openFpgaLoader.ok !== 'boolean') return false;
  if (openFpgaLoader.version !== undefined && typeof openFpgaLoader.version !== 'string') return false;
  if (openFpgaLoader.path !== undefined && typeof openFpgaLoader.path !== 'string') return false;
  if (openFpgaLoader.error !== undefined && typeof openFpgaLoader.error !== 'string') return false;

  for (const entry of v.boards) {
    if (!entry || typeof entry !== 'object') return false;
    const board = entry as {
      type?: unknown;
      transport?: unknown;
      detectedBy?: unknown;
      details?: unknown;
    };
    if (board.type !== 'basys3') return false;
    if (board.transport !== 'usb-jtag') return false;
    if (board.detectedBy !== 'openFPGALoader') return false;
    if (board.details !== undefined && typeof board.details !== 'object') return false;
  }

  return true;
}

function normalizeBoardDetectResult(result: BoardDetectResult): BoardDetectResult {
  const boards = [...(result.boards ?? [])]
    .map((board) => ({
      type: 'basys3' as const,
      transport: 'usb-jtag' as const,
      detectedBy: 'openFPGALoader' as const,
      ...(board.details
        ? {
            details: {
              ...(typeof board.details.raw === 'string' ? { raw: board.details.raw } : {}),
              ...(typeof board.details.command === 'string' ? { command: board.details.command } : {}),
            },
          }
        : {}),
    }))
    .sort((a, b) => {
      const leftRaw = a.details?.raw ?? '';
      const rightRaw = b.details?.raw ?? '';
      if (leftRaw !== rightRaw) return leftRaw.localeCompare(rightRaw);
      const leftCommand = a.details?.command ?? '';
      const rightCommand = b.details?.command ?? '';
      return leftCommand.localeCompare(rightCommand);
    });

  return {
    schema_version: 'toolchain_board_detect_v1',
    ok: result.ok,
    run_id: result.run_id,
    boards,
    tools: {
      openFPGALoader: {
        ok: result.tools.openFPGALoader.ok,
        ...(typeof result.tools.openFPGALoader.version === 'string'
          ? { version: result.tools.openFPGALoader.version }
          : {}),
        ...(typeof result.tools.openFPGALoader.path === 'string'
          ? { path: result.tools.openFPGALoader.path }
          : {}),
        ...(typeof result.tools.openFPGALoader.error === 'string'
          ? { error: result.tools.openFPGALoader.error }
          : {}),
      },
    },
    logs: normalizeProgramLogs(result.logs, result.run_id).map((entry) => ({ ...entry, step: 'probe' as const })),
  };
}

function isProgramBitstreamResponse(value: unknown): value is {
  ok: boolean;
  runId: string;
  artifactId: string;
  logs: BuildLogEntry[];
  state?: ToolchainRunState;
  nextOffset?: number;
  error?: string;
} {
  if (!value || typeof value !== 'object') return false;
  const v = value as {
    ok?: unknown;
    runId?: unknown;
    artifactId?: unknown;
    logs?: unknown;
    state?: unknown;
    nextOffset?: unknown;
    error?: unknown;
  };
  return (
    typeof v.ok === 'boolean' &&
    typeof v.runId === 'string' &&
    typeof v.artifactId === 'string' &&
    Array.isArray(v.logs) &&
    (v.state === undefined || v.state === 'running' || v.state === 'done' || v.state === 'error' || v.state === 'canceled') &&
    (v.nextOffset === undefined || typeof v.nextOffset === 'number') &&
    (v.error === undefined || typeof v.error === 'string')
  );
}

function isProgramBitstreamBusyResponse(value: unknown): value is {
  ok: false;
  error: 'BOARD_BUSY';
  board: TargetBoardId;
  activeRunId: string;
  logs: BuildLogEntry[];
  nextOffset: number;
} {
  if (!value || typeof value !== 'object') return false;
  const v = value as {
    ok?: unknown;
    error?: unknown;
    board?: unknown;
    activeRunId?: unknown;
    logs?: unknown;
    nextOffset?: unknown;
  };
  return (
    v.ok === false &&
    v.error === 'BOARD_BUSY' &&
    v.board === 'basys3' &&
    typeof v.activeRunId === 'string' &&
    Array.isArray(v.logs) &&
    typeof v.nextOffset === 'number'
  );
}

function normalizeProgramRunState(value: unknown): ToolchainRunState {
  if (value === 'done' || value === 'error' || value === 'running' || value === 'canceled') return value;
  return 'error';
}

function normalizeBuildLogs(logs: unknown, fallbackRunId: string, step: ToolchainStep): BuildLogEntry[] {
  if (!Array.isArray(logs)) return [];
  return sortLogsByRunTs(
    logs.map((entry, index) => {
      const raw = entry as Partial<BuildLogEntry>;
      return {
        run_id: typeof raw.run_id === 'string' ? raw.run_id : fallbackRunId,
        ts: typeof raw.ts === 'number' ? raw.ts : index,
        step,
        level:
          raw.level === 'error' || raw.level === 'warn' || raw.level === 'info'
            ? raw.level
            : 'info',
        msg: typeof raw.msg === 'string' ? raw.msg : `[${step}] invalid_log_entry`,
        ...(raw.data && typeof raw.data === 'object' ? { data: raw.data } : {}),
      };
    })
  );
}

function normalizeProgramLogs(logs: unknown, fallbackRunId: string): BuildLogEntry[] {
  return normalizeBuildLogs(logs, fallbackRunId, 'program');
}

function normalizeSynthLogs(logs: unknown, fallbackRunId: string): BuildLogEntry[] {
  return normalizeBuildLogs(logs, fallbackRunId, 'synth');
}

function normalizeBuildpackLogs(logs: unknown, fallbackRunId: string): BuildLogEntry[] {
  return normalizeBuildLogs(logs, fallbackRunId, 'buildpack');
}

function normalizeRunLogStep(value: unknown): ToolchainStep {
  if (
    value === 'probe' ||
    value === 'preflight' ||
    value === 'synth' ||
    value === 'implement' ||
    value === 'pnr' ||
    value === 'bitgen' ||
    value === 'buildpack' ||
    value === 'program'
  ) {
    return value;
  }
  return 'program';
}

function normalizeRunLogs(logs: unknown, fallbackRunId: string): BuildLogEntry[] {
  if (!Array.isArray(logs)) return [];
  return sortLogsByRunTs(
    logs.map((entry, index) => {
      const raw = entry as Partial<BuildLogEntry>;
      return {
        run_id: typeof raw.run_id === 'string' ? raw.run_id : fallbackRunId,
        ts: typeof raw.ts === 'number' ? raw.ts : index,
        step: normalizeRunLogStep(raw.step),
        level:
          raw.level === 'error' || raw.level === 'warn' || raw.level === 'info'
            ? raw.level
            : 'info',
        msg: typeof raw.msg === 'string' ? raw.msg : '[run] invalid_log_entry',
        ...(raw.data && typeof raw.data === 'object' ? { data: raw.data } : {}),
      } as BuildLogEntry;
    })
  );
}

function normalizeImplementLogStep(value: unknown): ToolchainStep {
  if (value === 'implement' || value === 'pnr' || value === 'bitgen') return value;
  return 'implement';
}

function normalizeImplementLogs(logs: unknown, fallbackRunId: string): BuildLogEntry[] {
  if (!Array.isArray(logs)) return [];
  return sortLogsByRunTs(
    logs.map((entry, index) => {
      const raw = entry as Partial<BuildLogEntry>;
      return {
        run_id: typeof raw.run_id === 'string' ? raw.run_id : fallbackRunId,
        ts: typeof raw.ts === 'number' ? raw.ts : index,
        step: normalizeImplementLogStep(raw.step),
        level:
          raw.level === 'error' || raw.level === 'warn' || raw.level === 'info'
            ? raw.level
            : 'info',
        msg: typeof raw.msg === 'string' ? raw.msg : '[implement] invalid_log_entry',
        ...(raw.data && typeof raw.data === 'object' ? { data: raw.data } : {}),
      } as BuildLogEntry;
    })
  );
}

function isProgramRunStatusResponse(value: unknown): value is {
  runId: string;
  artifactId: string;
  state: ToolchainRunState;
  ok: boolean | null;
  exitCode: number | null;
  logs: BuildLogEntry[];
  nextOffset: number;
  error?: string;
} {
  if (!value || typeof value !== 'object') return false;
  const v = value as {
    runId?: unknown;
    artifactId?: unknown;
    state?: unknown;
    ok?: unknown;
    exitCode?: unknown;
    logs?: unknown;
    nextOffset?: unknown;
    error?: unknown;
  };
  return (
    typeof v.runId === 'string' &&
    typeof v.artifactId === 'string' &&
    (v.state === 'running' || v.state === 'done' || v.state === 'error' || v.state === 'canceled') &&
    (typeof v.ok === 'boolean' || v.ok === null) &&
    (typeof v.exitCode === 'number' || v.exitCode === null) &&
    Array.isArray(v.logs) &&
    typeof v.nextOffset === 'number' &&
    (v.error === undefined || typeof v.error === 'string')
  );
}

function isBuildpackRunStatusResponse(value: unknown): value is BuildpackRunStatus {
  if (!value || typeof value !== 'object') return false;
  const v = value as {
    runId?: unknown;
    artifactId?: unknown;
    state?: unknown;
    ok?: unknown;
    exitCode?: unknown;
    logs?: unknown;
    nextOffset?: unknown;
    error?: unknown;
    artifact?: unknown;
  };
  return (
    typeof v.runId === 'string' &&
    typeof v.artifactId === 'string' &&
    (v.state === 'running' || v.state === 'done' || v.state === 'error' || v.state === 'canceled') &&
    (typeof v.ok === 'boolean' || v.ok === null) &&
    (typeof v.exitCode === 'number' || v.exitCode === null) &&
    Array.isArray(v.logs) &&
    typeof v.nextOffset === 'number' &&
    (v.error === undefined || typeof v.error === 'string') &&
    (v.artifact === undefined || (v.artifact !== null && typeof v.artifact === 'object'))
  );
}

function isBuildpackStatusResult(value: unknown): value is BuildpackStatusResult {
  if (!value || typeof value !== 'object') return false;
  const v = value as {
    schema_version?: unknown;
    ok?: unknown;
    run_id?: unknown;
    platformKey?: unknown;
    storeRoot?: unknown;
    installed?: unknown;
    tools?: unknown;
    logs?: unknown;
  };
  return (
    v.schema_version === 'toolchain_buildpack_status_v1' &&
    typeof v.ok === 'boolean' &&
    typeof v.run_id === 'string' &&
    typeof v.platformKey === 'string' &&
    typeof v.storeRoot === 'string' &&
    Array.isArray(v.installed) &&
    v.tools !== null &&
    typeof v.tools === 'object' &&
    Array.isArray(v.logs)
  );
}

function normalizeBuildpackToolStatus(rawTool: unknown): BuildpackToolStatus | undefined {
  if (!rawTool || typeof rawTool !== 'object') return undefined;
  const tool = rawTool as Record<string, unknown>;
  const source =
    tool.source === 'bundled' ||
    tool.source === 'buildpack' ||
    tool.source === 'system' ||
    tool.source === 'not_found' ||
    tool.source === 'found_not_in_path'
      ? tool.source
      : 'not_found';
  const status =
    tool.status === 'ok' || tool.status === 'found_not_in_path' || tool.status === 'missing'
      ? tool.status
      : 'missing';
  const integrity =
    tool.integrity === 'verified' || tool.integrity === 'corrupt' || tool.integrity === 'unknown'
      ? tool.integrity
      : source === 'bundled' || source === 'buildpack'
        ? 'unknown'
        : 'unknown';
  const normalized = {
    ok: tool.ok === true,
    source,
    status,
    integrity,
    ...(typeof tool.version === 'string' ? { version: tool.version } : {}),
    ...(typeof tool.path === 'string' ? { path: tool.path } : {}),
    ...(typeof tool.error === 'string' ? { error: tool.error } : {}),
    ...(typeof tool.suggestedFix === 'string' ? { suggestedFix: tool.suggestedFix } : {}),
  };
  return normalized;
}

function normalizeBuildpackStatusResult(input: BuildpackStatusResult): BuildpackStatusResult {
  const runId = typeof input.run_id === 'string' ? input.run_id : createRunId('buildpack-status');
  const installed = Array.isArray(input.installed)
    ? input.installed
        .map((pack) => ({
          name: typeof pack.name === 'string' ? pack.name : 'unknown',
          version: typeof pack.version === 'string' ? pack.version : 'unknown',
          platformKey: typeof pack.platformKey === 'string' ? pack.platformKey : null,
          installDir: typeof pack.installDir === 'string' ? pack.installDir : '',
          ok: pack.ok === true,
          integrity: pack.integrity === 'corrupt' ? 'corrupt' : 'verified',
          tools: Array.isArray(pack.tools)
            ? pack.tools
                .map((tool) => ({
                  name: typeof tool?.name === 'string' ? tool.name : 'unknown',
                  relPath: typeof tool?.relPath === 'string' ? tool.relPath : '',
                  version: typeof tool?.version === 'string' ? tool.version : null,
                }))
                .sort((left, right) => {
                  if (left.name !== right.name) return left.name.localeCompare(right.name);
                  return left.relPath.localeCompare(right.relPath);
                })
            : [],
          ...(typeof pack.error === 'string' ? { error: pack.error } : {}),
          ...(typeof pack.details === 'string' ? { details: pack.details } : {}),
        }))
        .sort((left, right) => {
          if (left.name !== right.name) return left.name.localeCompare(right.name);
          return left.version.localeCompare(right.version);
        })
    : [];
  const toolsRaw = input.tools && typeof input.tools === 'object' ? input.tools : {};
  const tools: BuildpackStatusResult['tools'] = {};
  for (const key of ['yosys', 'nextpnr-xilinx', 'f4pga', 'openFPGALoader'] as const) {
    const normalized = normalizeBuildpackToolStatus((toolsRaw as Record<string, unknown>)[key]);
    if (normalized) {
      (tools as Record<string, unknown>)[key] = normalized;
    }
  }
  return {
    schema_version: 'toolchain_buildpack_status_v1',
    ok: input.ok === true,
    run_id: runId,
    platformKey: typeof input.platformKey === 'string' ? input.platformKey : 'unknown',
    storeRoot: typeof input.storeRoot === 'string' ? input.storeRoot : '',
    installed,
    tools,
    logs: normalizeBuildpackLogs(input.logs, runId),
  };
}

function isBuildpackRemoveResult(value: unknown): value is BuildpackRemoveResult {
  if (!value || typeof value !== 'object') return false;
  const v = value as {
    schema_version?: unknown;
    ok?: unknown;
    run_id?: unknown;
    removed?: unknown;
    logs?: unknown;
    error?: unknown;
  };
  return (
    v.schema_version === 'toolchain_buildpack_remove_v1' &&
    typeof v.ok === 'boolean' &&
    typeof v.run_id === 'string' &&
    typeof v.removed === 'boolean' &&
    Array.isArray(v.logs) &&
    (v.error === undefined || typeof v.error === 'string')
  );
}

function isSynthArtifactRef(value: unknown): value is SynthArtifactRef {
  if (!value || typeof value !== 'object') return false;
  const artifact = value as Partial<SynthArtifactRef>;
  if (typeof artifact.artifactId !== 'string') return false;
  if (artifact.board !== 'basys3') return false;
  if (typeof artifact.top !== 'string') return false;
  if (typeof artifact.scriptVersion !== 'string') return false;
  if (!artifact.outputs || typeof artifact.outputs !== 'object') return false;
  const outputs = artifact.outputs as Partial<SynthArtifactRef['outputs']>;
  if (typeof outputs.netlistVerilog !== 'string') return false;
  if (typeof outputs.statText !== 'string') return false;
  if (outputs.statsJson !== undefined && typeof outputs.statsJson !== 'string') return false;
  if (artifact.yosysVersion !== undefined && artifact.yosysVersion !== null && typeof artifact.yosysVersion !== 'string') {
    return false;
  }
  if (artifact.buildPath !== undefined) {
    if (!artifact.buildPath || typeof artifact.buildPath !== 'object') return false;
    const buildPath = artifact.buildPath as { planId?: unknown; backend?: unknown };
    if (typeof buildPath.planId !== 'string') return false;
    if (normalizeImplementPlanBackend(buildPath.backend) !== buildPath.backend) return false;
  }
  return true;
}

function isImplementArtifactRef(value: unknown): value is ImplementArtifactRef {
  if (!value || typeof value !== 'object') return false;
  const artifact = value as Partial<ImplementArtifactRef>;
  if (typeof artifact.artifactId !== 'string') return false;
  if (artifact.board !== 'basys3') return false;
  if (typeof artifact.top !== 'string') return false;
  if (typeof artifact.planId !== 'string') return false;
  if (normalizeImplementPlanBackend(artifact.backend) !== artifact.backend) return false;
  if (typeof artifact.constraintsHash !== 'string') return false;
  if (!Array.isArray(artifact.commands) || !Array.isArray(artifact.requiredTools)) return false;
  if (!Array.isArray(artifact.sources) || !Array.isArray(artifact.outputs)) return false;
  return true;
}

function isSynthRunStatusResponse(value: unknown): value is SynthRunStatus {
  if (!value || typeof value !== 'object') return false;
  const v = value as {
    runId?: unknown;
    artifactId?: unknown;
    state?: unknown;
    ok?: unknown;
    exitCode?: unknown;
    logs?: unknown;
    nextOffset?: unknown;
    error?: unknown;
    artifact?: unknown;
  };
  return (
    typeof v.runId === 'string' &&
    typeof v.artifactId === 'string' &&
    (v.state === 'running' || v.state === 'done' || v.state === 'error' || v.state === 'canceled') &&
    (typeof v.ok === 'boolean' || v.ok === null) &&
    (typeof v.exitCode === 'number' || v.exitCode === null) &&
    Array.isArray(v.logs) &&
    typeof v.nextOffset === 'number' &&
    (v.error === undefined || typeof v.error === 'string') &&
    (v.artifact === undefined || isSynthArtifactRef(v.artifact))
  );
}

function isImplementRunStatusResponse(value: unknown): value is ImplementRunStatus {
  if (!value || typeof value !== 'object') return false;
  const v = value as {
    runId?: unknown;
    artifactId?: unknown;
    state?: unknown;
    ok?: unknown;
    exitCode?: unknown;
    logs?: unknown;
    nextOffset?: unknown;
    error?: unknown;
    artifact?: unknown;
  };
  return (
    typeof v.runId === 'string' &&
    typeof v.artifactId === 'string' &&
    (v.state === 'running' || v.state === 'done' || v.state === 'error' || v.state === 'canceled') &&
    (typeof v.ok === 'boolean' || v.ok === null) &&
    (typeof v.exitCode === 'number' || v.exitCode === null) &&
    Array.isArray(v.logs) &&
    typeof v.nextOffset === 'number' &&
    (v.error === undefined || typeof v.error === 'string') &&
    (v.artifact === undefined || isImplementArtifactRef(v.artifact))
  );
}

function isImplementBitstreamResponse(value: unknown): value is ImplementBitstreamOutput {
  if (!value || typeof value !== 'object') return false;
  const v = value as {
    runId?: unknown;
    artifactId?: unknown;
    filename?: unknown;
    bitstream?: unknown;
    output?: unknown;
  };
  if (typeof v.runId !== 'string') return false;
  if (typeof v.artifactId !== 'string') return false;
  if (typeof v.filename !== 'string') return false;
  if (!v.bitstream || typeof v.bitstream !== 'object') return false;
  const bitstream = v.bitstream as { kind?: unknown; data?: unknown };
  if (bitstream.kind !== 'base64') return false;
  if (typeof bitstream.data !== 'string' || bitstream.data.trim().length === 0) return false;
  if (v.output !== undefined) {
    if (!v.output || typeof v.output !== 'object') return false;
    const output = v.output as { kind?: unknown; name?: unknown };
    if (output.kind !== 'bitstream' && output.kind !== 'report' && output.kind !== 'output') return false;
    if (output.name !== undefined && typeof output.name !== 'string') return false;
  }
  return true;
}

export function createStudentReadinessSummary(input: {
  probe: ToolProbeResult | null;
  preflight: ToolchainPreflightStatus | null;
  buildPath: ToolchainBuildPath | null;
}): StudentReadinessSummary {
  const probeTools = input.probe?.tools ?? [];
  const missingProbeTools = probeTools.filter((tool) => tool.ok !== true);
  const hasProbeData = probeTools.length > 0;
  const probeGate: StudentReadinessGate = hasProbeData
    ? missingProbeTools.length === 0
      ? {
          id: 'toolchain_probe',
          label: 'Toolchain Probe',
          state: 'pass',
          detail: 'Required tool probes completed.',
        }
      : {
          id: 'toolchain_probe',
          label: 'Toolchain Probe',
          state: 'warn',
          detail: `${missingProbeTools.length} tool(s) need action.`,
          nextAction: 'Open /toolchain and run Verify Setup for missing tool fixes.',
        }
    : {
        id: 'toolchain_probe',
        label: 'Toolchain Probe',
        state: 'fail',
        detail: 'Toolchain probe has not been captured.',
        nextAction: 'Run Verify Setup to capture tool probe results.',
      };

  const preflightGate: StudentReadinessGate = input.preflight
    ? input.preflight.overallOk
      ? {
          id: 'preflight',
          label: 'Preflight',
          state: 'pass',
          detail: 'HDL/XDC preflight checks passed.',
        }
      : {
          id: 'preflight',
          label: 'Preflight',
          state: 'fail',
          detail: `Preflight blocked (${input.preflight.lint.errors.length} error(s)).`,
          nextAction: 'Fix HDL/XDC lint errors before build actions.',
        }
    : {
        id: 'preflight',
        label: 'Preflight',
        state: 'fail',
        detail: 'Preflight has not been run.',
        nextAction: 'Run preflight from the HDL panel or setup page.',
      };

  const implementGate: StudentReadinessGate = input.buildPath
    ? input.buildPath.backend !== 'none'
      ? {
          id: 'implement_plan',
          label: 'Implement Plan',
          state: 'pass',
          detail: `Backend selected: ${input.buildPath.backend}.`,
        }
      : {
          id: 'implement_plan',
          label: 'Implement Plan',
          state: 'warn',
          detail: 'No implement backend resolved.',
          nextAction: 'Install or repair required tools/buildpack, then rerun plan.',
        }
    : {
        id: 'implement_plan',
        label: 'Implement Plan',
        state: 'fail',
        detail: 'Implement plan has not been resolved.',
        nextAction: 'Run Plan Implementation from the HDL panel or setup page.',
      };

  const toolchainUiGate: StudentReadinessGate =
    probeGate.state === 'fail' || preflightGate.state === 'fail' || implementGate.state === 'fail'
      ? {
          id: 'toolchain_ui',
          label: 'Toolchain UI Gating',
          state: 'fail',
          detail: 'One or more readiness checks are failing.',
          nextAction: 'Resolve failed gates before running implement/program actions.',
        }
      : {
          id: 'toolchain_ui',
          label: 'Toolchain UI Gating',
          state: 'pass',
          detail: 'Actions are correctly gated by readiness state.',
        };

  const doctorExportGate: StudentReadinessGate = {
    id: 'doctor_export',
    label: 'Doctor Report Export',
    state: 'pass',
    detail: 'Doctor report export is available for submission/triage.',
  };

  const gates: StudentReadinessGate[] = [
    probeGate,
    preflightGate,
    implementGate,
    toolchainUiGate,
    doctorExportGate,
  ];
  const overall = gates.every((gate) => gate.state === 'pass') ? 'ready' : 'needs_action';
  return {
    schema_version: 'student_readiness_v1',
    overall,
    gates,
  };
}

export function createToolchainDoctorReport(input: {
  backend_id: ToolchainBackendId;
  bridge_url: string;
  probe: ToolProbeResult | null;
  preflight?: ToolchainPreflightStatus | null;
  buildPath?: ToolchainBuildPath | null;
  project?: ToolchainProjectSnapshotInput;
  logs: BuildLogEntry[];
}): ToolchainDoctorReport {
  const normalizedProbe = input.probe
    ? {
        ...input.probe,
        tools: normalizeProbeTools(input.probe.tools ?? []),
        logs: sortLogsByRunTs(input.probe.logs ?? []),
      }
    : null;

  const normalizedProject = input.project ? normalizeSnapshotInput(input.project) : null;
  const computedPreflight = input.preflight
    ? normalizePreflightStatus(input.preflight)
    : normalizedProject
      ? createToolchainPreflightStatus({
          backend_id: input.backend_id,
          snapshot: normalizedProject,
          probe: normalizedProbe,
        })
      : null;

  const computedBuildPath = input.buildPath
    ? normalizeToolchainBuildPath(input.buildPath)
    : normalizedProject
      ? buildPathFromImplementPlan({
          backend_id: input.backend_id,
          snapshot: normalizedProject,
          plan: createToolchainImplementPlan({
            backend_id: input.backend_id,
            snapshot: normalizedProject,
            probe: normalizedProbe,
          }),
        })
      : null;

  const projectSummary = normalizedProject ? buildDoctorProjectSummary(normalizedProject) : undefined;
  const sortedLogs = sortLogsByRunTs(input.logs).slice(-200);
  const studentReadiness = createStudentReadinessSummary({
    probe: normalizedProbe,
    preflight: computedPreflight,
    buildPath: computedBuildPath,
  });

  const reportHashPayload = {
    backend_id: input.backend_id,
    bridge_url: input.bridge_url,
    probe: normalizeProbeForHash(normalizedProbe),
    preflight: computedPreflight
      ? {
          project: computedPreflight.project,
          lint: {
            ok: computedPreflight.lint.ok,
            warnings: computedPreflight.lint.warnings.map((entry) => entry.msg),
            errors: computedPreflight.lint.errors.map((entry) => entry.msg),
          },
          tools: normalizeProbeTools(computedPreflight.tools ?? []).map((tool) => ({
            name: tool.name,
            ok: tool.ok,
            status: tool.status,
            source: tool.source,
            integrity: tool.integrity ?? null,
            version: tool.version ?? null,
            path: tool.path ?? null,
            error: tool.error ?? null,
            suggestedFix: tool.suggestedFix ?? null,
            alternates: Array.isArray(tool.alternates)
              ? tool.alternates.map((alternate) => ({
                  source: alternate.source ?? null,
                  status: alternate.status ?? null,
                  integrity: alternate.integrity ?? null,
                  version: alternate.version ?? null,
                  path: alternate.path ?? null,
                  error: alternate.error ?? null,
                }))
              : [],
          })),
          overallOk: computedPreflight.overallOk,
        }
      : null,
    projectSummary: projectSummary ?? null,
    studentReadiness: {
      overall: studentReadiness.overall,
      gates: studentReadiness.gates.map((gate) => ({
        id: gate.id,
        state: gate.state,
        detail: gate.detail,
        nextAction: gate.nextAction ?? null,
      })),
    },
    buildPath: computedBuildPath
      ? {
          planId: computedBuildPath.planId,
          backend: computedBuildPath.backend,
          buildpack: computedBuildPath.buildpack
            ? {
                name: computedBuildPath.buildpack.name,
                version: computedBuildPath.buildpack.version,
              }
            : null,
          board: computedBuildPath.board,
          top: computedBuildPath.top,
          constraintsPreset: computedBuildPath.constraintsPreset,
          requiredTools: computedBuildPath.requiredTools.map((tool) => ({
            name: tool.name,
            ok: tool.ok,
            version: tool.version ?? null,
            source: tool.source ?? null,
            integrity: tool.integrity ?? null,
            why: tool.why,
          })),
          commands: computedBuildPath.commands.map((command) => ({
            step: command.step,
            argv: command.argv,
            envKeysUsed: command.envKeysUsed,
          })),
          outputs: computedBuildPath.outputs,
          warnings: computedBuildPath.warnings.map((entry) => entry.msg),
        }
      : null,
    logs: sortedLogs.map((entry) => ({
      step: entry.step,
      level: entry.level,
      msg: entry.msg,
    })),
  };

  const reportId = deterministicId(`${input.backend_id}-doctor`, reportHashPayload);

  return {
    schema_version: 'rb_toolchain_doctor_v1',
    reportId,
    backend_id: input.backend_id,
    bridge_url: input.bridge_url,
    probe: normalizedProbe,
    ...(computedPreflight ? { preflight: computedPreflight } : {}),
    ...(computedBuildPath ? { buildPath: computedBuildPath } : {}),
    ...(projectSummary ? { projectSummary } : {}),
    studentReadiness,
    logs: sortedLogs,
  };
}

function makeStubBackend(id: ToolchainBackendId): ToolchainBackend {
  const cacheProbe = (probe: ToolProbeResult): ToolProbeResult => {
    lastProbeByBackend[id] = probe;
    return probe;
  };
  const cacheBuildPath = (buildPath: ToolchainBuildPath): ToolchainBuildPath => {
    const normalized = normalizeToolchainBuildPath(buildPath);
    const existing = buildPathCacheByBackend[id] ?? new Map<string, ToolchainBuildPath>();
    existing.set(normalized.planId, normalized);
    buildPathCacheByBackend[id] = existing;
    lastBuildPathByBackend[id] = normalized;
    return normalized;
  };
  const getCachedBuildPathByPlanId = (planId: string | null | undefined): ToolchainBuildPath | null => {
    if (!planId) return null;
    const cache = buildPathCacheByBackend[id];
    if (!cache) return null;
    return cache.get(planId) ?? null;
  };

  const backend: ToolchainBackend = {
    id,
    async synthesize(_input, sink) {
      const run_id = createRunId(`${id}-synth`);
      sink?.log({ run_id, ts: 0, step: 'synth', level: 'info', msg: `[${id}] synthesize: not implemented` });
      return { kind: 'netlist', backend: id, format: 'stub' };
    },
    async implement(_netlist, sink) {
      const run_id = createRunId(`${id}-pnr`);
      sink?.log({ run_id, ts: 0, step: 'pnr', level: 'info', msg: `[${id}] implement: not implemented` });
      return { kind: 'implemented', backend: id, format: 'stub' };
    },
    async bitgen(_implemented, sink) {
      const run_id = createRunId(`${id}-bitgen`);
      sink?.log({ run_id, ts: 0, step: 'bitgen', level: 'info', msg: `[${id}] bitgen: not implemented` });
      return { kind: 'bitstream', backend: id, format: 'stub' };
    },
    async program(_bitstream, board, sink) {
      const run_id = createRunId(`${id}-program`);
      sink?.log({ run_id, ts: 0, step: 'program', level: 'info', msg: `[${id}] program(${board}): not implemented` });
      return { ok: false, backend: id };
    },
    async probeTools() {
      if (typeof fetch === 'undefined') {
        const run_id = createRunId(`${id}-probe`);
        const { entries, emit } = makeEntrySink(run_id);
        emit({ level: 'info', step: 'probe', msg: `[${id}] probe: starting` });
        emit({ level: 'error', step: 'probe', msg: `[${id}] probe: fetch_unavailable` });
        return cacheProbe({
          schema_version: 'toolchain_probe_v1',
          ok: false,
          run_id,
          env: undefined,
          tools: [],
          logs: entries,
        });
      }

      const probeUrl = `${BRIDGE_URL}/api/toolchain/probe`;

      try {
        const res = await fetchJsonWithTimeout(probeUrl, 2000);
        if (isToolProbeResult(res.data)) {
          return cacheProbe({
            ...res.data,
            tools: normalizeProbeTools(res.data.tools ?? []),
            logs: sortLogsByRunTs(res.data.logs ?? []),
          });
        }

        if (res.status !== 404) {
          const run_id = createRunId(`${id}-probe`);
          const { entries, emit } = makeEntrySink(run_id);
          const error = res.ok ? 'bridge_bad_response' : `bridge_http_${res.status}`;
          emit({ level: 'info', step: 'probe', msg: `[${id}] probe: starting` });
          emit({ level: 'error', step: 'probe', msg: `[${id}] probe: failed: ${error}` });
          return cacheProbe({
            schema_version: 'toolchain_probe_v1',
            ok: false,
            run_id,
            env: undefined,
            tools: [{ name: 'bridge', ok: false, error }],
            logs: entries,
          });
        }

        // Backward compatibility fallback: older bridge without /api/toolchain/probe.
        const run_id = createRunId(`${id}-probe`);
        const { entries, emit } = makeEntrySink(run_id);
        emit({ level: 'info', step: 'probe', msg: `[${id}] probe: starting` });

        const legacyUrl = `${BRIDGE_URL}/api/toolchain`;
        emit({ level: 'info', step: 'probe', msg: `[${id}] probe: legacy GET ${legacyUrl}` });

        let legacyRes: Awaited<ReturnType<typeof fetchJsonWithTimeout>>;
        try {
          legacyRes = await fetchJsonWithTimeout(legacyUrl, 2000);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'bridge_unreachable';
          const errorCode =
            typeof window !== 'undefined' && window.location?.protocol === 'https:'
              ? 'local_toolchain_unavailable_in_https_context'
              : 'bridge_unreachable';
          emit({ level: 'error', step: 'probe', msg: `[${id}] probe: failed: ${errorCode}: ${message}` });
          return cacheProbe({
            schema_version: 'toolchain_probe_v1',
            ok: false,
            run_id,
            env: undefined,
            tools: [{ name: 'bridge', ok: false, error: errorCode }],
            logs: entries,
          });
        }

        if (!legacyRes.ok || !legacyRes.data || legacyRes.data.ok !== true) {
          const error = legacyRes?.data?.error ? String(legacyRes.data.error) : `bridge_http_${legacyRes.status}`;
          emit({ level: 'error', step: 'probe', msg: `[${id}] probe: failed: ${error}` });
          return cacheProbe({
            schema_version: 'toolchain_probe_v1',
            ok: false,
            run_id,
            env: undefined,
            tools: [{ name: 'bridge', ok: false, error }],
            logs: entries,
          });
        }

        const caps = (legacyRes.data.capabilities ?? {}) as Record<string, any>;
        const tools: ToolProbeTool[] = [];

        const pushTool = (name: string, capKey: string) => {
          const cap = caps?.[capKey];
          if (!cap) {
            tools.push(normalizeProbeTool({ name, ok: false, status: 'missing', source: 'not_found', integrity: 'unknown', error: 'not_found' }));
            return;
          }
          const status =
            cap?.status === 'ok' || cap?.status === 'found_not_in_path' || cap?.status === 'missing'
              ? cap.status
              : 'ok';
          const source =
            cap?.source === 'bundled' ||
            cap?.source === 'buildpack' ||
            cap?.source === 'system' ||
            cap?.source === 'not_found' ||
            cap?.source === 'found_not_in_path'
              ? cap.source
              : status === 'found_not_in_path'
                ? 'found_not_in_path'
                : status === 'missing'
                  ? 'not_found'
                  : 'system';
          tools.push(
            normalizeProbeTool({
              name,
              ok: status !== 'missing',
              status,
              source,
              integrity:
                cap?.integrity === 'verified' || cap?.integrity === 'corrupt' || cap?.integrity === 'unknown'
                  ? cap.integrity
                  : source === 'bundled' || source === 'buildpack'
                    ? 'unknown'
                    : undefined,
              version: typeof cap.version === 'string' ? cap.version : undefined,
              path: typeof cap.path === 'string' ? cap.path : undefined,
              error: typeof cap.error === 'string' ? cap.error : undefined,
              suggestedFix: typeof cap.suggestedFix === 'string' ? cap.suggestedFix : undefined,
              buildpackName: typeof cap.buildpackName === 'string' ? cap.buildpackName : undefined,
              buildpackVersion: typeof cap.buildpackVersion === 'string' ? cap.buildpackVersion : undefined,
              alternates: Array.isArray(cap.alternates)
                ? cap.alternates.map((alternate: any) => ({
                    source:
                      alternate?.source === 'bundled' ||
                      alternate?.source === 'buildpack' ||
                      alternate?.source === 'system' ||
                      alternate?.source === 'not_found' ||
                      alternate?.source === 'found_not_in_path'
                        ? alternate.source
                        : 'not_found',
                    status:
                      alternate?.status === 'ok' ||
                      alternate?.status === 'found_not_in_path' ||
                      alternate?.status === 'missing'
                        ? alternate.status
                        : 'missing',
                    integrity:
                      alternate?.integrity === 'verified' ||
                      alternate?.integrity === 'corrupt' ||
                      alternate?.integrity === 'unknown'
                        ? alternate.integrity
                        : 'unknown',
                    ...(typeof alternate?.version === 'string' ? { version: alternate.version } : {}),
                    ...(typeof alternate?.path === 'string' ? { path: alternate.path } : {}),
                    ...(typeof alternate?.error === 'string' ? { error: alternate.error } : {}),
                    ...(typeof alternate?.buildpackName === 'string' ? { buildpackName: alternate.buildpackName } : {}),
                    ...(typeof alternate?.buildpackVersion === 'string' ? { buildpackVersion: alternate.buildpackVersion } : {}),
                  }))
                : undefined,
            })
          );
        };

        pushTool('openFPGALoader', 'openFPGALoader');
        pushTool('yosys', 'yosys');
        pushTool('nextpnr-xilinx', 'nextpnrXilinx');
        pushTool('f4pga', 'f4pga');
        pushTool('vivado', 'vivado');

        for (const tool of tools) {
          if (tool.ok) {
            if (tool.status === 'found_not_in_path') {
              emit({
                level: 'warn',
                step: 'probe',
                msg: `[${id}] probe: ${tool.name}: found_not_in_path${tool.path ? ` (${tool.path})` : ''}`,
              });
              if (tool.suggestedFix) {
                emit({
                  level: 'warn',
                  step: 'probe',
                  msg: `[${id}] probe: ${tool.name}: fix: ${tool.suggestedFix}`,
                });
              }
              continue;
            }
            emit({
              level: 'info',
              step: 'probe',
              msg: `[${id}] probe: ${tool.name}: ok${tool.version ? ` (${tool.version})` : ''}`,
            });
          } else {
            emit({
              level: 'warn',
              step: 'probe',
              msg: `[${id}] probe: ${tool.name}: missing${tool.error ? ` (${tool.error})` : ''}`,
            });
          }
        }

        emit({ level: 'info', step: 'probe', msg: `[${id}] probe: complete` });
        const normalizedTools = normalizeProbeTools(tools);
        const ok = normalizedTools.some((t) => t.ok);
        return cacheProbe({
          schema_version: 'toolchain_probe_v1',
          ok,
          run_id,
          env: undefined,
          tools: normalizedTools,
          logs: entries,
        });
      } catch (err) {
        const run_id = createRunId(`${id}-probe`);
        const { entries, emit } = makeEntrySink(run_id);
        emit({ level: 'info', step: 'probe', msg: `[${id}] probe: starting` });
        const message = err instanceof Error ? err.message : 'bridge_unreachable';
        const errorCode =
          typeof window !== 'undefined' && window.location?.protocol === 'https:'
            ? 'local_toolchain_unavailable_in_https_context'
            : 'bridge_unreachable';
        emit({ level: 'error', step: 'probe', msg: `[${id}] probe: failed: ${errorCode}: ${message}` });
        return cacheProbe({
          schema_version: 'toolchain_probe_v1',
          ok: false,
          run_id,
          env: undefined,
          tools: [{ name: 'bridge', ok: false, error: errorCode }],
          logs: entries,
        });
      }
    },
    async preflight(snapshot, options) {
      const normalizedSnapshot = normalizeSnapshotInput(snapshot);

      let probe = lastProbeByBackend[id] ?? null;
      if (options?.refreshProbe) {
        try {
          probe = await backend.probeTools();
        } catch {
          probe = null;
        }
      }

      if (typeof fetch !== 'undefined') {
        const preflightUrl = `${BRIDGE_URL}/api/toolchain/preflight`;
        const payload = {
          schema_version: 'toolchain_preflight_request_v1',
          backend_id: id,
          refresh_probe: Boolean(options?.refreshProbe),
          project: normalizedSnapshot,
        };
        try {
          const res = await fetchJsonWithTimeout(preflightUrl, 2000, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (isToolchainPreflightStatus(res.data)) {
            return res.data;
          }
        } catch {
          // local fallback below
        }
      }

      return createToolchainPreflightStatus({
        backend_id: id,
        snapshot: normalizedSnapshot,
        probe,
      });
    },
    async resolveBuildPath(snapshot, options) {
      const normalizedSnapshot = normalizeSnapshotInput(snapshot);
      const projectSummary = buildProjectSummaryForBuildPath(normalizedSnapshot);
      const probe = options?.refreshProbe ? await backend.probeTools().catch(() => null) : lastProbeByBackend[id] ?? null;
      const probeSummary = normalizeProbeTools(probe?.tools ?? []).map((tool) => ({
        name: tool.name,
        ok: tool.ok,
        status: tool.status,
        source: tool.source,
        integrity: tool.integrity ?? null,
        version: tool.version ?? null,
        path: tool.path ?? null,
        error: tool.error ?? null,
        suggestedFix: tool.suggestedFix ?? null,
        buildpackName: tool.buildpackName ?? null,
        buildpackVersion: tool.buildpackVersion ?? null,
        alternates: Array.isArray(tool.alternates)
          ? tool.alternates.map((alternate) => ({
              source: alternate.source ?? null,
              status: alternate.status ?? null,
              integrity: alternate.integrity ?? null,
              version: alternate.version ?? null,
              path: alternate.path ?? null,
              error: alternate.error ?? null,
              buildpackName: alternate.buildpackName ?? null,
              buildpackVersion: alternate.buildpackVersion ?? null,
            }))
          : [],
      }));
      const inputCacheKey = deterministicId(`${id}-build-path-input`, {
        plannerVersion: TOOLCHAIN_PLANNER_VERSION,
        project: projectSummary,
        probe: probeSummary,
      });
      const inputCache = buildPathInputKeyByBackend[id] ?? new Map<string, string>();
      const cachedByInput = getCachedBuildPathByPlanId(inputCache.get(inputCacheKey));
      if (cachedByInput) {
        buildPathInputKeyByBackend[id] = inputCache;
        return cachedByInput;
      }
      const precomputedBackend = chooseImplementPlanBackend(probe, id);
      const precomputedRequiredTools = buildImplementPlanRequiredTools(probe, precomputedBackend);
      const precomputedBuildpack = resolveImplementPlanBuildpack(probe, precomputedBackend);
      const candidatePlanId = deriveBuildPathPlanId({
        backend_id: id,
        snapshot: normalizedSnapshot,
        backend: precomputedBackend,
        requiredTools: precomputedRequiredTools,
        buildpack: precomputedBuildpack,
      });
      const cached = getCachedBuildPathByPlanId(candidatePlanId);
      if (cached) {
        inputCache.set(inputCacheKey, cached.planId);
        buildPathInputKeyByBackend[id] = inputCache;
        return cached;
      }

      const plan = await backend.implementPlan(normalizedSnapshot, { refreshProbe: options?.refreshProbe });
      const buildPath = buildPathFromImplementPlan({
        backend_id: id,
        snapshot: normalizedSnapshot,
        plan,
      });

      const deterministicPlanId = deriveBuildPathPlanId({
        backend_id: id,
        snapshot: normalizedSnapshot,
        backend: buildPath.backend,
        requiredTools: buildPath.requiredTools,
        buildpack: buildPath.buildpack,
      });

      const cachedPath = cacheBuildPath({
        ...buildPath,
        planId: deterministicPlanId,
        board: projectSummary.board,
        top: projectSummary.top,
        constraintsPreset: projectSummary.preset,
      });
      inputCache.set(inputCacheKey, cachedPath.planId);
      buildPathInputKeyByBackend[id] = inputCache;
      return cachedPath;
    },
    async implementPlan(snapshot, options) {
      const normalizedSnapshot = normalizeSnapshotInput(snapshot);

      let probe = options?.refreshProbe ? null : lastProbeByBackend[id] ?? null;
      if (!probe || options?.refreshProbe) {
        try {
          probe = await backend.probeTools();
        } catch {
          probe = null;
        }
      }

      if (typeof fetch !== 'undefined') {
        const planUrl = `${BRIDGE_URL}/api/toolchain/implement/plan`;
        const payload: ImplementPlanRequest = {
          schema_version: 'toolchain_implement_plan_request_v1',
          backend_id: id,
          refresh_probe: Boolean(options?.refreshProbe),
          project: {
            hdl: {
              sources: normalizedSnapshot.hdl.sources.map((source) => ({
                path: source.path,
                language: source.language,
                text: source.text,
              })),
              top: normalizeTop(normalizedSnapshot.hdl.top, normalizedSnapshot.fpga.top),
            },
            fpga: {
              board: normalizedSnapshot.fpga.board,
              constraints: normalizedSnapshot.fpga.constraints
                ? {
                    type: 'xdc',
                    text: normalizedSnapshot.fpga.constraints.text,
                  }
                : null,
              preset: normalizedSnapshot.fpga.preset ?? null,
              top: normalizeTop(normalizedSnapshot.hdl.top, normalizedSnapshot.fpga.top),
            },
          },
        };
        try {
          const res = await fetchJsonWithTimeout(planUrl, 3000, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (isImplementPlanResult(res.data)) {
            const normalizedPlan = normalizeImplementPlanResult(res.data);
            const buildPath = buildPathFromImplementPlan({
              backend_id: id,
              snapshot: normalizedSnapshot,
              plan: normalizedPlan,
            });
            cacheBuildPath({
              ...buildPath,
              planId: deriveBuildPathPlanId({
                backend_id: id,
                snapshot: normalizedSnapshot,
                backend: buildPath.backend,
                requiredTools: buildPath.requiredTools,
                buildpack: buildPath.buildpack,
              }),
            });
            return normalizedPlan;
          }
        } catch {
          // local fallback below
        }
      }

      const fallbackPlan = createToolchainImplementPlan({
        backend_id: id,
        snapshot: normalizedSnapshot,
        probe,
      });
      const fallbackBuildPath = buildPathFromImplementPlan({
        backend_id: id,
        snapshot: normalizedSnapshot,
        plan: fallbackPlan,
      });
      cacheBuildPath({
        ...fallbackBuildPath,
        planId: deriveBuildPathPlanId({
          backend_id: id,
          snapshot: normalizedSnapshot,
          backend: fallbackBuildPath.backend,
          requiredTools: fallbackBuildPath.requiredTools,
          buildpack: fallbackBuildPath.buildpack,
        }),
      });
      return fallbackPlan;
    },
    async synth(input) {
      let resolvedBuildPath: ToolchainBuildPath | null = null;
      const explicitPlanId = typeof input.buildPath?.planId === 'string' ? input.buildPath.planId.trim() : '';
      if (explicitPlanId.length > 0) {
        const cached = getCachedBuildPathByPlanId(explicitPlanId);
        if (cached) {
          resolvedBuildPath = cached;
        } else if (lastBuildPathByBackend[id]?.planId === explicitPlanId) {
          resolvedBuildPath = lastBuildPathByBackend[id] ?? null;
        }
      }
      if (!resolvedBuildPath) {
        const snapshot: ToolchainProjectSnapshotInput = {
          hdl: {
            sources: input.sources.map((source) => ({
              path: source.path,
              language: source.language,
              text: source.text,
            })),
            top: input.top,
          },
          fpga: {
            board: input.board,
            top: input.top,
          },
        };
        resolvedBuildPath = await backend.resolveBuildPath(snapshot, { refreshProbe: false });
      }

      const normalizedPayload = encodeSynthRequestPayload({
        ...input,
        buildPath: {
          planId: resolvedBuildPath.planId,
          backend: resolvedBuildPath.backend,
        },
      });
      const runId = createRunId(`${id}-synth-run`);
      const fallbackArtifactId = deriveSynthArtifactId(normalizedPayload);
      const fallbackLogs: BuildLogEntry[] = [];
      let ts = 0;
      const push = (level: ToolchainLogLevel, msg: string, data?: Record<string, unknown>) => {
        fallbackLogs.push({
          run_id: runId,
          ts: ts++,
          step: 'synth',
          level,
          msg,
          ...(data ? { data } : {}),
        });
      };

      push('info', `[${id}] synth: starting`);
      push('info', `[${id}] synth: build-path ${resolvedBuildPath.planId} (${resolvedBuildPath.backend})`, {
        planId: resolvedBuildPath.planId,
        backend: resolvedBuildPath.backend,
      });

      const probe = await backend.probeTools();
      const yosys = (probe.tools ?? []).find((tool) => tool.name === 'yosys');
      if (!yosys?.ok) {
        push('error', `[${id}] synth: yosys_missing`);
        return {
          runId,
          artifactId: fallbackArtifactId,
          state: 'error',
          ok: false,
          exitCode: null,
          logs: fallbackLogs,
          nextOffset: fallbackLogs.length,
          error: 'yosys_missing',
          artifact: {
            artifactId: fallbackArtifactId,
            board: normalizedPayload.board,
            top: normalizedPayload.top,
            scriptVersion: SYNTH_SCRIPT_VERSION,
            buildPath: {
              planId: resolvedBuildPath.planId,
              backend: resolvedBuildPath.backend,
            },
            outputs: {
              netlistVerilog: '',
              statText: '',
            },
          },
        };
      }

      if (typeof fetch === 'undefined') {
        push('error', `[${id}] synth: fetch_unavailable`);
        return {
          runId,
          artifactId: deriveSynthArtifactId(normalizedPayload, yosys.version ?? null),
          state: 'error',
          ok: false,
          exitCode: null,
          logs: fallbackLogs,
          nextOffset: fallbackLogs.length,
          error: 'fetch_unavailable',
          artifact: {
            artifactId: deriveSynthArtifactId(normalizedPayload, yosys.version ?? null),
            board: normalizedPayload.board,
            top: normalizedPayload.top,
            yosysVersion: yosys.version ?? null,
            scriptVersion: SYNTH_SCRIPT_VERSION,
            buildPath: {
              planId: resolvedBuildPath.planId,
              backend: resolvedBuildPath.backend,
            },
            outputs: {
              netlistVerilog: '',
              statText: '',
            },
          },
        };
      }

      const synthUrl = `${BRIDGE_URL}/api/toolchain/synth`;
      push('info', `[${id}] synth: POST ${synthUrl}`, {
        board: normalizedPayload.board,
        top: normalizedPayload.top,
        sourceCount: normalizedPayload.sources.length,
        buildPathPlanId: resolvedBuildPath.planId,
        buildPathBackend: resolvedBuildPath.backend,
      });

      try {
        const res = await fetchJsonWithTimeout(synthUrl, 120000, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(normalizedPayload),
        });
        if (isSynthRunStatusResponse(res.data)) {
          return {
            runId: res.data.runId,
            artifactId: res.data.artifactId,
            state: normalizeProgramRunState(res.data.state),
            ok: res.data.ok,
            exitCode: res.data.exitCode,
            logs: normalizeSynthLogs(res.data.logs, res.data.runId),
            nextOffset: res.data.nextOffset,
            ...(res.data.error ? { error: res.data.error } : {}),
            ...(res.data.artifact ? { artifact: res.data.artifact } : {}),
          };
        }

        const error = res.ok ? 'bridge_bad_response' : `bridge_http_${res.status}`;
        push('error', `[${id}] synth: failed: ${error}`);
        return {
          runId,
          artifactId: deriveSynthArtifactId(normalizedPayload, yosys.version ?? null),
          state: 'error',
          ok: false,
          exitCode: null,
          logs: fallbackLogs,
          nextOffset: fallbackLogs.length,
          error,
          artifact: {
            artifactId: deriveSynthArtifactId(normalizedPayload, yosys.version ?? null),
            board: normalizedPayload.board,
            top: normalizedPayload.top,
            yosysVersion: yosys.version ?? null,
            scriptVersion: SYNTH_SCRIPT_VERSION,
            buildPath: {
              planId: resolvedBuildPath.planId,
              backend: resolvedBuildPath.backend,
            },
            outputs: {
              netlistVerilog: '',
              statText: '',
            },
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'bridge_unreachable';
        push('error', `[${id}] synth: failed: ${message}`);
        return {
          runId,
          artifactId: deriveSynthArtifactId(normalizedPayload, yosys.version ?? null),
          state: 'error',
          ok: false,
          exitCode: null,
          logs: fallbackLogs,
          nextOffset: fallbackLogs.length,
          error: 'bridge_unreachable',
          artifact: {
            artifactId: deriveSynthArtifactId(normalizedPayload, yosys.version ?? null),
            board: normalizedPayload.board,
            top: normalizedPayload.top,
            yosysVersion: yosys.version ?? null,
            scriptVersion: SYNTH_SCRIPT_VERSION,
            buildPath: {
              planId: resolvedBuildPath.planId,
              backend: resolvedBuildPath.backend,
            },
            outputs: {
              netlistVerilog: '',
              statText: '',
            },
          },
        };
      }
    },
    async getSynthRunStatus(runId, offset = 0) {
      const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;

      if (typeof fetch === 'undefined') {
        return {
          runId,
          artifactId: runId,
          state: 'error',
          ok: false,
          exitCode: null,
          logs: [
            {
              run_id: runId,
              ts: safeOffset,
              step: 'synth',
              level: 'error',
              msg: `[${id}] synth-run-status: fetch_unavailable`,
            },
          ],
          nextOffset: safeOffset + 1,
          error: 'fetch_unavailable',
        };
      }

      const statusUrl = `${BRIDGE_URL}/api/toolchain/synth/runs/${encodeURIComponent(runId)}?offset=${safeOffset}`;
      try {
        const res = await fetchJsonWithTimeout(statusUrl, 5000);
        if (isSynthRunStatusResponse(res.data)) {
          return {
            runId: res.data.runId,
            artifactId: res.data.artifactId,
            state: normalizeProgramRunState(res.data.state),
            ok: res.data.ok,
            exitCode: res.data.exitCode,
            logs: normalizeSynthLogs(res.data.logs, res.data.runId),
            nextOffset: res.data.nextOffset,
            ...(res.data.error ? { error: res.data.error } : {}),
            ...(res.data.artifact ? { artifact: res.data.artifact } : {}),
          };
        }

        const error = res.ok ? 'bridge_bad_response' : `bridge_http_${res.status}`;
        return {
          runId,
          artifactId: runId,
          state: 'error',
          ok: false,
          exitCode: null,
          logs: [
            {
              run_id: runId,
              ts: safeOffset,
              step: 'synth',
              level: 'error',
              msg: `[${id}] synth-run-status: failed: ${error}`,
            },
          ],
          nextOffset: safeOffset + 1,
          error,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'bridge_unreachable';
        return {
          runId,
          artifactId: runId,
          state: 'error',
          ok: false,
          exitCode: null,
          logs: [
            {
              run_id: runId,
              ts: safeOffset,
              step: 'synth',
              level: 'error',
              msg: `[${id}] synth-run-status: failed: ${message}`,
            },
          ],
          nextOffset: safeOffset + 1,
          error: 'bridge_unreachable',
        };
      }
    },
    openSynthRunStream(runId, handlers, options) {
      const offset = Number.isFinite(options?.offset) ? Math.max(0, Math.floor(options?.offset ?? 0)) : 0;
      if (typeof EventSource === 'undefined') {
        handlers.onError?.('eventsource_unavailable');
        return null;
      }

      const streamUrl = `${BRIDGE_URL}/api/toolchain/synth/runs/${encodeURIComponent(runId)}/stream?offset=${offset}`;
      const source = new EventSource(streamUrl);

      source.addEventListener('log', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data ?? 'null');
          const normalized = normalizeSynthLogs([payload], runId);
          if (normalized[0]) handlers.onLog?.(normalized[0]);
        } catch {
          handlers.onError?.('stream_bad_log');
        }
      });

      source.addEventListener('done', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data ?? 'null') as Partial<SynthRunDoneSummary>;
          const state =
            payload.state === 'error' || payload.state === 'canceled' ? payload.state : 'done';
          handlers.onDone?.({
            runId: typeof payload.runId === 'string' ? payload.runId : runId,
            artifactId: typeof payload.artifactId === 'string' ? payload.artifactId : runId,
            state,
            ok: payload.ok === true,
            exitCode: typeof payload.exitCode === 'number' ? payload.exitCode : null,
            nextOffset: typeof payload.nextOffset === 'number' ? payload.nextOffset : offset,
            ...(typeof payload.error === 'string' ? { error: payload.error } : {}),
            ...(isSynthArtifactRef(payload.artifact) ? { artifact: payload.artifact } : {}),
          });
        } catch {
          handlers.onError?.('stream_bad_done');
        } finally {
          source.close();
        }
      });

      source.onerror = () => {
        handlers.onError?.('stream_error');
        source.close();
      };

      return {
        close: () => {
          source.close();
        },
      };
    },
    async downloadSynthArtifacts(runId, options) {
      const safeRunId = typeof runId === 'string' ? runId.trim() : '';
      if (!safeRunId) {
        throw new Error('run_id_required');
      }
      if (typeof fetch === 'undefined') {
        throw new Error('fetch_unavailable');
      }

      const includeSources = options?.includeSources === true;
      const includeSourcesQuery = includeSources ? '?includeSources=1' : '';
      const downloadUrl = `${BRIDGE_URL}/api/toolchain/synth/runs/${encodeURIComponent(safeRunId)}/artifacts.zip${includeSourcesQuery}`;
      const response = await fetch(downloadUrl, {
        method: 'GET',
      });
      if (!response.ok) {
        throw new Error(`bridge_http_${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const fallbackName = `rb-synth-${safeRunId}.zip`;
      const headerName = parseContentDispositionFilename(response.headers.get('content-disposition'), fallbackName);
      return {
        filename: headerName,
        bytes,
      };
    },
    async implementRun(input) {
      const board = input.board === 'basys3' ? 'basys3' : 'basys3';
      const snapshot: ToolchainProjectSnapshotInput = {
        hdl: {
          sources: (input.project?.hdl?.sources ?? []).map((source) => ({
            path: source.path,
            language: source.language,
            text: source.text,
          })),
          top: input.project?.hdl?.top ?? undefined,
        },
        fpga: {
          board,
          constraints: input.project?.fpga?.constraints
            ? {
                type: 'xdc',
                text: input.project.fpga.constraints.text,
              }
            : undefined,
          preset: input.project?.fpga?.preset ?? undefined,
          top: input.project?.fpga?.top ?? undefined,
        },
      };
      const normalizedSnapshot = normalizeSnapshotInput(snapshot);
      const resolvedBuildPath =
        input.buildPath?.planId && input.buildPath?.backend
          ? (getCachedBuildPathByPlanId(input.buildPath.planId) ??
            (await backend.resolveBuildPath(normalizedSnapshot, { refreshProbe: false })))
          : await backend.resolveBuildPath(normalizedSnapshot, { refreshProbe: false });
      const top = normalizeTop(normalizedSnapshot.hdl.top, normalizedSnapshot.fpga.top) ?? basys3TopModuleContract.topModule;
      const sourceHash = deterministicId(
        'src',
        normalizedSnapshot.hdl.sources.map((source) => ({
          path: source.path,
          language: source.language,
          text: source.text,
        }))
      );
      const constraintsHash = deterministicId('xdc', normalizedSnapshot.fpga.constraints?.text ?? '');
      const runIdentity = {
        planId: resolvedBuildPath.planId,
        backend: resolvedBuildPath.backend,
        board: normalizedSnapshot.fpga.board,
        top,
        sourceHash,
        constraintsHash,
      };
      const runId = deterministicId(`${id}-implement-run`, runIdentity);
      const artifactId = deterministicId(`${id}-implement-artifact`, {
        ...runIdentity,
      });
      const payload = {
        board,
        project: {
          hdl: {
            sources: normalizedSnapshot.hdl.sources.map((source) => ({
              path: source.path,
              language: source.language,
              text: source.text,
            })),
            top,
          },
          fpga: {
            board,
            constraints: normalizedSnapshot.fpga.constraints
              ? {
                  type: 'xdc' as const,
                  text: normalizedSnapshot.fpga.constraints.text,
                }
              : null,
            preset: normalizedSnapshot.fpga.preset ?? null,
            top,
          },
        },
        buildPath: {
          planId: resolvedBuildPath.planId,
          backend: resolvedBuildPath.backend,
          ...(resolvedBuildPath.buildpack ? { buildpack: resolvedBuildPath.buildpack } : {}),
          requiredTools: resolvedBuildPath.requiredTools.map((tool) => ({
            name: tool.name,
            ok: tool.ok,
            ...(tool.version ? { version: tool.version } : {}),
            ...(tool.source ? { source: tool.source } : {}),
            ...(tool.integrity ? { integrity: tool.integrity } : {}),
            why: tool.why,
          })),
          commands: resolvedBuildPath.commands.map((command) => ({
            step: command.step,
            argv: [...command.argv],
            envKeysUsed: [...command.envKeysUsed],
          })),
          outputs: resolvedBuildPath.outputs.map((output) => ({
            name: output.name,
            pathHint: output.pathHint,
          })),
          warnings: resolvedBuildPath.warnings.map((entry) => ({
            run_id: entry.run_id,
            ts: entry.ts,
            step: entry.step,
            level: entry.level,
            msg: entry.msg,
          })),
        },
        clientIds: {
          runId,
          artifactId,
        },
      };

      if (typeof fetch === 'undefined') {
        return {
          runId,
          artifactId,
          state: 'error',
          ok: false,
          exitCode: null,
          logs: [
            {
              run_id: runId,
              ts: 0,
              step: 'implement',
              level: 'error',
              msg: `[${id}] implement-run: fetch_unavailable`,
            },
          ],
          nextOffset: 1,
          error: 'fetch_unavailable',
        };
      }

      const runUrl = `${BRIDGE_URL}/api/toolchain/implement/run`;
      try {
        const res = await fetchJsonWithTimeout(runUrl, 120000, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (isImplementRunStatusResponse(res.data)) {
          return {
            runId: res.data.runId,
            artifactId: res.data.artifactId,
            state: normalizeProgramRunState(res.data.state),
            ok: res.data.ok,
            exitCode: res.data.exitCode,
            logs: normalizeImplementLogs(res.data.logs, res.data.runId),
            nextOffset: res.data.nextOffset,
            ...(typeof res.data.error === 'string' ? { error: res.data.error } : {}),
            ...(res.data.artifact ? { artifact: res.data.artifact } : {}),
          };
        }
        return {
          runId,
          artifactId,
          state: 'error',
          ok: false,
          exitCode: null,
          logs: [
            {
              run_id: runId,
              ts: 0,
              step: 'implement',
              level: 'error',
              msg: `[${id}] implement-run: failed: bridge_bad_response`,
            },
          ],
          nextOffset: 1,
          error: res.ok ? 'bridge_bad_response' : `bridge_http_${res.status}`,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'bridge_unreachable';
        return {
          runId,
          artifactId,
          state: 'error',
          ok: false,
          exitCode: null,
          logs: [
            {
              run_id: runId,
              ts: 0,
              step: 'implement',
              level: 'error',
              msg: `[${id}] implement-run: failed: ${message}`,
            },
          ],
          nextOffset: 1,
          error: 'bridge_unreachable',
        };
      }
    },
    async getImplementRunStatus(runId, offset = 0) {
      const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
      if (typeof fetch === 'undefined') {
        return {
          runId,
          artifactId: runId,
          state: 'error',
          ok: false,
          exitCode: null,
          logs: [
            {
              run_id: runId,
              ts: safeOffset,
              step: 'implement',
              level: 'error',
              msg: `[${id}] implement-run-status: fetch_unavailable`,
            },
          ],
          nextOffset: safeOffset + 1,
          error: 'fetch_unavailable',
        };
      }
      const statusUrl = `${BRIDGE_URL}/api/toolchain/implement/runs/${encodeURIComponent(runId)}?offset=${safeOffset}`;
      try {
        const res = await fetchJsonWithTimeout(statusUrl, 5000);
        if (isImplementRunStatusResponse(res.data)) {
          return {
            runId: res.data.runId,
            artifactId: res.data.artifactId,
            state: normalizeProgramRunState(res.data.state),
            ok: res.data.ok,
            exitCode: res.data.exitCode,
            logs: normalizeImplementLogs(res.data.logs, res.data.runId),
            nextOffset: res.data.nextOffset,
            ...(typeof res.data.error === 'string' ? { error: res.data.error } : {}),
            ...(res.data.artifact ? { artifact: res.data.artifact } : {}),
          };
        }
        return {
          runId,
          artifactId: runId,
          state: 'error',
          ok: false,
          exitCode: null,
          logs: [
            {
              run_id: runId,
              ts: safeOffset,
              step: 'implement',
              level: 'error',
              msg: `[${id}] implement-run-status: failed: ${res.ok ? 'bridge_bad_response' : `bridge_http_${res.status}`}`,
            },
          ],
          nextOffset: safeOffset + 1,
          error: res.ok ? 'bridge_bad_response' : `bridge_http_${res.status}`,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'bridge_unreachable';
        return {
          runId,
          artifactId: runId,
          state: 'error',
          ok: false,
          exitCode: null,
          logs: [
            {
              run_id: runId,
              ts: safeOffset,
              step: 'implement',
              level: 'error',
              msg: `[${id}] implement-run-status: failed: ${message}`,
            },
          ],
          nextOffset: safeOffset + 1,
          error: 'bridge_unreachable',
        };
      }
    },
    openImplementRunStream(runId, handlers, options) {
      const offset = Number.isFinite(options?.offset) ? Math.max(0, Math.floor(options?.offset ?? 0)) : 0;
      if (typeof EventSource === 'undefined') {
        handlers.onError?.('eventsource_unavailable');
        return null;
      }

      const streamUrl = `${BRIDGE_URL}/api/toolchain/implement/runs/${encodeURIComponent(runId)}/stream?offset=${offset}`;
      const source = new EventSource(streamUrl);

      source.addEventListener('log', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data ?? 'null');
          const normalized = normalizeImplementLogs([payload], runId);
          if (normalized[0]) handlers.onLog?.(normalized[0]);
        } catch {
          handlers.onError?.('stream_bad_log');
        }
      });

      source.addEventListener('done', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data ?? 'null') as Partial<ImplementRunDoneSummary>;
          const state =
            payload.state === 'error' || payload.state === 'canceled' ? payload.state : 'done';
          handlers.onDone?.({
            runId: typeof payload.runId === 'string' ? payload.runId : runId,
            artifactId: typeof payload.artifactId === 'string' ? payload.artifactId : runId,
            state,
            ok: payload.ok === true,
            exitCode: typeof payload.exitCode === 'number' ? payload.exitCode : null,
            nextOffset: typeof payload.nextOffset === 'number' ? payload.nextOffset : offset,
            ...(typeof payload.error === 'string' ? { error: payload.error } : {}),
            ...(isImplementArtifactRef(payload.artifact) ? { artifact: payload.artifact } : {}),
          });
        } catch {
          handlers.onError?.('stream_bad_done');
        } finally {
          source.close();
        }
      });

      source.onerror = () => {
        handlers.onError?.('stream_error');
        source.close();
      };

      return {
        close: () => {
          source.close();
        },
      };
    },
    async downloadImplementArtifacts(runId, options) {
      const safeRunId = typeof runId === 'string' ? runId.trim() : '';
      if (!safeRunId) throw new Error('run_id_required');
      if (typeof fetch === 'undefined') throw new Error('fetch_unavailable');
      const includeSources = options?.includeSources === true;
      const includeSourcesQuery = includeSources ? '?includeSources=1' : '';
      const downloadUrl = `${BRIDGE_URL}/api/toolchain/implement/runs/${encodeURIComponent(safeRunId)}/artifacts.zip${includeSourcesQuery}`;
      const response = await fetch(downloadUrl, {
        method: 'GET',
      });
      if (!response.ok) throw new Error(`bridge_http_${response.status}`);
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const fallbackName = `rb-implement-${safeRunId}.zip`;
      const headerName = parseContentDispositionFilename(response.headers.get('content-disposition'), fallbackName);
      return {
        filename: headerName,
        bytes,
      };
    },
    async getImplementBitstream(runId) {
      const safeRunId = typeof runId === 'string' ? runId.trim() : '';
      if (!safeRunId) throw new Error('run_id_required');
      if (typeof fetch === 'undefined') throw new Error('fetch_unavailable');
      const endpoint = `${BRIDGE_URL}/api/toolchain/implement/runs/${encodeURIComponent(safeRunId)}/output/bitstream`;
      const response = await fetchJsonWithTimeout(endpoint, 10000, {
        method: 'GET',
      });
      if (isImplementBitstreamResponse(response.data)) {
        return response.data;
      }
      const bridgeError =
        response.data && typeof response.data === 'object' && typeof (response.data as { error?: unknown }).error === 'string'
          ? String((response.data as { error: string }).error)
          : null;
      throw new Error(bridgeError ?? (response.ok ? 'bridge_bad_response' : `bridge_http_${response.status}`));
    },
    async programImplementBitstream(runId, options) {
      const bitstream = await backend.getImplementBitstream(runId);
      return backend.programBitstream({
        board: options?.board === 'basys3' ? 'basys3' : 'basys3',
        mode: options?.mode === 'sram' ? 'sram' : 'sram',
        bitstream: bitstream.bitstream,
      });
    },
    async programBitstream(input) {
      const artifactId = deriveProgramBitstreamArtifactId(input);
      const runId = deriveProgramBitstreamRunId(input);
      const fallbackLogs: BuildLogEntry[] = [];
      let ts = 0;
      const push = (level: ToolchainLogLevel, msg: string, data?: Record<string, unknown>) => {
        fallbackLogs.push({
          run_id: runId,
          ts: ts++,
          step: 'program',
          level,
          msg,
          ...(data ? { data } : {}),
        });
      };

      push('info', `[${id}] program-bitstream: starting`);

      const probe = await backend.probeTools();
      const loader = (probe.tools ?? []).find((tool) => tool.name === 'openFPGALoader');
      if (!loader?.ok) {
        push('error', `[${id}] program-bitstream: openFPGALoader_missing`);
        push(
          'warn',
          '[program] hint: if device not found, verify Basys3 USB cable/drivers and close Vivado Hardware Manager.'
        );
        return {
          ok: false,
          runId,
          artifactId,
          logs: fallbackLogs,
          error: 'openfpgaloader_missing',
        };
      }

      if (typeof fetch === 'undefined') {
        push('error', `[${id}] program-bitstream: fetch_unavailable`);
        return { ok: false, runId, artifactId, logs: fallbackLogs, error: 'fetch_unavailable' };
      }

      const programUrl = `${BRIDGE_URL}/api/toolchain/program-bitstream`;
      const payload = encodeProgramBitstreamRequestPayload(input);
      push('info', `[${id}] program-bitstream: POST ${programUrl}`, {
        board: payload.board,
        mode: payload.mode,
        bytesBase64: payload.bitstream.data.length,
      });

      try {
        const res = await fetchJsonWithTimeout(programUrl, 120000, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (isProgramBitstreamResponse(res.data)) {
          const normalizedLogs = normalizeProgramLogs(res.data.logs, res.data.runId);
          return {
            ok: res.data.ok,
            runId: res.data.runId,
            artifactId: res.data.artifactId,
            logs: normalizedLogs,
            ...(res.data.state ? { state: res.data.state } : {}),
            ...(typeof res.data.nextOffset === 'number' ? { nextOffset: res.data.nextOffset } : {}),
            ...(res.data.error ? { error: res.data.error } : {}),
          };
        }

        if (isProgramBitstreamBusyResponse(res.data)) {
          const activeRunId = res.data.activeRunId;
          const normalizedLogs = normalizeProgramLogs(res.data.logs, activeRunId);
          return {
            ok: false,
            runId: activeRunId,
            artifactId: activeRunId,
            activeRunId,
            state: 'running',
            logs: normalizedLogs,
            nextOffset: res.data.nextOffset,
            error: 'BOARD_BUSY',
          };
        }

        const error = res.ok ? 'bridge_bad_response' : `bridge_http_${res.status}`;
        push('error', `[${id}] program-bitstream: failed: ${error}`);
        push(
          'warn',
          '[program] hint: if device not found, verify Basys3 USB cable/drivers and close Vivado Hardware Manager.'
        );
        return { ok: false, runId, artifactId, logs: fallbackLogs, error };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'bridge_unreachable';
        push('error', `[${id}] program-bitstream: failed: ${message}`);
        push(
          'warn',
          '[program] hint: if device not found, verify Basys3 USB cable/drivers and close Vivado Hardware Manager.'
        );
        return { ok: false, runId, artifactId, logs: fallbackLogs, error: 'bridge_unreachable' };
      }
    },
    async getRunStatus(runId, offset = 0) {
      const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;

      if (typeof fetch === 'undefined') {
        return {
          runId,
          artifactId: runId,
          state: 'error',
          ok: false,
          exitCode: null,
          logs: [
            {
              run_id: runId,
              ts: safeOffset,
              step: 'program',
              level: 'error',
              msg: `[${id}] run-status: fetch_unavailable`,
            },
          ],
          nextOffset: safeOffset + 1,
          error: 'fetch_unavailable',
        };
      }

      const statusUrl = `${BRIDGE_URL}/api/toolchain/runs/${encodeURIComponent(runId)}?offset=${safeOffset}`;
      try {
        const res = await fetchJsonWithTimeout(statusUrl, 5000);
        if (isProgramRunStatusResponse(res.data)) {
          return {
            runId: res.data.runId,
            artifactId: res.data.artifactId,
            state: normalizeProgramRunState(res.data.state),
            ok: res.data.ok,
            exitCode: res.data.exitCode,
            logs: normalizeRunLogs(res.data.logs, res.data.runId),
            nextOffset: res.data.nextOffset,
            ...(res.data.error ? { error: res.data.error } : {}),
          };
        }

        const error = res.ok ? 'bridge_bad_response' : `bridge_http_${res.status}`;
        return {
          runId,
          artifactId: runId,
          state: 'error',
          ok: false,
          exitCode: null,
          logs: [
            {
              run_id: runId,
              ts: safeOffset,
              step: 'program',
              level: 'error',
              msg: `[${id}] run-status: failed: ${error}`,
            },
          ],
          nextOffset: safeOffset + 1,
          error,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'bridge_unreachable';
        return {
          runId,
          artifactId: runId,
          state: 'error',
          ok: false,
          exitCode: null,
          logs: [
            {
              run_id: runId,
              ts: safeOffset,
              step: 'program',
              level: 'error',
              msg: `[${id}] run-status: failed: ${message}`,
            },
          ],
          nextOffset: safeOffset + 1,
          error: 'bridge_unreachable',
        };
      }
    },
    async cancelRun(runId) {
      const safeRunId = typeof runId === 'string' ? runId.trim() : '';
      if (!safeRunId) {
        return {
          runId: safeRunId,
          artifactId: safeRunId,
          state: 'error',
          ok: false,
          exitCode: null,
          logs: [
            {
              run_id: safeRunId || 'run-cancel',
              ts: 0,
              step: 'program',
              level: 'error',
              msg: `[${id}] run-cancel: run_id_required`,
            },
          ],
          nextOffset: 1,
          error: 'run_id_required',
        };
      }

      if (typeof fetch === 'undefined') {
        return {
          runId: safeRunId,
          artifactId: safeRunId,
          state: 'error',
          ok: false,
          exitCode: null,
          logs: [
            {
              run_id: safeRunId,
              ts: 0,
              step: 'program',
              level: 'error',
              msg: `[${id}] run-cancel: fetch_unavailable`,
            },
          ],
          nextOffset: 1,
          error: 'fetch_unavailable',
        };
      }

      const cancelUrl = `${BRIDGE_URL}/api/toolchain/runs/${encodeURIComponent(safeRunId)}/cancel`;
      try {
        const res = await fetchJsonWithTimeout(cancelUrl, 5000, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
        });
        if (isProgramRunStatusResponse(res.data)) {
          return {
            runId: res.data.runId,
            artifactId: res.data.artifactId,
            state: normalizeProgramRunState(res.data.state),
            ok: res.data.ok,
            exitCode: res.data.exitCode,
            logs: normalizeProgramLogs(res.data.logs, res.data.runId),
            nextOffset: res.data.nextOffset,
            ...(res.data.error ? { error: res.data.error } : {}),
          };
        }

        const error = res.ok ? 'bridge_bad_response' : `bridge_http_${res.status}`;
        return {
          runId: safeRunId,
          artifactId: safeRunId,
          state: 'error',
          ok: false,
          exitCode: null,
          logs: [
            {
              run_id: safeRunId,
              ts: 0,
              step: 'program',
              level: 'error',
              msg: `[${id}] run-cancel: failed: ${error}`,
            },
          ],
          nextOffset: 1,
          error,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'bridge_unreachable';
        return {
          runId: safeRunId,
          artifactId: safeRunId,
          state: 'error',
          ok: false,
          exitCode: null,
          logs: [
            {
              run_id: safeRunId,
              ts: 0,
              step: 'program',
              level: 'error',
              msg: `[${id}] run-cancel: failed: ${message}`,
            },
          ],
          nextOffset: 1,
          error: 'bridge_unreachable',
        };
      }
    },
    async detectBoards() {
      const run_id = createRunId(`${id}-board-detect`);

      if (typeof fetch === 'undefined') {
        return {
          schema_version: 'toolchain_board_detect_v1',
          ok: false,
          run_id,
          boards: [],
          tools: {
            openFPGALoader: {
              ok: false,
              error: 'fetch_unavailable',
            },
          },
          logs: [
            {
              run_id,
              ts: 0,
              step: 'probe',
              level: 'error',
              msg: `[${id}] board-detect: fetch_unavailable`,
            },
          ],
        };
      }

      const detectUrl = `${BRIDGE_URL}/api/toolchain/boards/detect`;
      try {
        const res = await fetchJsonWithTimeout(detectUrl, 8000);
        if (isBoardDetectResult(res.data)) {
          return normalizeBoardDetectResult(res.data);
        }

        const error = res.ok ? 'bridge_bad_response' : `bridge_http_${res.status}`;
        return {
          schema_version: 'toolchain_board_detect_v1',
          ok: false,
          run_id,
          boards: [],
          tools: {
            openFPGALoader: {
              ok: false,
              error,
            },
          },
          logs: [
            {
              run_id,
              ts: 0,
              step: 'probe',
              level: 'error',
              msg: `[${id}] board-detect: failed: ${error}`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'bridge_unreachable';
        return {
          schema_version: 'toolchain_board_detect_v1',
          ok: false,
          run_id,
          boards: [],
          tools: {
            openFPGALoader: {
              ok: false,
              error: 'bridge_unreachable',
            },
          },
          logs: [
            {
              run_id,
              ts: 0,
              step: 'probe',
              level: 'error',
              msg: `[${id}] board-detect: failed: ${message}`,
            },
          ],
        };
      }
    },
    async getBuildpackStatus() {
      const run_id = createRunId(`${id}-buildpack-status`);
      if (typeof fetch === 'undefined') {
        return {
          schema_version: 'toolchain_buildpack_status_v1',
          ok: false,
          run_id,
          platformKey: 'unknown',
          storeRoot: '',
          installed: [],
          tools: {},
          logs: [
            {
              run_id,
              ts: 0,
              step: 'buildpack',
              level: 'error',
              msg: `[${id}] buildpack-status: fetch_unavailable`,
            },
          ],
        };
      }

      const endpoint = `${BRIDGE_URL}/api/toolchain/buildpack/status`;
      try {
        const res = await fetchJsonWithTimeout(endpoint, 10000);
        if (isBuildpackStatusResult(res.data)) {
          return normalizeBuildpackStatusResult(res.data);
        }
        const error = res.ok ? 'bridge_bad_response' : `bridge_http_${res.status}`;
        return {
          schema_version: 'toolchain_buildpack_status_v1',
          ok: false,
          run_id,
          platformKey: 'unknown',
          storeRoot: '',
          installed: [],
          tools: {},
          logs: [
            {
              run_id,
              ts: 0,
              step: 'buildpack',
              level: 'error',
              msg: `[${id}] buildpack-status: failed: ${error}`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'bridge_unreachable';
        return {
          schema_version: 'toolchain_buildpack_status_v1',
          ok: false,
          run_id,
          platformKey: 'unknown',
          storeRoot: '',
          installed: [],
          tools: {},
          logs: [
            {
              run_id,
              ts: 0,
              step: 'buildpack',
              level: 'error',
              msg: `[${id}] buildpack-status: failed: ${message}`,
            },
          ],
        };
      }
    },
    async installBuildpack(input) {
      const fallbackRunId = createRunId(`${id}-buildpack-install`);
      const safeName = typeof input?.name === 'string' ? input.name.trim() : '';
      const safeVersion = typeof input?.version === 'string' ? input.version.trim() : '';
      const safeUrl = typeof input?.url === 'string' ? input.url.trim() : '';
      const safeSha256 = typeof input?.sha256 === 'string' && input.sha256.trim().length > 0 ? input.sha256.trim() : undefined;
      if (!safeName || !safeVersion || !safeUrl) {
        return {
          runId: fallbackRunId,
          artifactId: fallbackRunId,
          state: 'error',
          ok: false,
          exitCode: null,
          logs: [
            {
              run_id: fallbackRunId,
              ts: 0,
              step: 'buildpack',
              level: 'error',
              msg: `[${id}] buildpack-install: buildpack_name_version_url_required`,
            },
          ],
          nextOffset: 1,
          error: 'buildpack_name_version_url_required',
        };
      }

      if (typeof fetch === 'undefined') {
        return {
          runId: fallbackRunId,
          artifactId: fallbackRunId,
          state: 'error',
          ok: false,
          exitCode: null,
          logs: [
            {
              run_id: fallbackRunId,
              ts: 0,
              step: 'buildpack',
              level: 'error',
              msg: `[${id}] buildpack-install: fetch_unavailable`,
            },
          ],
          nextOffset: 1,
          error: 'fetch_unavailable',
        };
      }

      const endpoint = `${BRIDGE_URL}/api/toolchain/buildpack/install`;
      try {
        const res = await fetchJsonWithTimeout(endpoint, 120000, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: safeName,
            version: safeVersion,
            url: safeUrl,
            ...(safeSha256 ? { sha256: safeSha256 } : {}),
          }),
        });
        if (isBuildpackRunStatusResponse(res.data)) {
          return {
            runId: res.data.runId,
            artifactId: res.data.artifactId,
            state: normalizeProgramRunState(res.data.state),
            ok: res.data.ok,
            exitCode: res.data.exitCode,
            logs: normalizeBuildpackLogs(res.data.logs, res.data.runId),
            nextOffset: res.data.nextOffset,
            ...(typeof res.data.error === 'string' ? { error: res.data.error } : {}),
            ...(res.data.artifact ? { artifact: res.data.artifact } : {}),
          };
        }
        const error = res.ok ? 'bridge_bad_response' : `bridge_http_${res.status}`;
        return {
          runId: fallbackRunId,
          artifactId: fallbackRunId,
          state: 'error',
          ok: false,
          exitCode: null,
          logs: [
            {
              run_id: fallbackRunId,
              ts: 0,
              step: 'buildpack',
              level: 'error',
              msg: `[${id}] buildpack-install: failed: ${error}`,
            },
          ],
          nextOffset: 1,
          error,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'bridge_unreachable';
        return {
          runId: fallbackRunId,
          artifactId: fallbackRunId,
          state: 'error',
          ok: false,
          exitCode: null,
          logs: [
            {
              run_id: fallbackRunId,
              ts: 0,
              step: 'buildpack',
              level: 'error',
              msg: `[${id}] buildpack-install: failed: ${message}`,
            },
          ],
          nextOffset: 1,
          error: 'bridge_unreachable',
        };
      }
    },
    async getBuildpackRunStatus(runId, offset = 0) {
      const safeRunId = typeof runId === 'string' ? runId.trim() : '';
      const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
      if (!safeRunId) {
        return {
          runId: '',
          artifactId: '',
          state: 'error',
          ok: false,
          exitCode: null,
          logs: [
            {
              run_id: createRunId(`${id}-buildpack-status`),
              ts: 0,
              step: 'buildpack',
              level: 'error',
              msg: `[${id}] buildpack-run-status: run_id_required`,
            },
          ],
          nextOffset: 1,
          error: 'run_id_required',
        };
      }
      if (typeof fetch === 'undefined') {
        return {
          runId: safeRunId,
          artifactId: safeRunId,
          state: 'error',
          ok: false,
          exitCode: null,
          logs: [
            {
              run_id: safeRunId,
              ts: safeOffset,
              step: 'buildpack',
              level: 'error',
              msg: `[${id}] buildpack-run-status: fetch_unavailable`,
            },
          ],
          nextOffset: safeOffset + 1,
          error: 'fetch_unavailable',
        };
      }

      const endpoint = `${BRIDGE_URL}/api/toolchain/buildpack/runs/${encodeURIComponent(safeRunId)}?offset=${safeOffset}`;
      try {
        const res = await fetchJsonWithTimeout(endpoint, 5000);
        if (isBuildpackRunStatusResponse(res.data)) {
          return {
            runId: res.data.runId,
            artifactId: res.data.artifactId,
            state: normalizeProgramRunState(res.data.state),
            ok: res.data.ok,
            exitCode: res.data.exitCode,
            logs: normalizeBuildpackLogs(res.data.logs, res.data.runId),
            nextOffset: res.data.nextOffset,
            ...(typeof res.data.error === 'string' ? { error: res.data.error } : {}),
            ...(res.data.artifact ? { artifact: res.data.artifact } : {}),
          };
        }
        const error = res.ok ? 'bridge_bad_response' : `bridge_http_${res.status}`;
        return {
          runId: safeRunId,
          artifactId: safeRunId,
          state: 'error',
          ok: false,
          exitCode: null,
          logs: [
            {
              run_id: safeRunId,
              ts: safeOffset,
              step: 'buildpack',
              level: 'error',
              msg: `[${id}] buildpack-run-status: failed: ${error}`,
            },
          ],
          nextOffset: safeOffset + 1,
          error,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'bridge_unreachable';
        return {
          runId: safeRunId,
          artifactId: safeRunId,
          state: 'error',
          ok: false,
          exitCode: null,
          logs: [
            {
              run_id: safeRunId,
              ts: safeOffset,
              step: 'buildpack',
              level: 'error',
              msg: `[${id}] buildpack-run-status: failed: ${message}`,
            },
          ],
          nextOffset: safeOffset + 1,
          error: 'bridge_unreachable',
        };
      }
    },
    openBuildpackRunStream(runId, handlers, options) {
      const offset = Number.isFinite(options?.offset) ? Math.max(0, Math.floor(options?.offset ?? 0)) : 0;
      if (typeof EventSource === 'undefined') {
        handlers.onError?.('eventsource_unavailable');
        return null;
      }
      const endpoint = `${BRIDGE_URL}/api/toolchain/buildpack/runs/${encodeURIComponent(runId)}/stream?offset=${offset}`;
      const source = new EventSource(endpoint);

      source.addEventListener('log', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data ?? 'null');
          const normalized = normalizeBuildpackLogs([payload], runId);
          if (normalized[0]) handlers.onLog?.(normalized[0]);
        } catch {
          handlers.onError?.('stream_bad_log');
        }
      });

      source.addEventListener('done', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data ?? 'null') as Partial<BuildpackRunDoneSummary>;
          const state = payload.state === 'error' || payload.state === 'canceled' ? payload.state : 'done';
          handlers.onDone?.({
            runId: typeof payload.runId === 'string' ? payload.runId : runId,
            artifactId: typeof payload.artifactId === 'string' ? payload.artifactId : runId,
            state,
            ok: payload.ok === true,
            exitCode: typeof payload.exitCode === 'number' ? payload.exitCode : null,
            nextOffset: typeof payload.nextOffset === 'number' ? payload.nextOffset : offset,
            ...(typeof payload.error === 'string' ? { error: payload.error } : {}),
            ...(payload.artifact && typeof payload.artifact === 'object' ? { artifact: payload.artifact } : {}),
          });
        } catch {
          handlers.onError?.('stream_bad_done');
        } finally {
          source.close();
        }
      });

      source.onerror = () => {
        handlers.onError?.('stream_error');
        source.close();
      };

      return {
        close: () => source.close(),
      };
    },
    async removeBuildpack(name, version) {
      const runId = createRunId(`${id}-buildpack-remove`);
      const safeName = typeof name === 'string' ? name.trim() : '';
      const safeVersion = typeof version === 'string' ? version.trim() : '';
      if (!safeName || !safeVersion) {
        return {
          schema_version: 'toolchain_buildpack_remove_v1',
          ok: false,
          run_id: runId,
          removed: false,
          logs: [
            {
              run_id: runId,
              ts: 0,
              step: 'buildpack',
              level: 'error',
              msg: `[${id}] buildpack-remove: buildpack_name_version_required`,
            },
          ],
          error: 'buildpack_name_version_required',
        };
      }
      if (typeof fetch === 'undefined') {
        return {
          schema_version: 'toolchain_buildpack_remove_v1',
          ok: false,
          run_id: runId,
          removed: false,
          logs: [
            {
              run_id: runId,
              ts: 0,
              step: 'buildpack',
              level: 'error',
              msg: `[${id}] buildpack-remove: fetch_unavailable`,
            },
          ],
          error: 'fetch_unavailable',
        };
      }
      const endpoint = `${BRIDGE_URL}/api/toolchain/buildpack/remove`;
      try {
        const res = await fetchJsonWithTimeout(endpoint, 10000, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: safeName, version: safeVersion }),
        });
        if (isBuildpackRemoveResult(res.data)) {
          return {
            schema_version: 'toolchain_buildpack_remove_v1',
            ok: res.data.ok,
            run_id: res.data.run_id,
            removed: res.data.removed,
            logs: normalizeBuildpackLogs(res.data.logs, res.data.run_id),
            ...(typeof res.data.error === 'string' ? { error: res.data.error } : {}),
          };
        }
        const error = res.ok ? 'bridge_bad_response' : `bridge_http_${res.status}`;
        return {
          schema_version: 'toolchain_buildpack_remove_v1',
          ok: false,
          run_id: runId,
          removed: false,
          logs: [
            {
              run_id: runId,
              ts: 0,
              step: 'buildpack',
              level: 'error',
              msg: `[${id}] buildpack-remove: failed: ${error}`,
            },
          ],
          error,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'bridge_unreachable';
        return {
          schema_version: 'toolchain_buildpack_remove_v1',
          ok: false,
          run_id: runId,
          removed: false,
          logs: [
            {
              run_id: runId,
              ts: 0,
              step: 'buildpack',
              level: 'error',
              msg: `[${id}] buildpack-remove: failed: ${message}`,
            },
          ],
          error: 'bridge_unreachable',
        };
      }
    },
    openRunStream(runId, handlers, options) {
      const offset = Number.isFinite(options?.offset) ? Math.max(0, Math.floor(options?.offset ?? 0)) : 0;
      if (typeof EventSource === 'undefined') {
        handlers.onError?.('eventsource_unavailable');
        return null;
      }

      const streamUrl = `${BRIDGE_URL}/api/toolchain/runs/${encodeURIComponent(runId)}/stream?offset=${offset}`;
      const source = new EventSource(streamUrl);

      source.addEventListener('log', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data ?? 'null');
          const normalized = normalizeProgramLogs([payload], runId);
          if (normalized[0]) handlers.onLog?.(normalized[0]);
        } catch {
          handlers.onError?.('stream_bad_log');
        }
      });

      source.addEventListener('done', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data ?? 'null') as Partial<ProgramRunDoneSummary>;
          const state =
            payload.state === 'error' || payload.state === 'canceled' ? payload.state : 'done';
          handlers.onDone?.({
            runId: typeof payload.runId === 'string' ? payload.runId : runId,
            artifactId: typeof payload.artifactId === 'string' ? payload.artifactId : runId,
            state,
            ok: payload.ok === true,
            exitCode: typeof payload.exitCode === 'number' ? payload.exitCode : null,
            nextOffset: typeof payload.nextOffset === 'number' ? payload.nextOffset : offset,
            ...(typeof payload.error === 'string' ? { error: payload.error } : {}),
          });
        } catch {
          handlers.onError?.('stream_bad_done');
        } finally {
          source.close();
        }
      });

      source.onerror = () => {
        handlers.onError?.('stream_error');
        source.close();
      };

      return {
        close: () => {
          source.close();
        },
      };
    },
    async doctorReport(snapshot, options) {
      const normalizedSnapshot = normalizeSnapshotInput(snapshot);
      let probe = options?.probe ?? lastProbeByBackend[id] ?? null;
      const preferredBuildPath = options?.buildPath ?? lastBuildPathByBackend[id] ?? null;
      if (options?.refreshProbe) {
        try {
          probe = await backend.probeTools();
        } catch {
          probe = options?.probe ?? null;
        }
      }

      if (typeof fetch !== 'undefined' && !preferredBuildPath) {
        const reportUrl = `${BRIDGE_URL}/api/toolchain/doctor-report`;
        const payload = {
          schema_version: 'toolchain_doctor_report_request_v1',
          backend_id: id,
          refresh_probe: Boolean(options?.refreshProbe),
          project: normalizedSnapshot,
          logs: sortLogsByRunTs(options?.logs ?? []).slice(-200),
        };
        try {
          const res = await fetchJsonWithTimeout(reportUrl, 2000, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (isToolchainDoctorReport(res.data)) {
            return res.data;
          }
        } catch {
          // local fallback below
        }
      }

      const preflight = options?.preflight ?? (await backend.preflight(normalizedSnapshot, { refreshProbe: false }));
      const buildPath =
        preferredBuildPath ??
        (await backend.resolveBuildPath(normalizedSnapshot, { refreshProbe: false }));
      return createToolchainDoctorReport({
        backend_id: id,
        bridge_url: BRIDGE_URL,
        probe,
        preflight,
        buildPath,
        project: normalizedSnapshot,
        logs: options?.logs ?? [],
      });
    },
    async doctorReportV2() {
      const diagnosticsUrl = `${BRIDGE_URL}/diagnostics`;
      let diagnostics: {
        reachable?: boolean;
        version?: string;
        uptimeMs?: number;
        activeRunCount?: number;
        lastErrorCode?: string;
        programmer?: {
          found?: boolean;
          version?: string;
          pathHash?: string;
          capabilities?: { program?: boolean; detect?: boolean };
        };
      } | null = null;

      if (typeof fetch !== 'undefined') {
        try {
          const response = await fetchJsonWithTimeout(diagnosticsUrl, 2500);
          diagnostics = (response.data ?? null) as typeof diagnostics;
        } catch {
          diagnostics = null;
        }
      }

      let detectBoardsResult: BoardDetectResult | null = null;
      try {
        detectBoardsResult = await backend.detectBoards();
      } catch {
        detectBoardsResult = null;
      }

      const board = detectBoardsResult?.boards[0];
      const boardError = detectBoardsResult?.ok ? null : detectBoardsResult?.tools?.openFPGALoader?.error ?? 'board_missing';
      const lastErrorCode = mapHardwareErrorCode(diagnostics?.lastErrorCode ?? boardError ?? '') ?? diagnostics?.lastErrorCode;

      return buildDoctorReportV2({
        backendId: id,
        bridgeDiagnostics: {
          reachable: diagnostics?.reachable === true,
          version: diagnostics?.version,
          uptimeMs: diagnostics?.uptimeMs,
          activeRunCount: diagnostics?.activeRunCount,
          lastErrorCode,
          programmer: {
            found: diagnostics?.programmer?.found === true,
            version: diagnostics?.programmer?.version,
            path: diagnostics?.programmer?.pathHash,
            capabilities: {
              program: diagnostics?.programmer?.capabilities?.program === true,
              detect: diagnostics?.programmer?.capabilities?.detect === true,
            },
          },
        },
        boardDetect: {
          detected: Boolean(board),
          boardModel: board?.type === 'basys3' ? 'basys3' : undefined,
          deviceId: board?.details?.raw,
          transport: board?.transport,
          usbSummary: board?.details?.command,
        },
        buildPathKind: 'local_bridge',
        buildHashSource: {
          diagnostics,
          detectBoards: detectBoardsResult,
        },
        farmStatus: 'local-only',
        uiSurface: 'first-run-wizard',
      });
    },
  };

  return backend;
}

export function encodeToolchainDoctorReport(input: {
  backend_id: ToolchainBackendId;
  bridge_url: string;
  probe: ToolProbeResult | null;
  preflight?: ToolchainPreflightStatus | null;
  buildPath?: ToolchainBuildPath | null;
  project?: ToolchainProjectSnapshotInput;
  logs: BuildLogEntry[];
}): string {
  const report = createToolchainDoctorReport(input);
  return stableStringify(report);
}

export function encodeToolchainPreflightStatus(status: ToolchainPreflightStatus): string {
  const normalized: ToolchainPreflightStatus = {
    ...status,
    tools: sortToolsByName(status.tools ?? []),
    lint: {
      ...status.lint,
      warnings: sortPreflightLogs(status.lint.warnings ?? []),
      errors: sortPreflightLogs(status.lint.errors ?? []),
    },
  };
  return stableStringify(normalized);
}

export function createVivadoCLIBackend(): ToolchainBackend {
  return makeStubBackend('vivado');
}

export function createOpenToolchainBackend(): ToolchainBackend {
  return makeStubBackend('open');
}

export function getToolchainBackend(id: ToolchainBackendId = getToolchainBackendId()): ToolchainBackend {
  return id === 'open' ? createOpenToolchainBackend() : createVivadoCLIBackend();
}
