import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RedByteApp } from '../types';
import {
  type BuildpackRunStatus,
  type BuildpackStatusResult,
  getToolchainBackend,
  getToolchainBackendId,
  type BoardDetectResult,
  type BuildLogEntry,
  type ToolchainBuildPath,
  type ToolchainDoctorReport,
  type StudentReadinessGate,
  createStudentReadinessSummary,
  type ToolchainPreflightStatus,
  type ToolchainProjectSnapshotInput,
  type ToolProbeResult,
  type ToolProbeTool,
} from '../fpga/toolchainBackend';
import { stableStringify } from '../export/stableStringify';
import { getBasys3VerilogExample } from '../fpga/boards/basys3/examples';
import { getBasys3XdcPresetText, type Basys3XdcPresetId } from '../fpga/boards/basys3/presets';
import {
  SUBMISSION_BUNDLE_EVENT,
  SUBMISSION_BUNDLE_STATUS_STORAGE_KEY,
  decodeSubmissionBundleStatus,
  type SubmissionBundleStatusSnapshot,
} from '../export/submissionBundle';
import {
  downloadClassroomDiagnosticsBundle,
  generateClassroomDiagnosticsBundle,
} from '../export/classroomDiagnosticsBundle';
import {
  getClassroomLockdownState,
  getRedByteUiMode,
  RB_CLASSROOM_LOCKDOWN_CHANGE_EVENT,
  setClassroomLockdownEnabled,
} from '../utils/uiMode';
import { NEO_TYPO } from '../ui/neoTypography';
import styles from './ToolchainSetupApp.module.css';

type SetupPlatformId = 'windows' | 'macos' | 'linux';
type SetupStepId = 'probe' | 'detect' | 'plan';

interface SetupStepStatus {
  id: SetupStepId;
  label: string;
  state: 'idle' | 'running' | 'success' | 'warning' | 'error';
  detail: string;
  nextAction?: string;
}

interface SetupToolStatus {
  name: string;
  label: string;
  ok: boolean;
  status: 'ok' | 'found_not_in_path' | 'missing';
  source: 'bundled' | 'buildpack' | 'system' | 'not_found' | 'found_not_in_path';
  integrity: 'verified' | 'corrupt' | 'unknown';
  detail: string;
  suggestedFix?: string;
}

type ToolListFilter = 'needs_action' | 'all' | 'bundled';
type StudentReadinessGateView =
  | StudentReadinessGate
  | {
      id: 'submission_bundle';
      label: string;
      state: 'pass' | 'warn' | 'fail';
      detail: string;
      nextAction?: string;
    };

function normalizeSetupPlatform(platform: string): SetupPlatformId {
  const normalized = platform.toLowerCase();
  if (normalized.includes('win')) return 'windows';
  if (normalized.includes('darwin') || normalized.includes('mac')) return 'macos';
  return 'linux';
}

function getSetupCommands(platform: SetupPlatformId): Array<{ tool: string; command: string }> {
  if (platform === 'windows') {
    return [
      { tool: 'Vivado (stable backend)', command: 'Install Vivado WebPACK and ensure `vivado` is on PATH.' },
      { tool: 'openFPGALoader', command: 'winget install trabucayre.openFPGALoader' },
      { tool: 'Yosys (optional)', command: 'winget install YosysHQ.Yosys' },
    ];
  }

  if (platform === 'macos') {
    return [
      {
        tool: 'Vivado (stable backend)',
        command: 'Install Vivado WebPACK and export XILINX_VIVADO in your shell profile.',
      },
      { tool: 'openFPGALoader', command: 'brew install openfpgaloader' },
      { tool: 'Yosys (optional)', command: 'brew install yosys' },
    ];
  }

  return [
    {
      tool: 'Vivado (stable backend)',
      command: 'Install Vivado WebPACK and source settings64.sh before launching RedByte.',
    },
    { tool: 'openFPGALoader', command: 'sudo apt-get install -y openfpgaloader' },
    { tool: 'Yosys (optional)', command: 'sudo apt-get install -y yosys' },
  ];
}

function getTool(probe: ToolProbeResult | null, name: string): ToolProbeTool | null {
  if (!probe || !Array.isArray(probe.tools)) return null;
  return probe.tools.find((tool) => tool.name === name) ?? null;
}

function buildStableToolStatus(probe: ToolProbeResult | null): SetupToolStatus[] {
  const vivado = getTool(probe, 'vivado');
  const loader = getTool(probe, 'openFPGALoader');
  const yosys = getTool(probe, 'yosys');
  const entries: Array<{ name: string; label: string; tool: ToolProbeTool | null }> = [
    { name: 'vivado', label: 'Vivado (stable path)', tool: vivado },
    { name: 'openFPGALoader', label: 'openFPGALoader (programming)', tool: loader },
    { name: 'yosys', label: 'Yosys (synthesis)', tool: yosys },
  ];

  return entries.map((entry) => {
    const tool = entry.tool;
    const status: 'ok' | 'found_not_in_path' | 'missing' =
      tool?.status === 'found_not_in_path' ? 'found_not_in_path' : tool?.ok ? 'ok' : 'missing';
    const source: SetupToolStatus['source'] =
      tool?.source === 'bundled' ||
      tool?.source === 'buildpack' ||
      tool?.source === 'system' ||
      tool?.source === 'not_found' ||
      tool?.source === 'found_not_in_path'
        ? tool.source
        : status === 'found_not_in_path'
          ? 'found_not_in_path'
          : tool?.ok
            ? 'system'
            : 'not_found';
    const integrity: SetupToolStatus['integrity'] =
      source === 'bundled'
        ? tool?.integrity === 'verified' || tool?.integrity === 'corrupt' || tool?.integrity === 'unknown'
          ? tool.integrity
          : 'unknown'
        : 'unknown';
    const detail =
      status === 'found_not_in_path'
        ? `source:${source} found_not_in_path`
        : tool?.ok
          ? `source:${source} ${tool.version ?? 'detected'}`
          : `source:${source} ${tool?.error ?? 'missing'}`;
    const suggestedFix =
      integrity === 'corrupt'
        ? tool?.suggestedFix ??
          (entry.name === 'yosys'
            ? 'Repair Yosys bundle: delete bundled yosys payload and reinstall RedByte.'
            : 'Repair bundled tools: reinstall RedByte or re-download bundled tool payload.')
        : tool?.suggestedFix;
    return {
      name: entry.name,
      label: entry.label,
      ok: tool?.ok === true,
      status,
      source,
      integrity,
      detail,
      suggestedFix,
    };
  });
}

