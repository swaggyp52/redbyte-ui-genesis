import { useState, useEffect, useCallback } from "react";
import type { RedByteApp } from "../types";
import { hardwareClient, type ConnectionState } from "../services/hardwareClient";

interface IOState {
  SW: string;
  BTN: string;
  LED: string;
  TICK: string;
}

interface ToolchainCapabilities {
  vivado?: { version: string; path: string; canSynthesize: boolean; canProgram: boolean };
  yosys?: { version: string; path: string };
  openFPGALoader?: { version: string; path: string };
}

interface SynthesisJob {
  jobId: string;
  status: string;
  progress: number;
  logs: string[];
  error?: string;
  artifacts?: {
    bitstream?: string;
    timing?: { wns: number; tns: number; met: boolean };
  };
}

interface ProgramJob {
  jobId: string;
  status: string;
  progress: number;
  logs: string[];
  error?: string;
}

const BRIDGE_URL = "http://localhost:4242";

function HardwarePanelComponent() {
  const [connectionState, setConnectionState] = useState<ConnectionState>(hardwareClient.getState());
  const [ioState, setIOState] = useState<IOState | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [lastSeq, setLastSeq] = useState<number>(-1);
  const [hwMode, setHwMode] = useState<'auto' | 'on' | 'off'>('auto');

  // Toolchain state
  const [toolchain, setToolchain] = useState<ToolchainCapabilities | null>(null);
  const [toolchainLoading, setToolchainLoading] = useState(false);
  const [canSynthesize, setCanSynthesize] = useState(false);
  const [canProgram, setCanProgram] = useState(false);

  // Synthesis state
  const [synthesisJob, setSynthesisJob] = useState<SynthesisJob | null>(null);
  const [synthesizing, setSynthesizing] = useState(false);

  // Programming state
  const [programJob, setProgramJob] = useState<ProgramJob | null>(null);
  const [programming, setProgramming] = useState(false);

  // Bitstream ready for programming
  const [bitstreamReady, setBitstreamReady] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<'io' | 'synthesis' | 'logs'>('io');

  // Fetch toolchain capabilities
  const fetchToolchain = useCallback(async () => {
    setToolchainLoading(true);
    try {
      const res = await fetch(`${BRIDGE_URL}/api/toolchain`);
      const data = await res.json();
      if (data.ok) {
        setToolchain(data.capabilities);
        setCanSynthesize(data.canSynthesize);
        setCanProgram(data.canProgram);
      }
    } catch (e) {
      console.error("[Hardware Panel] Failed to fetch toolchain:", e);
    } finally {
      setToolchainLoading(false);
    }
  }, []);

  // Poll synthesis job status
  const pollSynthesisJob = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`${BRIDGE_URL}/api/synthesize/${jobId}`);
      const data = await res.json();
      if (data.ok) {
        setSynthesisJob(data.job);
        if (data.job.status === 'complete') {
          setSynthesizing(false);
          setBitstreamReady(!!data.job.artifacts?.bitstream);
        } else if (data.job.status === 'failed') {
          setSynthesizing(false);
        } else {
          // Continue polling
          setTimeout(() => pollSynthesisJob(jobId), 1000);
        }
      }
    } catch (e) {
      console.error("[Hardware Panel] Failed to poll synthesis:", e);
      setSynthesizing(false);
    }
  }, []);

  // Poll programming job status
  const pollProgramJob = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`${BRIDGE_URL}/api/program/${jobId}`);
      const data = await res.json();
      if (data.ok) {
        setProgramJob(data.job);
        if (data.job.status === 'complete' || data.job.status === 'failed') {
          setProgramming(false);
        } else {
          // Continue polling
          setTimeout(() => pollProgramJob(jobId), 500);
        }
      }
    } catch (e) {
      console.error("[Hardware Panel] Failed to poll programming:", e);
      setProgramming(false);
    }
  }, []);

  // Start synthesis
  const handleSynthesize = useCallback(async () => {
    setSynthesizing(true);
    setSynthesisJob(null);
    setBitstreamReady(false);

    // For demo, use simple test Verilog
    // In real app, this would come from the circuit editor
    const verilog = `
module top(
  input wire sw_0,
  input wire sw_1,
  output wire led_0
);
  assign led_0 = sw_0 & sw_1;
endmodule
`;

    const constraints = `
## Switches
set_property -dict { PACKAGE_PIN V17 IOSTANDARD LVCMOS33 } [get_ports {sw_0}]
set_property -dict { PACKAGE_PIN V16 IOSTANDARD LVCMOS33 } [get_ports {sw_1}]
## LEDs
set_property -dict { PACKAGE_PIN U16 IOSTANDARD LVCMOS33 } [get_ports {led_0}]
## Configuration
set_property CONFIG_VOLTAGE 3.3 [current_design]
set_property CFGBVS VCCO [current_design]
`;

    try {
      const res = await fetch(`${BRIDGE_URL}/api/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verilog, constraints, topModule: 'top' }),
      });
      const data = await res.json();
      if (data.ok) {
        pollSynthesisJob(data.jobId);
      } else {
        alert(`Synthesis failed: ${data.error}`);
        setSynthesizing(false);
      }
    } catch (e: any) {
      alert(`Synthesis failed: ${e.message}`);
      setSynthesizing(false);
    }
  }, [pollSynthesisJob]);

  // Program FPGA
  const handleProgram = useCallback(async () => {
    if (!synthesisJob?.artifacts?.bitstream) {
      alert('No bitstream available. Run synthesis first.');
      return;
    }

    setProgramming(true);
    setProgramJob(null);

    try {
      const res = await fetch(`${BRIDGE_URL}/api/program`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bitstream: synthesisJob.artifacts.bitstream }),
      });
      const data = await res.json();
      if (data.ok) {
        pollProgramJob(data.jobId);
      } else {
        alert(`Programming failed: ${data.error}`);
        setProgramming(false);
      }
    } catch (e: any) {
      alert(`Programming failed: ${e.message}`);
      setProgramming(false);
    }
  }, [synthesisJob, pollProgramJob]);

  // Subscribe to hardware client state changes
  useEffect(() => {
    fetchToolchain();

    const unsubscribe = hardwareClient.subscribe((state) => {
      setConnectionState(state);

      // Set up WebSocket message listener when connected
      if (state.status === 'connected' && state.ws) {
        state.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            setEvents((prev) => [...prev.slice(-20), msg]); // Keep last 20
            setLastSeq(msg.seq);

            if (msg.type === "io:update") {
              setIOState({
                SW: msg.SW || "0000000000000000",
                BTN: msg.BTN || "00000",
                LED: msg.LED || "0000000000000000",
                TICK: msg.TICK || "0",
              });
            }

            // Handle synthesis/program events
            if (msg.type?.startsWith('synthesis:') || msg.type?.startsWith('program:')) {
              setEvents((prev) => [...prev.slice(-20), msg]);
            }
          } catch (e) {
            console.error("[Hardware Panel] Failed to parse WS message", e);
          }
        };
      }
    });

    return unsubscribe;
  }, [fetchToolchain]);

  // Export proof capsule
  const exportProof = async () => {
    try {
      const blob = await hardwareClient.exportProof();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fpga-proof-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Failed to export proof: ${e.message}`);
    }
  };

  const handleModeChange = (mode: 'auto' | 'on' | 'off') => {
    setHwMode(mode);
    hardwareClient.setMode(mode);
  };

  const isConnected = connectionState.status === 'connected';
  const ws = connectionState.status === 'connected' ? connectionState.ws : null;
  const mockMode = connectionState.status === 'connected' && connectionState.bridge.port === 'MOCK';

  const tabStyle = (tab: string) => ({
    padding: "8px 16px",
    background: activeTab === tab ? "#0a5a0a" : "#333",
    color: "#fff",
    border: "none",
    borderRadius: "4px 4px 0 0",
    cursor: "pointer",
    fontSize: "12px",
  });

  return (
    <div style={{ padding: "20px", fontFamily: "monospace", color: "#fff", height: "100%", overflow: "auto" }}>
      <h2>Hardware Panel</h2>

      {/* Toolchain Status */}
      <div style={{ marginBottom: "20px", padding: "10px", background: "#1a1a2e", borderRadius: "4px", border: "1px solid #16213e" }}>
        <div style={{ marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>Toolchain Status</strong>
          <button
            onClick={fetchToolchain}
            disabled={toolchainLoading}
            style={{ padding: "4px 8px", background: "#333", color: "#fff", border: "1px solid #555", borderRadius: "4px", cursor: "pointer", fontSize: "11px" }}
          >
            {toolchainLoading ? "..." : "Refresh"}
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", fontSize: "11px" }}>
          <div style={{ padding: "6px", background: "#222", borderRadius: "4px" }}>
            <div style={{ color: toolchain?.vivado ? "#0f0" : "#f66" }}>
              {toolchain?.vivado ? "●" : "○"} Vivado
            </div>
            {toolchain?.vivado && (
              <div style={{ color: "#888", marginTop: "2px" }}>v{toolchain.vivado.version}</div>
            )}
          </div>
          <div style={{ padding: "6px", background: "#222", borderRadius: "4px" }}>
            <div style={{ color: toolchain?.yosys ? "#0f0" : "#f66" }}>
              {toolchain?.yosys ? "●" : "○"} Yosys
            </div>
            {toolchain?.yosys && (
              <div style={{ color: "#888", marginTop: "2px" }}>v{toolchain.yosys.version}</div>
            )}
          </div>
          <div style={{ padding: "6px", background: "#222", borderRadius: "4px" }}>
            <div style={{ color: toolchain?.openFPGALoader ? "#0f0" : "#f66" }}>
              {toolchain?.openFPGALoader ? "●" : "○"} openFPGALoader
            </div>
            {toolchain?.openFPGALoader && (
              <div style={{ color: "#888", marginTop: "2px" }}>v{toolchain.openFPGALoader.version}</div>
            )}
          </div>
        </div>
        <div style={{ marginTop: "8px", fontSize: "11px", color: "#888" }}>
          Synthesis: {canSynthesize ? <span style={{ color: "#0f0" }}>Available</span> : <span style={{ color: "#f66" }}>Not available</span>}
          {" | "}
          Programming: {canProgram ? <span style={{ color: "#0f0" }}>Available</span> : <span style={{ color: "#f66" }}>Not available</span>}
        </div>
      </div>

      {/* Hardware Mode Toggle */}
      <div style={{ marginBottom: "20px", padding: "10px", background: "#1a1a2e", borderRadius: "4px", border: "1px solid #16213e" }}>
        <div style={{ marginBottom: "8px" }}><strong>Hardware Integration:</strong></div>
        <div style={{ display: "flex", gap: "10px" }}>
          {(['off', 'auto', 'on'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => handleModeChange(mode)}
              style={{
                padding: "6px 12px",
                background: hwMode === mode ? "#0a5a0a" : "#333",
                color: "#fff",
                border: "1px solid " + (hwMode === mode ? "#0f0" : "#555"),
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              {mode === 'off' ? 'OFF' : mode === 'auto' ? 'AUTO' : 'ON'}
            </button>
          ))}
        </div>
        <div style={{ marginTop: "8px", fontSize: "11px", color: "#888" }}>
          {hwMode === 'off' && 'Demo mode - hardware disabled'}
          {hwMode === 'auto' && 'Auto-detect - falls back to demo if unavailable'}
          {hwMode === 'on' && 'Force hardware connection - keeps retrying'}
        </div>
      </div>

      {/* Connection Status */}
      <div style={{ marginBottom: "20px", padding: "10px", background: "#1a1a2e", borderRadius: "4px", border: "1px solid #16213e" }}>
        <strong>Connection:</strong>{" "}
        {connectionState.status === 'offline' && (
          <span style={{ color: "#f90" }}>● Offline - {connectionState.message}</span>
        )}
        {connectionState.status === 'connecting' && (
          <span style={{ color: "#ff0" }}>● Connecting...</span>
        )}
        {connectionState.status === 'connected' && (
          <span style={{ color: "#0f0" }}>● Connected ({connectionState.bridge.port})</span>
        )}
      </div>

      {/* Synthesis & Programming Actions */}
      <div style={{ marginBottom: "20px", padding: "10px", background: "#1a1a2e", borderRadius: "4px", border: "1px solid #16213e" }}>
        <div style={{ marginBottom: "8px" }}><strong>FPGA Workflow:</strong></div>
        <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
          <button
            onClick={handleSynthesize}
            disabled={!canSynthesize || synthesizing}
            style={{
              padding: "10px 20px",
              background: canSynthesize && !synthesizing ? "#0a5a0a" : "#555",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: canSynthesize && !synthesizing ? "pointer" : "not-allowed",
            }}
          >
            {synthesizing ? "Synthesizing..." : "Synthesize"}
          </button>
          <button
            onClick={handleProgram}
            disabled={!canProgram || !bitstreamReady || programming}
            style={{
              padding: "10px 20px",
              background: canProgram && bitstreamReady && !programming ? "#5a0a5a" : "#555",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: canProgram && bitstreamReady && !programming ? "pointer" : "not-allowed",
            }}
          >
            {programming ? "Programming..." : "Program FPGA"}
          </button>
          <button
            onClick={exportProof}
            disabled={!isConnected}
            style={{
              padding: "10px 20px",
              background: isConnected ? "#0a3a5a" : "#555",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: isConnected ? "pointer" : "not-allowed",
            }}
          >
            Export Proof
          </button>
        </div>

        {/* Synthesis Progress */}
        {synthesisJob && (
          <div style={{ marginBottom: "10px" }}>
            <div style={{ fontSize: "11px", marginBottom: "4px" }}>
              Synthesis: {synthesisJob.status} ({synthesisJob.progress}%)
            </div>
            <div style={{ height: "8px", background: "#333", borderRadius: "4px", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${synthesisJob.progress}%`,
                  background: synthesisJob.status === 'failed' ? "#f66" : synthesisJob.status === 'complete' ? "#0f0" : "#ff0",
                  transition: "width 0.3s",
                }}
              />
            </div>
            {synthesisJob.error && (
              <div style={{ color: "#f66", fontSize: "11px", marginTop: "4px" }}>{synthesisJob.error}</div>
            )}
            {synthesisJob.artifacts?.timing && (
              <div style={{ fontSize: "11px", marginTop: "4px", color: synthesisJob.artifacts.timing.met ? "#0f0" : "#f66" }}>
                Timing: WNS={synthesisJob.artifacts.timing.wns.toFixed(3)}ns {synthesisJob.artifacts.timing.met ? "(MET)" : "(VIOLATED)"}
              </div>
            )}
          </div>
        )}

        {/* Programming Progress */}
        {programJob && (
          <div>
            <div style={{ fontSize: "11px", marginBottom: "4px" }}>
              Programming: {programJob.status} ({programJob.progress}%)
            </div>
            <div style={{ height: "8px", background: "#333", borderRadius: "4px", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${programJob.progress}%`,
                  background: programJob.status === 'failed' ? "#f66" : programJob.status === 'complete' ? "#0f0" : "#ff0",
                  transition: "width 0.3s",
                }}
              />
            </div>
            {programJob.error && (
              <div style={{ color: "#f66", fontSize: "11px", marginTop: "4px" }}>{programJob.error}</div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "0" }}>
        <button onClick={() => setActiveTab('io')} style={tabStyle('io')}>I/O State</button>
        <button onClick={() => setActiveTab('synthesis')} style={tabStyle('synthesis')}>Synthesis Logs</button>
        <button onClick={() => setActiveTab('logs')} style={tabStyle('logs')}>Event Log</button>
      </div>

      {/* Tab Content */}
      <div style={{ background: "#111", padding: "10px", borderRadius: "0 4px 4px 4px", minHeight: "200px" }}>
        {/* I/O State Tab */}
        {activeTab === 'io' && ioState && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div style={{ padding: "10px", background: "#222", borderRadius: "4px" }}>
              <div><strong>Switches (SW)</strong></div>
              <div style={{ fontSize: "14px", color: "#0ff", fontFamily: "monospace" }}>{ioState.SW}</div>
            </div>
            <div style={{ padding: "10px", background: "#222", borderRadius: "4px" }}>
              <div><strong>LEDs</strong></div>
              <div style={{ fontSize: "14px", color: "#ff0", fontFamily: "monospace" }}>{ioState.LED}</div>
            </div>
            <div style={{ padding: "10px", background: "#222", borderRadius: "4px" }}>
              <div><strong>Buttons (BTN)</strong></div>
              <div style={{ fontSize: "14px", color: "#0f0", fontFamily: "monospace" }}>{ioState.BTN}</div>
            </div>
            <div style={{ padding: "10px", background: "#222", borderRadius: "4px" }}>
              <div><strong>Tick</strong></div>
              <div style={{ fontSize: "14px", color: "#fff" }}>{ioState.TICK}</div>
            </div>
          </div>
        )}
        {activeTab === 'io' && !ioState && (
          <div style={{ color: "#666" }}>No I/O data. Connect to hardware or enable mock mode.</div>
        )}

        {/* Synthesis Logs Tab */}
        {activeTab === 'synthesis' && (
          <div style={{ maxHeight: "250px", overflow: "auto", fontSize: "11px", fontFamily: "monospace" }}>
            {synthesisJob?.logs?.length ? (
              synthesisJob.logs.slice(-30).map((log, i) => (
                <div key={i} style={{ marginBottom: "2px", color: log.includes('ERROR') ? "#f66" : "#aaa" }}>{log}</div>
              ))
            ) : (
              <div style={{ color: "#666" }}>No synthesis logs. Click "Synthesize" to start.</div>
            )}
          </div>
        )}

        {/* Event Log Tab */}
        {activeTab === 'logs' && (
          <div style={{ maxHeight: "250px", overflow: "auto", fontSize: "12px" }}>
            {events.length === 0 ? (
              <div style={{ color: "#666" }}>No events yet. Waiting for bridge...</div>
            ) : (
              events.slice(-15).reverse().map((evt, i) => (
                <div key={i} style={{ marginBottom: "4px", borderBottom: "1px solid #333", paddingBottom: "4px" }}>
                  <span style={{ color: "#0ff" }}>[{evt.seq}]</span>{" "}
                  <span style={{ color: "#ff0" }}>{evt.type}</span>{" "}
                  <span style={{ color: "#888" }}>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
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
    defaultSize: { width: 800, height: 600 },
    minSize: { width: 600, height: 400 },
  },
  component: HardwarePanelComponent,
};
