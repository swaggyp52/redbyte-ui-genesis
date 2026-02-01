# RedByte Project Format — Lab-Ready Spec

Copyright © 2025 Connor Angiel — RedByte OS Genesis

## Authority

This document specifies the canonical portable project format for RedByte.
All import/export operations MUST conform to this specification.

---

## Current State Analysis

### Existing Export/Import Infrastructure

**Found:**
1. **Evidence Capsule System** (`rb-lab-engine/src/services/exportService.ts`)
   - Exports: `.rb-lab.zip` containing:
     - `capsule.json` (index with SHA-256 hashes)
     - `project.json` (LabProjectV1)
     - `actions.log.json` (action log)
     - `manifest.json` (integrity manifest)
   - Imports with cryptographic verification
   - Already uses deterministic hashing

2. **LabProjectV1 Schema** (`rb-utils/src/labProjectSchema.ts`)
   - Circuit (nodes, connections, custom chips)
   - Simulation state (tick rate, probes, breakpoints)
   - Board mapping (pin maps, virtual IO state)
   - Evidence (actions, snapshots, manifest)
   - Lab spec (checkpoints, templates)

3. **Legacy Evidence Export** (`rb-apps/src/utils/evidenceExport.ts`)
   - Older format, still in use
   - Includes hardware trace, student metadata
   - Less comprehensive than lab-engine version

4. **Proof Pack System** (`rb-apps` LogicPlaygroundApp)
   - Run recordings with circuit snapshots
   - Used for deterministic replay
   - Separate from project exports

### What Exists ✓

- Versioned schema (LabProjectV1)
- Deterministic serialization (stable key sorting + SHA-256)
- Action log (append-only, versioned actions)
- Sparse snapshots (checkpoints only)
- Board mapping (pin maps, virtual IO)
- Import/export with integrity verification

### What's Missing ✗

1. **Cross-App Fidelity**
   - Logic Playground, Lab, and Virtual Lab have separate state
   - No unified "current project" that all apps render
   - Exports are Lab-specific, not universal

2. **Examples System**
   - No examples registry
   - No "Open Example" UI
   - No bundled example projects

3. **Reproducibility Verification**
   - Import works, but no "verify reproducibility" command
   - No automated replay verification
   - No cross-machine validation test

4. **Complete IO Mapping**
   - Board mapping exists but not shared across all apps
   - 2D Lab doesn't have universal IO panel
   - Virtual Lab 3D and 2D Lab IO not synchronized

5. **Migration System**
   - Schema versioning exists but no migration functions
   - No forward-compatibility warnings

---

## Canonical Project Container Spec

### File Name Convention

```
<project-name>-<timestamp>.rbx.zip
```

Example: `half-adder-2026-02-01T15-30-00.rbx.zip`

### Container Structure (ZIP)

```
project.json              // Canonical LabProjectV1 (REQUIRED)
manifest.json             // Integrity manifest (REQUIRED)
capsule.json              // Capsule index with hashes (REQUIRED)
actions.log.json          // Action log (OPTIONAL but recommended)
README.md                 // Human-readable summary (AUTO-GENERATED)

assets/
  thumbnail.png           // Project thumbnail (OPTIONAL)
  circuit-preview.svg     // Circuit diagram (OPTIONAL)

recordings/
  run-001.json            // Deterministic run recording (OPTIONAL)
  run-002.json
  ...

proofs/
  proof-pack.json         // Proof pack / integrity data (OPTIONAL)

boards/
  default-mapping.json    // Board config + pin mapping (OPTIONAL)
  basys3-mapping.json     // Alternative board configs
  ...

waves/
  default-probes.json     // Probe/wave configuration (OPTIONAL)
```

### Mandatory Files

1. **project.json** — `LabProjectV1`
   - schemaVersion: "1.0"
   - Full circuit, simulation, board mapping
   - Evidence (actions + snapshots)
   - Lab spec (if applicable)

