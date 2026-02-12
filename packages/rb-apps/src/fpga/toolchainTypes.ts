export type ToolchainBackendId = 'vivado' | 'open';

export type TargetBoardId = 'basys3';

export type ToolchainLogLevel = 'info' | 'warn' | 'error';

export type ToolchainStep = 'probe' | 'preflight' | 'synth' | 'implement' | 'pnr' | 'bitgen' | 'program' | 'buildpack';

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
  status?: 'ok' | 'found_not_in_path' | 'missing';
  source?: 'bundled' | 'buildpack' | 'system' | 'not_found' | 'found_not_in_path';
  integrity?: 'verified' | 'corrupt' | 'unknown';
  version?: string;
  path?: string;
  error?: string;
  suggestedFix?: string;
  buildpackName?: string;
  buildpackVersion?: string;
  alternates?: Array<{
    source?: 'bundled' | 'buildpack' | 'system' | 'not_found' | 'found_not_in_path';
    status?: 'ok' | 'found_not_in_path' | 'missing';
    integrity?: 'verified' | 'corrupt' | 'unknown';
    version?: string;
    path?: string;
    error?: string;
    buildpackName?: string;
    buildpackVersion?: string;
  }>;
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

export interface BuildpackToolStatus {
  ok: boolean;
  source: 'bundled' | 'buildpack' | 'system' | 'not_found' | 'found_not_in_path';
  status: 'ok' | 'found_not_in_path' | 'missing';
  integrity: 'verified' | 'corrupt' | 'unknown';
  version?: string;
  path?: string;
  error?: string;
  suggestedFix?: string;
}

export interface BuildpackInstalledPack {
  name: string;
  version: string;
  platformKey: string | null;
  installDir: string;
  ok: boolean;
  integrity: 'verified' | 'corrupt';
  tools: Array<{
    name: string;
    relPath: string;
    version: string | null;
  }>;
  error?: string;
  details?: string;
}

export interface BuildpackStatusResult {
  schema_version: 'toolchain_buildpack_status_v1';
  ok: boolean;
  run_id: string;
  platformKey: string;
  storeRoot: string;
  installed: BuildpackInstalledPack[];
  tools: {
    yosys?: BuildpackToolStatus;
    'nextpnr-xilinx'?: BuildpackToolStatus;
    f4pga?: BuildpackToolStatus;
    openFPGALoader?: BuildpackToolStatus;
  };
  logs: BuildLogEntry[];
}

export interface BuildpackInstallRequest {
  name: string;
  version: string;
  url: string;
  sha256?: string;
}

export interface BuildpackRunStatus {
  runId: string;
  artifactId: string;
  state: ToolchainRunState;
  ok: boolean | null;
  exitCode: number | null;
  logs: BuildLogEntry[];
  nextOffset: number;
  error?: string;
  artifact?: Record<string, unknown>;
}

export interface BuildpackRunDoneSummary {
  runId: string;
  artifactId: string;
  state: Exclude<ToolchainRunState, 'running'>;
  ok: boolean;
  exitCode: number | null;
  nextOffset: number;
  error?: string;
  artifact?: Record<string, unknown>;
}

export interface BuildpackRemoveResult {
  schema_version: 'toolchain_buildpack_remove_v1';
  ok: boolean;
  run_id: string;
  removed: boolean;
  logs: BuildLogEntry[];
  error?: string;
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
  buildPath?: {
    planId: string;
    backend: ImplementPlanBackend;
  };
}

