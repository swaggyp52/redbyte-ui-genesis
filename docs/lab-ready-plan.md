# RedByte Lab-Ready Implementation Plan

Copyright © 2025 Connor Angiel — RedByte OS Genesis

## Progress Summary

### ✅ Phase 0: Recon & Documentation (COMPLETE)

**Created:**
- [docs/project-format.md](project-format.md) — Complete spec for portable project format
- Analyzed existing export/import infrastructure
- Documented current state and gaps

**Findings:**
- LabProjectV1 schema exists and is comprehensive
- Export/import with cryptographic verification exists
- Evidence capsule system is functional
- Missing: cross-app fidelity, examples system, reproducibility verification

---

### ✅ Phase 1: Portable Project Container (COMPLETE)

**Created:**
- `packages/rb-lab-engine/src/services/readmeGenerator.ts` — Auto-generate README.md for exports
- Enhanced `exportService.ts` to include README in capsules

**Format:**
- `*.rbx.zip` (or `*.rb-lab.zip`)
- Contains: project.json, actions.log.json, manifest.json, capsule.json, README.md
- Deterministic serialization (stable key sorting + SHA-256)
- Full integrity verification on import

---

### ✅ Phase 2: Unified ProjectStore (COMPLETE)

**Created:**
- `packages/rb-lab-engine/src/stores/unifiedProjectStore.ts` — Single source of truth
- `packages/rb-lab-engine/src/adapters/projectAdapters.ts` — Transform project to app-specific models
- Exported from `rb-lab-engine/src/index.ts`

**Design:**
- `currentProject: LabProjectV1 | null` — Canonical state
- Apps render FROM project (not the other way around)
- Adapters:
  - `toLogicPlaygroundModel()` / `fromLogicPlaygroundEdits()`
  - `toLab2DModel()` / `fromLab2DEdits()`
  - `toVirtualLab3DModel()` / `fromVirtualLab3DEdits()`

---

## Phase 3: Cross-Representation Fidelity (IN PROGRESS)

### Objective
Ensure that editing in one app reflects in all apps seamlessly.
Prove that "software = hardware = logic" by showing identical behavior across views.

### Tasks

#### 3.1 Shared IO Mapping Contract

**Create:**
- `packages/rb-lab-engine/src/types/ioMapping.ts`
  ```typescript
  export interface RbIoMapping {
    boardProfileId: string; // "basys3", "generic", etc.
    signalToPinMap: Record<string, string>; // signal → pin
    direction: Record<string, 'input' | 'output'>;
    constraints?: {
      pullUps?: string[];
      debounce?: Record<string, number>;
      clockPin?: string;
    };
  }
  ```

- Already exists in LabProjectV1 as `boardMap`, but needs to be standardized across apps

#### 3.2 Universal IO Panel (2D Lab)

**Update:**
- `packages/rb-apps/src/apps/LabApp.tsx` (or similar)
- Add "Board IO View" component that:
  - Shows switches/buttons mapped to circuit inputs
  - Shows LEDs mapped to circuit outputs
  - Works in pure simulation mode (no hardware required)
  - Uses `boardMap` from unified project store

**Implementation:**
- Read from `useUnifiedProjectStore().currentProject.boardMap`
- Toggle switch → dispatch action → update project → circuit reacts
- Circuit output changes → LED updates

#### 3.3 Virtual Lab 3D Sync

**Update:**
- `packages/rb-apps/src/apps/VirtualLabApp.tsx` (or similar)
- Consume same `boardMap` from unified store
- 3D board shows same mapped IO as 2D panel
- Toggling 3D switch → updates unified store → 2D panel reflects change

**Acceptance Criteria:**
- [ ] Toggle switch in 2D IO → 3D board updates
- [ ] Toggle switch in 3D board → 2D IO updates
- [ ] Circuit output → both 2D LED and 3D LED light up
- [ ] No duplication of state (single source: unified store)

---

## Phase 4: Examples System (NOT STARTED)

### Objective
Ship 5–7 example projects as portable `.rbx.zip` files, with UI to open them.

### Tasks

#### 4.1 Create Examples Folder

**Create:**
- `/examples/` at repo root
- Each example is an exported `.rbx.zip` checked into repo

**Examples to create:**
1. **Half Adder** (`examples/01-half-adder.rbx.zip`)
   - 2 XOR + 1 AND gate
   - Inputs: A, B; Outputs: Sum, Carry
   - Probes configured
   - Board mapping: 2 switches → A/B, 2 LEDs → Sum/Carry

2. **Full Adder** (`examples/02-full-adder.rbx.zip`)
   - 2 half adders + OR gate
   - Inputs: A, B, Cin; Outputs: Sum, Cout

3. **2-bit ALU Slice** (`examples/03-2bit-alu.rbx.zip`)
   - AND, OR, ADD operations with mux
   - 2-bit inputs, 1 control bit, 2-bit output

