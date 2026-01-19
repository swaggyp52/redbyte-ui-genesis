import { useState, useEffect } from "react";
import type { RedByteApp } from "../types";
import { hardwareClient, type ConnectionState } from "../services/hardwareClient";

interface IOState {
  SW: string;
  BTN: string;
  LED: string;
  TICK: string;
}

function HardwarePanelComponent() {
  const [connectionState, setConnectionState] = useState<ConnectionState>(hardwareClient.getState());
  const [ioState, setIOState] = useState<IOState | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [lastSeq, setLastSeq] = useState<number>(-1);
  const [hwMode, setHwMode] = useState<'auto' | 'on' | 'off'>('auto');

  // Subscribe to hardware client state changes
  useEffect(() => {
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
          } catch (e) {
            console.error("[Hardware Panel] Failed to parse WS message", e);
          }
        };
      }
    });

    return unsubscribe;
  }, []);

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

  return (
    <div style={{ padding: "20px", fontFamily: "monospace", color: "#fff" }}>
      <h2>🔧 Hardware Panel</h2>
      
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
              {mode === 'off' ? '⭕ OFF' : mode === 'auto' ? '🔄 AUTO' : '✅ ON'}
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
        <strong>Status:</strong>{" "}
        {connectionState.status === 'offline' && (
          <div>
            <span style={{ color: "#f90" }}>● Offline</span>
            <div style={{ marginTop: "8px", fontSize: "12px", color: "#aaa" }}>
              {connectionState.message}
            </div>
          </div>
        )}
        {connectionState.status === 'connecting' && (
          <div>
            <span style={{ color: "#ff0" }}>● Connecting...</span>
            <div style={{ marginTop: "8px", fontSize: "12px", color: "#aaa" }}>
              {connectionState.message}
            </div>
          </div>
        )}
        {connectionState.status === 'connected' && (
          <div>
            <span style={{ color: "#0f0" }}>● Connected</span>
            <div style={{ marginTop: "8px", fontSize: "12px" }}>
              Port: {connectionState.bridge.port} | Baud: {connectionState.bridge.baud} | Mode: {mockMode ? "MOCK" : "UART"}
            </div>
            <div style={{ marginTop: "4px", fontSize: "11px", color: ws ? "#0f0" : "#f90" }}>
              WebSocket: {ws ? `Connected (seq: ${lastSeq})` : 'Disconnected'}
            </div>
          </div>
        )}
      </div>

      {/* I/O State */}
      {ioState && (
        <div style={{ marginBottom: "20px" }}>
          <h3>I/O State (Live)</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {/* Switches */}
            <div style={{ padding: "10px", background: "#222", borderRadius: "4px" }}>
              <div><strong>Switches (SW)</strong></div>
              <div style={{ fontSize: "14px", color: "#0ff", fontFamily: "monospace" }}>
                {ioState.SW}
              </div>
            </div>
            {/* LEDs */}
            <div style={{ padding: "10px", background: "#222", borderRadius: "4px" }}>
              <div><strong>LEDs</strong></div>
              <div style={{ fontSize: "14px", color: "#ff0", fontFamily: "monospace" }}>{ioState.LED}</div>
            </div>
            {/* Buttons */}
            <div style={{ padding: "10px", background: "#222", borderRadius: "4px" }}>
              <div><strong>Buttons (BTN)</strong></div>
              <div style={{ fontSize: "14px", color: "#0f0", fontFamily: "monospace" }}>
                {ioState.BTN}
              </div>
            </div>
            {/* TICK */}
            <div style={{ padding: "10px", background: "#222", borderRadius: "4px" }}>
              <div><strong>Tick</strong></div>
              <div style={{ fontSize: "14px", color: "#fff" }}>{ioState.TICK}</div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={exportProof}
          disabled={!isConnected}
          style={{
            padding: "10px 20px",
            background: isConnected ? "#0a5a0a" : "#555",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: isConnected ? "pointer" : "not-allowed",
            marginRight: "10px",
          }}
        >
          📦 Export Proof Capsule
        </button>
        <button
          onClick={() => hardwareClient.connect()}
          style={{
            padding: "10px 20px",
            background: "#0a3a5a",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          🔄 Reconnect
        </button>
      </div>

      {/* Event Log */}
      <div>
        <h3>Event Log (Last 10)</h3>
        <div style={{ maxHeight: "300px", overflow: "auto", background: "#111", padding: "10px", borderRadius: "4px", fontSize: "12px" }}>
          {events.length === 0 ? (
            <div style={{ color: "#666" }}>No events yet. Waiting for bridge...</div>
          ) : (
            events.slice(-10).reverse().map((evt, i) => (
              <div key={i} style={{ marginBottom: "4px", borderBottom: "1px solid #333", paddingBottom: "4px" }}>
                <span style={{ color: "#0ff" }}>[{evt.seq}]</span>{" "}
                <span style={{ color: "#ff0" }}>{evt.type}</span>{" "}
                <span style={{ color: "#888" }}>{new Date(evt.timestamp).toLocaleTimeString()}</span>
              </div>
            ))
          )}
        </div>
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
