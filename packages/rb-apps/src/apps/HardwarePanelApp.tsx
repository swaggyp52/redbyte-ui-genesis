import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { RedByteApp } from "../types";
import type { BridgeDevice } from "@redbyte/rb-fpga-bridge-contract";
import type { HardwareTraceEvent } from "@redbyte/rb-fpga-proof-core";
import { exportV2Bundle, type BoardProfile } from "../utils/bundleExport";
import { buildTraceEvent } from "./hardwarePanelUtils";

const BRIDGE_URL = "http://127.0.0.1:4242";
const DEFAULT_LAB_ID = "basys3_mvp_lab";
const DEFAULT_LAB_VERSION = "1.0.0";
const DEFAULT_BOARD = "basys3";
const DEFAULT_CAPTURE_HZ = 20;
const DEFAULT_CAPTURE_SECONDS = 5;
const STREAM_SILENCE_MS = 2000;
const STREAM_RETRY_LIMIT = 1;
const DEFAULT_RETRY_DELAY_MS = 600;

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

function HardwarePanelComponent() {
  const [panelState, setPanelState] = useState<PanelState>("DISCONNECTED");
  const [bridgeHealth, setBridgeHealth] = useState<BridgeHealth | null>(null);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [devices, setDevices] = useState<BridgeDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [bitstreamFile, setBitstreamFile] = useState<File | null>(null);
  const [bitstreamBase64, setBitstreamBase64] = useState<string | null>(null);
  const [programLogPath, setProgramLogPath] = useState<string | null>(null);
  const [programError, setProgramError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [traceEvents, setTraceEvents] = useState<HardwareTraceEvent[]>([]);
  const [captureHz, setCaptureHz] = useState<number>(DEFAULT_CAPTURE_HZ);
  const [captureSeconds, setCaptureSeconds] = useState<number>(DEFAULT_CAPTURE_SECONDS);
  const [captureStartedAt, setCaptureStartedAt] = useState<number | null>(null);
  const [captureStoppedAt, setCaptureStoppedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const runIdRef = useRef<string | null>(null);
  const monoSeqRef = useRef<number>(0);
  const captureHzRef = useRef<number>(DEFAULT_CAPTURE_HZ);
  const stopTimerRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const lastSampleAtRef = useRef<number | null>(null);
  const streamRetryRef = useRef<number>(0);

  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId) ?? null,
    [devices, selectedDeviceId]
  );

  const traceEventCount = traceEvents.length;
  const bridgeReady = bridgeHealth?.ok === true;
  const hasDevices = devices.length > 0;
  const isSimDevice = selectedDevice?.transport === "sim";
  const runtimeReady = selectedDevice?.runtime?.status === "ready";
  const programmingReady = selectedDevice?.programming?.status === "ready";

  const programBlockedReason =
    !bridgeReady
      ? "Bridge offline"
      : !selectedDeviceId
        ? "Select a device"
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

  const setPanelError = useCallback((message: string) => {
    setError(message);
    setPanelState("ERROR");
  }, []);

  const fetchHealth = useCallback(async () => {
    try {
      const result = await fetchJsonWithRetry<BridgeHealth>(
        `${BRIDGE_URL}/health`,
        {},
        { timeoutMs: 2000, retries: 1 }
      );
      if (!result.ok || !result.data?.ok) {
        throw new Error(`bridge_http_${result.status}`);
      }
      const data = result.data;
      if (!data.ok) throw new Error("bridge_unavailable");
      setBridgeHealth(data);
      setBridgeError(null);
      setPanelState((prev) =>
        prev === "DISCONNECTED" || prev === "ERROR" ? "IDLE" : prev
      );
      return true;
    } catch (err) {
      setBridgeHealth(null);
      setBridgeError("Local Bridge not running");
      setDevices([]);
      setSelectedDeviceId("");
      setPanelState("DISCONNECTED");
      return false;
    }
  }, []);

  const fetchDevices = useCallback(async () => {
    try {
      const result = await fetchJsonWithRetry<{ devices?: BridgeDevice[] }>(
        `${BRIDGE_URL}/devices`,
        {},
        { timeoutMs: 3000, retries: 1 }
      );
      if (!result.ok) throw new Error(`devices_http_${result.status}`);
      const payload = result.data;
      const list = Array.isArray(payload?.devices) ? payload.devices : [];
      setDevices(list);
      if (!selectedDeviceId && list.length > 0) {
        setSelectedDeviceId(list[0].id);
      }
    } catch (err) {
      setDevices([]);
    }
  }, [selectedDeviceId]);

  const refreshBridge = useCallback(async () => {
    const ok = await fetchHealth();
    if (ok) {
      await fetchDevices();
    }
  }, [fetchDevices, fetchHealth]);

  useEffect(() => {
    refreshBridge();
  }, [refreshBridge]);

  useEffect(() => {
    return () => {
      if (stopTimerRef.current) {
        window.clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
      if (silenceTimerRef.current) {
        window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
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
    setBitstreamFile(file);
    setProgramLogPath(null);
    setProgramError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setBitstreamBase64(dataUrl);
    } catch (err) {
      setBitstreamBase64(null);
      setProgramError("Failed to read bitstream file.");
    }
  }, []);

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

      const source = new EventSource(
        `${BRIDGE_URL}/stream?run_id=${encodeURIComponent(runId)}`
      );
      eventSourceRef.current = source;

      const scheduleSilenceCheck = () => {
        if (silenceTimerRef.current) {
          window.clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        silenceTimerRef.current = window.setTimeout(() => {
          const last = lastSampleAtRef.current;
          if (!last || Date.now() - last >= STREAM_SILENCE_MS) {
            if (streamRetryRef.current < STREAM_RETRY_LIMIT && runIdRef.current) {
              streamRetryRef.current += 1;
              openStream(runIdRef.current);
              return;
            }
            failCapture("Stream stalled (no samples).");
          }
        }, STREAM_SILENCE_MS);
      };

      source.addEventListener("sample", (event) => {
        try {
          const data = JSON.parse(event.data) as StreamSample;
          const seq = monoSeqRef.current++;
          const eventItem = buildTraceEvent(data, seq, captureHzRef.current);
          lastSampleAtRef.current = Date.now();
          scheduleSilenceCheck();
          setTraceEvents((prev) => [...prev, eventItem]);
        } catch {
          // Ignore malformed samples
        }
      });

      source.addEventListener("status", (event) => {
        try {
          const data = JSON.parse(event.data) as StreamStatus;
          if (data.state) {
            setRunStatus(data.state);
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
    setProgramError(null);
    setProgramLogPath(null);
    setPanelState("PROGRAMMING");
    try {
      const result = await fetchJsonWithRetry<{ ok?: boolean; error?: string; log_path?: string }>(
        `${BRIDGE_URL}/program`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            device_id: selectedDeviceId,
            board_model_id: selectedDevice?.model_id ?? DEFAULT_BOARD,
            bitstream_base64: bitstreamBase64,
          }),
        },
        { timeoutMs: 120000, retries: 1 }
      );
      if (!result.ok || !result.data?.ok) {
        throw new Error(result.data?.error || `program_failed_${result.status}`);
      }
      setProgramLogPath(result.data?.log_path || null);
      setPanelState("READY");
    } catch (err) {
      setProgramError(err instanceof Error ? err.message : "program_failed");
      setPanelState("ERROR");
    }
  }, [bitstreamBase64, programBlockedReason, selectedDevice?.model_id, selectedDeviceId]);

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
            mode: selectedDevice?.transport === "sim" ? "mock" : "hardware",
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

  const handleExportBundle = useCallback(async () => {
    if (exportBlockedReason) {
      setError(exportBlockedReason);
      return;
    }

    const boardProfile: BoardProfile = {
      ...DEFAULT_BOARD_PROFILE,
      board: selectedDevice?.model_id ?? DEFAULT_BOARD,
    };

    try {
      const result = await exportV2Bundle({
        labId: DEFAULT_LAB_ID,
        labVersion: DEFAULT_LAB_VERSION,
        board: selectedDevice?.model_id ?? DEFAULT_BOARD,
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
  }, [bitstreamFile, exportBlockedReason, selectedDevice?.model_id, traceEvents, setPanelError]);

  const stateLabel = (() => {
    switch (panelState) {
      case "DISCONNECTED":
        return "Bridge offline";
      case "IDLE":
        return "Ready";
      case "PROGRAMMING":
        return "Programming";
      case "READY":
        return "Programmed";
      case "RUNNING":
        return "Capturing";
      case "STOPPING":
        return "Stopping";
      case "DONE":
        return "Capture complete";
      case "ERROR":
        return "Error";
      default:
        return "Unknown";
    }
  })();

  const sectionStyle = {
    marginBottom: "20px",
    padding: "10px",
    background: "#1a1a2e",
    borderRadius: "4px",
    border: "1px solid #16213e",
  } as const;

  return (
    <div style={{ padding: "20px", fontFamily: "monospace", color: "#fff", height: "100%", overflow: "auto" }}>
      <h2>Hardware Panel</h2>

      <div style={sectionStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <strong>Bridge Status</strong>
          <button
            onClick={refreshBridge}
            style={{ padding: "4px 8px", background: "#333", color: "#fff", border: "1px solid #555", borderRadius: "4px", cursor: "pointer", fontSize: "11px" }}
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
        <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
          Panel state: {stateLabel}
          {runStatus ? ` | Run status: ${runStatus}` : ""}
        </div>
      </div>

      <div style={sectionStyle}>
        <strong>Device</strong>
        <div style={{ marginTop: "8px", display: "flex", gap: "10px", alignItems: "center" }}>
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            disabled={!bridgeReady}
            style={{ padding: "6px", background: "#111", color: "#fff", border: "1px solid #444", borderRadius: "4px", minWidth: "280px" }}
          >
            {devices.length === 0 && <option value="">No devices found</option>}
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.display_name} ({device.id})
              </option>
            ))}
          </select>
          <button
            onClick={fetchDevices}
            style={{ padding: "6px 10px", background: "#333", color: "#fff", border: "1px solid #555", borderRadius: "4px", cursor: "pointer", fontSize: "11px" }}
          >
            Refresh Devices
          </button>
        </div>
        {!bridgeReady && (
          <div style={{ marginTop: "6px", fontSize: "11px", color: "#f66" }}>
            Bridge offline. Start the local daemon to enable devices.
          </div>
        )}
        {bridgeReady && !hasDevices && (
          <div style={{ marginTop: "6px", fontSize: "11px", color: "#f66" }}>
            No devices detected.
          </div>
        )}
        {selectedDevice && (
          <div style={{ marginTop: "8px", fontSize: "11px", color: "#888" }}>
            model_id: {selectedDevice.model_id} | transport: {selectedDevice.transport} | runtime: {selectedDevice.runtime?.status}
          </div>
        )}
      </div>

      <div style={sectionStyle}>
        <strong>Bitstream</strong>
        <div style={{ marginTop: "8px", display: "flex", gap: "10px", alignItems: "center" }}>
          <input
            type="file"
            accept=".bit"
            onChange={handleBitstreamSelect}
            disabled={!bridgeReady}
            style={{ color: "#fff" }}
          />
          <span style={{ fontSize: "11px", color: "#888" }}>
            {bitstreamFile ? bitstreamFile.name : "No bitstream selected"}
          </span>
        </div>
        {programLogPath && (
          <div style={{ marginTop: "6px", fontSize: "11px", color: "#888" }}>log: {programLogPath}</div>
        )}
        {programError && (
          <div style={{ marginTop: "6px", fontSize: "11px", color: "#f66" }}>{programError}</div>
        )}
      </div>

      <div style={sectionStyle}>
        <strong>Program</strong>
        <div style={{ marginTop: "8px", display: "flex", gap: "10px" }}>
          <button
            onClick={handleProgram}
            disabled={!!programBlockedReason}
            style={{
              padding: "10px 20px",
              background: programBlockedReason ? "#555" : "#0a5a0a",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: programBlockedReason ? "not-allowed" : "pointer",
            }}
          >
            {panelState === "PROGRAMMING" ? "Programming..." : "Program FPGA"}
          </button>
        </div>
        {programBlockedReason && (
          <div style={{ marginTop: "6px", fontSize: "11px", color: "#888" }}>
            {programBlockedReason}
          </div>
        )}
      </div>

      <div style={sectionStyle}>
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

      <div style={sectionStyle}>
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

      {error && (
        <div style={{ padding: "10px", background: "#2a0a0a", borderRadius: "4px", border: "1px solid #5a0a0a", color: "#f66" }}>
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
    category: "development",
    defaultSize: { width: 900, height: 700 },
    minSize: { width: 700, height: 500 },
  },
  component: HardwarePanelComponent,
};
