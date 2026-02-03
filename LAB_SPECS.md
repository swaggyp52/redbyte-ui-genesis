# LAB_SPECS.md

## Lab Specifications in RedByte

Lab specifications ("lab specs") define what a given lab assignment expects from student evidence. They provide **guidance for instructors and graders**—not automation or enforcement.

---

## Philosophy: Guidance, Not Automation

- **Lab specs are for human graders.**
- They highlight missing or incomplete evidence, but never block grading or export.
- No auto-grading, no rubric logic, no LMS integration.
- Evidence remains the source of truth; lab specs are optional overlays.

---

## Lab Spec Schema (v1)

A minimal, extensible JSON format. Only `labId` is required; all other fields are optional.

```json
{
  "labId": "lab1-dff",            // required, unique identifier
  "title": "D Flip-Flop Timing",  // optional, human-readable
  "requiredExampleId": "11_d-flipflop", // optional, match against evidence
  "requirements": {
    "probes": ["clk", "Q"],      // optional, required probe names
    "minTicks": 20                // optional, minimum tick/sample count
  },
  "notes": "Students should demonstrate clocked storage behavior." // optional
}
```

### Field Reference
- `labId` (string, required): Unique identifier for the lab.
- `title` (string, optional): Human-readable title.
- `requiredExampleId` (string, optional): Example/circuit ID to match.
- `requirements` (object, optional):
  - `probes` (string[], optional): List of required probe names.
  - `minTicks` (number, optional): Minimum number of ticks/samples.
- `notes` (string, optional): Freeform notes for graders.

---

## What Is Validated

- **Probes:** Each required probe is checked for presence in the evidence.
- **Ticks:** Evidence is checked for minimum tick/sample count.
- **Example ID:** If specified, evidence is checked for matching exampleId.

Validation results are shown as:
- ✅ Met
- ❌ Missing/insufficient
- ⚠️ Not checked (if not specified in spec)

---

## What Is Not Validated

- No signal value checking
- No waveform or logic analysis
- No auto-grading or scoring
- No student-side enforcement
- No simulation re-runs
- No LMS or rubric integration

---

## Example `labspec.json`

```json
{
  "labId": "lab1-dff",
  "title": "D Flip-Flop Timing",
  "requiredExampleId": "11_d-flipflop",
  "requirements": {
    "probes": ["clk", "Q"],
    "minTicks": 20
  },
  "notes": "Students should demonstrate clocked storage behavior."
}
```

---

## Usage Workflow

1. **Instructor/TA loads a `.labspec.json`** in the Evidence Viewer.
2. Validation results appear in the "Lab Requirements" panel.
3. Grading is always possible, regardless of validation status.
4. Lab specs are optional and backward compatible—older evidence loads with no errors.

---

## Versioning
- This is Lab Spec Schema v1. Future versions may add fields, but will remain backward compatible and non-enforcing.

---

## Hardware Deployment (FPGA/Arduino)

**PHASE 1 Task 1.7: Lab Setup Documentation**

RedByte supports deploying student circuits to physical hardware:
- **Basys 3 FPGA** (Xilinx Artix-7)
- **Arduino Uno** (ATmega328P)

This section covers hardware setup, deployment workflow, and troubleshooting.

---

### Prerequisites (One-Time Setup)

#### 1. Install Vivado Design Suite (for Basys 3)

**Required for:**
- FPGA synthesis and bitstream generation
- Programming Basys 3 boards via USB-JTAG

**Installation:**
1. Download Vivado ML Edition (free) from Xilinx/AMD website
2. Install with "Vivado" option (not Vitis)
3. Select Artix-7 device support during installation
4. Verify installation:
   ```powershell
   vivado -version
   ```
5. Set `VIVADO_PATH` environment variable (if not in PATH):
   ```powershell
   $env:VIVADO_PATH = "C:\Xilinx\Vivado\2023.2\bin"
   ```

**Note:** Vivado is ~40GB installed. Allow 2-3 hours for download and installation.

#### 2. Install USB Drivers

**Basys 3 FPGA:**
- Download Digilent Adept USB drivers from digilent.com
- Connect Basys 3 via USB
- Windows should auto-detect as "Digilent USB Device"
- Verify in Device Manager: "Universal Serial Bus devices" → "Digilent USB Device"

**Arduino Uno:**
- Official boards: Windows auto-installs drivers
- Clone boards (CH340 chipset): Download CH340 drivers from manufacturer
- Verify in Device Manager: "Ports (COM & LPT)" → "Arduino Uno (COMx)"

#### 3. Install RedByte Bridge Agent

The bridge agent handles hardware communication between RedByte and physical devices.

**Install:**
```powershell
cd packages/rb-fpga-bridge
pnpm install
```

**Start bridge:**
```powershell
pnpm bridge:start
```

**Verify:**
- Bridge runs on http://localhost:3100
- Check health: http://localhost:3100/health
- Should return `{"ok":true,"status":"online","version":"1.0.0"}`

#### 4. Configure Hardware Detection

