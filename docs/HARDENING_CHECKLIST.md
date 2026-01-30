# RedByte Hardware Hardening Checklist

If the system isn't detecting or connecting to hardware as expected, follow these steps:

### 1. `devices.json` is empty or missing expected boards

- **Symptom**: `curl.exe -s http://127.0.0.1:4242/devices` returns `{"devices": []}`.
- **Fixes**:
  - Check physical connection (USB cable).
  - Ensure the bridge agent is running: `pnpm --filter @redbyte/rb-bridge-agent dev`.
  - Check for permission issues: In Windows, ensure no other serial monitor (Arduino IDE, Vivado) is holding the COM port.
  - Run `scripts/prove_hardware.ps1` to see raw discovery logs.

### 2. "Access Denied" or COM Port Collisions

- **Symptom**: Bridge logs show `Error: Access denied` when opening a port.
- **Fixes**:
  - **Single Bridge Authority**: Ensure only ONE bridge agent is running on port 4242.
  - **Idempotency Check**: Your bridge code must use `backends.get(deviceId)` to reuse sessions.
  - Kill ghost processes: `Get-Process node | Stop-Process -Force`.

### 3. WebSocket Connection Fails

- **Symptom**: UI shows "Offline" but `/health` is OK.
- **Fixes**:
  - Verify the WS path. The bridge and client must agree on `ws://127.0.0.1:4242/ws`.
  - Check browser logs for `SecurityError` (though on localhost this is rare).

### 4. 3D Nodes are Stacked

- **Symptom**: All hardware nodes appear at (0,0,0) and flicker.
- **Fixes**:
  - Ensure `iso-transform.ts` has the grid arrangement logic enabled.
  - Verify that the circuit engine is passing unique node IDs.
