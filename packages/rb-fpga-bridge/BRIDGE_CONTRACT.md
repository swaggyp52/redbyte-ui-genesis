# FPGA Bridge Contract

**Version**: 1.0  
**Status**: Immutable (frozen for hardware compatibility)  
**Scope**: All events between mock, serial, UI, and test layers

**Purpose**: Unified event format for:
- Mock bridge (development, this session)
- Serial bridge (real hardware, future)
- WebSocket clients (UI dashboard)
- Test runners (vector tests, proof verification)

The bridge exposes:
- HTTP API (`/api/health`, `/api/devices`, `/api/io`)
- WebSocket stream (`ws://localhost:4243`)
- Event-driven architecture (immutable event schema)

---

## HTTP API

### `GET /api/health`
System status.
```json
{
  "status": "ok",
  "version": "0.1.0",
  "backend": "uart" | "simulator" | "jtag",
  "device": {
    "connected": boolean,
    "board": "Basys3" | null,
    "port": "COM5" | "simulator-1" | null
  }
}
```

### `GET /api/devices`
List available boards.
```json
{
  "devices": [
    {
      "id": "ftdi-1234-5678",
      "name": "Basys3 FPGA",
      "board": "Basys3",
      "backend": "uart",
      "port": "COM5",
      "manufacturer": "Digilent",
      "serialNumber": "123456",
      "detected_via": "VID_0403 (FTDI)"
    },
    {
      "id": "simulator-default",
      "name": "Simulated Basys3",
      "board": "Basys3",
      "backend": "simulator",
      "port": "sim://default",
      "detected_via": "environment"
    }
  ]
}
```

### `POST /api/connect`
Connect to a device by ID.
```bash
curl -X POST http://localhost:4242/api/connect \
  -H "Content-Type: application/json" \
  -d '{"id": "ftdi-1234-5678"}'
```

Response:
```json
{
  "success": true,
  "device": {
    "id": "ftdi-1234-5678",
    "name": "Basys3 FPGA",
    "board": "Basys3",
    "contract": {
      "protocol": "UART",
      "baudrate": 115200,
      "format": "RB1",
      "io": {
        "inputs": {"SW": 16, "BTN": 5},
        "outputs": {"LED": 16}
      }
    }
  }
}
```

### `POST /api/disconnect`
Disconnect current device.
```bash
curl -X POST http://localhost:4242/api/disconnect
```

### `POST /api/io/{type}/{index}`
Inject input (for simulator or testing).
```bash
# Toggle switch 3
curl -X POST http://localhost:4242/api/io/switch/3 \
  -H "Content-Type: application/json" \
  -d '{"value": 1}'

# Press button (BTNC)
curl -X POST http://localhost:4242/api/io/button/0 \
  -H "Content-Type: application/json" \
  -d '{"value": 1}'
```

Response:
```json
{
  "success": true,
  "type": "switch",
  "index": 3,
  "value": 1
}
```

---

## WebSocket Event Stream

**Connection**: `ws://localhost:4243`

All messages are JSON objects with `type` field:

### `device:connected`
Device connected and ready.
```json
{
  "type": "device:connected",
  "timestamp": 1737000000000,
  "device": {
    "id": "ftdi-1234-5678",
    "name": "Basys3 FPGA",
    "board": "Basys3",
    "backend": "uart",
    "port": "COM5",
    "serialNumber": "123456",
    "contract": {
      "protocol": "UART",
      "baudrate": 115200,
      "format": "RB1",
      "io": {
        "inputs": {"SW": 16, "BTN": 5},
        "outputs": {"LED": 16}
      }
    }
  }
}
```

### `device:disconnected`
Device disconnected or error.
```json
{
  "type": "device:disconnected",
  "timestamp": 1737000000000,
  "reason": "user_disconnect" | "error" | "reconnect",
  "error": null | "Port not found"
}
```

### `io:update`
I/O state changed (inputs or outputs).
```json
{
  "type": "io:update",
  "timestamp": 1737000000000,
  "source": "device" | "user_input",
  "changes": {
    "SW": "0000000010110011",
    "BTN": "00101",
    "LED": "0000000010110011"
  },
  "tick": 1234
}
```

### `uart:rx`
Raw UART message received from device.
```json
{
  "type": "uart:rx",
  "timestamp": 1737000000000,
  "raw": "RB1 SW=0000000010110011 BTN=00101 LED=0000000010110011 TICK=1234",
  "parsed": {
    "format": "RB1",
    "SW": "0000000010110011",
    "BTN": "00101",
    "LED": "0000000010110011",
    "TICK": 1234
  }
}
```

### `uart:tx`
Raw UART message sent to device.
```json
{
  "type": "uart:tx",
  "timestamp": 1737000000000,
  "raw": "PROG:ADDR=0x1000 DATA=0xFF"
}
```

### `sample:frame`
Waveform/logic analyzer sample (future JTAG/advanced).
```json
{
  "type": "sample:frame",
  "timestamp": 1737000000000,
  "tick": 1234,
  "sample_rate": 100000000,
  "duration_ns": 10000,
  "signals": {
    "CLK": [0, 1, 0, 1, 0, 1],
    "SW": ["0000000010110011", "0000000010110011"],
    "LED": ["0000000010110011", "0000000010110011"]
  }
}
```