function getDefaultSnapshot(): ToolchainProjectSnapshotInput {
  const example = getBasys3VerilogExample('basys3-switches-to-leds');
  const preset: Basys3XdcPresetId = 'basys3-switches-leds-7seg';
  const sourceText = example?.text ?? 'module top(input wire clk, output wire [15:0] led); assign led = 16\'h0000; endmodule\n';
  return {
    hdl: {
      top: example?.top ?? 'top',
      sources: [
        {
          path: example?.defaultPath ?? 'top.v',
          language: 'verilog',
          text: sourceText,
        },
      ],
    },
    fpga: {
      board: 'basys3',
      preset,
      top: example?.top ?? 'top',
      constraints: { type: 'xdc', text: getBasys3XdcPresetText(preset) },
    },
  };
}

const DEFAULT_STEPS: SetupStepStatus[] = [
  { id: 'probe', label: 'Probe tools', state: 'idle', detail: 'Pending' },
  { id: 'detect', label: 'Detect Basys3', state: 'idle', detail: 'Pending' },
  { id: 'plan', label: 'Resolve build path', state: 'idle', detail: 'Pending' },
];

function updateStepState(
  steps: SetupStepStatus[],
  stepId: SetupStepId,
  next: Omit<SetupStepStatus, 'id' | 'label'> & Partial<Pick<SetupStepStatus, 'label'>>
): SetupStepStatus[] {
  return steps.map((step) =>
    step.id === stepId
      ? {
          ...step,
          ...(next.label ? { label: next.label } : {}),
          state: next.state,
          detail: next.detail,
          ...(next.nextAction ? { nextAction: next.nextAction } : {}),
        }
      : step
  );
}

function resolveOverallStatus(
  tools: SetupToolStatus[],
  buildPath: ToolchainBuildPath | null
): { tone: 'ready' | 'warning' | 'error'; label: string } {
  const hasFoundNotInPath = tools.some((tool) => tool.status === 'found_not_in_path');
  const hasMissing = tools.some((tool) => tool.status === 'missing');
  const planReady = buildPath?.backend && buildPath.backend !== 'none';

  if (!hasMissing && !hasFoundNotInPath && planReady) {
    return { tone: 'ready', label: 'Ready' };
  }

  if (hasFoundNotInPath) {
    return { tone: 'warning', label: 'Found, not in PATH' };
  }

  return { tone: 'error', label: 'Missing tools' };
}

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function getToolSourceBadge(source: SetupToolStatus['source']): { label: string; tone: 'bundled' | 'buildpack' | 'system' | 'found' | 'missing' } {
  if (source === 'bundled') {
    return { label: 'Bundled', tone: 'bundled' };
  }
  if (source === 'buildpack') {
    return { label: 'Buildpack', tone: 'buildpack' };
  }
  if (source === 'system') {
    return { label: 'System', tone: 'system' };
  }
  if (source === 'found_not_in_path') {
    return { label: 'Found, not in PATH', tone: 'found' };
  }
  return { label: 'Missing', tone: 'missing' };
}

function getReadinessGateTone(state: StudentReadinessGateView['state']): string {
  if (state === 'pass') return styles.gatePass;
  if (state === 'warn') return styles.gateWarn;
  return styles.gateFail;
}

function buildSubmissionBundleGate(status: SubmissionBundleStatusSnapshot | null): StudentReadinessGateView {
  if (!status) {
    return {
      id: 'submission_bundle',
      label: 'Submission Bundle',
      state: 'fail',
      detail: 'No submission bundle generated in this session.',
      nextAction: 'Generate Submission Bundle from Logic Playground.',
    };
  }
  if (status.reproducibilityStatus === 'pass') {
    return {
      id: 'submission_bundle',
      label: 'Submission Bundle',
      state: 'pass',
      detail: `Latest bundle: ${status.filename}`,
    };
  }
  return {
    id: 'submission_bundle',
    label: 'Submission Bundle',
    state: 'warn',
    detail: `Latest bundle has reproducibility status "${status.reproducibilityStatus}".`,
    nextAction: 'Regenerate bundle after replay verification passes.',
  };
}

interface TaModeSummary {
  missingTools: Array<{ name: string; suggestedFix?: string }>;
}

