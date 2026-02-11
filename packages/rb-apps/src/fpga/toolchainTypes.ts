export type ToolchainBackendId = 'vivado' | 'open';

export type TargetBoardId = 'basys3';

export type ToolchainLogLevel = 'info' | 'warn' | 'error';

export type ToolchainStep = 'probe' | 'preflight' | 'synth' | 'pnr' | 'bitgen' | 'program';

export type ToolchainRunState = 'running' | 'done' | 'error' | 'canceled';

// Deterministic timestamp (ts): monotonic integer sequence (NOT wall-clock time).
export interface BuildLogEntry {
  run_id: string;
  ts: number;
  step: ToolchainStep;
  level: ToolchainLogLevel;
  msg: string;
  data?: Record<string, unknown>;
}

export interface ToolProbeTool {
  name: string;
  ok: boolean;
  version?: string;
  path?: string;
  error?: string;
}

export interface ToolProbeEnv {
  platform?: string;
  arch?: string;
  node?: string;
}

export interface ToolProbeResult {
  schema_version: 'toolchain_probe_v1';
  ok: boolean;
  run_id: string;
  env?: ToolProbeEnv;
  tools: ToolProbeTool[];
  logs: BuildLogEntry[];
}

export interface BoardDetectToolStatus {
  ok: boolean;
  version?: string;
  path?: string;
  error?: string;
}

export interface BoardDetectBoard {
  type: TargetBoardId;
  transport: 'usb-jtag';
  detectedBy: 'openFPGALoader';
  details?: {
    raw?: string;
    command?: string;
  };
}

export interface BoardDetectResult {
  schema_version: 'toolchain_board_detect_v1';
  ok: boolean;
  run_id: string;
  boards: BoardDetectBoard[];
  tools: {
    openFPGALoader: BoardDetectToolStatus;
  };
  logs: BuildLogEntry[];
}

export interface SynthSourceInput {
  path: string;
  language: 'verilog';
  text: string;
}

export interface SynthRequest {
  board: TargetBoardId;
  top: string;
  sources: SynthSourceInput[];
}

export interface SynthArtifactRef {
  artifactId: string;
  board: TargetBoardId;
  top: string;
  yosysVersion?: string | null;
  scriptVersion: string;
  outputs: {
    netlistVerilog: string;
    statText: string;
    statsJson?: string;
  };
}

export interface SynthRunStatus {
  runId: string;
  artifactId: string;
  state: ToolchainRunState;
  ok: boolean | null;
  exitCode: number | null;
  logs: BuildLogEntry[];
  nextOffset: number;
  error?: string;
  artifact?: SynthArtifactRef;
}

export interface SynthRunDoneSummary {
  runId: string;
  artifactId: string;
  state: Exclude<ToolchainRunState, 'running'>;
  ok: boolean;
  exitCode: number | null;
  nextOffset: number;
  error?: string;
  artifact?: SynthArtifactRef;
}

export interface ToolchainDoctorReport {
  schema_version: 'rb_toolchain_doctor_v1';
  reportId: string;
  backend_id: ToolchainBackendId;
  bridge_url: string;
  probe: ToolProbeResult | null;
  preflight?: ToolchainPreflightStatus;
  projectSummary?: {
    board: TargetBoardId;
    preset: string | null;
    top: string | null;
    hdlFilesCount: number;
    hasXdc: boolean;
  };
  logs: BuildLogEntry[];
}

export interface ToolchainPreflightProjectSummary {
  board: TargetBoardId;
  hasHdl: boolean;
  top: string | null;
  hasXdc: boolean;
  preset: string | null;
}

export interface ToolchainPreflightLintSummary {
  ok: boolean;
  warnings: BuildLogEntry[];
  errors: BuildLogEntry[];
}

export interface ToolchainPreflightStatus {
  schema_version: 'toolchain_preflight_v1';
  run_id: string;
  ts: number;
  project: ToolchainPreflightProjectSummary;
  lint: ToolchainPreflightLintSummary;
  tools: ToolProbeTool[];
  overallOk: boolean;
}