**Optional environment variables:**
- `RB_FPGA_CABLE`: Specify JTAG cable target (default: auto-detect)
- `RB_FPGA_DEVICE`: Specify FPGA device (default: xc7a35t_0)
- `RB_FPGA_DRYRUN`: Set to "1" for testing without hardware

**Example:**
```powershell
$env:RB_FPGA_CABLE = "Digilent/210308A5A4C1"
$env:RB_FPGA_DEVICE = "xc7a35t_0"
```

---

### Deployment Workflow: Deploy to Basys 3

**Step 1: Design Circuit**
1. Open Logic Playground or Virtual Lab
2. Build circuit using logic gates, flip-flops, etc.
3. Define I/O mappings (switches → inputs, LEDs → outputs)
4. Test in simulation mode

**Step 2: Export Verilog**
1. Click **"Export Verilog"** in toolbar
2. RedByte generates:
   - `design.v` (Verilog HDL)
   - `constraints.xdc` (Pin mappings for Basys 3)
3. Validation runs automatically:
   - Syntax checking
   - Signal matching (Verilog ↔ constraints)
   - Readiness score (0-100%)
4. Download `.v` and `.xdc` files if synthesis-ready

**Step 3: Synthesize Bitstream**
1. Click **"Build Bitstream"** button
2. RedByte invokes Vivado in batch mode:
   - Synthesis: Logic optimization (~30-60 seconds)
   - Implementation: Place & route (~30-60 seconds)
   - Bitstream generation: Creates `.bit` file (~5 seconds)
3. Progress dialog shows:
   - "Generating Verilog..." → "Synthesizing..." → "Implementing..." → "Success!"
4. Bitstream stored in project artifacts

**Step 4: Program FPGA**
1. Connect Basys 3 via USB (power switch ON)
2. Verify connection in Hardware Panel:
   - Bridge: ONLINE (green)
   - Basys 3: "Not connected" → Click **"Connect COM7"**
3. Click **"Program Board"** button
4. RedByte programs FPGA via Vivado:
   - Progress: "Programming Board..." (~10 seconds)
   - Success: "FPGA programmed successfully!"
5. Test with physical switches/LEDs on Basys 3

**Hardware Mode:**
- After programming, circuit runs natively on FPGA
- RedByte can monitor switch states and LED outputs via bridge
- Toggle **SIM/HW** mode in Hardware Panel to switch between simulation and live board

---

### Deployment Workflow: Arduino Uno

**Step 1: Upload Firmware**
1. Open Hardware Panel
2. Connect Arduino Uno via USB
3. Verify detection:
   - Device list shows: "Arduino Uno on COM3"
4. Click **"Upload Firmware"** button
5. RedByte uploads default I/O protocol firmware:
   - Compiles with arduino-cli
   - Flashes via USB (~5 seconds)
   - Arduino reboots with RedByte firmware

**Step 2: Live Control**
1. After firmware upload, Arduino enters "Live" mode
2. RedByte can:
   - Set digital outputs (D2-D13)
   - Read digital inputs (D2-D13)
   - Read analog inputs (A0-A5)
3. Commands sent over serial at 115200 baud:
   - `GET` - Read pin states
   - `SET <pin> <value>` - Set output
   - `PIN <pin> <mode>` - Configure mode

**Integration with Virtual Lab:**
- Arduino node spawns automatically in 3D scene
- Connect wires from breadboard to Arduino pins
- Simulation drives real Arduino outputs
- Physical Arduino inputs feed back to simulation

---

### Troubleshooting Guide

#### Bridge Not Connecting

**Symptom:** Connection panel shows "Bridge: OFFLINE"

**Causes:**
- Bridge agent not running
- Firewall blocking localhost:3100
- Port conflict (another service on 3100)

**Solutions:**
1. Start bridge agent: `pnpm bridge:start`
2. Check process: `Get-Process node | Where-Object { $_.Path -like '*rb-fpga-bridge*' }`
3. Kill conflicting process: `Stop-Process -Id <PID>`
4. Try alternate port: `$env:PORT=3101; pnpm bridge:start`

#### Device Not Found

**Symptom:** "Device not found" error when connecting

**Causes:**
- USB cable not connected
- Device powered off
- Driver not installed
- Wrong COM port specified

**Solutions:**
1. Check USB connection (try different cable/port)
2. Verify power: Basys 3 power switch ON, Arduino LED lit
3. Check Device Manager:
   - Basys 3: Should appear under "Universal Serial Bus devices"
   - Arduino: Should appear under "Ports (COM & LPT)"
4. Auto-detect port: Remove hardcoded COM port, let bridge auto-select
5. Reinstall drivers (see Prerequisites)

#### Vivado Not Found

**Symptom:** "Vivado not found" error during synthesis

**Causes:**
- Vivado not installed
- Vivado not in PATH
- Incorrect VIVADO_PATH variable

**Solutions:**
1. Verify installation: `vivado -version`
2. Set VIVADO_PATH:
   ```powershell
   $env:VIVADO_PATH = "C:\Xilinx\Vivado\2023.2\bin"
   ```
3. Add to system PATH permanently (Control Panel → Environment Variables)
4. Restart terminal after PATH changes