4. **D Flip-Flop** (`examples/04-d-flip-flop.rbx.zip`)
   - D latch with clock
   - Debounced button for clock input
   - Shows sequential logic

5. **4-bit Counter** (`examples/05-4bit-counter.rbx.zip`)
   - Clock, reset
   - 4 LEDs showing count
   - Demonstrates state

6. **7-Segment Decoder** (`examples/06-7seg-decoder.rbx.zip`)
   - 4-bit BCD input
   - 7 outputs (LED pattern)
   - Mock display (could be 7 LEDs)

7. **UART TX Concept** (`examples/07-uart-tx-concept.rbx.zip`)
   - Bit-bang transmission in logic
   - Timeline/probe view showing bit timing
   - Purely simulated (no actual serial)

#### 4.2 Example Builder Script

**Create:**
- `scripts/build-examples.ts` (or `.js`)
- Automates building example projects from definitions
- Exports each to `/examples/`

**Usage:**
```bash
pnpm run build:examples
```

#### 4.3 Examples Registry

**Create:**
- `packages/rb-lab-engine/src/examples/examplesRegistry.ts`
  ```typescript
  export interface ExampleMetadata {
    id: string;
    name: string;
    description: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    topics: string[];
    filePath: string; // relative to /examples/
  }

  export const EXAMPLES_REGISTRY: ExampleMetadata[] = [
    {
      id: 'half-adder',
      name: 'Half Adder',
      description: 'Learn binary addition with XOR and AND gates',
      difficulty: 'beginner',
      topics: ['gates', 'combinational'],
      filePath: '01-half-adder.rbx.zip',
    },
    // ... more examples
  ];
  ```

#### 4.4 UI Integration (Home Dashboard)

**Update:**
- Home/Dashboard app (or create new "Examples Browser" app)
- Show example cards with:
  - Name, description, difficulty badge
  - Thumbnail (auto-generated from circuit?)
  - "Open" button

**Implementation:**
```typescript
const handleOpenExample = async (exampleId: string) => {
  const example = EXAMPLES_REGISTRY.find(e => e.id === exampleId);
  if (!example) return;

  // Fetch example file from /examples/
  const response = await fetch(`/examples/${example.filePath}`);
  const blob = await response.blob();

  // Import into unified store
  const { project } = await importEvidenceCapsule(blob);
  useUnifiedProjectStore.getState().loadProject(project);

  // Open Logic Playground or Lab app
  // (depends on your app opening logic)
};
```

**Acceptance Criteria:**
- [ ] Home shows example cards
- [ ] Click "Open" → loads example into unified store
- [ ] Example opens in appropriate app (Logic Playground, Lab, or Virtual Lab)
- [ ] User can immediately interact with example
- [ ] "Save As" allows user to save modified example as new project

---

## Phase 5: Lab-Ready Ergonomics & Verification (NOT STARTED)

### Objective
Add UI/UX features that make RedByte ready for classroom/lab use.

### Tasks

#### 5.1 One-Click Export/Import

**Add to Evidence Bar (or Toolbar):**
- **Export Project** button
  - Calls `exportEvidenceCapsule(currentProject)`
  - Downloads `<project-name>-<timestamp>.rbx.zip`
- **Import Project** button
  - Opens file picker
  - Calls `importEvidenceCapsule(blob)`
  - Loads into unified store
  - Shows integrity status (verified/modified)

#### 5.2 Reproducibility Verification Command

**Create:**
- `packages/rb-lab-engine/src/verification/verifyReproducibility.ts`
  ```typescript
  export interface ReproducibilityResult {
    status: 'pass' | 'fail';
    checks: {
      schemaValid: boolean;
      recordingReplayOk: boolean;
      proofVerified: boolean;
      ioMappingValid: boolean;
    };
    errors: string[];
  }

  export async function verifyReproducibility(
    project: LabProjectV1
  ): Promise<ReproducibilityResult> {
    // 1. Validate schema
    // 2. Replay recordings (if present)
    // 3. Verify proof pack (if present)
    // 4. Check IO mapping sanity
    // 5. Return pass/fail
  }
  ```

**UI:**
- Add command: `Project: Verify Reproducibility`
- Shows modal with pass/fail report
- Lists any mismatches or errors

#### 5.3 Project Summary Panel

**Create:**
- Modal or side panel showing:
  - Project name, ID, version
  - Circuit stats (nodes, connections, chips)
  - Last recording (if any)
  - Proof status (verified/modified/none)
  - Mapped IO count
  - Export hash
  - Example vs. user project indicator

**Trigger:**
- Command: `Project: Show Summary`
- Or button in Evidence Bar

#### 5.4 Auto-Save & Dirty State

**Update unified store:**
- Track `isDirty` flag
- Auto-save to browser localStorage every 5 seconds (optional)
- Show "*" in title bar if dirty
- Warn on close if unsaved

---

## Implementation Order (Copilot Tasks)

