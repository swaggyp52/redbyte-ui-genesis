# RedByte Demo Environment Specification

**Target**: Classroom 304 Podium PC / Instructor Laptop
**Status**: LOCKED for Demo v1

## 1. System Specifications

- **OS**: Windows 10/11 (64-bit)
- **Browser**: Google Chrome (Latest) OR Microsoft Edge (Chromium)
  - *Firefox is supported but Chrome is preferred for WebSerial stability during demos.*
- **Screen Resolution**: 1920x1080 (Projector standard)
  - *App scaling is optimized for 1080p.*

## 2. Hardware Manifest

- **FPGA Board**: Digilent Basys 3 (Artix-7)
- **Bridge Core**: `top.bit` (v1.0 Release) must be flashed to NVRAM.
- **Connection**: USB Micro-B to USB-A.
  - *Use a known good data cable. Many "charge only" cables look identical.*

## 3. Pre-Flight Checks (Run 10 mins before class)

1. **Bridge Agent**: Ensure `rb-bridge-agent.exe` is running in tray.
    - Status should be "Listening on localhost:3000".
2. **USB Port**: Connect Basys 3.
    - Verify Windows plays "Device Connected" sound.
    - Verify Bridge Agent logs display "Device connected: COMx".
3. **Browser**:
    - Clear cache if updating version.
    - Open `https://redbyte.os/students` (or local file path).

## 4. Known Quirks & Safety Nets

- **USB Sleep**: If board disconnects after 5 mins of idle, unplug/replug. Bridge will auto-reconnect.
- **Projector Scaling**: If UI looks huge, use `Ctrl -` to zoom out to 80% or 90%.
- **Bailout**: If Hardware fails (e.g., bad cable), **Switch to Simulation immediately**.
  - Say: "We'll continue in Simulation Mode, which is bit-exact to the hardware."