#### Synthesis Fails

**Symptom:** "Synthesis failed" error, log shows Verilog errors

**Causes:**
- Invalid Verilog syntax
- Unconnected signals
- Constraint file mismatch (signal names don't match)

**Solutions:**
1. Check validation before export:
   - Readiness score should be 90-100%
   - All warnings addressed
2. Review error log in `.redbyte/tmp/vivado/program.log`
3. Common fixes:
   - Unused inputs: Connect to ground or comment out in constraints
   - Multiple drivers: Check for signal conflicts
   - Timing violations: Simplify circuit or reduce clock speed

#### Programming Timeout

**Symptom:** "Connection timeout" when programming FPGA

**Causes:**
- JTAG cable not responding
- FPGA in wrong mode (JTAG vs SPI)
- USB hub latency

**Solutions:**
1. Connect Basys 3 directly to PC (bypass USB hub)
2. Set JTAG mode:
   - Basys 3 jumper: JP1 set to JTAG (not QSPI)
3. Power cycle board: Switch OFF → wait 5s → switch ON
4. Try manual programming:
   ```powershell
   vivado -mode batch -source .redbyte/tmp/vivado/program.tcl -tclargs path/to/design.bit
   ```

#### Arduino Not Responding

**Symptom:** Arduino connected but commands timeout

**Causes:**
- Wrong baud rate
- Firmware not flashed
- Serial buffer overflow
- RTS/DTR reset issue

**Solutions:**
1. Re-upload firmware via Hardware Panel
2. Verify baud rate: 115200 (default in RedByte firmware)
3. Press reset button on Arduino
4. Check serial monitor in Arduino IDE:
   - Open Tools → Serial Monitor
   - Set 115200 baud
   - Type `PING` → Should respond `PONG`
5. If still unresponsive, flash factory bootloader

#### Port Already in Use

**Symptom:** "Port already in use" error

**Causes:**
- Arduino IDE open with serial monitor
- PuTTY/screen connected to port
- Previous RedByte session didn't release port

**Solutions:**
1. Close Arduino IDE serial monitor
2. Close terminal programs (PuTTY, screen, etc.)
3. Restart bridge agent
4. If stuck, reboot PC (releases all COM ports)

---

### Best Practices

**For Students:**
- Always test in simulation before deploying to hardware
- Save project before programming (in case of power loss)
- Disconnect hardware when not in use (preserve USB ports)
- Export evidence after successful hardware verification

**For Instructors:**
- Provide pre-validated example circuits for hardware labs
- Test entire workflow on lab machines before class
- Keep spare USB cables (common failure point)
- Document COM port assignments (post on lab wall)
- Have Arduino IDE installed as backup for firmware recovery

**For Lab Admins:**
- Image lab machines with all drivers pre-installed
- Create startup script that launches bridge agent automatically
- Use USB extension cables to prevent board damage from drops
- Label each workstation with assigned COM ports
- Keep firmware/.bit backup files for quick recovery

---

### Hardware Lab Examples

**Example 1: 4-Bit Binary Counter on Basys 3**
- Use example #16: `16_8bit-counter-basys3.json`
- Maps clock → SW0, outputs → LD0-LD3
- Students observe counting on LEDs

**Example 2: Traffic Light FSM**
- Use example #17: `17_traffic-light-fsm-basys3.json`
- 3-state FSM with timer
- Deploy to Basys 3, test state transitions with physical switches

**Example 3: Arduino Blink Test**
- Upload firmware to Arduino Uno
- Send command: `SET 13 1` (LED on)
- Send command: `SET 13 0` (LED off)
- Verifies serial communication working

---

### Environment Variable Reference

| Variable | Purpose | Default | Example |
|----------|---------|---------|---------|
| `VIVADO_PATH` | Path to Vivado bin directory | Auto-detect | `C:\Xilinx\Vivado\2023.2\bin` |
| `RB_FPGA_CABLE` | JTAG cable identifier | Auto-detect | `Digilent/210308A5A4C1` |
| `RB_FPGA_DEVICE` | Target FPGA device | `xc7a35t_0` | `xc7a35t_0` |
| `RB_FPGA_DRYRUN` | Test mode (no hardware) | `0` | `1` |
| `PORT` | Bridge agent port | `3100` | `3101` |

---

### Dry Run Mode (Testing Without Hardware)

For testing or grading without physical hardware:

```powershell
$env:RB_FPGA_DRYRUN = "1"
pnpm bridge:start
```

**In dry run mode:**
- Vivado commands logged but not executed
- Programming succeeds instantly (fake success)
- Useful for verifying workflow without hardware
- Logs written to `.redbyte/tmp/vivado/program.log`

---

### Additional Resources

- **Basys 3 Reference Manual:** digilent.com/reference/basys3
- **Vivado Documentation:** xilinx.com/support/documentation
- **Arduino Reference:** arduino.cc/reference
- **RedByte Firmware Protocol:** `packages/rb-fpga-bridge/src/arduino/firmware/README.md`
- **FPGA Validation Guide:** `docs/fpga-validation-guide.md`

