import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { RedByteApp } from "../types";
import type { HardwareTraceEvent } from "@redbyte/rb-fpga-proof-core";
import { exportV2Bundle, type BoardProfile } from "../utils/bundleExport";
import { toast } from "@redbyte/rb-primitives";
import { buildTraceEvent, computeStreamSilenceMs } from "./hardwarePanelUtils";
import { hardwareClient, type ConnectionState, type Device } from "../services/hardwareClient";
import { BridgeDebugPanel } from "../panels/BridgeDebugPanel";
import { SynthesisDialog, type SynthesisPhase } from "../components/SynthesisDialog";
import { EmptyStateCard } from "../components/EmptyStateCard";
import { stableStringify } from "../export/stableStringify";
import {
  getToolchainBackend,
  type BoardDetectResult,
  getToolchainBackendId,
  type BuildLogEntry,
  type ProgramRunDoneSummary,
} from "../fpga/toolchainBackend";
import { NEO_STATUS } from "../ui/neoGlossary";
import { NEO_ACTION_ICONS } from "../ui/neoIcons";
import styles from "./HardwarePanelApp.module.css";

const BRIDGE_URL = "http://127.0.0.1:4242";
const DEFAULT_LAB_ID = "basys3_mvp_lab";
const DEFAULT_LAB_VERSION = "1.0.0";
const DEFAULT_BOARD = "basys3";
const DEFAULT_CAPTURE_HZ = 20;
const DEFAULT_CAPTURE_SECONDS = 5;
const STREAM_START_GRACE_MS = 2500;
const NO_DATA_AUTO_STOP_MS = 5000;
const STREAM_RETRY_LIMIT = 1;
const DEFAULT_RETRY_DELAY_MS = 600;
const MAX_SAMPLES = 50000;
const PROGRAM_STATUS_POLL_MS = 500;

type PanelState =
  | "DISCONNECTED"
  | "IDLE"
  | "PROGRAMMING"
  | "READY"
  | "RUNNING"
  | "STOPPING"
  | "DONE"
  | "ERROR";

interface BridgeHealth {
  ok: boolean;
  version?: string;
  uptimeMs?: number;
  status?: string;
  wsPort?: number;
  activeRunCount?: number;
}

interface StreamStatus {
  run_id?: string | null;
  state?: string | null;
  hint?: string | null;
}

interface StreamSample {
  t_ms?: number | string | null;
  device_id?: string | null;
  io?: Record<string, unknown> | null;
}

type ProgramRunUiStatus = "idle" | "running" | "success" | "failed" | "canceled";

interface HardwarePanelComponentProps {
  beginnerView?: boolean;
  onBoardDetectedChange?: (detected: boolean) => void;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("bitstream_read_failed"));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error("bitstream_read_failed"));
    reader.readAsDataURL(file);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry<T>(
  url: string,
  init: RequestInit,
  options: { timeoutMs: number; retries: number; retryDelayMs?: number }
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const retries = Math.max(0, options.retries);
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      let data: T | null = null;
      try {
        data = (await res.json()) as T;
      } catch {
        data = null;
      }
      if (!res.ok && res.status >= 500 && attempt < retries) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error("request_failed");
}

const DEFAULT_BOARD_PROFILE: BoardProfile = {
  board: DEFAULT_BOARD,
  uart_baud: 115200,
  digital_signals: {
    "0": "SW0",
    "1": "SW1",
    "2": "BTN0",
  },
  analog_signals: {
    "0": "ComparatorOut",
    "1": "LDR_Level",
  },
};

