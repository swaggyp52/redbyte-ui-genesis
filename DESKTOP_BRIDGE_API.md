# Desktop Bridge API Contract

**Version:** 1.0  
**Purpose:** Stable HTTP interface between browser-based lab UI and physical FPGA boards  
**Transport:** HTTP/1.1 over localhost (127.0.0.1)  
**Default Port:** 3002

---

## Overview

The Desktop Bridge is a local HTTP server that runs on the student's lab desktop. It provides a stable interface for:
- Detecting FPGA board connection status
- Capturing I/O snapshots from connected boards
- (Future) Programming bitstreams
- (Future) Live I/O streaming

This architecture separates the web UI from hardware-specific tooling (OpenOCD, Vivado, openFPGALoader, etc.), allowing the bridge to evolve independently.

---

## Endpoints

### `GET /board/status`

**Purpose:** Check if an FPGA board is currently connected and detected.

**Response:** `200 OK`
```json
{
  "connected": true,
  "model": "Basys3",
  "serial": "210319AB1234",
  "timestamp": "2026-01-18T14:23:45.123Z"
}
```

**Fields:**
- `connected` (boolean, required): `true` if board detected, `false` otherwise
- `model` (string, optional): Board model identifier (e.g., "Basys3", "Nexys4-DDR", "Arty-A7")
- `serial` (string, optional): Board serial number if available
- `timestamp` (string, required): ISO 8601 timestamp of when status was determined

**Timing:**
- Must respond within **500ms** or less
- Browser polls this endpoint every **2 seconds**

**Error Responses:**
- `500 Internal Server Error`: Bridge encountered an error (return `{"connected": false}`)
- `503 Service Unavailable`: Bridge is starting up (rare)

---

### `GET /board/snapshot`

**Purpose:** Capture current I/O state of the connected FPGA board.

**Response (board connected):** `200 OK`
```json
{
  "timestamp": "2026-01-18T14:23:45.678Z",
  "inputs": {
    "SW": 5,
    "BTN": 1
  },
  "outputs": {
    "LED": 7,
    "SEG": 63
  },
  "meta": {
    "tool": "openFPGALoader",
    "read_method": "jtag_poll"
  }
}
```

**Fields:**
- `timestamp` (string, required): ISO 8601 timestamp of snapshot capture
- `inputs` (object, required): Map of input signals to integer values
  - Keys are signal names (e.g., "SW", "BTN", "RST")
  - Values are integers representing current state
- `outputs` (object, required): Map of output signals to integer values
  - Keys are signal names (e.g., "LED", "SEG", "RGB")
  - Values are integers representing current state
- `meta` (object, optional): Additional metadata about how snapshot was captured
  - `tool` (string): Tool used for capture
  - `read_method` (string): Method used (e.g., "jtag_poll", "serial_read")

**Response (board NOT connected):** `409 Conflict`
```json
{
  "error": "Board not connected",
  "connected": false
}
```

**Timing:**
- Must respond within **1000ms** or less
- Snapshot capture is user-initiated (not polled automatically)

**Error Responses:**
- `409 Conflict`: No board connected (return `{"connected": false}`)
- `500 Internal Server Error`: Capture failed (return error details)
- `timeout`: Browser times out after 1 second, falls back to manual entry modal

---

## Future Endpoints (Not Yet Implemented)

### `POST /board/program`

**Purpose:** Program a bitstream onto the connected FPGA board.

**Request Body:**
```json
{
  "bitstream": "base64-encoded-bitstream-or-path",
  "format": "bin",
  "verify": true
}
```

**Response:** `200 OK` (after programming completes)
```json
{
  "success": true,
  "duration_ms": 3456,
  "tool": "openFPGALoader",
  "timestamp": "2026-01-18T14:25:00.123Z"
}
```

---

### `GET /board/stream` (WebSocket)

**Purpose:** Real-time I/O updates during lab work (future enhancement for live monitoring).

---

## Implementation Notes

### Current Mock Implementation
- Location: `tools/desktop-bridge.js`
- Behavior: Returns randomized I/O values for testing
- Board always "connected", model="Basys3"

### Production Implementation Guidance
- **OpenOCD**: Shell out to `openocd -c "...read commands..."` for JTAG-based boards
- **Vivado**: Use TCL scripts via `vivado -mode batch -source read_ios.tcl`
- **openFPGALoader**: Use `openFPGALoader --read-register` for supported boards
- **Serial Protocol**: For boards with serial debug interface (e.g., custom UART protocol)

### Error Handling
- If tool invocation fails, return HTTP 500 with error message
- If board disconnects mid-read, return HTTP 409
- If timeout occurs, bridge must still respond (even if data is stale)

### CORS
- Must enable CORS headers for browser requests:
  ```
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, POST, OPTIONS
  Access-Control-Allow-Headers: Content-Type
  ```

---

## Security Considerations

### Localhost-Only Binding
- Bridge MUST bind to `127.0.0.1` only (never `0.0.0.0`)
- This ensures only local browser can access bridge
- No authentication required (localhost trust model)

### Sandboxing (Future)
- Bridge should run with minimal privileges
- No write access to user directories except temp folder
- No network access beyond localhost

---

## Testing

### Unit Tests
- Verify status endpoint returns valid JSON
- Verify snapshot endpoint times out gracefully
- Verify CORS headers are present

### Integration Tests
- Start bridge, poll from browser, verify latency <500ms
- Disconnect board, verify status updates within 2 seconds
- Capture 10 snapshots rapidly, verify no crashes

### Mock Bridge
- Use `tools/desktop-bridge.js` for UI development
- Provides deterministic responses for automated tests

---

## Versioning

**Version Format:** `X.Y`
- **X (major)**: Breaking changes to endpoint contracts
- **Y (minor)**: Backwards-compatible additions (new endpoints, new fields)

**Current Version:** 1.0
- Initial stable contract
- `/board/status` and `/board/snapshot` endpoints
- Future: Add `/board/program` as minor version bump (1.1)

**Breaking Changes Require:**
- Updated bridge implementations
- Updated browser UI expectations
- Migration guide for existing deployments

---

## Reference Implementation

See `tools/desktop-bridge.js` for minimal Node.js mock implementation.

Production bridges should follow this pattern:
1. Start HTTP server on 127.0.0.1:3002
2. Handle OPTIONS for CORS preflight
3. Implement `/board/status` with real detection logic
4. Implement `/board/snapshot` with real I/O read logic
5. Log all requests for debugging
6. Gracefully handle SIGINT/SIGTERM

---

## Contact

For questions about this API contract, see `AI_STATE.md` or `HARDWARE_SESSION_V1_TEST.md`.
