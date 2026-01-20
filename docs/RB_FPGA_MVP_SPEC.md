# RedByte FPGA Bridge + Lab Pipeline

## Deterministic MVP Implementation Specification

**Authoritative Build Contract**

---

## 0. PURPOSE (READ FIRST)

This document defines the **exact, non-negotiable implementation contract** for the RedByte FPGA Bridge MVP and its integration with RedByte OS.

This is **not a proposal**, **not guidance**, and **not optional**.
Codex is expected to **implement exactly what is written here**, preserving determinism, reproducibility, and architectural intent.

RedByte is deterministic by philosophy.
Therefore **the build, the data path, the replay system, and the verification system must also be deterministic**.

---

## 1. SYSTEM OVERVIEW

RedByte FPGA support is composed of **three tightly coupled subsystems**:

1. **RedByte OS (UI + Simulator)**

   * Browser-based (localhost)
   * Deterministic simulation + replay
   * Displays live hardware data
   * Imports/exports RB Zip lab bundles
   * Verifies integrity and signatures

2. **RedByte FPGA Bridge (Node.js local service)**

   * Interfaces with FPGA hardware
   * Programs boards
   * Streams UART telemetry
   * Canonicalizes hardware timing into deterministic events
   * Signs evidence bundles

3. **RB Zip (Lab Evidence Capsule)**

   * Portable, signed, replayable
   * Uploadable to Blackboard
   * Importable by instructors/TA
   * Tamper-evident

---

## 2. HARD CONSTRAINTS (DO NOT VIOLATE)

* Target board: **Digilent Basys 3 (Artix-7)**
* Host OS: **Windows (PowerShell, admin allowed)**
* Bridge language: **Node.js (existing bridge must be enhanced, not rewritten)**
* Hardware telemetry: **USB-UART**
* Programming: **USB-JTAG via Vivado batch**
* Live update latency: **< 1 second end-to-end**
* Protocol: **Binary UART packets with CRC-16**
* Integrity: **Ed25519 signatures**
* Replay: **Deterministic, time-binned**
* Installation: **Single PowerShell bootstrap**
* Versioning: **Pinned, reproducible**
* Philosophy: **No hidden state, no magic**

---

## 3. REPOSITORY STRUCTURE (MANDATORY)

The following structure **must exist**:

```
/packages
  /rb-fpga-bridge
    /src
      index.js
      /parsers
        binary-packet.js
        crc16.js
      /trace
        recorder.js
    package.json

  /rb-fpga-signing
    /src
      index.ts
      keygen.ts
      trusted-keys.ts
    package.json

  /rb-fpga-proof-core
    /src
      replay.ts
      types.ts

  /rb-apps
    /src/utils
      bundleExport.ts

  /rb-fpga-toolchain
    /hdl
      rb_uart_telemetry.v
      rb_crc16.v

/scripts
  bootstrap.ps1
  doctor.ps1

/docs
  VERSIONS.md
  STUDENT_EXPORT_SCHEMA.md
  RB_FPGA_MVP_SPEC.md (this file)
```

---

## 4. PINNED TOOLCHAIN (VERSIONS.md)

Create `VERSIONS.md` with **exact versions**:

* Node.js: **20.19.0**
* pnpm: **10.24.0**
* Vivado: **2024.1**
* @noble/ed25519: pinned exact version
* serialport: pinned
* ws: pinned
* jszip: pinned

No floating ranges.
No `latest`.
No caret (`^`) or tilde (`~`) in package.json.

---

## 5. WINDOWS BOOTSTRAP (bootstrap.ps1)

### Goal

A **single command** installs everything from scratch.

### Entry command students paste:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
iwr -useb https://raw.githubusercontent.com/<ORG>/<REPO>/main/scripts/bootstrap.ps1 | iex
```

### bootstrap.ps1 REQUIREMENTS

* Set strict mode and stop on error
* Detect and install (via winget, fallback to choco):

  * Git
  * Node.js (exact version)
  * pnpm (exact version)
* Verify Vivado installation or print explicit error
* Clone repo at a **pinned tag or commit**
* Run `pnpm install --frozen-lockfile`
* Build all packages
* Print final URL: `http://localhost:<port>`

Must be **idempotent**.

---

## 6. SYSTEM HEALTH CHECK (doctor.ps1)

doctor.ps1 must verify:

* Node version correct
* pnpm version correct
* Git available
* Vivado detected
* USB devices present
* COM ports enumerated
* node_modules present
* Bridge executable runs

Output MUST be human-readable and unambiguous.

---

## 7. UART BINARY PROTOCOL (HARD CONTRACT)

### Packet Size

**Fixed 28 bytes ALWAYS**

No variable-length packets in MVP.

### Layout (Big-Endian everywhere)

| Bytes | Field                                  |
| ----- | -------------------------------------- |
| 0–1   | Magic `0x52 0x42` (“RB”)               |
| 2     | Version `0x01`                         |
| 3     | Flags (reserved, ignored for framing)  |
| 4–7   | Sequence number (uint32 BE, monotonic) |
| 8–9   | Digital signals (uint16 BE, 16 bits)   |
| 10–25 | Analog channels (8 × uint16 BE)        |
| 26–27 | CRC-16-CCITT                           |

### CRC

* Polynomial: **0x1021**
* Initial value: **0xFFFF**
* Computed over bytes 0–25

---

## 8. UART PARSER (Node.js)

### binary-packet.js

