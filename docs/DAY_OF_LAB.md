# Day-Of Lab Guide (Lab-Ready)

This page is the single, lab-day checklist for instructors and TAs. It is optimized to prevent live-lab failures and to match the UI messages students will see.

## Quick Start (Students)

1. Open RedByte OS.
2. If you see a recovery prompt, choose Restore to recover the last session.
3. Open Logic Playground or Virtual Lab from the Launcher.
4. Build or load the circuit for the lab.
5. Use Export or Export Evidence to produce the submission bundle.

## Hardware Connect (Basys3)

1. Start the Bridge Agent on the lab machine.
2. Plug in the Basys3 board via USB.
3. Open Hardware Panel.
4. If Bridge is online, select the Basys3 device and click Connect.
5. Use Deploy to Basys3 when required by the lab.

## Export and Submit

1. Use Export Evidence (Logic Playground) or Export Capsule (Virtual Lab).
2. Confirm download and submit the generated .rb-lab.zip file.
3. If a warning appears, the export still completes and includes warnings.json.

## Troubleshooting (UI Message Match)

Each section title matches the exact UI text.

### "Bridge offline"
- Cause: Bridge Agent not running or blocked.
- Fix: Start the Bridge Agent, then click Refresh Devices.

### "No devices detected."
- Cause: Board not connected or driver missing.
- Fix: Reseat USB, verify drivers, and retry.

### "Safe Mode Active"
- Cause: Safe Mode is enabled (stability mode).
- Fix: Disable Safe Mode from the top toolbar to restore full features.

### "Safe Mode is enabled"
- Cause: Hardware is disabled by Safe Mode.
- Fix: Turn off Safe Mode, then reconnect hardware.

### "Device not found"
- Cause: Target device not visible to the bridge.
- Fix: Check USB connection, verify the correct board, then refresh.

### "Connection timed out"
- Cause: Bridge handshake failed or the port is busy.
- Fix: Restart the Bridge Agent and reconnect the device.

### "Port already in use"
- Cause: Another app is using the board serial port.
- Fix: Close other serial tools and retry.

### "Export failed"
- Cause: A serialization step failed.
- Fix: Export is still completed with warnings.json. Submit the recovery bundle.

### "Recover unsaved work?"
- Cause: The previous session ended unexpectedly.
- Fix: Click Recover to restore the last autosave snapshot.

## TA Checklist (10 seconds)

1. Open Status Panel.
2. Confirm:
   - Project loaded
   - Last autosave timestamp
   - Export readiness
   - Hardware connection status
   - Active warnings/errors

If all are green, the student is safe to continue.
