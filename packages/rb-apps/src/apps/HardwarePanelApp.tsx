import { useState, useEffect, useCallback } from "react";
import type { RedByteApp } from "../types";

interface BridgeStatus {
  ok: boolean;
  connected: boolean;
  port: string;
  baud: number;
  mode?: string;
}

interface IOState {
  SW: string;
  BTN: string;
  LED: string;
  TICK: string;
}

const BRIDGE_HTTP = "http://127.0.0.1:4242";
const BRIDGE_WS = "ws://127.0.0.1:4243";

function HardwarePanelComponent() {
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ioState, setIOState] = useState<IOState | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [events, setEvents] = useState<any[]>([]);

  // Check bridge health
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${BRIDGE_HTTP}/api/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStatus(data);
      setError(null);
    } catch (e: any) {
      setError(e.message || "Bridge not detected");
      setStatus(null);
    }
  }, []);

  // Connect to WebSocket
  const connectWS = useCallback(() => {
    if (ws) return;

    try {
      const socket = new WebSocket(BRIDGE_WS);

      socket.onopen = () => {
        console.log("[Hardware Panel] WS connected");
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          setEvents((prev) => [...prev.slice(-20), msg]); // Keep last 20

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

      socket.onerror = (e) => {
        console.error("[Hardware Panel] WS error", e);
        setError("WebSocket connection failed");
      };

      socket.onclose = () => {
        console.log("[Hardware Panel] WS closed");
        setWs(null);
        setTimeout(() => connectWS(), 2000); // Reconnect after 2s
      };

      setWs(socket);
    } catch (e: any) {
      setError(e.message);
    }
  }, [ws]);

  // Export proof capsule
  const exportProof = async () => {
    try {
      const res = await fetch(`${BRIDGE_HTTP}/api/proof`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const proof = await res.json();
      
      const blob = new Blob([JSON.stringify(proof, null, 2)], { type: "application/json" });
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

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  useEffect(() => {
    if (status?.ok && !ws) {
      connectWS();
    }
    return () => {
      if (ws) {
        ws.close();
        setWs(null);
      }
    };
  }, [status, ws, connectWS]);

  return (
    <div style={{ padding: "20px", fontFamily: "monospace", color: "#fff" }}>
      <h2>🔧 Hardware Panel</h2>
      
      {/* Bridge Status */}
      <div style={{ marginBottom: "20px", padding: "10px", background: status?.ok ? "#0a3a0a" : "#3a0a0a", borderRadius: "4px" }}>
        <strong>Bridge Status:</strong>{" "}
        {status ? (
          <>
            <span style={{ color: "#0f0" }}>● Connected</span>
            <div style={{ marginTop: "8px", fontSize: "12px" }}>
              Port: {status.port} | Baud: {status.baud} | Mode: {status.mode || (status.port === "MOCK" ? "MOCK" : "UART")}
            </div>
          </>
        ) : (
          <>
            <span style={{ color: "#f00" }}>● No local bridge detected</span>
            <div style={{ marginTop: "8px", fontSize: "12px", color: "#aaa" }}>
              {error || "Start bridge: pnpm --filter @redbyte/fpga-bridge dev:mock"}
            </div>
          </>
        )}
      </div>

      {/* I/O State */}
      {ioState && (
        <div style={{ marginBottom: "20px" }}>
          <h3>I/O State (Live)</h3>
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
        </div>
      )}

      {/* Actions */}
      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={exportProof}
          disabled={!status?.ok}
          style={{
            padding: "10px 20px",
            background: status?.ok ? "#0a5a0a" : "#555",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: status?.ok ? "pointer" : "not-allowed",
            marginRight: "10px",
          }}
        >
          📦 Export Proof Capsule
        </button>
        <button
          onClick={checkHealth}
          style={{
            padding: "10px 20px",
            background: "#0a3a5a",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          🔄 Refresh Status
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