function parseTaModeReport(raw: string): TaModeSummary | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const parsed = JSON.parse(trimmed) as ToolchainDoctorReport;
  const tools = parsed?.probe?.tools ?? [];
  const missingTools = tools
    .filter((tool) => tool.ok !== true)
    .map((tool) => ({
      name: tool.name,
      suggestedFix: tool.suggestedFix,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  return { missingTools };
}

const DEFAULT_BUILDPACK_INSTALL = {
  name: 'basys3-open-toolchain',
  version: '0.1.0-dev',
  url: 'file://C:/redbyte-buildpacks/basys3-open-toolchain-0.1.0-dev.zip',
  sha256: '',
};

function mergeSetupLogs(existing: BuildLogEntry[], incoming: BuildLogEntry[]): BuildLogEntry[] {
  const next = [...existing];
  const seen = new Set(existing.map((entry) => `${entry.run_id}|${entry.ts}|${entry.step}|${entry.msg}`));
  for (const entry of incoming) {
    const key = `${entry.run_id}|${entry.ts}|${entry.step}|${entry.msg}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(entry);
  }
  next.sort((left, right) => {
    if (left.run_id !== right.run_id) return left.run_id.localeCompare(right.run_id);
    if (left.ts !== right.ts) return left.ts - right.ts;
    if (left.step !== right.step) return left.step.localeCompare(right.step);
    return left.msg.localeCompare(right.msg);
  });
  return next;
}

export const ToolchainSetupComponent: React.FC<{
  onOpenApp?: (appId: string, props?: Record<string, unknown>) => void;
}> = ({ onOpenApp }) => {
  const backendId = getToolchainBackendId();
  const backend = useMemo(() => getToolchainBackend(backendId), [backendId]);
  const uiMode = useMemo(() => getRedByteUiMode(), []);
  const isTaMode = uiMode === 'ta';
  const [classroomLockdownEnabled, setClassroomLockdownState] = useState<boolean>(
    () => getClassroomLockdownState().enabled,
  );
  const isLockdownStudentView = classroomLockdownEnabled && !isTaMode;
  const snapshot = useMemo(() => getDefaultSnapshot(), []);

  const [probe, setProbe] = useState<ToolProbeResult | null>(null);
  const [boardDetect, setBoardDetect] = useState<BoardDetectResult | null>(null);
  const [buildPath, setBuildPath] = useState<ToolchainBuildPath | null>(null);
  const [preflight, setPreflight] = useState<ToolchainPreflightStatus | null>(null);
  const [logs, setLogs] = useState<BuildLogEntry[]>([]);
  const [buildpackStatus, setBuildpackStatus] = useState<BuildpackStatusResult | null>(null);
  const [buildpackRun, setBuildpackRun] = useState<BuildpackRunStatus | null>(null);
  const [buildpackLogs, setBuildpackLogs] = useState<BuildLogEntry[]>([]);
  const [isBuildpackInstalling, setIsBuildpackInstalling] = useState(false);
  const [isBuildpackRemoving, setIsBuildpackRemoving] = useState(false);
  const [submissionBundleStatus, setSubmissionBundleStatus] = useState<SubmissionBundleStatusSnapshot | null>(() => {
    if (typeof window === 'undefined') return null;
    return decodeSubmissionBundleStatus(window.localStorage.getItem(SUBMISSION_BUNDLE_STATUS_STORAGE_KEY));
  });
  const [steps, setSteps] = useState<SetupStepStatus[]>(DEFAULT_STEPS);
  const [isVerifying, setIsVerifying] = useState(false);
  const [toolFilter, setToolFilter] = useState<ToolListFilter>('needs_action');
  const [taInput, setTaInput] = useState('');
  const [taError, setTaError] = useState<string | null>(null);
  const [taSummary, setTaSummary] = useState<TaModeSummary | null>(null);
  const isMountedRef = useRef(true);
  const buildpackStreamRef = useRef<{ close: () => void } | null>(null);
  const buildpackPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buildpackMonitorTokenRef = useRef(0);
  const buildpackPollingBusyRef = useRef(false);
  const buildpackOffsetRef = useRef(0);

  const setupPlatform = useMemo(() => {
    const probePlatform = probe?.env?.platform;
    if (typeof probePlatform === 'string' && probePlatform.trim().length > 0) {
      return normalizeSetupPlatform(probePlatform);
    }
    const platform =
      typeof navigator !== 'undefined' && typeof navigator.platform === 'string' ? navigator.platform : 'linux';
    return normalizeSetupPlatform(platform);
  }, [probe?.env?.platform]);

  const setupCommands = useMemo(() => getSetupCommands(setupPlatform), [setupPlatform]);
  const requiredTools = useMemo(() => buildStableToolStatus(probe), [probe]);
  const filteredRequiredTools = useMemo(() => {
    if (toolFilter === 'all') return requiredTools;
    if (toolFilter === 'bundled') return requiredTools.filter((tool) => tool.source === 'bundled');
    return requiredTools.filter(
      (tool) =>
        tool.status === 'missing' ||
        tool.status === 'found_not_in_path' ||
        (tool.source === 'bundled' && tool.integrity === 'corrupt')
    );
  }, [requiredTools, toolFilter]);
  const allRequiredToolsReady = useMemo(
    () =>
      requiredTools.length > 0 &&
      requiredTools.every(
        (tool) =>
          tool.status === 'ok' &&
          (tool.source === 'bundled' || tool.source === 'buildpack' || tool.source === 'system') &&
          !(tool.source === 'bundled' && tool.integrity === 'corrupt')
      ),
    [requiredTools]
  );
  const overall = useMemo(() => resolveOverallStatus(requiredTools, buildPath), [requiredTools, buildPath]);
  const studentReadiness = useMemo(
    () =>
      createStudentReadinessSummary({
        probe,
        preflight,
        buildPath,
      }),
    [buildPath, preflight, probe]
  );
  const studentReadinessWithSubmission = useMemo(() => {
    const submissionGate = buildSubmissionBundleGate(submissionBundleStatus);
    const gates: StudentReadinessGateView[] = [...studentReadiness.gates, submissionGate];
    const overall = gates.every((gate) => gate.state === 'pass') ? 'ready' : 'needs_action';
    return {
      schema_version: studentReadiness.schema_version,
      overall,
      gates,
    };
  }, [studentReadiness, submissionBundleStatus]);
  const defaultBuildpack = useMemo(
    () =>
      buildpackStatus?.installed.find(
        (pack) => pack.name === DEFAULT_BUILDPACK_INSTALL.name && pack.version === DEFAULT_BUILDPACK_INSTALL.version
      ) ?? null,
    [buildpackStatus]
  );

  const clearBuildpackMonitoring = useCallback(() => {
    buildpackMonitorTokenRef.current += 1;
    if (buildpackStreamRef.current) {
      buildpackStreamRef.current.close();
      buildpackStreamRef.current = null;
    }
    if (buildpackPollRef.current) {
      clearTimeout(buildpackPollRef.current);
      buildpackPollRef.current = null;
    }
    buildpackPollingBusyRef.current = false;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearBuildpackMonitoring();
    };
  }, [clearBuildpackMonitoring]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleSubmissionBundleEvent = (event: Event) => {
      const detail = (event as CustomEvent<SubmissionBundleStatusSnapshot | null | undefined>).detail;
      const parsed =
        detail && typeof detail === 'object' && 'schema_version' in detail
          ? decodeSubmissionBundleStatus(stableStringify(detail))
          : decodeSubmissionBundleStatus(window.localStorage.getItem(SUBMISSION_BUNDLE_STATUS_STORAGE_KEY));
      setSubmissionBundleStatus(parsed);
    };
    window.addEventListener(SUBMISSION_BUNDLE_EVENT, handleSubmissionBundleEvent as EventListener);
    return () => window.removeEventListener(SUBMISSION_BUNDLE_EVENT, handleSubmissionBundleEvent as EventListener);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
      if (typeof detail?.enabled === 'boolean') {
        setClassroomLockdownState(detail.enabled);
        return;
      }
      setClassroomLockdownState(getClassroomLockdownState().enabled);
    };
    window.addEventListener(RB_CLASSROOM_LOCKDOWN_CHANGE_EVENT, handler as EventListener);
    return () => window.removeEventListener(RB_CLASSROOM_LOCKDOWN_CHANGE_EVENT, handler as EventListener);
  }, []);

  const handleToggleClassroomLockdown = useCallback(() => {
    setClassroomLockdownEnabled(!classroomLockdownEnabled);
  }, [classroomLockdownEnabled]);

  const refreshBuildpackStatus = useCallback(async () => {
    try {
      const status = await backend.getBuildpackStatus();
      if (!isMountedRef.current) return;
      setBuildpackStatus(status);
      setLogs((prev) => mergeSetupLogs(prev, status.logs ?? []));
    } catch (error) {
      if (!isMountedRef.current) return;
      const message = error instanceof Error ? error.message : 'buildpack_status_failed';
      setLogs((prev) =>
        mergeSetupLogs(prev, [
          {
            run_id: 'toolchain-buildpack-status',
            ts: prev.length,
            step: 'buildpack',
            level: 'error',
            msg: `[${backend.id}] buildpack-status failed: ${message}`,
          },
        ])
      );
    }
  }, [backend]);

  const pollBuildpackRun = useCallback(
    (runId: string, monitorToken: number) => {
      const tick = async () => {
        if (!isMountedRef.current || monitorToken !== buildpackMonitorTokenRef.current) return;
        if (buildpackPollingBusyRef.current) {
          buildpackPollRef.current = setTimeout(tick, 500);
          return;
        }
        buildpackPollingBusyRef.current = true;
        try {
          const status = await backend.getBuildpackRunStatus(runId, buildpackOffsetRef.current);
          if (!isMountedRef.current || monitorToken !== buildpackMonitorTokenRef.current) return;
          setBuildpackRun(status);
          setBuildpackLogs((prev) => mergeSetupLogs(prev, status.logs ?? []));
          buildpackOffsetRef.current = Math.max(buildpackOffsetRef.current, status.nextOffset ?? buildpackOffsetRef.current);
          if (status.state === 'running') {
            buildpackPollRef.current = setTimeout(tick, 500);
            return;
          }
          setIsBuildpackInstalling(false);
          clearBuildpackMonitoring();
          await refreshBuildpackStatus();
        } catch (error) {
          if (!isMountedRef.current || monitorToken !== buildpackMonitorTokenRef.current) return;
          const message = error instanceof Error ? error.message : 'buildpack_poll_failed';
          setBuildpackLogs((prev) =>
            mergeSetupLogs(prev, [
              {
                run_id: runId,
                ts: prev.length,
                step: 'buildpack',
                level: 'error',
                msg: `[${backend.id}] buildpack-run poll failed: ${message}`,
              },
            ])
          );
          setIsBuildpackInstalling(false);
          clearBuildpackMonitoring();
        } finally {
          buildpackPollingBusyRef.current = false;
        }
      };
      void tick();
    },
    [backend, clearBuildpackMonitoring, refreshBuildpackStatus]
  );

  const monitorBuildpackRun = useCallback(
    (runId: string, initialOffset: number) => {
      buildpackOffsetRef.current = initialOffset;
      clearBuildpackMonitoring();
      const monitorToken = buildpackMonitorTokenRef.current;
      const subscription = backend.openBuildpackRunStream(
        runId,
        {
          onLog: (entry) => {
            if (!isMountedRef.current || monitorToken !== buildpackMonitorTokenRef.current) return;
            setBuildpackLogs((prev) => mergeSetupLogs(prev, [entry]));
            buildpackOffsetRef.current = Math.max(buildpackOffsetRef.current, Number(entry.ts) + 1);
          },
          onDone: (summary) => {
            if (!isMountedRef.current || monitorToken !== buildpackMonitorTokenRef.current) return;
            setBuildpackRun((prev) => ({
              runId: summary.runId,
              artifactId: summary.artifactId,
              state: summary.state,
              ok: summary.ok,
              exitCode: summary.exitCode,
              logs: prev?.logs ?? [],
              nextOffset: summary.nextOffset,
              ...(summary.error ? { error: summary.error } : {}),
              ...(summary.artifact ? { artifact: summary.artifact } : {}),
            }));
            buildpackOffsetRef.current = Math.max(buildpackOffsetRef.current, summary.nextOffset ?? buildpackOffsetRef.current);
            setIsBuildpackInstalling(false);
            clearBuildpackMonitoring();
            void refreshBuildpackStatus();
          },
          onError: () => {
            if (!isMountedRef.current || monitorToken !== buildpackMonitorTokenRef.current) return;
            clearBuildpackMonitoring();
            pollBuildpackRun(runId, buildpackMonitorTokenRef.current);
          },
        },
        { offset: initialOffset }
      );

      if (!subscription) {
        pollBuildpackRun(runId, monitorToken);
        return;
      }
      buildpackStreamRef.current = subscription;
    },
    [backend, clearBuildpackMonitoring, pollBuildpackRun, refreshBuildpackStatus]
  );

  useEffect(() => {
    if (!isTaMode) return;
    void refreshBuildpackStatus();
  }, [isTaMode, refreshBuildpackStatus]);

  const handleVerifySetup = useCallback(() => {
    void (async () => {
      setIsVerifying(true);
      setLogs([]);
      setSteps(DEFAULT_STEPS);
      const nextLogs: BuildLogEntry[] = [];

      try {
        setSteps((prev) => updateStepState(prev, 'probe', { state: 'running', detail: 'Checking toolchain tools...' }));
        const nextProbe = await backend.probeTools();
        setProbe(nextProbe);
        nextLogs.push(...(nextProbe.logs ?? []));

        const missingProbeTool = buildStableToolStatus(nextProbe).find((tool) => tool.status === 'missing');
        if (missingProbeTool) {
          setSteps((prev) =>
            updateStepState(prev, 'probe', {
              state: 'warning',
              detail: `Missing ${missingProbeTool.name}`,
              nextAction: setupCommands.find((entry) =>
                entry.tool.toLowerCase().includes(missingProbeTool.name.toLowerCase())
              )?.command,
            })
          );
        } else {
          setSteps((prev) =>
            updateStepState(prev, 'probe', { state: 'success', detail: 'Required tools were detected.' })
          );
        }

        setSteps((prev) => updateStepState(prev, 'detect', { state: 'running', detail: 'Scanning for Basys3 board...' }));
        const nextBoardDetect = await backend.detectBoards();
        setBoardDetect(nextBoardDetect);
        nextLogs.push(...(nextBoardDetect.logs ?? []));

        const boardDetected = (nextBoardDetect.boards ?? []).some((board) => board.type === 'basys3');
        setSteps((prev) =>
          updateStepState(prev, 'detect', {
            state: boardDetected ? 'success' : 'warning',
            detail: boardDetected ? 'Basys3 detected via USB-JTAG.' : 'Basys3 not detected.',
            nextAction: boardDetected
              ? undefined
              : 'Check USB cable, drivers, and ensure Vivado Hardware Manager is closed.',
          })
        );

        setSteps((prev) => updateStepState(prev, 'plan', { state: 'running', detail: 'Resolving implement backend...' }));
        const nextBuildPath = await backend.resolveBuildPath(snapshot, { refreshProbe: false });
        setBuildPath(nextBuildPath);
        nextLogs.push(...(nextBuildPath.warnings ?? []));

        if (nextBuildPath.backend === 'none') {
          setSteps((prev) =>
            updateStepState(prev, 'plan', {
              state: 'error',
              detail: 'No implement backend available.',
              nextAction: 'Install Vivado WebPACK (recommended stable path) and re-run Verify Setup.',
            })
          );
        } else {
          const isExperimental = nextBuildPath.backend === 'f4pga' || nextBuildPath.backend === 'nextpnr-xilinx';
          const buildpackLabel =
            nextBuildPath.backend === 'buildpack-open' && nextBuildPath.buildpack
              ? ` (${nextBuildPath.buildpack.name}@${nextBuildPath.buildpack.version})`
              : '';
          setSteps((prev) =>
            updateStepState(prev, 'plan', {
              state: isExperimental ? 'warning' : 'success',
              detail: `Selected backend: ${nextBuildPath.backend}${buildpackLabel}.`,
              nextAction: isExperimental
                ? 'Backend is experimental; if runs fail, export report + artifacts for triage.'
                : undefined,
            })
          );
        }

        const nextPreflight = await backend.preflight(snapshot, { refreshProbe: false });
        setPreflight(nextPreflight);
        nextLogs.push(...(nextPreflight.lint.warnings ?? []), ...(nextPreflight.lint.errors ?? []));

        setLogs(nextLogs);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'setup_verify_failed';
        const failureLog: BuildLogEntry = {
          run_id: 'toolchain-setup-verify',
          ts: nextLogs.length,
          step: 'preflight',
          level: 'error',
          msg: `[${backend.id}] setup verify failed: ${message}`,
        };
        setLogs([...nextLogs, failureLog]);
      } finally {
        setIsVerifying(false);
      }
    })();
  }, [backend, setupCommands, snapshot]);

  const handleBuildpackInstall = useCallback(() => {
    void (async () => {
      clearBuildpackMonitoring();
      setIsBuildpackInstalling(true);
      setBuildpackLogs([]);
      try {
        const run = await backend.installBuildpack({
          name: DEFAULT_BUILDPACK_INSTALL.name,
          version: DEFAULT_BUILDPACK_INSTALL.version,
          url: DEFAULT_BUILDPACK_INSTALL.url,
          ...(DEFAULT_BUILDPACK_INSTALL.sha256 ? { sha256: DEFAULT_BUILDPACK_INSTALL.sha256 } : {}),
        });
        setBuildpackRun(run);
        setBuildpackLogs(run.logs ?? []);
        buildpackOffsetRef.current = run.nextOffset ?? 0;
        if (run.state === 'running') {
          monitorBuildpackRun(run.runId, run.nextOffset ?? 0);
          return;
        }
        setIsBuildpackInstalling(false);
        await refreshBuildpackStatus();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'buildpack_install_failed';
        setBuildpackLogs((prev) =>
          mergeSetupLogs(prev, [
            {
              run_id: 'toolchain-buildpack-install',
              ts: prev.length,
              step: 'buildpack',
              level: 'error',
              msg: `[${backend.id}] buildpack-install failed: ${message}`,
            },
          ])
        );
        setIsBuildpackInstalling(false);
      }
    })();
  }, [backend, clearBuildpackMonitoring, monitorBuildpackRun, refreshBuildpackStatus]);

  const handleBuildpackRemove = useCallback(() => {
    void (async () => {
      setIsBuildpackRemoving(true);
      try {
        const result = await backend.removeBuildpack(DEFAULT_BUILDPACK_INSTALL.name, DEFAULT_BUILDPACK_INSTALL.version);
        setBuildpackLogs((prev) => mergeSetupLogs(prev, result.logs ?? []));
        await refreshBuildpackStatus();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'buildpack_remove_failed';
        setBuildpackLogs((prev) =>
          mergeSetupLogs(prev, [
            {
              run_id: 'toolchain-buildpack-remove',
              ts: prev.length,
              step: 'buildpack',
              level: 'error',
              msg: `[${backend.id}] buildpack-remove failed: ${message}`,
            },
          ])
        );
      } finally {
        setIsBuildpackRemoving(false);
      }
    })();
  }, [backend, refreshBuildpackStatus]);

  const handleExportSetupReport = useCallback(() => {
    void (async () => {
      const nextProbe = probe ?? (await backend.probeTools());
      if (!probe) setProbe(nextProbe);

      const nextPreflight = preflight ?? (await backend.preflight(snapshot, { refreshProbe: false }));
      if (!preflight) setPreflight(nextPreflight);

      const nextBuildPath = buildPath ?? (await backend.resolveBuildPath(snapshot, { refreshProbe: false }));
      if (!buildPath) setBuildPath(nextBuildPath);

      const report = await backend.doctorReport(snapshot, {
        logs,
        probe: nextProbe,
        preflight: nextPreflight,
        buildPath: nextBuildPath,
      });

      const json = stableStringify(report);
      const blob = new Blob([json], { type: 'application/json' });
      const reportTag = report.reportId ? `-${report.reportId}` : '';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rb-toolchain-setup-report${reportTag}.json`;
      link.click();
      URL.revokeObjectURL(url);
    })().catch((error) => {
      const message = error instanceof Error ? error.message : 'setup_report_export_failed';
      setLogs((prev) => [
        ...prev,
        {
          run_id: 'toolchain-setup-export',
          ts: prev.length,
          step: 'preflight',
          level: 'error',
          msg: `[${backend.id}] setup report export failed: ${message}`,
        },
      ]);
    });
  }, [backend, buildPath, logs, preflight, probe, snapshot]);

  const handleExportDiagnosticsBundle = useCallback(() => {
    void (async () => {
      const nextProbe = probe ?? (await backend.probeTools());
      if (!probe) setProbe(nextProbe);

      const nextPreflight = preflight ?? (await backend.preflight(snapshot, { refreshProbe: false }));
      if (!preflight) setPreflight(nextPreflight);

      const nextBuildPath = buildPath ?? (await backend.resolveBuildPath(snapshot, { refreshProbe: false }));
      if (!buildPath) setBuildPath(nextBuildPath);

      const report = await backend.doctorReport(snapshot, {
        logs,
        probe: nextProbe,
        preflight: nextPreflight,
        buildPath: nextBuildPath,
      });

      const bundle = await generateClassroomDiagnosticsBundle({
        source: 'toolchain-setup',
        mode: uiMode,
        app: {
          envMode: import.meta.env.MODE ?? null,
          appVersion: import.meta.env.VITE_APP_VERSION ?? null,
          buildId: import.meta.env.VITE_GIT_SHA ?? null,
        },
        environment: {
          platform: nextProbe.env?.platform ?? (typeof navigator !== 'undefined' ? navigator.platform : null),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        },
        doctorReport: report,
        readiness: studentReadiness,
        probe: nextProbe,
        preflight: nextPreflight,
        buildPath: nextBuildPath,
        logs: mergeSetupLogs(logs, buildpackLogs),
        context: {
          boardDetect,
          setupSteps: steps,
          submissionBundleStatus,
          buildpackStatus,
          buildpackRun,
        },
      });
      downloadClassroomDiagnosticsBundle(bundle);
    })().catch((error) => {
      const message = error instanceof Error ? error.message : 'diagnostics_bundle_export_failed';
      setLogs((prev) => [
        ...prev,
        {
          run_id: 'toolchain-setup-diagnostics',
          ts: prev.length,
          step: 'preflight',
          level: 'error',
          msg: `[${backend.id}] diagnostics bundle export failed: ${message}`,
        },
      ]);
    });
  }, [
    backend,
    boardDetect,
    buildPath,
    buildpackLogs,
    buildpackRun,
    buildpackStatus,
    logs,
    preflight,
    probe,
    snapshot,
    steps,
    studentReadiness,
    submissionBundleStatus,
    uiMode,
  ]);

  const handleParseTaMode = useCallback(() => {
    try {
      const summary = parseTaModeReport(taInput);
      setTaSummary(summary);
      setTaError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON';
      setTaError(message);
      setTaSummary(null);
    }
  }, [taInput]);

  return (
    <div className={styles.page} data-testid="toolchain-setup-page">
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Toolchain Setup</h2>
          <p className={styles.subtitle}>Basys3 path: Vivado (implement) + Yosys (synth) + openFPGALoader (program).</p>
          <p className={styles.meta} data-testid="toolchain-setup-mode-label">
            mode: <span className={styles.mono}>{uiMode}</span>
          </p>
          <p className={styles.meta} data-testid="toolchain-setup-lockdown-label">
            lockdown: <span className={styles.mono}>{classroomLockdownEnabled ? 'on' : 'off'}</span>
          </p>
        </div>
        <div className={styles.headerActions}>
          <span
            className={cx(
              styles.statusPill,
              overall.tone === 'ready' ? styles.statusReady : overall.tone === 'warning' ? styles.statusWarning : styles.statusError,
            )}
            data-testid="toolchain-setup-status"
          >
            {overall.label}
          </span>
          {!isLockdownStudentView ? (
            <button
              onClick={handleExportSetupReport}
              className={cx(styles.button, styles.buttonInfo)}
              type="button"
              data-testid="toolchain-setup-export-button"
            >
              Export Setup Report
            </button>
          ) : null}
          {isTaMode ? (
            <button
              onClick={handleToggleClassroomLockdown}
              className={cx(styles.button, styles.buttonWarn)}
              type="button"
              data-testid="toolchain-setup-lockdown-toggle"
            >
              Classroom Lockdown: {classroomLockdownEnabled ? 'ON' : 'OFF'}
            </button>
          ) : null}
          {isTaMode ? (
            <button
              onClick={handleExportDiagnosticsBundle}
              className={cx(styles.button, styles.buttonInfo)}
              type="button"
              data-testid="toolchain-setup-export-diagnostics-button"
            >
              Export Diagnostics Bundle
            </button>
          ) : null}
        </div>
      </div>

      {isLockdownStudentView ? (
      <div
        className={cx(styles.section, styles.sectionMuted)}
        data-testid="toolchain-setup-lockdown-minimal"
      >
        <h3 className={styles.sectionTitle}>Classroom Lockdown</h3>
        <p className={styles.sectionHint}>
          Advanced toolchain diagnostics are hidden. Use Verify Setup for readiness status.
        </p>
        <button
          onClick={handleVerifySetup}
          className={cx(styles.button, styles.buttonInfo)}
          type="button"
          disabled={isVerifying}
          data-testid="toolchain-setup-verify-button"
        >
          {isVerifying ? 'Verifying...' : 'Verify Setup'}
        </button>
      </div>
      ) : (
      <div className={styles.section} data-testid="toolchain-setup-required-tools">
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Stable Path Checklist (Vivado-first)</h3>
          <div>
            <button
              onClick={handleVerifySetup}
              className={cx(styles.button, styles.buttonInfo)}
              type="button"
              disabled={isVerifying}
              data-testid="toolchain-setup-verify-button"
            >
              {isVerifying ? 'Verifying...' : NEO_TYPO.verifySetup}
            </button>
          </div>
        </div>

        <div className={styles.filterRow} data-testid="toolchain-setup-tool-filter">
          <span className={styles.filterLabel}>Filter:</span>
          <button
            type="button"
            onClick={() => setToolFilter('all')}
            className={cx(styles.filterButton, toolFilter === 'all' && styles.filterButtonActive)}
            data-testid="toolchain-setup-filter-all"
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setToolFilter('needs_action')}
            className={cx(styles.filterButton, toolFilter === 'needs_action' && styles.filterButtonActive)}
            data-testid="toolchain-setup-filter-needs-action"
          >
            Missing / Needs action
          </button>
          <button
            type="button"
            onClick={() => setToolFilter('bundled')}
            className={cx(styles.filterButton, toolFilter === 'bundled' && styles.filterButtonActive)}
            data-testid="toolchain-setup-filter-bundled"
          >
            Bundled only
          </button>
        </div>

        {allRequiredToolsReady ? (
          <div
            className={styles.successBanner}
            data-testid="toolchain-setup-no-installs-summary"
          >
            Setup complete â€” no additional downloads needed.
          </div>
        ) : null}

        <div className={styles.toolList}>
          {filteredRequiredTools.length === 0 ? (
            <div className={styles.sectionHint} data-testid="toolchain-setup-tool-filter-empty">
              No tools match the current filter.
            </div>
          ) : null}
          {filteredRequiredTools.map((tool) => {
            const sourceBadge = getToolSourceBadge(tool.source);
            const badgeClass =
              sourceBadge.tone === 'bundled'
                ? styles.toolBadgeBundled
                : sourceBadge.tone === 'buildpack'
                  ? styles.toolBadgeBuildpack
                  : sourceBadge.tone === 'system'
                    ? styles.toolBadgeSystem
                    : sourceBadge.tone === 'found'
                      ? styles.toolBadgeFound
                      : styles.toolBadgeMissing;
            return (
            <div key={tool.name} className={styles.toolRow} data-testid={`toolchain-setup-tool-${tool.name}`}>
              <span className={styles.toolName}>{tool.label}:</span>{' '}
              <span className={styles.mono}>{tool.ok ? 'ok' : tool.status}</span>
              {' · '}
              <span
                className={cx(styles.toolBadge, badgeClass)}
                data-testid={`toolchain-setup-tool-source-${tool.name}`}
              >
                {sourceBadge.label}
              </span>
              {' · '}
              <span className={styles.mono}>{tool.detail}</span>
              {' · '}
              <span className={cx(styles.mono, tool.integrity === 'corrupt' ? styles.toolTextDanger : styles.toolTextMuted)}>
                integrity:{tool.integrity}
              </span>
              {tool.source === 'bundled' && tool.integrity === 'verified' ? (
                <>
                  {' · '}
                  <span className={cx(styles.mono, styles.toolTextSuccess)}>Verified</span>
                </>
              ) : null}
              {tool.source === 'bundled' && tool.integrity === 'corrupt' ? (
                <>
                  {' · '}
                  <span className={cx(styles.mono, styles.toolTextDanger)}>Corrupt bundle detected</span>
                </>
              ) : null}
              {tool.suggestedFix ? (
                <>
                  {' · '}
                  <span className={cx(styles.mono, styles.toolTextInfo)}>{tool.suggestedFix}</span>
                </>
              ) : null}
            </div>
            );
          })}
        </div>

        <div className={styles.boardCard} data-testid="toolchain-setup-board-detect">
          <div>
            Basys3 detect:{' '}
            <span className={styles.mono}>
              {boardDetect
                ? boardDetect.boards.some((board) => board.type === 'basys3')
                  ? 'detected'
                  : 'not detected'
                : 'not run'}
            </span>
          </div>
        </div>
      </div>
      )}

      {!isLockdownStudentView ? (
      <div className={styles.section} data-testid="toolchain-setup-install-instructions">
        <h3 className={styles.sectionTitle}>Install Commands ({setupPlatform})</h3>
        <pre className={styles.pre}>
          {setupCommands.map((entry) => `${entry.tool}: ${entry.command}`).join('\n')}
        </pre>
        <details>
          <summary className={styles.detailsSummary}>macOS / Linux alternatives</summary>
          <pre className={styles.pre}>
            {getSetupCommands('macos')
              .concat(getSetupCommands('linux'))
              .map((entry) => `${entry.tool}: ${entry.command}`)
              .join('\n')}
          </pre>
        </details>
      </div>
      ) : null}

      {isTaMode && !isLockdownStudentView ? (
      <div className={cx(styles.section, styles.sectionTa)} data-testid="toolchain-setup-buildpack">
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Basys3 Open Buildpack</h3>
          <div className={styles.headerActions}>
            <button
              type="button"
              onClick={() => void refreshBuildpackStatus()}
              className={styles.button}
              data-testid="toolchain-setup-buildpack-refresh"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={handleBuildpackInstall}
              disabled={isBuildpackInstalling}
              className={cx(styles.button, styles.buttonInfo)}
              data-testid="toolchain-setup-buildpack-install"
            >
              {isBuildpackInstalling ? 'Installing...' : 'Install Buildpack'}
            </button>
            <button
              type="button"
              onClick={handleBuildpackRemove}
              disabled={isBuildpackRemoving}
              className={cx(styles.button, styles.buttonWarn)}
              data-testid="toolchain-setup-buildpack-remove"
            >
              {isBuildpackRemoving ? 'Removing...' : 'Remove'}
            </button>
          </div>
        </div>

        <div className={styles.gatesList} data-testid="toolchain-setup-buildpack-status">
          <div>
            target: <span className={styles.mono}>{DEFAULT_BUILDPACK_INSTALL.name}@{DEFAULT_BUILDPACK_INSTALL.version}</span>
          </div>
          <div>
            source: <span className={styles.mono}>{DEFAULT_BUILDPACK_INSTALL.url}</span>
          </div>
          <div>
            status:{' '}
            <span className={styles.mono}>
              {defaultBuildpack ? (defaultBuildpack.ok ? 'installed' : `installed_corrupt (${defaultBuildpack.error ?? 'unknown'})`) : 'not_installed'}
            </span>
          </div>
          {buildpackStatus ? (
            <div>
              storeRoot: <span className={styles.mono}>{buildpackStatus.storeRoot}</span>
            </div>
          ) : null}
          {buildpackRun ? (
            <div>
              run: <span className={styles.mono}>{buildpackRun.runId}</span> · state:{' '}
              <span className={styles.mono}>{buildpackRun.state}</span>
            </div>
          ) : null}
        </div>

        <pre
          className={styles.miniPre}
          data-testid="toolchain-setup-buildpack-logs"
        >
          {buildpackLogs.map((entry) => `[${entry.level}] ${entry.msg}`).join('\n')}
        </pre>
      </div>
      ) : null}

      {!isLockdownStudentView ? (
      <div className={styles.section} data-testid="toolchain-setup-verify-results">
        <h3 className={styles.sectionTitle}>Verify Results</h3>
        <div className={styles.gatesList}>
          {steps.map((step) => (
            <div key={step.id} className={styles.gateRow}>
              <span className={styles.toolName}>{step.label}:</span> <span className={styles.mono}>{step.state}</span>
              {' · '}
              <span>{step.detail}</span>
              {step.nextAction ? (
                <>
                  {' · '}
                  <span className={styles.toolTextInfo}>Next: {step.nextAction}</span>
                </>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      ) : null}

      <div className={styles.section} data-testid="toolchain-setup-student-readiness">
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionTitle}>Student Readiness</h3>
            {isTaMode ? (
              <p className={styles.sectionHint} data-testid="toolchain-setup-open-submission-help">
                Grade or troubleshoot a student submission (.zip).
              </p>
            ) : (
              <p className={styles.sectionHint}>Student view keeps advanced grading tools hidden.</p>
            )}
          </div>
          {isTaMode ? (
            <button
              type="button"
              onClick={() => onOpenApp?.('submission-inspector')}
              className={cx(styles.button, styles.buttonInfo)}
              data-testid="toolchain-setup-open-submission-cta"
            >
              {NEO_TYPO.openSubmissionBundle}
            </button>
          ) : null}
        </div>
        <div className={styles.readinessOverall}>
          <span className={styles.toolTextMuted}>overall:</span>{' '}
          <span
            className={cx(
              styles.mono,
              studentReadinessWithSubmission.overall === 'ready' ? styles.readinessReady : styles.readinessWarn,
            )}
            data-testid="toolchain-setup-student-readiness-overall"
          >
            {studentReadinessWithSubmission.overall}
          </span>
        </div>
        <div className={styles.gatesList}>
          {studentReadinessWithSubmission.gates.map((gate) => (
            <div key={gate.id} className={styles.gateRow} data-testid={`toolchain-setup-readiness-${gate.id}`}>
              <span className={styles.toolName}>{gate.label}:</span>{' '}
              <span className={cx(styles.mono, getReadinessGateTone(gate.state))}>{gate.state}</span>
              {' · '}
              <span>{gate.detail}</span>
              {gate.nextAction ? (
                <>
                  {' · '}
                  <span className={styles.toolTextInfo}>Next: {gate.nextAction}</span>
                </>
              ) : null}
              {gate.id === 'submission_bundle' && gate.state !== 'pass' ? (
                <>
                  <button
                    type="button"
                    onClick={() => onOpenApp?.('logic-playground')}
                    className={styles.inlineCta}
                    data-testid="toolchain-setup-readiness-submission-cta"
                  >
                    Generate
                  </button>
                </>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {isTaMode && !isLockdownStudentView ? (
      <div className={cx(styles.section, styles.sectionTa)} data-testid="toolchain-setup-ta-mode">
        <h3 className={styles.sectionTitle}>TA Mode (Doctor Report Triage)</h3>
        <textarea
          className={styles.textarea}
          placeholder="Paste doctor report JSON"
          value={taInput}
          onChange={(event) => setTaInput(event.target.value)}
          data-testid="toolchain-setup-ta-input"
        />
        <div className={styles.headerActions}>
          <button
            type="button"
            onClick={handleParseTaMode}
            className={styles.button}
            data-testid="toolchain-setup-ta-parse-button"
          >
            Parse Report
          </button>
          {taError ? <span className={styles.inlineError}>{taError}</span> : null}
        </div>
        {taSummary ? (
          <div className={styles.gatesList} data-testid="toolchain-setup-ta-summary">
            {taSummary.missingTools.length === 0 ? (
              <span className={styles.toolTextSuccess}>No missing tools reported.</span>
            ) : (
              <ul>
                {taSummary.missingTools.map((tool) => (
                  <li key={tool.name}>
                    <span className={styles.mono}>{tool.name}</span>
                    {tool.suggestedFix ? <span className={styles.toolTextInfo}> · {tool.suggestedFix}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
      ) : null}

      {isTaMode && !isLockdownStudentView ? (
      <div className={cx(styles.section, styles.sectionTa)}>
        <h3 className={styles.sectionTitle}>Setup Logs</h3>
        <pre className={styles.logsPre} data-testid="toolchain-setup-logs">
          {logs.map((entry) => `[${entry.level}] ${entry.msg}`).join('\n')}
        </pre>
      </div>
      ) : null}
    </div>
  );
};

export const ToolchainSetupApp: RedByteApp = {
  manifest: {
    id: 'toolchain-setup',
    name: 'Toolchain Setup',
    iconId: 'settings',
    singleton: true,
    category: 'tools',
    defaultSize: { width: 900, height: 680 },
    minSize: { width: 760, height: 520 },
  },
  component: ToolchainSetupComponent,
};