* Stream parser
* MUST resynchronize on dropped bytes:

  * Scan for `0x52 0x42`
  * Read 26 more bytes
  * Validate CRC
  * If CRC fails → shift by 1 byte and rescan
* Expose parsed packets as JS objects

### crc16.js

* Pure JS CRC-16-CCITT
* Unit tested against RFC vectors

---

## 9. HDL INSTRUMENTATION CORE

### rb_uart_telemetry.v

* Fixed transmit interval OR on-change + heartbeat
* Packs signals into **exact 28-byte packet**
* Big-endian packing
* Sequence counter increments monotonically
* CRC generated in hardware using `rb_crc16.v`

Students build **on top of this scaffold**.

---

## 10. FPGA BRIDGE (rb-fpga-bridge)

### Responsibilities

* Enumerate COM ports
* Open UART
* Parse binary packets
* Add timestamps
* Canonicalize into deterministic events
* Stream via WebSocket
* Record trace

### Event Augmentation

Each packet becomes:

```json
{
  "hw_tick": 12,
  "mono_seq": 1023,
  "digital": 291,
  "analog": [12, 14, 0, 1023, ...],
  "ts_wall": 1705600000022
}
```

---

## 11. DETERMINISTIC TIME BINNING

### Rule

**Wall time is nondeterministic → convert to deterministic bins**

* Default bin size: **20 ms**
* `hw_tick = floor((ts_wall - t0) / bin_size_ms)`
* Replay uses ONLY `hw_tick` and `mono_seq`
* `ts_wall` is informational only

Same trace + same bin size MUST produce identical replay.

---

## 12. TRACE FORMAT

File: `trace/hw_trace.ndjson`

* One JSON object per line
* Fields:

  * hw_tick
  * mono_seq
  * digital
  * analog[]
  * ts_wall

---

## 13. HARDWARE REPLAY ENGINE

### replay.ts

* Deterministic iterator
* Emits events in hw_tick order
* No timers based on wall clock
* Optional artificial pacing for UI only

Replay must behave identically on all machines.

---

## 14. PROGRAMMING THE BOARD

Bridge must:

* Detect Vivado
* Program `.bit` using batch mode:

  ```
  vivado.bat -mode batch -source program.tcl -tclargs design.bit
  ```
* Provide explicit error messages:

  * Cable not found
  * Board not detected
  * Programming failed

Students **never open Vivado manually**.

---

## 15. RB ZIP FORMAT (v2)

### File Structure

```
<lab>.rb-lab.zip
├── manifest.json
├── trace/
│   └── hw_trace.ndjson
├── bitstream/
│   └── design.bit
├── integrity/
│   ├── capsule.json
│   └── signature.sig
└── meta/
    └── board_profile.json
```

---

## 16. manifest.json (v2)

Must include:

```json
{
  "schema_version": "v2",
  "redbyte_version": "...",
  "lab_id": "...",
  "lab_version": "...",
  "scaffold_hash": "...",
  "board": "basys3",
  "bin_size_ms": 20,
  "trace_summary": {
    "events": 1234,
    "crc_failures": 0
  }
}
```

---

## 17. board_profile.json

Defines meaning of signals:

```json
{
  "board": "basys3",
  "uart_baud": 115200,
  "digital_signals": {
    "0": "SW0",
    "1": "SW1",
    "2": "BTN0"
  },
  "analog_signals": {
    "0": "ComparatorOut",
    "1": "LDR_Level"
  }
}
```

---

## 18. SIGNING & INTEGRITY (Ed25519)

### Signing Flow

1. SHA-256 hash **every file** in the zip
2. Build `capsule.json`:

   ```json
   {
     "algo": "sha256",
     "files": [
       {"path":"manifest.json","hash":"..."},
       ...
     ]
   }
   ```
3. Sort entries lexicographically by path
4. Sign **exact UTF-8 bytes** of capsule.json
5. Store signature in `signature.sig`

### Verification

* Recompute hashes
* Rebuild capsule.json identically
* Verify signature using trusted public keys

Any modification MUST invalidate signature.

---

## 19. KEY MANAGEMENT

* Instructor generates key via `keygen.ts`
* Private key NEVER embedded in app
* Public keys embedded in `trusted-keys.ts`

Students may export **unsigned** bundles; instructor can re-sign.

---

## 20. UI REQUIREMENTS (MINIMUM)

UI must show:

* Board connected / disconnected
* COM port
* Packet rate
* CRC failure count
* Last sequence #
* Last packet age
* Signature status:

  * Valid
  * Invalid
  * Unsigned

No silent failures.

---

## 21. BACKWARDS COMPATIBILITY

* v1 RB Zip imports MUST continue to work
* New exports default to v2

---

## 22. TESTING REQUIREMENTS

Automated tests MUST cover:

* CRC-16 vectors
* Binary parser resync
* Deterministic binning
* Replay determinism
* Signature invalidation on tamper
* Bootstrap idempotency

---

## 23. NON-GOALS (DO NOT IMPLEMENT)

* MHz waveform capture
* JTAG internal probes
* Cloud services
* Online grading
* Vivado GUI workflows

---

## 24. SUCCESS CRITERIA (FINAL)

The MVP is complete ONLY IF:

* A fresh Windows machine can bootstrap in one command
* Basys 3 streams live data < 1s
* RB Zip exports, signs, and verifies
* Same zip replays identically on another machine
* Any tampering is detected
* No nondeterministic behavior exists in replay

---

## END OF CONTRACT

This document is the **source of truth**.
Codex must implement **exactly this**.
