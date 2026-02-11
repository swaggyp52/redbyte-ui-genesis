import { stableStringify } from '../export/stableStringify';
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
  ToolchainRunState,
  BoardDetectResult,
  SynthRequest,
  SynthRunStatus,
  SynthRunDoneSummary,
  SynthArtifactRef,
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
  ToolchainRunState,
  BoardDetectResult,
  SynthRequest,
  SynthRunStatus,
  SynthRunDoneSummary,
  SynthArtifactRef,
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

export interface ToolchainLogSink {
  log: (entry: BuildLogEntry) => void;
}

export interface ToolchainDoctorReportOptions {
  refreshProbe?: boolean;
  logs?: BuildLogEntry[];
  probe?: ToolProbeResult | null;
  preflight?: ToolchainPreflightStatus | null;
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
  synth: (input: SynthRequest) => Promise<SynthRunStatus>;
  getSynthRunStatus: (runId: string, offset?: number) => Promise<SynthRunStatus>;
  openSynthRunStream: (
    runId: string,
    handlers: SynthRunStreamHandlers,
    options?: { offset?: number }
  ) => SynthRunStreamSubscription | null;
  programBitstream: (input: ProgramBitstreamInput) => Promise<ProgramBitstreamResult>;
  getRunStatus: (runId: string, offset?: number) => Promise<ProgramRunStatusResult>;
  cancelRun: (runId: string) => Promise<ProgramRunStatusResult>;
  detectBoards: () => Promise<BoardDetectResult>;
  openRunStream: (
    runId: string,
    handlers: ProgramRunStreamHandlers,
    options?: { offset?: number }
  ) => ProgramRunStreamSubscription | null;
  doctorReport: (
    snapshot: ToolchainProjectSnapshotInput,
    options?: ToolchainDoctorReportOptions
  ) => Promise<ToolchainDoctorReport>;
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
  return {
    board: normalized.board,
    top: normalized.top,
    sources: normalized.sources,
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
          tools: sortToolsByName(input.probe.tools ?? []).map((tool) => ({
            name: tool.name,
            ok: tool.ok,
            version: tool.version ?? null,
            error: tool.error ?? null,
          })),
        }
      : null,
  });
  const lintSummary = buildPreflightLintSummary(run_id, normalizedSnapshot, projectSummary);
  const tools = sortToolsByName(input.probe?.tools ?? []);
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
    tools: sortToolsByName(probe.tools ?? []).map((tool) => ({
      name: tool.name,
      ok: tool.ok,
      version: tool.version ?? null,
      error: tool.error ?? null,
    })),
  };
}

function isToolchainDoctorReport(value: unknown): value is ToolchainDoctorReport {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<ToolchainDoctorReport>;
  return (
    v.schema_version === 'rb_toolchain_doctor_v1' &&
    typeof v.reportId === 'string' &&
    typeof v.backend_id === 'string' &&
    Array.isArray(v.logs)
  );
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

export function createToolchainDoctorReport(input: {
  backend_id: ToolchainBackendId;
  bridge_url: string;
  probe: ToolProbeResult | null;
  preflight?: ToolchainPreflightStatus | null;
  project?: ToolchainProjectSnapshotInput;
  logs: BuildLogEntry[];
}): ToolchainDoctorReport {
  const normalizedProbe = input.probe
    ? {
        ...input.probe,
        tools: sortToolsByName(input.probe.tools ?? []),
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

  const projectSummary = normalizedProject ? buildDoctorProjectSummary(normalizedProject) : undefined;
  const sortedLogs = sortLogsByRunTs(input.logs).slice(-200);

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
          tools: sortToolsByName(computedPreflight.tools ?? []).map((tool) => ({
            name: tool.name,
            ok: tool.ok,
            version: tool.version ?? null,
            error: tool.error ?? null,
          })),
          overallOk: computedPreflight.overallOk,
        }
      : null,
    projectSummary: projectSummary ?? null,
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
    ...(projectSummary ? { projectSummary } : {}),
    logs: sortedLogs,
  };
}

function makeStubBackend(id: ToolchainBackendId): ToolchainBackend {
  const cacheProbe = (probe: ToolProbeResult): ToolProbeResult => {
    lastProbeByBackend[id] = probe;
    return probe;
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
        if (isToolProbeResult(res.data)) return cacheProbe(res.data);

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
            tools.push({ name, ok: false, error: 'not_found' });
            return;
          }
          tools.push({
            name,
            ok: true,
            version: typeof cap.version === 'string' ? cap.version : undefined,
            path: typeof cap.path === 'string' ? cap.path : undefined,
          });
        };

        pushTool('openFPGALoader', 'openFPGALoader');
        pushTool('yosys', 'yosys');
        pushTool('nextpnr-xilinx', 'nextpnrXilinx');
        pushTool('vivado', 'vivado');

        for (const tool of tools) {
          if (tool.ok) {
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
        const ok = tools.some((t) => t.ok);
        return cacheProbe({
          schema_version: 'toolchain_probe_v1',
          ok,
          run_id,
          env: undefined,
          tools,
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
    async synth(input) {
      const normalizedPayload = encodeSynthRequestPayload(input);
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
        };
      }

      const synthUrl = `${BRIDGE_URL}/api/toolchain/synth`;
      push('info', `[${id}] synth: POST ${synthUrl}`, {
        board: normalizedPayload.board,
        top: normalizedPayload.top,
        sourceCount: normalizedPayload.sources.length,
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
            logs: normalizeProgramLogs(res.data.logs, res.data.runId),
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
      if (options?.refreshProbe) {
        try {
          probe = await backend.probeTools();
        } catch {
          probe = options?.probe ?? null;
        }
      }

      if (typeof fetch !== 'undefined') {
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
      return createToolchainDoctorReport({
        backend_id: id,
        bridge_url: BRIDGE_URL,
        probe,
        preflight,
        project: normalizedSnapshot,
        logs: options?.logs ?? [],
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