### `proof:capsule`
Session proof bundle ready for export.
```json
{
  "type": "proof:capsule",
  "timestamp": 1737000000000,
  "session_id": "sess-2026-01-15-abc123",
  "hash": "sha256:...",
  "device_snapshot": {
    "id": "ftdi-1234-5678",
    "name": "Basys3 FPGA",
    "board": "Basys3",
    "serialNumber": "123456"
  },
  "event_count": 1234,
  "start_time": 1737000000000,
  "end_time": 1737001000000,
  "duration_ms": 1000,
  "io_events": 234,
  "uart_events": 234,
  "sample_frames": 0,
  "bundle_url": "/api/proof/sess-2026-01-15-abc123.json"
}
```

### `error:*`
Generic error from bridge.
```json
{
  "type": "error:port_not_found",
  "timestamp": 1737000000000,
  "message": "COM5 not found"
}
```

---

## Board Contract (`boards/basys3.json`)

Every board declares how to detect it and what it speaks:

```json
{
  "name": "Basys3",
  "manufacturer": "Digilent",
  "fpga": "Xilinx Artix-7 XC7A35T",
  "detection": {
    "vid_pid": ["0403:6010"],
    "manufacturer_string": ["Digilent", "FTDI"],
    "friendly_name_contains": ["Basys3", "Digilent"],
    "pnp_device_id_pattern": ".*FTDI.*"
  },
  "protocols": ["UART"],
  "uart": {
    "baudrate": 115200,
    "format": "RB1",
    "message_schema": "RB1 SW=<16bit> BTN=<5bit> LED=<16bit> TICK=<counter>"
  },
  "io": {
    "inputs": {
      "SW": {"count": 16, "type": "switch", "labels": ["SW0", "SW1", "...", "SW15"]},
      "BTN": {"count": 5, "type": "button", "labels": ["BTNC", "BTNU", "BTND", "BTNL", "BTNR"]}
    },
    "outputs": {
      "LED": {"count": 16, "type": "led", "labels": ["LD0", "LD1", "...", "LD15"]},
      "SEG": {"count": 4, "type": "7segment"}
    }
  },
  "clocks": {
    "main": {"freq_mhz": 100, "name": "CLK100MHZ"}
  },
  "features": ["UART", "GPIO", "7-segment display", "VGA", "PMOD headers"]
}
```

---

## TICK Semantics (State Counter)

**Purpose**: Monotonic counter for tracking sequential state updates.

**Contract** (frozen for replay compatibility):
- **Initial Value**: TICK starts at `0` (before first observation)
- **Increment Timing**: TICK increments **after** each `io:update` event observation
- **Observable State**: TICK is part of every `io:update` event payload
- **Persistence**: TICK never resets during a session (monotonically increasing)
- **Type**: Integer (parsed as decimal string in protocol, transmitted as number in events)

**Example Sequence**:
```javascript
// Initial state: TICK = 0
applyInputs(SW=0, BTN=0);
emitIoUpdateEvent(); // {TICK: "0", SW: "...", LED: "...", BTN: "..."}
// After observation: TICK increments to 1

applyInputs(SW=1, BTN=0);
emitIoUpdateEvent(); // {TICK: "1", SW: "...", LED: "...", BTN: "..."}
// After observation: TICK increments to 2
```

**Why This Matters**:
- Test vectors must expect TICK=0 for first vector, TICK=1 for second, etc.
- Proof capsules can verify event sequence correctness via TICK
- Replay validation checks TICK monotonicity (never decreases, no gaps)
- Counter DUT mode uses TICK as observable state (LED = TICK value)

**Implementation Note**: Changing TICK semantics breaks replay compatibility.

---

## Event Replay

If the UI captures events, it can reconstruct the entire hardware session:

```json
{
  "session_id": "sess-2026-01-15-abc123",
  "device": "Basys3",
  "events": [
    {"type": "device:connected", "timestamp": 1737000000000, ...},
    {"type": "io:update", "timestamp": 1737000000100, "changes": {"SW": "0000000000000001"}, "tick": 0},
    {"type": "io:update", "timestamp": 1737000000200, "changes": {"LED": "0000000000000001"}, "tick": 1},
    {"type": "io:update", "timestamp": 1737000000300, "changes": {"SW": "0000000000000011"}, "tick": 2},
    {"type": "io:update", "timestamp": 1737000000400, "changes": {"LED": "0000000000000011"}, "tick": 3},
    {"type": "device:disconnected", "timestamp": 1737000001000, ...}
  ]
}
```

UI can:
- **Replay** the exact sequence at original speed
- **Analyze** each change (expected vs actual)
- **Export** as lab evidence (hashed, timestamped)
- **Compare** against "reference" runs from instructor

---

## Backend Interchangeability

Same contract, different backends:

| Backend | Source | Auto-Detect | Connection |
|---------|--------|------------|------------|
| **uart** | Real serial port | VID/PID scoring | COM port |
| **simulator** | Generated events | Environment var | `sim://default` |
| **jtag** | JTAG probe (future) | JTAG device IDs | JTAG adapter |
| **remote** | Ethernet lab (future) | mDNS discovery | TCP socket |

UI doesn't care which backend is active — same WS stream, same events.

---

## Implementation Checklist

- [ ] Bridge core supports multi-backend (UART, simulator pluggable)
- [ ] Board contracts loaded from JSON
- [ ] HTTP API fully implements contract
- [ ] WebSocket events match schema exactly
- [ ] Simulator backend (rb-fpga-sim) implements same contract
- [ ] RedByte Hardware Panel connects and renders all events
- [ ] Proof capsule export (hashing + session JSON)
- [ ] Event replay in UI
