# RedByte Lab-Ready System: Implementation Handoff

**Date:** February 1, 2026  
**Status:** Core infrastructure complete, examples and integration in progress  
**Goal:** Portable, reproducible projects across Logic Playground, 2D Lab, and 3D Virtual Lab

---

## What's Been Done

### ✅ Phase 0: Project Canon Defined

- **Project format specification** documented in `docs/project-format.md`
- Canonical `RbProjectV1` TypeScript type defined
- Container structure standardized (`.rbx.zip` format)
- Versioning system established (schema v1.0)

### ✅ Phase 1: Portable Project Container (80% Complete)

**Implemented:**
- `packages/app-lab-electron/src/project/projectTypes.ts` - Complete type definitions
- `packages/app-lab-electron/src/project/projectSerialize.ts` - Serialization logic
- `packages/app-lab-electron/src/project/projectZip.ts` - Zip read/write utilities
- `packages/app-lab-electron/src/project/projectMigrations.ts` - Version migration scaffolding
- Enhanced export service with README generation
- Export produces complete portable containers

**File structure implemented:**
```
project.json          ✅ Canonical source of truth
assets/              ✅ Thumbnails, images
circuits/*.json      ✅ Circuit definitions
recordings/*.json    ✅ Deterministic recordings
proof/*.json         ✅ Proof pack integrity
boards/*.json        ✅ 3D board config + pin mapping
README.md           ✅ Auto-generated human-readable summary
manifest.json       ✅ Quick index with checksums
```

**Still needed:**
- Wire up Import command in UI
- Add file picker integration
- Add "Open Example" command in Home dashboard

### ✅ Phase 2: Unified State (Infrastructure Ready)

**Implemented:**
- `packages/app-lab-electron/src/project/projectStore.ts` - Zustand store for unified state
- `packages/app-lab-electron/src/project/projectAdapters.ts` - Transform functions for each app
- Store architecture supports multiple views reading from same project

**Adapters available:**
- `toLogicPlaygroundModel()` - Transform project → circuit editor model
- `toLab2DModel()` - Transform project → 2D lab view model  
- `toVirtualLabModel()` - Transform project → 3D board view model
- Reverse adapters: `fromLogicPlaygroundEdits()`, etc.

**Still needed:**
- Wire adapters into each app's render pipeline
- Replace per-app state slices with ProjectStore consumers
- Test cross-app synchronization

### ⏳ Phase 3: Cross-Representation Fidelity (Partially Done)

**Existing infrastructure:**
- IO mapping exists in evidence system (`ioMapping` in project type)
- Board configuration type defined (`boardConfig`)
- 3D Virtual Lab already renders boards

**Still needed:**
- Create universal "Board IO View" panel in 2D Lab
- Wire up IO mapping to both 2D panel and 3D board
- Ensure toggle in one view updates the other instantly
- Add switch/button/LED components to unified IO panel

### ⏳ Phase 4: Examples System (Not Started)

**Prepared:**
- `/examples/` folder structure ready
- `projectExamples.ts` registry skeleton created
- Example builder utilities available

**Examples to create (minimum viable set):**
1. ❌ Half Adder (gate-level)
2. ❌ Full Adder  
3. ❌ 2-bit ALU slice (AND/OR/ADD + mux)
4. ❌ D Flip-Flop + debounced button clock
5. ❌ 4-bit counter (clock, reset)
6. ❌ Seven-segment driver or LED pattern
7. ❌ UART TX concept demo (bit-bang simulation)

**Each example must include:**
- Circuit definition (JSON)
- Recommended probes/wave setup
- IO mapping for 2D + 3D board
- At least one deterministic recording + proof
- Auto-generated README with concept explanation

**Still needed:**
- Build each example circuit
- Generate proof packs for each
- Export as `.rbx.zip` files
- Place in `/examples/` folder
- Add to examples registry with metadata

### ⏳ Phase 5: Lab-Ready Ergonomics (Not Started)

**Still needed:**
- Add "Export Project" button in Evidence Bar
- Add "Import Project" button with file picker
- Implement "Project: Verify Reproducibility" command
- Create "Project Summary" modal/panel
- Add "Open Example" UI in Home dashboard
- Wire up "Save As Project" for examples

---

## Priority Implementation Order

### 🔴 Critical Path (Do First)

**1. Complete Import/Export UI Integration (2-4 hours)**
```
Tasks:
- Add "Export Project" button to Evidence Bar
- Add "Import Project" file picker to Home/File menu
- Wire up import to ProjectStore.loadProject()
- Test round-trip: export → import on same machine
- Test cross-machine: export on A → import on B
```

**2. Wire ProjectStore to Existing Apps (4-6 hours)**
```
Tasks:
- Update Logic Playground to read from ProjectStore
- Update Lab to read from ProjectStore  
- Update Virtual Lab to read from ProjectStore
- Remove duplicate state management
- Test: edit in one app → see in others without export/import
```