export function HardwarePanelComponent({
  beginnerView = false,
  onBoardDetectedChange,
}: HardwarePanelComponentProps) {
  const [panelState, setPanelState] = useState<PanelState>("DISCONNECTED");
  const [bridgeHealth, setBridgeHealth] = useState<BridgeHealth | null>(null);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [bitstreamFile, setBitstreamFile] = useState<File | null>(null);
  const [bitstreamBase64, setBitstreamBase64] = useState<string | null>(null);
  const [programLogPath, setProgramLogPath] = useState<string | null>(null);
  const [programError, setProgramError] = useState<string | null>(null);
  const [programLogs, setProgramLogs] = useState<BuildLogEntry[]>([]);
  const [programRunStatus, setProgramRunStatus] = useState<ProgramRunUiStatus>("idle");
  const [programExitCode, setProgramExitCode] = useState<number | null>(null);
  const [programCanceling, setProgramCanceling] = useState(false);
  const [boardBusyActiveRunId, setBoardBusyActiveRunId] = useState<string | null>(null);
  const [boardBusyCanceling, setBoardBusyCanceling] = useState(false);
  const [boardDetecting, setBoardDetecting] = useState(false);
  const [boardDetectResult, setBoardDetectResult] = useState<BoardDetectResult | null>(null);
  const handleCopyBridgeCommand = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText("pnpm bridge:start");
        toast.success("Bridge command copied to clipboard.");
      } else {
        toast.error("Clipboard not available. Run: pnpm bridge:start");
      }
    } catch (error) {
      console.error("Failed to copy bridge command:", error);
      toast.error("Failed to copy bridge command.");
    }
  }, []);
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [runStatusHint, setRunStatusHint] = useState<string | null>(null);
  const [traceEvents, setTraceEvents] = useState<HardwareTraceEvent[]>([]);
  const [captureHz, setCaptureHz] = useState<number>(DEFAULT_CAPTURE_HZ);
  const [captureSeconds, setCaptureSeconds] = useState<number>(DEFAULT_CAPTURE_SECONDS);
  const [captureStartedAt, setCaptureStartedAt] = useState<number | null>(null);
  const [captureStoppedAt, setCaptureStoppedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // PHASE 1: Synthesis Dialog State
  const [synthesisDialogOpen, setSynthesisDialogOpen] = useState(false);
  const [synthesisPhase, setSynthesisPhase] = useState<SynthesisPhase>('idle');
  const [synthesisMessage, setSynthesisMessage] = useState<string | undefined>();
  const [synthesisError, setSynthesisError] = useState<string | undefined>();
  const synthesisAbortRef = useRef<AbortController | null>(null);
  const synthesisDialogTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  const eventSourceRef = useRef<EventSource | null>(null);
  const runIdRef = useRef<string | null>(null);
  const monoSeqRef = useRef<number>(0);
  const captureHzRef = useRef<number>(DEFAULT_CAPTURE_HZ);
  const stopTimerRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const noDataTimerRef = useRef<number | null>(null);
  const lastSampleAtRef = useRef<number | null>(null);
  const streamRetryRef = useRef<number>(0);
  const captureStartRef = useRef<number | null>(null);
  const runStatusRef = useRef<string | null>(null);
  const programRunStreamRef = useRef<{ close: () => void } | null>(null);
  const programPollTimerRef = useRef<number | null>(null);
  const programOffsetRef = useRef<number>(0);
  const programPollingBusyRef = useRef<boolean>(false);

  const selectedDevice = useMemo(
    () => devices.find((device) => device.deviceId === selectedDeviceId) ?? null,
    [devices, selectedDeviceId]
  );
  const toolchainBackend = useMemo(
    () => getToolchainBackend(getToolchainBackendId()),
    []
  );

  const traceEventCount = traceEvents.length;
  const bridgeReady = bridgeHealth?.ok === true;
  const hasDevices = devices.length > 0;
  // const isSimDevice = selectedDevice?.transport === "sim";
  const isSimDevice = false; // Phase 10: Logic 3D handles Sim, this panel is for Hardware
  // const runtimeReady = selectedDevice?.runtime?.status === "ready";
  const runtimeReady = true; // Assume ready if connected
  // const programmingReady = selectedDevice?.programming?.status === "ready";
  const programmingReady = true; // Assume ready if connected
  const isRunningNoData = runStatus === "running_no_data";
  const programStatusLabel =
    programRunStatus === "running"
      ? "Running"
      : programRunStatus === "success"
        ? "Success"
        : programRunStatus === "canceled"
          ? "Canceled"
        : programRunStatus === "failed"
          ? "Failed"
          : "Idle";

  const programBlockedReason =
    !bridgeReady
      ? "Bridge offline"
      : boardBusyActiveRunId
        ? `Board busy: active run ${boardBusyActiveRunId}`
      : isSimDevice
          ? "SIM device does not require programming"
          : panelState === "RUNNING"
            ? "Capture running"
            : panelState === "STOPPING"
              ? "Stopping capture"
              : panelState === "PROGRAMMING"
                ? "Programming in progress"
                : !programmingReady
                  ? "Programmer unavailable"
                  : !bitstreamBase64
                    ? "Bitstream required"
                    : null;

  const captureBlockedReason =
    !bridgeReady
      ? "Bridge offline"
      : !selectedDeviceId
        ? "Select a device"
        : panelState === "PROGRAMMING"
          ? "Programming in progress"
          : panelState === "RUNNING"
            ? "Capture running"
            : panelState === "STOPPING"
              ? "Stopping capture"
              : !isSimDevice && !runtimeReady
                ? `Runtime not ready: ${selectedDevice?.runtime?.status ?? "unknown"}`
                : !isSimDevice && !(panelState === "READY" || panelState === "DONE")
                  ? "Program the board first"
                  : null;

  const exportBlockedReason =
    panelState === "RUNNING" || panelState === "PROGRAMMING" || panelState === "STOPPING"
      ? "Capture in progress"
      : traceEvents.length === 0
        ? "No trace events captured"
        : null;

  const boardDetected = (boardDetectResult?.boards?.length ?? 0) > 0;
  const showAdvancedControls = !beginnerView;

  useEffect(() => {
    onBoardDetectedChange?.(boardDetected);
  }, [boardDetected, onBoardDetectedChange]);

  const setPanelError = useCallback((message: string) => {
    setError(message);
    setPanelState("ERROR");
  }, []);

  useEffect(() => {
    runStatusRef.current = runStatus;
  }, [runStatus]);

  const appendProgramLogs = useCallback((incoming: BuildLogEntry[]) => {
    if (!incoming || incoming.length === 0) return;
    setProgramLogs((prev) => {
      const keys = new Set(prev.map((entry) => `${entry.run_id}:${entry.ts}:${entry.msg}`));
      const merged = [...prev];
      for (const entry of incoming) {
        const key = `${entry.run_id}:${entry.ts}:${entry.msg}`;
        if (keys.has(key)) continue;
        keys.add(key);
        merged.push(entry);
      }
      return merged.sort((a, b) => {
        if (a.ts !== b.ts) return a.ts - b.ts;
        return a.msg.localeCompare(b.msg);
      });
    });
  }, []);

  const clearProgramMonitoring = useCallback(() => {
    if (programRunStreamRef.current) {
      programRunStreamRef.current.close();
      programRunStreamRef.current = null;
    }
    if (programPollTimerRef.current) {
      window.clearInterval(programPollTimerRef.current);
      programPollTimerRef.current = null;
    }
    programPollingBusyRef.current = false;
  }, []);

  const finalizeProgramRun = useCallback(
    (summary: ProgramRunDoneSummary) => {
      if (!isMountedRef.current) return;
      clearProgramMonitoring();
      setProgramCanceling(false);
      setProgramExitCode(summary.exitCode);
      if (summary.state === "canceled") {
        setProgramRunStatus("canceled");
        setProgramError(null);
        setPanelState("IDLE");
        setSynthesisPhase("idle");
        setSynthesisMessage(`Programming canceled (run: ${summary.runId})`);
        setSynthesisDialogOpen(false);
        return;
      }
      if (summary.ok) {
        setProgramRunStatus("success");
        setProgramError(null);
        setPanelState("READY");
        setSynthesisPhase("success");
        setSynthesisMessage(`Programmed successfully (run: ${summary.runId})`);
        if (synthesisDialogTimerRef.current) {
          window.clearTimeout(synthesisDialogTimerRef.current);
        }
        synthesisDialogTimerRef.current = window.setTimeout(() => {
          if (!isMountedRef.current) return;
          setSynthesisDialogOpen(false);
          setSynthesisPhase("idle");
        }, 2000);
        return;
      }

      const errorMsg = summary.error || `openFPGALoader_exit_${summary.exitCode ?? "unknown"}`;
      setProgramRunStatus("failed");
      setProgramError(errorMsg);
      setPanelState("ERROR");
      setSynthesisError(errorMsg);
      setSynthesisPhase("error");
    },
    [clearProgramMonitoring]
  );

  const pollProgramRunStatus = useCallback(
    async (runId: string) => {
      if (!isMountedRef.current) return;
      if (programPollingBusyRef.current) return;
      programPollingBusyRef.current = true;
      try {
        const status = await toolchainBackend.getRunStatus(runId, programOffsetRef.current);
        if (!isMountedRef.current) return;
        appendProgramLogs(status.logs);
        programOffsetRef.current = status.nextOffset;
        setProgramExitCode(status.exitCode);
        if (status.state === "done" || status.state === "error" || status.state === "canceled") {
          finalizeProgramRun({
            runId: status.runId,
            artifactId: status.artifactId,
            state: status.state,
            ok: status.ok === true,
            exitCode: status.exitCode,
            nextOffset: status.nextOffset,
            ...(status.error ? { error: status.error } : {}),
          });
        }
      } catch (err) {
        if (!isMountedRef.current) return;
        const message = err instanceof Error ? err.message : "program_status_failed";
        setProgramError(message);
        setProgramRunStatus("failed");
        setPanelState("ERROR");
        clearProgramMonitoring();
      } finally {
        programPollingBusyRef.current = false;
      }
    },
    [appendProgramLogs, clearProgramMonitoring, finalizeProgramRun, toolchainBackend]
  );

  const startProgramPolling = useCallback(
    (runId: string, offset: number) => {
      clearProgramMonitoring();
      programOffsetRef.current = Math.max(0, offset);
      setProgramRunStatus("running");
      void pollProgramRunStatus(runId);
      programPollTimerRef.current = window.setInterval(() => {
        void pollProgramRunStatus(runId);
      }, PROGRAM_STATUS_POLL_MS);
    },
    [clearProgramMonitoring, pollProgramRunStatus]
  );

  const startProgramStreaming = useCallback(
    (runId: string, offset: number) => {
      if (!isMountedRef.current) return;
      clearProgramMonitoring();
      programOffsetRef.current = Math.max(0, offset);
      setProgramRunStatus("running");
      const subscription = toolchainBackend.openRunStream(
        runId,
        {
          onLog(entry) {
            if (!isMountedRef.current) return;
            appendProgramLogs([entry]);
            programOffsetRef.current = Math.max(programOffsetRef.current, entry.ts + 1);
          },
          onDone(summary) {
            if (!isMountedRef.current) return;
            programOffsetRef.current = Math.max(programOffsetRef.current, summary.nextOffset);
            finalizeProgramRun(summary);
          },
          onError() {
            if (!isMountedRef.current) return;
            startProgramPolling(runId, programOffsetRef.current);
          },
        },
        { offset: programOffsetRef.current }
      );
      if (!subscription) {
        startProgramPolling(runId, programOffsetRef.current);
        return;
      }
      programRunStreamRef.current = subscription;
    },
    [appendProgramLogs, clearProgramMonitoring, finalizeProgramRun, startProgramPolling, toolchainBackend]
  );

  const handleCopyProgramLogs = useCallback(async () => {
    const text = programLogs.map((entry) => entry.msg).join("\n").trim();
    if (!text) {
      toast.error("No program logs to copy.");
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        toast.success("Program logs copied.");
      } else {
        toast.error("Clipboard not available.");
      }
    } catch (error) {
      toast.error("Failed to copy program logs.");
    }
  }, [programLogs]);

  const handleExportProgramReport = useCallback(() => {
    void (async () => {
      const report = await toolchainBackend.doctorReport(
        {},
        {
          logs: programLogs,
        }
      );
      const json = stableStringify(report);
      const fileTag = report.reportId ? `-${report.reportId}` : "";
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rb-toolchain-report${fileTag}.json`;
      link.click();
      URL.revokeObjectURL(url);
    })().catch((error) => {
      const message = error instanceof Error ? error.message : "doctor_report_export_failed";
      setProgramError(message);
      setProgramRunStatus("failed");
    });
  }, [programLogs, toolchainBackend]);

  // --- Model A Integration ---
  useEffect(() => {
    // 1. Initial state sync
    const syncState = (state: ConnectionState) => {
      if (state.status === 'connected') {
        setBridgeHealth(state.bridge);
        setDevices(state.devices);
        setBridgeError(null);
        // Auto-select first device if none selected
        if (!selectedDeviceId && state.devices.length > 0) {
          setSelectedDeviceId(state.devices[0].deviceId);
        }
      } else if (state.status === 'offline') {
        setBridgeHealth(null);
        setBridgeError(state.message || "Bridge offline");
        setDevices([]);
      } else {
        // Connecting...
        setBridgeError("Connecting...");
      }
    };

    // 2. Subscribe
    const unsubscribe = hardwareClient.subscribe(syncState);
    return unsubscribe;
  }, [selectedDeviceId]);

  // Refresh -> hardwareClient.connect() implies a retry or re-check
  const refreshBridge = useCallback(() => {
    hardwareClient.connect(); // forceful reconnect attempt
  }, []);

  const handleDetectBoard = useCallback(() => {
    void (async () => {
      setBoardDetecting(true);
      try {
        const result = await toolchainBackend.detectBoards();
        setBoardDetectResult(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "board_detect_failed";
        setBoardDetectResult({
          schema_version: "toolchain_board_detect_v1",
          ok: false,
          run_id: "board-detect-failed",
          boards: [],
          tools: {
            openFPGALoader: {
              ok: false,
              error: "board_detect_failed",
            },
          },
          logs: [
            {
              run_id: "board-detect-failed",
              ts: 0,
              step: "probe",
              level: "error",
              msg: `[board-detect] failed: ${message}`,
            },
          ],
        });
      } finally {
        setBoardDetecting(false);
      }
    })();
  }, [toolchainBackend]);

  // Remove internal polling effects!

  const stateLabel = (() => {
    switch (panelState) {
      case "DISCONNECTED":
        return NEO_STATUS.NOT_READY;
      case "IDLE":
        return NEO_STATUS.READY;
      case "PROGRAMMING":
        return NEO_STATUS.RUNNING;
      case "READY":
        return NEO_STATUS.DONE;
      case "RUNNING":
        return NEO_STATUS.RUNNING;
      case "STOPPING":
        return NEO_STATUS.WARNING;
      case "DONE":
        return NEO_STATUS.DONE;
      case "ERROR":
        return NEO_STATUS.ERROR;
      default:
        return NEO_STATUS.NOT_READY;
    }
  })();
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (synthesisDialogTimerRef.current) {
        window.clearTimeout(synthesisDialogTimerRef.current);
        synthesisDialogTimerRef.current = null;
      }
      if (stopTimerRef.current) {
        window.clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
      if (silenceTimerRef.current) {
        window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (noDataTimerRef.current) {
        window.clearTimeout(noDataTimerRef.current);
        noDataTimerRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (programRunStreamRef.current) {
        programRunStreamRef.current.close();
        programRunStreamRef.current = null;
      }
      if (programPollTimerRef.current) {
        window.clearInterval(programPollTimerRef.current);
        programPollTimerRef.current = null;
      }
      if (runIdRef.current) {
        fetch(`${BRIDGE_URL}/stop`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ run_id: runIdRef.current }),
          signal: AbortSignal.timeout(5000),
        }).catch(() => {
          // Swallow shutdown errors
        });
      }
    };
  }, []);

  const handleBitstreamSelect = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    clearProgramMonitoring();
    setBitstreamFile(file);
    setProgramLogPath(null);
    setProgramError(null);
    setProgramLogs([]);
    setProgramRunStatus("idle");
    setProgramExitCode(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setBitstreamBase64(dataUrl);
    } catch (err) {
      setBitstreamBase64(null);
      setProgramError("Failed to read bitstream file.");
    }
  }, [clearProgramMonitoring]);

  const closeStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stopCapture = useCallback(
    async (reason: "manual" | "error" | "unmount") => {
      if (stopTimerRef.current) {
        window.clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
      if (silenceTimerRef.current) {
        window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      const runId = runIdRef.current;
      if (reason !== "unmount") {
        setPanelState("STOPPING");
      }

      if (runId) {
        try {
          await fetchJsonWithRetry<{ ok?: boolean; error?: string }>(
            `${BRIDGE_URL}/stop`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ run_id: runId }),
            },
            { timeoutMs: 5000, retries: 1 }
          );
        } catch (err) {
          if (reason !== "unmount" && reason !== "error") {
            setError(err instanceof Error ? err.message : "stop_failed");
          }
        }
      }

      closeStream();
      runIdRef.current = null;
      if (reason !== "unmount") {
        setRunId(null);
        setCaptureStoppedAt(Date.now());
        if (reason === "error") {
          setPanelState("ERROR");
        } else if (traceEvents.length === 0) {
          setError("Capture produced no samples.");
          setPanelState("ERROR");
        } else {
          setPanelState("DONE");
        }
      }
    },
    [closeStream, traceEvents.length]
  );

  const failCapture = useCallback(
    (message: string) => {
      setError(message);
      void stopCapture("error");
    },
    [stopCapture]
  );

  const openStream = useCallback(
    (runId: string) => {
      closeStream();
      lastSampleAtRef.current = null;
      captureStartRef.current = Date.now();

      const source = new EventSource(
        `${BRIDGE_URL}/stream?run_id=${encodeURIComponent(runId)}`
      );
      eventSourceRef.current = source;

      const silenceMs = computeStreamSilenceMs(captureHzRef.current);

      const scheduleSilenceCheck = () => {
        if (silenceTimerRef.current) {
          window.clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        silenceTimerRef.current = window.setTimeout(() => {
          const now = Date.now();
          const last = lastSampleAtRef.current;
          const captureStart = captureStartRef.current ?? now;
          const elapsed = now - captureStart;

          // Don't fail during grace period - wait for first sample
          if (elapsed < STREAM_START_GRACE_MS && !last) {
            scheduleSilenceCheck();
            return;
          }

          // If running_no_data, don't treat as stall - handled separately
          if (runStatusRef.current === "running_no_data") {
            return;
          }

          if (!last || now - last >= silenceMs) {
            if (streamRetryRef.current < STREAM_RETRY_LIMIT && runIdRef.current) {
              streamRetryRef.current += 1;
              openStream(runIdRef.current);
              return;
            }
            failCapture("Stream stalled (no samples).");
          }
        }, silenceMs);
      };

      source.addEventListener("sample", (event) => {
        try {
          const data = JSON.parse(event.data) as StreamSample;
          const seq = monoSeqRef.current++;
          const eventItem = buildTraceEvent(data, seq, captureHzRef.current);
          lastSampleAtRef.current = Date.now();
          scheduleSilenceCheck();
          setTraceEvents((prev) => {
            if (prev.length >= MAX_SAMPLES) {
              // Simple strict cap: drop oldest
              return [...prev.slice(1), eventItem];
            }
            return [...prev, eventItem];
          });
        } catch {
          // Ignore malformed samples
        }
      });

      source.addEventListener("status", (event) => {
        try {
          const data = JSON.parse(event.data) as StreamStatus;
          if (data.state) {
            setRunStatus(data.state);
            if (data.hint) {
              setRunStatusHint(data.hint);
            }

            // Handle running_no_data: start auto-stop timer
            if (data.state === "running_no_data") {
              if (noDataTimerRef.current) {
                window.clearTimeout(noDataTimerRef.current);
              }
              noDataTimerRef.current = window.setTimeout(() => {
                failCapture("No wrapper detected — auto-stopped after timeout.");
              }, NO_DATA_AUTO_STOP_MS);
            } else if (noDataTimerRef.current) {
              // Clear timer if state changes away from running_no_data
              window.clearTimeout(noDataTimerRef.current);
              noDataTimerRef.current = null;
            }
          }
        } catch {
          // Ignore status parse errors
        }
      });

      source.onerror = () => {
        if (streamRetryRef.current < STREAM_RETRY_LIMIT && runIdRef.current) {
          streamRetryRef.current += 1;
          openStream(runIdRef.current);
          return;
        }
        failCapture("Stream disconnected.");
      };

      scheduleSilenceCheck();
    },
    [closeStream, failCapture]
  );

  const handleProgram = useCallback(async () => {
    if (programBlockedReason) {
      setProgramError(programBlockedReason);
      return;
    }

    if (!bitstreamBase64) {
      setProgramError("bitstream_required");
      return;
    }

    setProgramError(null);
    setProgramLogPath(null);
    setProgramLogs([]);
    setProgramRunStatus("running");
    setProgramCanceling(false);
    setBoardBusyCanceling(false);
    setProgramExitCode(null);
    clearProgramMonitoring();
    setSynthesisDialogOpen(true);
    setSynthesisPhase('programming');
    setSynthesisMessage("Programming Basys3 with openFPGALoader...");
    setSynthesisError(undefined);

    const abortCtrl = new AbortController();
    synthesisAbortRef.current = abortCtrl;
    setPanelState("PROGRAMMING");

    try {
      const result = await toolchainBackend.programBitstream({
        board: "basys3",
        mode: "sram",
        bitstream: {
          kind: "base64",
          data: bitstreamBase64,
        },
      });
      if (abortCtrl.signal.aborted) {
        return;
      }

      appendProgramLogs(result.logs ?? []);
      setProgramLogPath(result.runId);
      if (!result.ok) {
        if (result.error === "BOARD_BUSY") {
          setBoardBusyActiveRunId(result.activeRunId ?? result.runId);
          setProgramRunStatus("idle");
          setProgramError(`Board busy: active run ${result.activeRunId ?? result.runId}`);
          setPanelState("IDLE");
          setSynthesisPhase("idle");
          setSynthesisDialogOpen(false);
          return;
        }
        throw new Error(result.error || "program_failed");
      }
      setBoardBusyActiveRunId(null);
      setPanelState("PROGRAMMING");
      setSynthesisMessage(`Programming run started (run: ${result.runId})`);

      const initialOffset =
        typeof result.nextOffset === "number"
          ? result.nextOffset
          : (result.logs ?? []).reduce((maxOffset, entry) => Math.max(maxOffset, entry.ts + 1), 0);
      startProgramStreaming(result.runId, initialOffset);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        clearProgramMonitoring();
        setProgramRunStatus("idle");
        setSynthesisPhase('idle');
        setSynthesisDialogOpen(false);
      } else {
        const errorMsg = err instanceof Error ? err.message : "program_failed";
        setSynthesisError(errorMsg);
        setSynthesisPhase('error');
        setProgramError(errorMsg);
        setProgramRunStatus("failed");
        setPanelState("ERROR");
      }
    }

    synthesisAbortRef.current = null;
  }, [
    appendProgramLogs,
    bitstreamBase64,
    clearProgramMonitoring,
    programBlockedReason,
    startProgramStreaming,
    toolchainBackend,
  ]);

  const handleCancelProgram = useCallback(async () => {
    if (programCanceling) return;
    if (programRunStatus !== "running") return;
    if (!programLogPath) return;

    setProgramCanceling(true);
    try {
      const status = await toolchainBackend.cancelRun(programLogPath);
      appendProgramLogs(status.logs ?? []);
      setProgramExitCode(status.exitCode);
      if (status.state === "running") {
        setProgramError(status.error || "cancel_failed");
        setSynthesisError(status.error || "cancel_failed");
        setProgramCanceling(false);
        return;
      }

      finalizeProgramRun({
        runId: status.runId,
        artifactId: status.artifactId,
        state: status.state,
        ok: status.ok === true,
        exitCode: status.exitCode,
        nextOffset: status.nextOffset,
        ...(status.error ? { error: status.error } : {}),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "cancel_failed";
      setProgramError(message);
      setSynthesisError(message);
      appendProgramLogs([
        {
          run_id: programLogPath,
          ts: programOffsetRef.current + 1,
          step: "program",
          level: "error",
          msg: "[bridge] program: cancel failed; try unplugging board and closing any Vivado instances.",
        },
      ]);
      setProgramCanceling(false);
    }
  }, [
    appendProgramLogs,
    finalizeProgramRun,
    programCanceling,
    programLogPath,
    programRunStatus,
    toolchainBackend,
  ]);

  const handleCancelActiveRun = useCallback(async () => {
    if (boardBusyCanceling) return;
    if (!boardBusyActiveRunId) return;

    setBoardBusyCanceling(true);
    try {
      const status = await toolchainBackend.cancelRun(boardBusyActiveRunId);
      appendProgramLogs(status.logs ?? []);
      setProgramExitCode(status.exitCode);
      if (status.state === "running") {
        setProgramError(status.error || "cancel_failed");
        setSynthesisError(status.error || "cancel_failed");
        return;
      }

      setBoardBusyActiveRunId(null);
      setProgramError(null);
      setPanelState("IDLE");
      setProgramRunStatus("idle");
    } catch (error) {
      const message = error instanceof Error ? error.message : "cancel_failed";
      setProgramError(message);
      setSynthesisError(message);
    } finally {
      setBoardBusyCanceling(false);
    }
  }, [appendProgramLogs, boardBusyActiveRunId, boardBusyCanceling, toolchainBackend]);

  const handleStopCapture = useCallback(async () => {
    if (!runIdRef.current) return;
    await stopCapture("manual");
  }, [stopCapture]);

  const handleStartCapture = useCallback(async () => {
    if (captureBlockedReason) {
      setError(captureBlockedReason);
      return;
    }

    setError(null);
    setRunStatus(null);
    setTraceEvents([]);
    setCaptureStartedAt(Date.now());
    setCaptureStoppedAt(null);
    monoSeqRef.current = 0;
    streamRetryRef.current = 0;
    lastSampleAtRef.current = null;
    captureHzRef.current = captureHz;
    setPanelState("RUNNING");

    try {
      const result = await fetchJsonWithRetry<{ ok?: boolean; error?: string; run_id?: string }>(
        `${BRIDGE_URL}/run`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            device_id: selectedDeviceId,
            hz: captureHz,
            mode: "hardware",
          }),
        },
        { timeoutMs: 5000, retries: 1 }
      );
      if (!result.ok || !result.data?.ok || !result.data.run_id) {
        throw new Error(result.data?.error || `run_failed_${result.status}`);
      }
      setRunId(result.data.run_id);
      runIdRef.current = result.data.run_id;
      openStream(result.data.run_id);

      if (stopTimerRef.current) {
        window.clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
      if (captureSeconds > 0) {
        stopTimerRef.current = window.setTimeout(() => {
          void handleStopCapture();
        }, captureSeconds * 1000);
      }
    } catch (err) {
      failCapture(err instanceof Error ? err.message : "run_failed");
    }
  }, [
    captureBlockedReason,
    captureHz,
    captureSeconds,
    failCapture,
    handleStopCapture,
    openStream,
    selectedDevice?.transport,
    selectedDeviceId,
  ]);

  // PHASE 1: Synthesis Dialog Handlers
  const handleSynthesisDismiss = useCallback(() => {
    setSynthesisDialogOpen(false);
    setSynthesisPhase('idle');
  }, []);

  const handleSynthesisCancel = useCallback(() => {
    if (synthesisAbortRef.current) {
      synthesisAbortRef.current.abort();
    }
    if (programRunStatus === "running" && programLogPath) {
      void handleCancelProgram();
      return;
    }
    clearProgramMonitoring();
    setProgramCanceling(false);
    setProgramRunStatus("idle");
    setSynthesisPhase('idle');
    setSynthesisDialogOpen(false);
    setPanelState('IDLE');
  }, [clearProgramMonitoring, handleCancelProgram, programLogPath, programRunStatus]);

  const handleExportBundle = useCallback(async () => {
    if (exportBlockedReason) {
      setError(exportBlockedReason);
      return;
    }

    const boardProfile: BoardProfile = {
      ...DEFAULT_BOARD_PROFILE,
      board: selectedDevice?.boardModel ?? DEFAULT_BOARD,
    };

    try {
      const result = await exportV2Bundle({
        labId: DEFAULT_LAB_ID,
        labVersion: DEFAULT_LAB_VERSION,
        board: selectedDevice?.boardModel ?? DEFAULT_BOARD,
        binSizeMs: Math.max(1, Math.round(1000 / captureHzRef.current)),
        traceNdjson: traceEvents.map((event) => JSON.stringify(event)).join("\n"),
        traceEventCount: traceEvents.length,
        bitstreamBytes: bitstreamFile ?? undefined,
        boardProfile,
      });
      if (!result.hash) {
        setPanelError("Bundle hash computation failed.");
      }
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : "export_failed");
    }
  }, [bitstreamFile, exportBlockedReason, selectedDevice, traceEvents, setPanelError]);
  return (
    <div className={styles.panelRoot}>
      {/* PHASE 1: Synthesis Dialog */}
      <SynthesisDialog
        isOpen={synthesisDialogOpen}
        phase={synthesisPhase}
        message={synthesisMessage}
        errorMessage={synthesisError}
        onCancel={handleSynthesisCancel}
        onDismiss={handleSynthesisDismiss}
      />

      {showAdvancedControls && <BridgeDebugPanel />}
      <h2 className={styles.panelTitle}>Hardware Panel</h2>

      <div className={styles.section} data-testid="hardware-bridge-status">
        <div className={styles.sectionHeader}>
          <strong>Bridge Status</strong>
          <button
            onClick={refreshBridge}
            className={styles.smallButton}
          >
            Refresh
          </button>
        </div>
        <div style={{ fontSize: "12px" }}>
          {bridgeHealth?.ok ? (
            <span style={{ color: "#0f0" }}>o Connected (v{bridgeHealth.version || "?"})</span>
          ) : (
            <span style={{ color: "#f66" }}>o {bridgeError || "Disconnected"}</span>
          )}
        </div>
        <div className={styles.statusLine}>
          Panel state: {stateLabel}
          {runStatus ? ` | Run status: ${runStatus}` : ""}
        </div>
      </div>

      <div className={styles.section} data-testid="hardware-device-section">
        <strong>Device</strong>
        <div style={{ marginTop: "8px", display: "flex", gap: "10px", alignItems: "center" }}>
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            disabled={!bridgeReady}
            title="Select Hardware Device"
            style={{ padding: "6px", background: "#111", color: "#fff", border: "1px solid #444", borderRadius: "4px", minWidth: "280px" }}
          >
            {devices.length === 0 && <option value="">No devices found</option>}
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.boardModel} ({device.deviceId})
              </option>
            ))}
          </select>
          <button
            onClick={refreshBridge}
            className={styles.smallButton}
          >
            Refresh Devices
          </button>
          <button
            onClick={handleDetectBoard}
            disabled={boardDetecting}
            data-testid="hardware-detect-board-button"
            style={{
              padding: "6px 10px",
              background: boardDetecting ? "#555" : "#0b3b5a",
              color: "#fff",
              border: "1px solid #555",
              borderRadius: "4px",
              cursor: boardDetecting ? "not-allowed" : "pointer",
              fontSize: "11px",
            }}
          >
            {boardDetecting ? "Detecting..." : "Detect Board"}
          </button>
        </div>
        {!bridgeReady && (
          <div
            data-testid="hardware-connection-help"
            className={styles.offlineCallout}
          >
            <EmptyStateCard
              testId="hardware-empty-bridge"
              headline="Bridge is not running"
              description={beginnerView
                ? "Start the local bridge to enable board detection, or continue in Build/Simulate if hardware is optional today."
                : "Start the local bridge service to unlock board discovery and FPGA programming actions."}
              primaryLabel="Copy Start Command"
              onPrimaryClick={() => {
                void handleCopyBridgeCommand();
              }}
              secondaryLabel="Why this matters"
            />
            <div style={{ marginTop: "8px" }}>
              <button
                onClick={handleCopyBridgeCommand}
                data-testid="hardware-copy-bridge-command"
                className={styles.smallButton}
              >
                Copy Bridge Command
              </button>
            </div>
          </div>
        )}
        {bridgeReady && !hasDevices && (
          <div style={{ marginTop: "8px" }} data-testid="hardware-empty-no-board">
            <EmptyStateCard
              headline="No board detected"
              description="Connect your Basys3, confirm permissions/drivers, then run board detection to continue programming."
              primaryLabel={boardDetecting ? "Connecting..." : "Connect Board"}
              onPrimaryClick={() => {
                void handleDetectBoard();
              }}
              secondaryLabel="Why this matters"
            />
          </div>
        )}
        {selectedDevice && (
          <div style={{ marginTop: "8px", fontSize: "11px", color: "#888" }}>
            model_id: {selectedDevice.boardModel} | transport: hardware
          </div>
        )}
        {boardDetectResult && (
          <div style={{ marginTop: "8px", fontSize: "11px", color: "#888" }}>
            {boardDetectResult.boards.length > 0 ? (
              <div style={{ color: "#22c55e", display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: "9px", height: "9px", borderRadius: "999px", background: "#22c55e", boxShadow: "0 0 10px rgba(34,197,94,0.7)" }} />
                {NEO_STATUS.DONE} · Basys 3 ({boardDetectResult.boards.length}) detected
              </div>
            ) : (
              <div data-testid="hardware-empty-detect-retry">
                <EmptyStateCard
                  headline="Board not detected"
                  description="Not detected. Check cable, drivers, and permissions, then retry board detection."
                  primaryLabel={boardDetecting ? "Retrying..." : "Retry Detection"}
                  onPrimaryClick={() => {
                    void handleDetectBoard();
                  }}
                  secondaryLabel="Why this matters"
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.section} data-testid="hardware-bitstream-section">
        <strong>Bitstream</strong>
        <div style={{ marginTop: "8px", display: "flex", gap: "10px", alignItems: "center" }}>
          <input
            type="file"
            accept=".bit"
            onChange={handleBitstreamSelect}
            disabled={!bridgeReady}
            data-testid="hardware-bitstream-input"
            title="Select Bitstream File"
            style={{ color: "#fff" }}
          />
          <span style={{ fontSize: "11px", color: "#888" }}>
            {bitstreamFile ? bitstreamFile.name : "No bitstream selected"}
          </span>
        </div>
        {programLogPath && (
          <div style={{ marginTop: "6px", fontSize: "11px", color: "#888" }}>run_id: {programLogPath}</div>
        )}
        {programError && (
          <div style={{ marginTop: "6px", fontSize: "11px", color: "#f66" }}>{programError}</div>
        )}
      </div>

      <div className={styles.section} data-testid="hardware-program-section">
        <strong>Program</strong>
        <div style={{ marginTop: "6px", fontSize: "11px", color: "#888" }}>
          status:{" "}
          <span
            style={{
              color:
                programRunStatus === "success"
                  ? "#22c55e"
                  : programRunStatus === "canceled"
                    ? "#f59e0b"
                  : programRunStatus === "failed"
                    ? "#ef4444"
                    : programRunStatus === "running"
                      ? "#60a5fa"
                      : "#9ca3af",
            }}
          >
            {programStatusLabel}
          </span>
          {programExitCode !== null ? ` | exit_code: ${programExitCode}` : ""}
        </div>
        <div style={{ marginTop: "8px", display: "flex", gap: "10px" }}>
          <button
            onClick={handleProgram}
            disabled={!!programBlockedReason || programCanceling}
            data-testid="hardware-program-button"
            style={{
              padding: "10px 20px",
              background: programBlockedReason || programCanceling ? "#555" : "linear-gradient(180deg, #0d7a54 0%, #0a5a0a 100%)",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: programBlockedReason || programCanceling ? "not-allowed" : "pointer",
              boxShadow: programBlockedReason || programCanceling ? "none" : "0 6px 16px rgba(16,185,129,0.25)",
            }}
          >
            {panelState === "PROGRAMMING" ? "Programming..." : "Program FPGA"}
          </button>
          {programRunStatus === "running" && (
            <button
              onClick={handleCancelProgram}
              disabled={programCanceling}
              style={{
                padding: "10px 20px",
                background: programCanceling ? "#555" : "#5a0a0a",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: programCanceling ? "not-allowed" : "pointer",
              }}
            >
              {programCanceling ? "Canceling..." : "Cancel Program"}
            </button>
          )}
          <button
            onClick={handleCopyProgramLogs}
            disabled={programLogs.length === 0}
            style={{
              padding: "10px 20px",
              background: programLogs.length === 0 ? "#555" : "#334155",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: programLogs.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            Copy Logs
          </button>
          <button
            onClick={handleExportProgramReport}
            style={{
              padding: "10px 20px",
              background: "#3f3f46",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Export Report
          </button>
        </div>
        {programBlockedReason && (
          <div style={{ marginTop: "6px", fontSize: "11px", color: "#888" }}>
            {programBlockedReason}
          </div>
        )}
        {boardBusyActiveRunId && (
          <div
            style={{
              marginTop: "8px",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #7c2d12",
              background: "#431407",
              color: "#fed7aa",
              fontSize: "11px",
            }}
          >
            <div>
              <strong>Board Busy</strong>: another program run is active ({boardBusyActiveRunId}). Cancel it or wait.
            </div>
            <div style={{ marginTop: "6px" }}>
              <button
                onClick={handleCancelActiveRun}
                disabled={boardBusyCanceling}
                style={{
                  padding: "6px 10px",
                  background: boardBusyCanceling ? "#555" : "#7f1d1d",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  cursor: boardBusyCanceling ? "not-allowed" : "pointer",
                  fontSize: "11px",
                }}
              >
                {boardBusyCanceling ? "Canceling Active Run..." : "Cancel Active Run"}
              </button>
            </div>
          </div>
        )}
        <div style={{ marginTop: "8px", fontSize: "11px", color: "#888" }}>
          {programLogs.length === 0 ? (
            <span>No program logs yet.</span>
          ) : (
            <pre
              style={{
                margin: 0,
                padding: "8px",
                borderRadius: "4px",
                background: "#0f172a",
                border: "1px solid #1f2937",
                color: "#d1d5db",
                maxHeight: "140px",
                overflow: "auto",
                whiteSpace: "pre-wrap",
              }}
            >
              {programLogs.map((entry) => entry.msg).join("\n")}
            </pre>
          )}
        </div>
      </div>

      {showAdvancedControls && (
        <div className={styles.section}>
          <strong>Capture</strong>
        <div style={{ marginTop: "8px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: "11px", color: "#aaa" }}>
            Hz
            <input
              type="number"
              min={1}
              max={200}
              value={captureHz}
              onChange={(e) => setCaptureHz(Math.max(1, Math.min(200, Number(e.target.value) || DEFAULT_CAPTURE_HZ)))}
              disabled={!bridgeReady}
              style={{ marginLeft: "6px", width: "70px", background: "#111", color: "#fff", border: "1px solid #444", borderRadius: "4px", padding: "4px" }}
            />
          </label>
          <label style={{ fontSize: "11px", color: "#aaa" }}>
            Seconds
            <input
              type="number"
              min={1}
              max={120}
              value={captureSeconds}
              onChange={(e) => setCaptureSeconds(Math.max(1, Math.min(120, Number(e.target.value) || DEFAULT_CAPTURE_SECONDS)))}
              disabled={!bridgeReady}
              style={{ marginLeft: "6px", width: "70px", background: "#111", color: "#fff", border: "1px solid #444", borderRadius: "4px", padding: "4px" }}
            />
          </label>
          <button
            onClick={handleStartCapture}
            disabled={!!captureBlockedReason}
            style={{
              padding: "10px 20px",
              background: captureBlockedReason ? "#555" : "#0a3a5a",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: captureBlockedReason ? "not-allowed" : "pointer",
            }}
          >
            {panelState === "RUNNING" ? "Capturing..." : "Start Capture"}
          </button>
          <button
            onClick={handleStopCapture}
            disabled={panelState !== "RUNNING"}
            style={{
              padding: "10px 20px",
              background: panelState === "RUNNING" ? "#5a0a0a" : "#555",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: panelState === "RUNNING" ? "pointer" : "not-allowed",
            }}
          >
            Stop Capture
          </button>
        </div>
        {captureBlockedReason && (
          <div style={{ marginTop: "6px", fontSize: "11px", color: "#888" }}>
            {captureBlockedReason}
          </div>
        )}
          <div style={{ marginTop: "8px", fontSize: "11px", color: "#888" }}>
            run_id: {runId || "-"} | events: {traceEventCount}
            {captureStartedAt ? ` | started: ${new Date(captureStartedAt).toLocaleTimeString()}` : ""}
            {captureStoppedAt ? ` | stopped: ${new Date(captureStoppedAt).toLocaleTimeString()}` : ""}
          </div>
        </div>
      )}

      {showAdvancedControls && (
        <div className={styles.section}>
          <strong>Export</strong>
        <div style={{ marginTop: "8px", display: "flex", gap: "10px" }}>
          <button
            onClick={handleExportBundle}
            disabled={!!exportBlockedReason}
            style={{
              padding: "10px 20px",
              background: exportBlockedReason ? "#555" : "#0a5a5a",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: exportBlockedReason ? "not-allowed" : "pointer",
            }}
          >
            Export Bundle v2
          </button>
        </div>
        {exportBlockedReason && (
          <div style={{ marginTop: "6px", fontSize: "11px", color: "#888" }}>
            {exportBlockedReason}
          </div>
        )}
          <div style={{ marginTop: "6px", fontSize: "11px", color: "#888" }}>
            Writes: manifest.json, trace/hw_trace.ndjson, meta/board_profile.json, integrity/capsule.json
          </div>
        </div>
      )}

      {isRunningNoData && (
        <div className={styles.warningBox}>
          <div style={{ color: "#fa0", fontWeight: "bold", marginBottom: "6px" }}>
            {NEO_ACTION_ICONS.warning} No Wrapper Detected
          </div>
          <div style={{ color: "#db9", fontSize: "12px", lineHeight: "1.5" }}>
            The bitstream is running but not producing IO samples.
            This typically means the design lacks the RedByte IO wrapper.
          </div>
          <div style={{ color: "#db9", fontSize: "12px", marginTop: "8px" }}>
            <strong>To fix:</strong> Use the instructor-provided wrapper bitstream,
            or build your design with the RedByte toolchain.
          </div>
          <div style={{ color: "#888", fontSize: "11px", marginTop: "8px" }}>
            Auto-stopping in {NO_DATA_AUTO_STOP_MS / 1000}s...
            {runStatusHint && ` (${runStatusHint})`}
          </div>
        </div>
      )}

      {showAdvancedControls && (
        <div className={styles.section}>
          <strong>Lab Diagnostics</strong>
          <div style={{ marginTop: "8px", fontSize: "11px", color: "#888" }}>
            <div>Bridge URL: <span style={{ color: bridgeHealth?.ok ? "#0f0" : "#f66" }}>{BRIDGE_URL}</span></div>
            <div style={{ marginTop: "4px" }}>
              Status: {bridgeHealth?.ok ? (
                <span style={{ color: "#0f0" }}>Online (v{bridgeHealth.version || "?"})</span>
              ) : (
                <span style={{ color: "#f66" }}>{bridgeError || "Offline"}</span>
              )}
            </div>
            {bridgeHealth?.activeRunCount !== undefined && (
              <div style={{ marginTop: "4px" }}>Active runs: {bridgeHealth.activeRunCount}</div>
            )}
            {programLogPath && (
              <div style={{ marginTop: "4px" }}>Last program run_id: {programLogPath}</div>
            )}
            {programError && (
              <div style={{ marginTop: "4px", color: "#f66" }}>Last program error: {programError}</div>
            )}
          </div>
          <div style={{ marginTop: "8px", fontSize: "11px", color: "#666" }}>
            <div>Checklist: Digilent Adept installed? FTDI VCP drivers? Bridge daemon running?</div>
          </div>
        </div>
      )}

      {error && (
        <div className={styles.errorBox}>
          {error}
        </div>
      )}
    </div>
  );
}

export const HardwarePanelApp: RedByteApp = {
  manifest: {
    id: "hardware-panel",
    name: "Hardware Panel",
    iconId: "chip",
    singleton: true,
    category: "tools",
    hidden: true,
    defaultSize: { width: 900, height: 700 },
    minSize: { width: 700, height: 500 },
  },
  component: HardwarePanelComponent,
};
