import { stableStringify } from '../export/stableStringify';
import {
  listHardwareRemediations,
  mapHardwareErrorCode,
  type HardwareErrorCode,
} from './hardwareErrorTaxonomy';

export interface DoctorReportV2 {
  schema_version: 'rb_doctor_report_v2';
  generatedAt: string;
  redbyte: {
    appVersion: string;
    buildHash: string;
    uiSurface: string;
    wizardVersion: string;
  };
  environment: {
    os: { platform: string; release: string; arch: string };
    node: { version: string };
    paths: { workspaceRootHash: string; tempDirHash: string };
  };
  bridge: { reachable: boolean; version?: string; uptimeMs?: number; activeRunCount?: number; lastErrorCode?: string };
  programmer: {
    name: 'openFPGALoader';
    found: boolean;
    version?: string;
    pathHash?: string;
    capabilities: { program: boolean; detect: boolean };
  };
  board: {
    detected: boolean;
    boardModel?: 'basys3';
    deviceIdHash?: string;
    transport?: string;
    usbSummary?: string;
  };
  programAttempt: {
    runId?: string;
    state?: string;
    ok?: boolean;
    exitCode?: number;
    errorCode?: string;
    durationMs?: number;
    startedAt?: string;
  };
  capture: {
    lastRunId?: string;
    sampleCount?: number;
    durationMs?: number;
    stalled?: boolean;
    traceHash?: string;
  };
  toolchain: {
    backendId: string;
    buildPathKind: string;
    buildHash?: string;
    farmStatus: string;
  };
  remediation: Array<{ code: string; title: string; action: string }>;
}

export interface DoctorReportV2Input {
  backendId: string;
  bridgeDiagnostics: {
    reachable: boolean;
    version?: string;
    uptimeMs?: number;
    activeRunCount?: number;
    lastErrorCode?: string;
    programmer?: { found: boolean; version?: string; path?: string; capabilities?: { program: boolean; detect: boolean } };
  } | null;
  boardDetect: {
    detected: boolean;
    deviceId?: string;
    transport?: string;
    boardModel?: 'basys3';
    usbSummary?: string;
  } | null;
  programAttempt?: {
    runId?: string;
    state?: string;
    ok?: boolean;
    exitCode?: number;
    error?: string;
    durationMs?: number;
    startedAt?: string;
  };
  capture?: {
    lastRunId?: string;
    sampleCount?: number;
    durationMs?: number;
    stalled?: boolean;
    traceHashSource?: string;
  };
  buildPathKind: string;
  buildHashSource?: unknown;
  farmStatus?: string;
  appVersion?: string;
  buildHash?: string;
  uiSurface?: string;
  wizardVersion?: string;
  nodeVersion?: string;
  osInfo?: { platform?: string; release?: string; arch?: string };
  workspaceRoot?: string;
  tempDir?: string;
}