**3. Create Universal IO Panel (3-5 hours)**
```
Tasks:
- Design "Board IO View" component for 2D Lab
- Show switches/buttons (inputs)
- Show LEDs/outputs (outputs)
- Wire to project.ioMapping
- Ensure changes reflect in Virtual Lab 3D board
- Test: toggle switch in 2D → LED lights in 3D
```

### 🟡 High Priority (Do Next)

**4. Build Example Projects (6-8 hours)**
```
Tasks:
- Create half_adder.rbx.zip
- Create full_adder.rbx.zip
- Create alu_2bit.rbx.zip
- Create dff_debounce.rbx.zip
- Create counter_4bit.rbx.zip
- Create led_pattern.rbx.zip
- Create uart_tx_concept.rbx.zip
- Place all in /examples/ folder
- Update projectExamples.ts registry
```

**5. Examples UI Integration (2-3 hours)**
```
Tasks:
- Add "Open Example" to Home dashboard
- Display example cards with thumbnails
- Load example into ProjectStore on click
- Add "Save As Project" immediately after loading
- Test: user can open example and see circuit + IO + 3D
```

### 🟢 Medium Priority (Polish)

**6. Reproducibility Check System (3-4 hours)**
```
Tasks:
- Implement "Project: Verify Reproducibility" command
- Run schema validation
- Replay recording verification
- Proof pack verification
- IO mapping sanity check
- Show pass/fail report modal
```

**7. Project Summary Panel (2-3 hours)**
```
Tasks:
- Create "Project Summary" component
- Show: circuits count, chips count, last recording
- Show: proof status, mapped IO count
- Show: export hash, example vs user project
- Add to sidebar or modal
```

---

## Technical Constraints (Remember These)

- **Strict determinism:** No hidden randomness anywhere
- **Performance:** Memoize adapters, use shallow store selectors
- **UI consistency:** Follow existing neon design language
- **Backward compatibility:** Don't break existing evidence/proof workflows
- **Version migration:** Support loading older project formats

---

## Acceptance Test (Non-Negotiable)

**Machine A:**
1. Open Example "4-bit counter"
2. Toggle switches in 2D IO panel
3. See same state reflected in 3D Virtual Lab board
4. Run simulation recording
5. Export `counter.rbx.zip`

**Machine B:**
1. Import `counter.rbx.zip`
2. Project opens correctly
3. Run "Verify Reproducibility" → passes
4. 2D IO and 3D board behave identically
5. Waveform/probe config appears as saved
6. Can replay recording with same results

**If this works, RedByte is lab-ready.**

---

## Code Locations Reference

### Project System Core
- `packages/app-lab-electron/src/project/` - All project infrastructure
- `packages/app-lab-electron/src/services/exportService.ts` - Export with README generation
- `packages/app-lab-electron/src/state/labEngineStore.ts` - Existing lab state (integrate with ProjectStore)

### App Entry Points
- Logic Playground: `packages/app-lab-electron/src/components/logic/` (needs ProjectStore integration)
- 2D Lab: `packages/app-lab-electron/src/components/lab/` (needs IO panel)
- Virtual Lab: `packages/app-lab-electron/src/components/lab3d/` (already has board, needs ProjectStore)

### Evidence System (Existing)
- `packages/app-lab-electron/src/evidence/` - Proof packs, recordings, verification
- Don't break this—wrap it into project container

### Examples
- `/examples/` - Place exported `.rbx.zip` files here
- `packages/app-lab-electron/src/project/projectExamples.ts` - Registry

---

## Next Immediate Actions (For You, GitHub Copilot Agent)

1. **Read `AI_STATE.md`** at repo root (as instructed in AGENTS.md)
2. **Read `docs/ai-usage-rules.md`** for contribution rules
3. **Start with Critical Path Item #1:** Export/Import UI integration
4. **Test each phase** before moving to next
5. **Update `AI_STATE.md` Change Log** for each meaningful change
6. **Keep commits small and logical** (terminal-first workflow)

---

## Questions to Clarify (Before Starting)

1. **Import UI placement:** Should "Import Project" be in File menu, Home dashboard, or both?
2. **Example complexity:** Start with simple examples (half adder) or jump to feature-complete (4-bit counter)?
3. **Testing strategy:** Unit tests, integration tests, or manual acceptance test only?
4. **3D board model:** Which board should examples target? (Basys3, generic, multiple?)

---

## Success Metrics

- ✅ Export/import round-trips successfully
- ✅ Cross-machine import works identically
- ✅ All three views (Logic, 2D Lab, 3D Lab) show same project
- ✅ IO mapping works in both 2D and 3D
- ✅ At least 5 working examples shipped
- ✅ Reproducibility verification passes
- ✅ User can build custom project and export it

---

## Philosophy Reminder

> **"Software, hardware, firmware, circuits—it's all the same. It's all just logic."**

RedByte proves this by letting users:
- Build in one representation
- See it in all others
- Export and reproduce anywhere
- Understand deeply through multiple perspectives

Your job is to make that vision concrete and usable in a real lab environment.

---

**You have terminal access, full repo context, and clear acceptance criteria. Go build it.** 🚀
