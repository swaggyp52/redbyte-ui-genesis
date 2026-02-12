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
    return { tone: 'warning', label: 'Found but not in PATH' };
  }

  return { tone: 'error', label: 'Missing tools' };
}

function getToolSourceBadge(source: SetupToolStatus['source']): { label: string; className: string } {
  if (source === 'bundled') {
    return { label: 'Bundled', className: 'bg-green-500/20 text-green-200 border border-green-500/40' };
  }
  if (source === 'buildpack') {
    return { label: 'Buildpack', className: 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40' };
  }
  if (source === 'system') {
    return { label: 'System', className: 'bg-sky-500/20 text-sky-200 border border-sky-500/40' };
  }
  if (source === 'found_not_in_path') {
    return { label: 'Found, not in PATH', className: 'bg-yellow-500/20 text-yellow-100 border border-yellow-500/40' };
  }
  return { label: 'Missing', className: 'bg-red-500/20 text-red-100 border border-red-500/40' };
}

function getReadinessGateTone(state: StudentReadinessGateView['state']): string {
  if (state === 'pass') return 'text-green-300';
  if (state === 'warn') return 'text-yellow-200';
  return 'text-red-300';
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
    <div className="h-full overflow-y-auto bg-[#0B0F14] text-[#E6EDF3] p-4" data-testid="toolchain-setup-page">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1F2937] pb-3">
        <div>
          <h2 className="text-base font-semibold text-[#E6EDF3]">Toolchain Setup</h2>
          <p className="text-[11px] text-[#8B949E]">Basys3 path: Vivado (implement) + Yosys (synth) + openFPGALoader (program).</p>
          <p className="text-[10px] text-[#64748B]" data-testid="toolchain-setup-mode-label">
            mode: <span className="font-mono">{uiMode}</span>
          </p>
          <p className="text-[10px] text-[#64748B]" data-testid="toolchain-setup-lockdown-label">
            lockdown: <span className="font-mono">{classroomLockdownEnabled ? 'on' : 'off'}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-2 py-1 text-[10px] font-semibold ${
              overall.tone === 'ready'
                ? 'bg-green-500/20 text-green-200'
                : overall.tone === 'warning'
                  ? 'bg-yellow-500/20 text-yellow-100'
                  : 'bg-red-500/20 text-red-100'
            }`}
            data-testid="toolchain-setup-status"
          >
            {overall.label}
          </span>
          {!isLockdownStudentView ? (
            <button
              onClick={handleExportSetupReport}
              className="px-2 py-1 text-[10px] rounded border border-[#38BDF8]/40 text-[#38BDF8] hover:bg-[#38BDF8]/10"
              type="button"
              data-testid="toolchain-setup-export-button"
            >
              Export Setup Report
            </button>
          ) : null}
          {isTaMode ? (
            <button
              onClick={handleToggleClassroomLockdown}
              className="px-2 py-1 text-[10px] rounded border border-[#F59E0B]/40 text-[#FCD34D] hover:bg-[#F59E0B]/10"
              type="button"
              data-testid="toolchain-setup-lockdown-toggle"
            >
              Classroom Lockdown: {classroomLockdownEnabled ? 'ON' : 'OFF'}
            </button>
          ) : null}
          {isTaMode ? (
            <button
              onClick={handleExportDiagnosticsBundle}
              className="px-2 py-1 text-[10px] rounded border border-[#22D3EE]/40 text-[#22D3EE] hover:bg-[#22D3EE]/10"
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
        className="mt-3 rounded border border-[#1F2937] bg-[#111827] p-3"
        data-testid="toolchain-setup-lockdown-minimal"
      >
        <h3 className="text-xs font-semibold text-[#BAE6FD]">Classroom Lockdown</h3>
        <p className="mt-1 text-[11px] text-[#8B949E]">
          Advanced toolchain diagnostics are hidden. Use Verify Setup for readiness status.
        </p>
        <button
          onClick={handleVerifySetup}
          className="mt-2 px-2 py-1 text-[10px] rounded border border-[#22D3EE]/40 text-[#22D3EE] hover:bg-[#22D3EE]/10 disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          disabled={isVerifying}
          data-testid="toolchain-setup-verify-button"
        >
          {isVerifying ? 'Verifying...' : 'Verify Setup'}
        </button>
      </div>
      ) : (
      <div className="mt-3 rounded border border-[#1F2937] bg-[#111827] p-3" data-testid="toolchain-setup-required-tools">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-[#BAE6FD]">Stable Path Checklist (Vivado-first)</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleVerifySetup}
              className="px-2 py-1 text-[10px] rounded border border-[#22D3EE]/40 text-[#22D3EE] hover:bg-[#22D3EE]/10 disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              disabled={isVerifying}
              data-testid="toolchain-setup-verify-button"
            >
              {isVerifying ? 'Verifying...' : 'Verify Setup'}
            </button>
          </div>
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px]" data-testid="toolchain-setup-tool-filter">
          <span className="text-[#8B949E]">Filter:</span>
          <button
            type="button"
            onClick={() => setToolFilter('all')}
            className={`rounded px-2 py-1 border ${
              toolFilter === 'all'
                ? 'border-[#38BDF8]/50 text-[#BAE6FD] bg-[#38BDF8]/10'
                : 'border-[#334155] text-[#94A3B8]'
            }`}
            data-testid="toolchain-setup-filter-all"
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setToolFilter('needs_action')}
            className={`rounded px-2 py-1 border ${
              toolFilter === 'needs_action'
                ? 'border-[#F59E0B]/50 text-[#FCD34D] bg-[#F59E0B]/10'
                : 'border-[#334155] text-[#94A3B8]'
            }`}
            data-testid="toolchain-setup-filter-needs-action"
          >
            Missing / Needs action
          </button>
          <button
            type="button"
            onClick={() => setToolFilter('bundled')}
            className={`rounded px-2 py-1 border ${
              toolFilter === 'bundled'
                ? 'border-[#22C55E]/50 text-[#86EFAC] bg-[#22C55E]/10'
                : 'border-[#334155] text-[#94A3B8]'
            }`}
            data-testid="toolchain-setup-filter-bundled"
          >
            Bundled only
          </button>
        </div>

        {allRequiredToolsReady ? (
          <div
            className="mb-2 rounded border border-green-500/40 bg-green-500/10 px-2 py-1 text-[11px] text-green-200"
            data-testid="toolchain-setup-no-installs-summary"
          >
            Setup complete â€” no additional downloads needed.
          </div>
        ) : null}

        <div className="space-y-1 text-[11px]">
          {filteredRequiredTools.length === 0 ? (
            <div className="text-[11px] text-[#8B949E]" data-testid="toolchain-setup-tool-filter-empty">
              No tools match the current filter.
            </div>
          ) : null}
          {filteredRequiredTools.map((tool) => {
            const sourceBadge = getToolSourceBadge(tool.source);
            return (
            <div key={tool.name} data-testid={`toolchain-setup-tool-${tool.name}`}>
              <span className="font-semibold">{tool.label}:</span>{' '}
              <span className="font-mono">{tool.ok ? 'ok' : tool.status}</span>
              {' · '}
              <span
                className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${sourceBadge.className}`}
                data-testid={`toolchain-setup-tool-source-${tool.name}`}
              >
                {sourceBadge.label}
              </span>
              {' · '}
              <span className="font-mono">{tool.detail}</span>
              {' · '}
              <span className={`font-mono ${tool.integrity === 'corrupt' ? 'text-red-300' : 'text-[#8B949E]'}`}>
                integrity:{tool.integrity}
              </span>
              {tool.source === 'bundled' && tool.integrity === 'verified' ? (
                <>
                  {' · '}
                  <span className="font-mono text-green-300">Verified</span>
                </>
              ) : null}
              {tool.source === 'bundled' && tool.integrity === 'corrupt' ? (
                <>
                  {' · '}
                  <span className="font-mono text-red-300">Corrupt bundle detected</span>
                </>
              ) : null}
              {tool.suggestedFix ? (
                <>
                  {' · '}
                  <span className="font-mono text-[#93C5FD]">{tool.suggestedFix}</span>
                </>
              ) : null}
            </div>
            );
          })}
        </div>

        <div className="mt-3 rounded border border-[#1F2937] bg-[#0B1220] p-2" data-testid="toolchain-setup-board-detect">
          <div className="text-[11px] text-[#93C5FD]">
            Basys3 detect:{' '}
            <span className="font-mono">
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
      <div className="mt-3 rounded border border-[#1F2937] bg-[#111827] p-3" data-testid="toolchain-setup-install-instructions">
        <h3 className="text-xs font-semibold text-[#BAE6FD]">Install Commands ({setupPlatform})</h3>
        <pre className="mt-2 whitespace-pre-wrap text-[11px] text-[#93C5FD]">
          {setupCommands.map((entry) => `${entry.tool}: ${entry.command}`).join('\n')}
        </pre>
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] text-[#8B949E]">macOS / Linux alternatives</summary>
          <pre className="mt-2 whitespace-pre-wrap text-[11px] text-[#8B949E]">
            {getSetupCommands('macos')
              .concat(getSetupCommands('linux'))
              .map((entry) => `${entry.tool}: ${entry.command}`)
              .join('\n')}
          </pre>
        </details>
      </div>
      ) : null}

      {isTaMode && !isLockdownStudentView ? (
      <div className="mt-3 rounded border border-[#1F2937] bg-[#111827] p-3" data-testid="toolchain-setup-buildpack">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-[#BAE6FD]">Basys3 Open Buildpack</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshBuildpackStatus()}
              className="px-2 py-1 text-[10px] rounded border border-[#64748B]/40 text-[#CBD5E1] hover:bg-[#1E293B]"
              data-testid="toolchain-setup-buildpack-refresh"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={handleBuildpackInstall}
              disabled={isBuildpackInstalling}
              className="px-2 py-1 text-[10px] rounded border border-[#22D3EE]/40 text-[#22D3EE] hover:bg-[#22D3EE]/10 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="toolchain-setup-buildpack-install"
            >
              {isBuildpackInstalling ? 'Installing...' : 'Install Buildpack'}
            </button>
            <button
              type="button"
              onClick={handleBuildpackRemove}
              disabled={isBuildpackRemoving}
              className="px-2 py-1 text-[10px] rounded border border-[#F59E0B]/40 text-[#FCD34D] hover:bg-[#F59E0B]/10 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="toolchain-setup-buildpack-remove"
            >
              {isBuildpackRemoving ? 'Removing...' : 'Remove'}
            </button>
          </div>
        </div>

        <div className="mt-2 text-[11px] text-[#E2E8F0]" data-testid="toolchain-setup-buildpack-status">
          <div>
            target: <span className="font-mono">{DEFAULT_BUILDPACK_INSTALL.name}@{DEFAULT_BUILDPACK_INSTALL.version}</span>
          </div>
          <div>
            source: <span className="font-mono">{DEFAULT_BUILDPACK_INSTALL.url}</span>
          </div>
          <div>
            status:{' '}
            <span className="font-mono">
              {defaultBuildpack ? (defaultBuildpack.ok ? 'installed' : `installed_corrupt (${defaultBuildpack.error ?? 'unknown'})`) : 'not_installed'}
            </span>
          </div>
          {buildpackStatus ? (
            <div>
              storeRoot: <span className="font-mono">{buildpackStatus.storeRoot}</span>
            </div>
          ) : null}
          {buildpackRun ? (
            <div>
              run: <span className="font-mono">{buildpackRun.runId}</span> · state:{' '}
              <span className="font-mono">{buildpackRun.state}</span>
            </div>
          ) : null}
        </div>

        <pre
          className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap rounded border border-[#1F2937] bg-[#0B1220] p-2 text-[10px] text-[#A5B4FC]"
          data-testid="toolchain-setup-buildpack-logs"
        >
          {buildpackLogs.map((entry) => `[${entry.level}] ${entry.msg}`).join('\n')}
        </pre>
      </div>
      ) : null}

      {!isLockdownStudentView ? (
      <div className="mt-3 rounded border border-[#1F2937] bg-[#111827] p-3" data-testid="toolchain-setup-verify-results">
        <h3 className="text-xs font-semibold text-[#BAE6FD]">Verify Results</h3>
        <div className="mt-2 space-y-1 text-[11px]">
          {steps.map((step) => (
            <div key={step.id}>
              <span className="font-semibold">{step.label}:</span> <span className="font-mono">{step.state}</span>
              {' · '}
              <span>{step.detail}</span>
              {step.nextAction ? (
                <>
                  {' · '}
                  <span className="text-[#93C5FD]">Next: {step.nextAction}</span>
                </>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      ) : null}

      <div className="mt-3 rounded border border-[#1F2937] bg-[#111827] p-3" data-testid="toolchain-setup-student-readiness">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold text-[#BAE6FD]">Student Readiness</h3>
            {isTaMode ? (
              <p className="mt-1 text-[10px] text-[#8B949E]" data-testid="toolchain-setup-open-submission-help">
                Grade or troubleshoot a student submission (.zip).
              </p>
            ) : (
              <p className="mt-1 text-[10px] text-[#8B949E]">Student view keeps advanced grading tools hidden.</p>
            )}
          </div>
          {isTaMode ? (
            <button
              type="button"
              onClick={() => onOpenApp?.('submission-inspector')}
              className="px-2 py-1 text-[10px] rounded border border-[#38BDF8]/40 text-[#38BDF8] hover:bg-[#38BDF8]/10"
              data-testid="toolchain-setup-open-submission-cta"
            >
              Open Submission Bundle
            </button>
          ) : null}
        </div>
        <div className="mt-2 text-[11px]">
          <span className="text-[#8B949E]">overall:</span>{' '}
          <span
            className={`font-mono ${
              studentReadinessWithSubmission.overall === 'ready' ? 'text-green-300' : 'text-yellow-200'
            }`}
            data-testid="toolchain-setup-student-readiness-overall"
          >
            {studentReadinessWithSubmission.overall}
          </span>
        </div>
        <div className="mt-2 space-y-1 text-[11px]">
          {studentReadinessWithSubmission.gates.map((gate) => (
            <div key={gate.id} data-testid={`toolchain-setup-readiness-${gate.id}`}>
              <span className="font-semibold">{gate.label}:</span>{' '}
              <span className={`font-mono ${getReadinessGateTone(gate.state)}`}>{gate.state}</span>
              {' · '}
              <span>{gate.detail}</span>
              {gate.nextAction ? (
                <>
                  {' · '}
                  <span className="text-[#93C5FD]">Next: {gate.nextAction}</span>
                </>
              ) : null}
              {gate.id === 'submission_bundle' && gate.state !== 'pass' ? (
                <>
                  {' · '}
                  <button
                    type="button"
                    onClick={() => onOpenApp?.('logic-playground')}
                    className="text-[10px] rounded border border-[#38BDF8]/40 px-1.5 py-0.5 text-[#38BDF8] hover:bg-[#38BDF8]/10"
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
      <div className="mt-3 rounded border border-[#1F2937] bg-[#111827] p-3" data-testid="toolchain-setup-ta-mode">
        <h3 className="text-xs font-semibold text-[#BAE6FD]">TA Mode (Doctor Report Triage)</h3>
        <textarea
          className="mt-2 h-24 w-full resize-y rounded border border-[#1F2937] bg-[#0B1220] p-2 text-[11px] text-[#E6EDF3] outline-none"
          placeholder="Paste doctor report JSON"
          value={taInput}
          onChange={(event) => setTaInput(event.target.value)}
          data-testid="toolchain-setup-ta-input"
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={handleParseTaMode}
            className="px-2 py-1 text-[10px] rounded border border-[#8B949E]/40 text-[#8B949E] hover:bg-[#161B22]"
            data-testid="toolchain-setup-ta-parse-button"
          >
            Parse Report
          </button>
          {taError ? <span className="text-[10px] text-[#FCA5A5]">{taError}</span> : null}
        </div>
        {taSummary ? (
          <div className="mt-2 text-[11px]" data-testid="toolchain-setup-ta-summary">
            {taSummary.missingTools.length === 0 ? (
              <span className="text-green-200">No missing tools reported.</span>
            ) : (
              <ul className="list-disc pl-4">
                {taSummary.missingTools.map((tool) => (
                  <li key={tool.name}>
                    <span className="font-mono">{tool.name}</span>
                    {tool.suggestedFix ? <span className="text-[#93C5FD]"> · {tool.suggestedFix}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
      ) : null}

      {isTaMode && !isLockdownStudentView ? (
      <div className="mt-3 rounded border border-[#1F2937] bg-[#111827] p-3">
        <h3 className="text-xs font-semibold text-[#BAE6FD]">Setup Logs</h3>
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[10px] text-[#9CA3AF]" data-testid="toolchain-setup-logs">
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
