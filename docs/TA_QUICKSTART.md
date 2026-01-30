# RedByte OS Genesis — TA Quickstart Guide

## What is RedByte?

RedByte OS Genesis is a browser-based operating system for digital logic education. Students build circuits in a 3D lab, run simulations, connect to physical hardware (Arduino/FPGA), and submit evidence bundles for grading.

## Architecture at a Glance

```
┌─────────────────────────────────────────────────┐
│  rb-shell (Window Manager)                      │
│  ┌─────────┐ ┌─────────┐ ┌──────────────────┐  │
│  │ Launcher │ │  Files  │ │  Virtual Lab     │  │
│  └─────────┘ └─────────┘ │  (3D + Grading)  │  │
│  ┌─────────┐ ┌─────────┐ └──────────────────┘  │
│  │ Logic   │ │Inspector│ ┌──────────────────┐  │
│  │Playgnd  │ │         │ │  Hardware Panel  │  │
│  └─────────┘ └─────────┘ └──────────────────┘  │
├─────────────────────────────────────────────────┤
│  rb-logic-3d  │  rb-logic-core  │  rb-protocol │
│  (3D sim)     │  (2D sim)       │  (bridge msg)│
├─────────────────────────────────────────────────┤
│  rb-bridge-agent (localhost:4242)               │
│  Serial ↔ Arduino/Basys3                        │
└─────────────────────────────────────────────────┘
```

## Running Locally

```bash
# Install dependencies
pnpm install

# Start the dev server
pnpm dev

# Start the hardware bridge (only if grading hardware labs)
cd packages/rb-bridge-agent && pnpm dev
```

The app opens at `http://localhost:5173`.

## Student Workflow (Lab 0)

1. Student opens **Virtual Lab** from the Launcher
2. Selects **Lab 0: Hardware Proof** template
3. Enters their name and student ID
4. Follows guided steps: place parts → wire circuit → run simulation
5. Lab evaluator runs behavior checks automatically
6. Student clicks **Export Evidence** → downloads `.rb-lab.zip`
7. TA opens **Submission Inspector** → imports the `.rb-lab.zip`

## Grading a Submission

### Using the Submission Inspector

1. Open the **Submission Inspector** app from the Launcher
2. Drop the student's `.rb-lab.zip` file onto the drop zone (or click Browse)
3. Review the **Summary** tab:
   - Lab ID, student name, creation timestamp
   - Self-Check Summary: passed/failed/total checks with score
   - Lab Progress: completed steps, pass/fail verdict
   - Circuit Snapshot: node count, wire count, simulation tick
   - Integrity Hash (SHA-256)
4. Review the **Vectors** tab for individual check results
5. Review the **Events** tab for hardware trace data (if present)
6. Click **Export Grading Report** for a JSON artifact

### What's in the ZIP?

```
submission.rb-lab.zip
├── manifest.json              # Lab ID, student, schema version
├── proofs/
│   ├── capsule.json           # Evidence capsule with checks + summary
│   ├── events.ndjson          # Hardware trace (if bridge was used)
│   └── circuit_snapshot.json  # Full circuit graph at export time
```

### Checking for Integrity

- The capsule includes an `evidenceHash` (SHA-256 when available)
- The inspector verifies this hash on import
- If `summary.all_passed` is `true` and the hash matches, the submission is valid

## Hardware Lab Grading

For labs that require physical hardware:

1. Student connects Arduino/Basys3 via USB
2. Bridge agent must be running (`pnpm dev` in `rb-bridge-agent`)
3. Student's Hardware Panel shows device verification status
4. The `meta.hardware.verified` field in the capsule indicates whether a real device handshake occurred
5. Hardware trace events (`proofs/events.ndjson`) contain timestamped I/O snapshots

## Common Issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Inspector shows "Failed to parse bundle" | Wrong file format | Ensure file is `.rb-lab.zip`, not `.json` |
| No vectors in submission | Student exported before running simulation | Ask student to re-run and re-export |
| `meta.hardware.verified: false` | Student used simulation mode | Check if hardware was required for the lab |
| Bridge shows "offline" | Bridge agent not running | Run `pnpm dev` in `rb-bridge-agent` |
| Score is 0% | No behavior checks passed | Review circuit snapshot for wiring errors |

## Key Zustand Stores

| Store | Package | Purpose |
|-------|---------|---------|
| `useLabStore` | `rb-logic-3d` | 3D lab graph, simulation, transport |
| `useLabStore` (pedagogical) | `rb-apps/labs` | Lab steps, student info, completion |
| `useRunRecorderStore` | `rb-apps` | Recording/replay/verification |
| `useHardwareStore` | `rb-apps` | Hardware connection, I/O traces |
| `useWindowStore` | `rb-shell` | Window management |
| `useFileSystemStore` | `rb-apps` | Virtual filesystem |

## File Locations

| What | Where |
|------|-------|
| Lab templates | `packages/rb-apps/src/apps/virtual-lab-templates.ts` |
| Evidence export | `packages/rb-apps/src/utils/evidenceExport.ts` |
| Submission inspector | `packages/rb-apps/src/apps/SubmissionInspectorApp.tsx` |
| Lab evaluator | `packages/rb-logic-3d/src/lab-model/labEvaluator.ts` |
| Bridge agent | `packages/rb-bridge-agent/src/index.ts` |
| Bridge protocol | `packages/rb-protocol/src/bridge.ts` |