export interface SynthArtifactRef {
  artifactId: string;
  board: TargetBoardId;
  top: string;
  yosysVersion?: string | null;
  scriptVersion: string;
  buildPath?: {
    planId: string;
    backend: ImplementPlanBackend;
  };
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

export interface ImplementRunRequest {
  board: TargetBoardId;
  project: ImplementPlanProjectSnapshot;
  buildPath?: {
    planId: string;
    backend: ImplementPlanBackend;
  };
}

export type ImplementArtifactOutputKind = 'bitstream' | 'report' | 'output';

export interface ImplementArtifactOutputRef {
  name: string;
  pathHint: string;
  storedPath: string;
  kind?: ImplementArtifactOutputKind;
}

export interface ImplementArtifactRef {
  artifactId: string;
  board: TargetBoardId;
  top: string;
  planId: string;
  backend: ImplementPlanBackend;
  constraintsHash: string;
  commands: ImplementPlanCommand[];
  requiredTools: ImplementPlanRequiredTool[];
  sources: Array<{
    path: string;
    storedPath: string;
  }>;
  outputs: ImplementArtifactOutputRef[];
}

export interface ImplementRunStatus {
  runId: string;
  artifactId: string;
  state: ToolchainRunState;
  ok: boolean | null;
  exitCode: number | null;
  logs: BuildLogEntry[];
  nextOffset: number;
  error?: string;
  artifact?: ImplementArtifactRef;
}

export interface ImplementRunDoneSummary {
  runId: string;
  artifactId: string;
  state: Exclude<ToolchainRunState, 'running'>;
  ok: boolean;
  exitCode: number | null;
  nextOffset: number;
  error?: string;
  artifact?: ImplementArtifactRef;
}

export type ImplementPlanBackend = 'buildpack-open' | 'nextpnr-xilinx' | 'f4pga' | 'vivado-fallback' | 'none';

export interface ImplementPlanBuildpackRef {
  name: string;
  version: string;
}

export interface ImplementPlanHdlSource {
  path: string;
  language: 'verilog' | 'vhdl';
  text: string;
}

export interface ImplementPlanProjectSnapshot {
  hdl: {
    sources: ImplementPlanHdlSource[];
    top: string | null;
  };
  fpga: {
    board: TargetBoardId;
    constraints: { type: 'xdc'; text: string } | null;
    preset: string | null;
    top: string | null;
  };
}

export interface ImplementPlanRequest {
  schema_version: 'toolchain_implement_plan_request_v1';
  backend_id: ToolchainBackendId;
  refresh_probe: boolean;
  project: ImplementPlanProjectSnapshot;
}

export interface ImplementPlanRequiredTool {
  name: string;
  ok: boolean;
  version?: string;
  source?: 'bundled' | 'buildpack' | 'system' | 'not_found' | 'found_not_in_path';
  integrity?: 'verified' | 'corrupt' | 'unknown';
  why: string;
}

export interface ImplementPlanCommand {
  step: 'synth' | 'pnr' | 'bitgen';
  argv: string[];
  envKeysUsed: string[];
}

export interface ImplementPlanOutput {
  name: string;
  pathHint: string;
}

export interface ImplementPlanResult {
  schema_version: 'toolchain_implement_plan_v1';
  ok: boolean;
  run_id: string;
  planId: string;
  backend: ImplementPlanBackend;
  buildpack?: ImplementPlanBuildpackRef;
  requiredTools: ImplementPlanRequiredTool[];
  commands: ImplementPlanCommand[];
  outputs: ImplementPlanOutput[];
  warnings: BuildLogEntry[];
  logs: BuildLogEntry[];
}

export interface ToolchainBuildPath {
  schema_version: 'toolchain_build_path_v1';
  plannerVersion: 'toolchain_planner_v1';
  planId: string;
  backend: ImplementPlanBackend;
  buildpack?: ImplementPlanBuildpackRef;
  board: TargetBoardId;
  top: string;
  constraintsPreset: string | null;
  requiredTools: ImplementPlanRequiredTool[];
  commands: ImplementPlanCommand[];
  outputs: ImplementPlanOutput[];
  warnings: BuildLogEntry[];
}

export type StudentReadinessGateState = 'pass' | 'warn' | 'fail';

export interface StudentReadinessGate {
  id: 'toolchain_probe' | 'preflight' | 'implement_plan' | 'toolchain_ui' | 'doctor_export';
  label: string;
  state: StudentReadinessGateState;
  detail: string;
  nextAction?: string;
}

export interface StudentReadinessSummary {
  schema_version: 'student_readiness_v1';
  overall: 'ready' | 'needs_action';
  gates: StudentReadinessGate[];
}

export interface ToolchainDoctorReport {
  schema_version: 'rb_toolchain_doctor_v1';
  reportId: string;
  backend_id: ToolchainBackendId;
  bridge_url: string;
  probe: ToolProbeResult | null;
  preflight?: ToolchainPreflightStatus;
  buildPath?: ToolchainBuildPath;
  projectSummary?: {
    board: TargetBoardId;
    preset: string | null;
    top: string | null;
      hdlFilesCount: number;
      hasXdc: boolean;
  };
  studentReadiness?: StudentReadinessSummary;
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