2. **manifest.json** — `EvidenceManifest`
   - buildVersion (commit SHA if available)
   - createdAt, updatedAt
   - File list with SHA-256 hashes
   - Root hash (integrity verification)

3. **capsule.json** — `CapsuleIndex`
   - Quick index for fast loading
   - File paths and hashes
   - Metadata (student, lab ID, etc.)

### Optional But Recommended

- **actions.log.json** — Full action history for replay
- **recordings/** — Deterministic run recordings (for verification)
- **README.md** — Auto-generated human-readable summary

---

## Versioning & Compatibility

### Schema Version

```typescript
project.json → schemaVersion: "1.0"
```

### Migration Strategy

```typescript
// Future: migrateProject(input: unknown): LabProjectV1
// - Detect version
// - Apply migrations
// - Warn if version is newer than supported
```

### Forward Compatibility

If importing a project with `schemaVersion > "1.0"`:
- Show warning modal: "This project was created with a newer version"
- Attempt best-effort load
- Disable export (to prevent downgrade corruption)

---

## Determinism Requirements

### Simulation Determinism

- Tick-based (integer ticks only, no floating point)
- No hidden randomness (all inputs explicit)
- Same circuit + same inputs = same outputs

### Reproducibility Test

When importing a project with recordings:
1. Load circuit
2. Replay recording actions
3. Compare outputs at each tick
4. Report: `PASS` or `FAIL` with diff

### Cross-Machine Guarantee

If `Project A` exports on Machine 1:
- Import on Machine 2 MUST reproduce identical behavior
- Same circuit state at same tick
- Same waveforms
- Same board IO state

---

## Next Steps (Implementation Phases)

1. **Phase 1**: Standardize export format
   - Migrate all export code to use `rb-lab-engine/exportService`
   - Ensure all apps use LabProjectV1
   - Add README.md auto-generation

2. **Phase 2**: Unified ProjectStore
   - Create Zustand store for "current project"
   - Wire Logic Playground, Lab, Virtual Lab to read from store
   - Implement adapters: `toLogicPlaygroundModel`, `toLab2DModel`, `toVirtualLabModel`

3. **Phase 3**: Cross-App Fidelity
   - Shared IO mapping (2D panel + 3D board)
   - Edit in one app → reflect in all apps
   - Single export button (works from any app)

4. **Phase 4**: Examples System
   - Create `/examples/` folder with bundled projects
   - Add "Open Example" UI
   - Ship with 5–7 core examples (half adder, counter, etc.)

5. **Phase 5**: Verification Commands
   - `Project: Verify Reproducibility`
   - `Project: Export`
   - `Project: Import`
   - `Project: Summary`

---

## Design Invariants

1. **LabProjectV1 is canonical** — Apps render from it, not the other way around
2. **Exports are portable** — No machine-specific paths or dependencies
3. **Determinism is mandatory** — Same inputs = same outputs
4. **Integrity is cryptographic** — SHA-256 for all files
5. **Schema is versioned** — Forward/backward compatibility planned
6. **Examples ship with repo** — No external dependencies

---

## Success Criteria

### The "Lab-Ready" Test

On Machine A:
1. Open example "4-bit counter"
2. Toggle switches in 2D IO panel
3. See same state in 3D Virtual Lab
4. Run simulation and record
5. Export `counter.rbx.zip`

On Machine B:
1. Import `counter.rbx.zip`
2. Project opens correctly
3. Run verification: `PASS`
4. 2D IO and 3D board behave identically
5. Waveforms match exported config

If all steps pass → RedByte is lab-ready.

---

## References

- LabProjectV1 schema: `packages/rb-utils/src/labProjectSchema.ts`
- Export service: `packages/rb-lab-engine/src/services/exportService.ts`
- Legacy export: `packages/rb-apps/src/utils/evidenceExport.ts` (deprecate)
- Proof pack: `packages/rb-apps/src/apps/LogicPlaygroundApp.tsx` (integrate)