function hashText(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function normalizeErrorCode(error: string | undefined): string | undefined {
  if (!error) return undefined;
  const mapped = mapHardwareErrorCode(error);
  return mapped ?? error;
}

export function buildDoctorReportV2(input: DoctorReportV2Input): DoctorReportV2 {
  const generatedAt = new Date().toISOString();
  const bridgeReachable = input.bridgeDiagnostics?.reachable === true;
  const boardDetected = input.boardDetect?.detected === true;
  const lastErrorCode = normalizeErrorCode(input.bridgeDiagnostics?.lastErrorCode);
  const attemptErrorCode = normalizeErrorCode(input.programAttempt?.error);

  const remediationCodes: HardwareErrorCode[] = [];
  const pushCode = (code: HardwareErrorCode | null | undefined) => {
    if (!code) return;
    remediationCodes.push(code);
  };

  pushCode((bridgeReachable ? null : 'bridge_offline') as HardwareErrorCode | null);
  pushCode((boardDetected ? null : 'board_missing') as HardwareErrorCode | null);
  pushCode((attemptErrorCode ?? lastErrorCode) as HardwareErrorCode | null);

  const report: DoctorReportV2 = {
    schema_version: 'rb_doctor_report_v2',
    generatedAt,
    redbyte: {
      appVersion: input.appVersion ?? 'dev',
      buildHash: input.buildHash ?? 'dev',
      uiSurface: input.uiSurface ?? 'studio',
      wizardVersion: input.wizardVersion ?? 'v1',
    },
    environment: {
      os: {
        platform: input.osInfo?.platform ?? 'unknown',
        release: input.osInfo?.release ?? 'unknown',
        arch: input.osInfo?.arch ?? 'unknown',
      },
      node: {
        version: input.nodeVersion ?? 'unknown',
      },
      paths: {
        workspaceRootHash: hashText(input.workspaceRoot ?? 'unknown'),
        tempDirHash: hashText(input.tempDir ?? 'unknown'),
      },
    },
    bridge: {
      reachable: bridgeReachable,
      ...(typeof input.bridgeDiagnostics?.version === 'string' ? { version: input.bridgeDiagnostics.version } : {}),
      ...(typeof input.bridgeDiagnostics?.uptimeMs === 'number' ? { uptimeMs: input.bridgeDiagnostics.uptimeMs } : {}),
      ...(typeof input.bridgeDiagnostics?.activeRunCount === 'number'
        ? { activeRunCount: input.bridgeDiagnostics.activeRunCount }
        : {}),
      ...(lastErrorCode ? { lastErrorCode } : {}),
    },
    programmer: {
      name: 'openFPGALoader',
      found: input.bridgeDiagnostics?.programmer?.found === true,
      ...(typeof input.bridgeDiagnostics?.programmer?.version === 'string'
        ? { version: input.bridgeDiagnostics.programmer.version }
        : {}),
      ...(typeof input.bridgeDiagnostics?.programmer?.path === 'string'
        ? { pathHash: hashText(input.bridgeDiagnostics.programmer.path) }
        : {}),
      capabilities: {
        program: input.bridgeDiagnostics?.programmer?.capabilities?.program === true,
        detect: input.bridgeDiagnostics?.programmer?.capabilities?.detect === true,
      },
    },
    board: {
      detected: boardDetected,
      ...(input.boardDetect?.boardModel ? { boardModel: input.boardDetect.boardModel } : {}),
      ...(input.boardDetect?.deviceId ? { deviceIdHash: hashText(input.boardDetect.deviceId) } : {}),
      ...(input.boardDetect?.transport ? { transport: input.boardDetect.transport } : {}),
      ...(input.boardDetect?.usbSummary ? { usbSummary: input.boardDetect.usbSummary } : {}),
    },
    programAttempt: {
      ...(input.programAttempt?.runId ? { runId: input.programAttempt.runId } : {}),
      ...(input.programAttempt?.state ? { state: input.programAttempt.state } : {}),
      ...(typeof input.programAttempt?.ok === 'boolean' ? { ok: input.programAttempt.ok } : {}),
      ...(typeof input.programAttempt?.exitCode === 'number' ? { exitCode: input.programAttempt.exitCode } : {}),
      ...(attemptErrorCode ? { errorCode: attemptErrorCode } : {}),
      ...(typeof input.programAttempt?.durationMs === 'number' ? { durationMs: input.programAttempt.durationMs } : {}),
      ...(input.programAttempt?.startedAt ? { startedAt: input.programAttempt.startedAt } : {}),
    },
    capture: {
      ...(input.capture?.lastRunId ? { lastRunId: input.capture.lastRunId } : {}),
      ...(typeof input.capture?.sampleCount === 'number' ? { sampleCount: input.capture.sampleCount } : {}),
      ...(typeof input.capture?.durationMs === 'number' ? { durationMs: input.capture.durationMs } : {}),
      ...(typeof input.capture?.stalled === 'boolean' ? { stalled: input.capture.stalled } : {}),
      ...(typeof input.capture?.traceHashSource === 'string' ? { traceHash: hashText(input.capture.traceHashSource) } : {}),
    },
    toolchain: {
      backendId: input.backendId,
      buildPathKind: input.buildPathKind,
      ...(input.buildHashSource != null ? { buildHash: hashText(stableStringify(input.buildHashSource)) } : {}),
      farmStatus: input.farmStatus ?? 'local-only',
    },
    remediation: listHardwareRemediations(remediationCodes),
  };

  return report;
}