### Immediate (Phase 3):
1. Wire Logic Playground to use `unifiedProjectStore`
2. Wire Lab app to use `unifiedProjectStore`
3. Wire Virtual Lab to use `unifiedProjectStore`
4. Implement shared IO panel in 2D Lab
5. Sync 3D Virtual Lab board with unified IO state
6. Test cross-app fidelity (toggle switch in one → see in all)

### Next (Phase 4):
7. Create 5–7 example projects manually
8. Export each as `.rbx.zip` to `/examples/`
9. Create `examplesRegistry.ts`
10. Add "Open Example" UI to Home/Dashboard
11. Test: open example → works in all apps

### Final (Phase 5):
12. Add Export/Import buttons to UI
13. Implement `verifyReproducibility()` function
14. Add "Verify Reproducibility" command
15. Add "Project Summary" panel
16. Test: export on machine A → import on machine B → verify → pass

---

## Testing Plan

### Manual Test: "Lab-Ready" Test

**Machine A:**
1. Open RedByte
2. Click "Open Example" → "4-bit Counter"
3. Example loads in Logic Playground
4. Open Virtual Lab → see same circuit in 3D
5. Toggle switch in 2D IO → 3D board updates
6. Toggle switch in 3D board → 2D IO updates
7. Run simulation and record
8. Export project → `counter.rbx.zip`

**Machine B:**
1. Open RedByte
2. Click "Import Project" → select `counter.rbx.zip`
3. Project opens correctly
4. Run "Verify Reproducibility" → **PASS**
5. Toggle switches → same behavior as Machine A
6. Waveforms match exported config

**Success criteria:** All steps pass, no errors, identical behavior.

---

## Design Invariants (DO NOT BREAK)

1. **LabProjectV1 is canonical** — Apps render from it, not the other way around
2. **Exports are portable** — No machine-specific paths or dependencies
3. **Determinism is mandatory** — Same inputs = same outputs
4. **Integrity is cryptographic** — SHA-256 for all files
5. **Schema is versioned** — Forward/backward compatibility planned
6. **Examples ship with repo** — No external dependencies

---

## File Structure Summary

```
/examples/
  01-half-adder.rbx.zip
  02-full-adder.rbx.zip
  03-2bit-alu.rbx.zip
  04-d-flip-flop.rbx.zip
  05-4bit-counter.rbx.zip
  06-7seg-decoder.rbx.zip
  07-uart-tx-concept.rbx.zip

/packages/rb-lab-engine/src/
  stores/
    unifiedProjectStore.ts          [DONE]
    labEngineStore.ts                [EXISTS]
  adapters/
    projectAdapters.ts               [DONE]
    circuitAdapter.ts                [EXISTS]
  services/
    exportService.ts                 [ENHANCED]
    readmeGenerator.ts               [DONE]
  verification/
    verifyReproducibility.ts         [TODO]
    verifyCheckpoint.ts              [EXISTS]
  examples/
    examplesRegistry.ts              [TODO]

/packages/rb-apps/src/apps/
  LogicPlaygroundApp.tsx             [TODO: wire to unified store]
  LabApp.tsx                         [TODO: wire to unified store]
  VirtualLabApp.tsx                  [TODO: wire to unified store]

/docs/
  project-format.md                  [DONE]
  lab-ready-plan.md                  [THIS FILE]
```

---

## Next Steps for Copilot

**Priority 1 (Now):**
- [ ] Create examples: half-adder, full-adder, counter, flip-flop
- [ ] Export as `.rbx.zip` to `/examples/`
- [ ] Create `examplesRegistry.ts`
- [ ] Add "Open Example" UI

**Priority 2 (Next session):**
- [ ] Wire Logic Playground to unified store
- [ ] Wire Lab/Virtual Lab to unified store
- [ ] Test cross-app fidelity

**Priority 3 (Polish):**
- [ ] Add export/import buttons
- [ ] Add "Verify Reproducibility" command
- [ ] Add "Project Summary" panel
- [ ] Write end-to-end test

---

## Questions / Decisions Needed

1. **Where is the Home/Dashboard app?**
   - Need to know where to add "Open Example" UI

2. **How do apps currently open?**
   - Need to understand app launching to open correct app for example

3. **Board profiles:**
   - Should we create a "generic" board profile for examples?
   - Or use Basys3 as default?

4. **Example thumbnails:**
   - Auto-generate from circuit SVG?
   - Or manually create PNG files?

5. **Auto-save:**
   - Should projects auto-save to localStorage?
   - Or only manual save?

---

## Completion Checklist

- [x] Phase 0: Recon & Documentation
- [x] Phase 1: Portable Project Container
- [x] Phase 2: Unified ProjectStore
- [ ] Phase 3: Cross-Representation Fidelity
- [ ] Phase 4: Examples System
- [ ] Phase 5: Lab-Ready Ergonomics
- [ ] Manual "Lab-Ready" Test (Machine A → Machine B)

**Status:** ~40% complete. Core infrastructure done. App integration and examples next.
